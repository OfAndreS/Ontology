import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, FileText, Plus, Scale, Search } from "lucide-react";
import { api } from "@/lib/api";

export function LawsPage() {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");

  const lawsQ = useQuery({ queryKey: ["laws"], queryFn: api.getLaws });
  const laws = lawsQ.data ?? [];

  const tipos = useMemo(
    () => Array.from(new Set(laws.map((l) => l.tipo_instrumento))).sort(),
    [laws],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return laws.filter((l) => {
      if (tipoFilter !== "all" && l.tipo_instrumento !== tipoFilter) return false;
      if (!q) return true;
      return `${l.label} ${l.descricao} ${l.tipo_instrumento} ${l.dispositivos
        .map((d) => d.label)
        .join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [laws, search, tipoFilter]);

  return (
    <div className="min-h-full">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Scale className="h-4 w-4" />
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
                  Arcabouço Regulatório
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold">Normas, Leis e Dispositivos</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Instrumentos normativos, artigos/incisos citáveis, links oficiais e documentos PDF de referência vinculados às variáveis.
              </p>
            </div>
            <Link
              to="/laws/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> Cadastrar norma
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar norma, lei, resolução ou dispositivo..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="all">Todos os tipos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {lawsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando normas...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-rule bg-surface p-10 text-center text-sm text-muted-foreground">
            Nenhuma norma encontrada.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((law) => (
              <Link
                key={law.id}
                to={`/laws/${encodeURIComponent(law.slug)}`}
                className="group flex flex-col justify-between rounded-xl border border-rule bg-surface p-5 shadow-xs transition-all hover:border-primary/60 hover:shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="feature-chip">{law.tipo_instrumento}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {law.pdf_name && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          <FileText className="h-3 w-3" /> PDF
                        </span>
                      )}
                      {law.url_fonte && (
                        <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5">
                          <ExternalLink className="h-3 w-3" /> URL
                        </span>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-foreground group-hover:text-primary">
                    {law.label}
                  </h2>
                  {law.descricao && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {law.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-xs text-muted-foreground">
                  <span>
                    {law.dispositivos.length} dispositivo(s) · {law.linked_variables.length} variável(is)
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Ver norma <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
