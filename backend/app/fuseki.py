"""Cliente SPARQL/GSP para Apache Jena Fuseki (com backend em memória para testes)."""

from __future__ import annotations

from typing import Any, Dict, List, Protocol
import urllib.parse

import httpx
from rdflib import Dataset

from app.config import settings

GRAPH_ONTOLOGY = "urn:graph:ontology"
GRAPH_EXTERNAL = "urn:graph:external"
GRAPH_DATA = "urn:graph:data"


class GraphBackend(Protocol):
    def select(self, sparql: str) -> List[Dict[str, Dict[str, str]]]: ...
    def update(self, sparql: str) -> None: ...
    def put_turtle(self, graph_uri: str, turtle_data: str) -> None: ...


class FusekiClient:
    """Cliente HTTP para o Apache Jena Fuseki (Query, Update e Graph Store Protocol)."""

    def __init__(
        self,
        base_url: str | None = None,
        dataset: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self.base_url = (base_url or settings.fuseki_url).rstrip("/")
        self.dataset = dataset or settings.fuseki_dataset
        self.username = username if username is not None else settings.fuseki_user
        self.password = password if password is not None else settings.fuseki_password
        self.query_url = f"{self.base_url}/{self.dataset}/sparql"
        self.update_url = f"{self.base_url}/{self.dataset}/update"
        self.data_url = f"{self.base_url}/{self.dataset}/data"

    @property
    def _auth(self) -> tuple[str, str] | None:
        if self.username and self.password:
            return (self.username, self.password)
        return None

    def ping(self) -> bool:
        try:
            resp = httpx.get(f"{self.base_url}/$/ping", timeout=3.0)
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    def select(self, sparql: str) -> List[Dict[str, Dict[str, str]]]:
        resp = httpx.post(
            self.query_url,
            data={"query": sparql},
            headers={"Accept": "application/sparql-results+json"},
            auth=self._auth,
            timeout=30.0,
        )
        resp.raise_for_status()
        payload = resp.json()
        return payload.get("results", {}).get("bindings", [])

    def update(self, sparql: str) -> None:
        resp = httpx.post(
            self.update_url,
            data=sparql.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update; charset=utf-8"},
            auth=self._auth,
            timeout=30.0,
        )
        resp.raise_for_status()

    def put_turtle(self, graph_uri: str, turtle_data: str) -> None:
        encoded = urllib.parse.urlencode({"graph": graph_uri})
        resp = httpx.put(
            f"{self.data_url}?{encoded}",
            content=turtle_data.encode("utf-8"),
            headers={"Content-Type": "text/turtle; charset=utf-8"},
            auth=self._auth,
            timeout=60.0,
        )
        resp.raise_for_status()


class InMemoryRdflibBackend:
    """Backend SPARQL em memória com union default graph (usado em testes automatizados)."""

    def __init__(self) -> None:
        self.dataset = Dataset(default_union=True)

    def select(self, sparql: str) -> List[Dict[str, Dict[str, str]]]:
        qres = self.dataset.query(sparql)
        bindings: List[Dict[str, Dict[str, str]]] = []
        vars_list = [str(v) for v in (qres.vars or [])]
        for row in qres:
            entry: Dict[str, Dict[str, str]] = {}
            for idx, var_name in enumerate(vars_list):
                val = row[idx]
                if val is None:
                    continue
                entry[var_name] = {"value": str(val)}
            bindings.append(entry)
        return bindings

    def update(self, sparql: str) -> None:
        self.dataset.update(sparql)

    def put_turtle(self, graph_uri: str, turtle_data: str) -> None:
        g = self.dataset.graph(graph_uri)
        g.remove((None, None, None))
        g.parse(data=turtle_data, format="turtle")


_default_client: GraphBackend | None = None


def get_graph_backend() -> GraphBackend:
    global _default_client
    if _default_client is None:
        _default_client = FusekiClient()
    return _default_client


def set_graph_backend(backend: GraphBackend) -> None:
    global _default_client
    _default_client = backend
