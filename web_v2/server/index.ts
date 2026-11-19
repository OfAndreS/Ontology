import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { OntologyService, sanitizeIdentifier, type VariablePayload } from "./ontologyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

const service = new OntologyService();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/vocabularies", (_req, res) => {
  res.json(service.getVocabularies());
});

app.get("/api/ontology-overview", (_req, res) => {
  res.json(service.getOntologyOverview());
});

app.get("/api/concepts", (_req, res) => {
  res.json(service.listExternalConcepts());
});

app.get("/api/variables", (_req, res) => {
  res.json(service.listVariables());
});

app.get("/api/variables/:id", (req, res) => {
  const all = service.listVariables();
  const target = all.find((v) => v.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: "Variável não encontrada." });
    return;
  }
  const reverseProxies = all.filter((v) => v.proxyDe.includes(target.id)).map((v) => ({ id: v.id, label: v.label }));
  const derivedChildren = all.filter((v) => v.derivadaDe.includes(target.id)).map((v) => ({ id: v.id, label: v.label }));
  res.json({ ...target, reverseProxies, derivedChildren });
});

app.post("/api/variables", (req, res) => {
  const body = req.body as VariablePayload;
  if (!body?.label?.trim()) {
    res.status(400).json({ error: "Informe o nome da variável." });
    return;
  }
  const targetId = body.id?.trim() ? sanitizeIdentifier(body.id) : sanitizeIdentifier(body.label);
  const exists = service.listVariables().some((v) => v.id === targetId);
  if (exists) {
    res.status(409).json({ error: `Já existe uma variável com ID "${targetId}".` });
    return;
  }
  try {
    const saved = service.saveCustomVariable(targetId, body);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Erro ao salvar variável." });
  }
});

app.put("/api/variables/:id", (req, res) => {
  const targetId = req.params.id;
  const exists = service.listVariables().some((v) => v.id === targetId);
  if (!exists) {
    res.status(404).json({ error: `Variável "${targetId}" não encontrada.` });
    return;
  }
  const body = req.body as VariablePayload;
  if (!body?.label?.trim()) {
    res.status(400).json({ error: "Informe o nome da variável." });
    return;
  }
  try {
    const saved = service.saveCustomVariable(targetId, body);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Erro ao atualizar variável." });
  }
});

app.post("/api/reload", (_req, res) => {
  service.reload();
  res.json({ ok: true, count: service.listVariables().length });
});

app.post("/api/report", (req, res) => {
  const { variableIds = [], modelName = "" } = req.body as {
    variableIds?: string[];
    modelName?: string;
  };
  res.json(service.buildMarkdownReport(variableIds, modelName));
});

// Serve build de produção (vite build) quando existir
const distDir = path.resolve(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`MyOnt V2 Node API listening on http://localhost:${PORT}`);
});
