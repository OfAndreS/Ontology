import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, PlusCircle, Search, X } from "lucide-react";
import { api } from "@/lib/api";

export function ConceptsPage() {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState("Todos");

  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: api.getConcepts });
  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });

  const concepts = conceptsQ.data ?? [];
  const variables = varsQ.data ?? [];

  const usageMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label: string }>>();
    for (const v of variables) {
      for (const curie of [...v.conceitosEquivalentes, ...v.conceitosBaseados]) {
        const list = map.get(curie) ?? [];
        list.push({ id: v.id, label: v.label });
        map.set(curie, list);
      }
    }
    return map;
  }, [variables]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter((c) => {
      if (tipo !== "Todos" && c.tipo !== tipo) return false;
      if (q) {
        const hay = `${c.curie} ${c.label} ${c.comment} ${c.contexto}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [concepts, query, tipo]);

  if (conceptsQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold">
            Conceitos de Referência (Schema.org)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Índice pré-processado e uniforme de classes, propriedades e enumerações do{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
              schemaorg.ttl
            </code>{" "}
            para fundamentar o cadastro antecipado de variáveis jurídicas (UC-01 / UC-03).
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-lg border border-rule bg-background px-4 py-2.5 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conceito (ex.: MonetaryAmount, birthDate, LoanOrCredit)…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {["Todos", "Classe", "Propriedade", "Enumeração"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                    tipo === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-rule bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-4 text-xs text-muted-foreground">
          Exibindo <strong>{filtered.length}</strong> de {concepts.length} conceitos extraídos.
        </p>

        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface">
          {filtered.map((c) => {
            const linked = usageMap.get(c.curie) ?? [];
            return (
              <li key={c.curie} className="px-5 py-4 transition-colors hover:bg-surface-muted/60">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-surface-muted px-2 py-0.5 font-mono text-sm font-semibold text-foreground">
                        {c.curie}
                      </code>
                      <span className="feature-chip">{c.tipo}</span>
                      <a
                        href={c.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {c.uri} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {c.comment || "Sem definição textual no vocabulário."}
                    </p>

                    {c.contexto && (
                      <p className="font-mono text-xs text-muted-foreground">{c.contexto}</p>
                    )}

                    {linked.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span className="text-muted-foreground">Variáveis vinculadas:</span>
                        {linked.map((v) => (
                          <Link
                            key={v.id}
                            to={`/variables/${encodeURIComponent(v.id)}`}
                            className="rounded border border-rule bg-surface-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground hover:border-primary"
                          >
                            {v.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/variables/new?concept=${encodeURIComponent(c.curie)}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Criar Variável
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
