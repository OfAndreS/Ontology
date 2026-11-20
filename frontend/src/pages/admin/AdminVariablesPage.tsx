import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { riskBadgeClass, riskShortLabel } from "@/lib/levels";

export function AdminVariablesPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteVariable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variables"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Variável removida.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover variável."),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = varsQ.data ?? [];
    if (!q) return list;
    return list.filter((v) =>
      `${v.label} ${v.id} ${v.categoria_label ?? ""}`.toLowerCase().includes(q),
    );
  }, [varsQ.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar variáveis..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Link
          to="/variables/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nova Variável
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-rule bg-surface-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Variável</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Risco Máximo</th>
              <th className="px-4 py-3 font-semibold">Riscos</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-background/60">
                <td className="px-4 py-3">
                  <Link
                    to={`/variables/${encodeURIComponent(v.id)}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {v.label}
                  </Link>
                  <p className="font-mono text-[0.7rem] text-muted-foreground">{v.id}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {v.categoria_label ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${riskBadgeClass(
                      v.nivel_risco_maximo,
                    )}`}
                  >
                    {riskShortLabel(v.nivel_risco_maximo)}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{v.riscos.length}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/variables/${encodeURIComponent(v.id)}/edit`}
                      className="rounded border border-rule p-1.5 hover:bg-surface-muted"
                      title="Editar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Excluir variável "${v.label}"?`)) {
                          deleteMut.mutate(v.id);
                        }
                      }}
                      className="rounded border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
