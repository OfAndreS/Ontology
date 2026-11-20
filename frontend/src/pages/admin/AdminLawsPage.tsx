import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, FileText, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function AdminLawsPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const lawsQ = useQuery({ queryKey: ["laws"], queryFn: api.getLaws });

  const deleteMut = useMutation({
    mutationFn: (slug: string) => api.deleteLaw(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laws"] });
      queryClient.invalidateQueries({ queryKey: ["vocabularies"] });
      toast.success("Norma excluída.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir norma."),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = lawsQ.data ?? [];
    if (!q) return list;
    return list.filter((l) => `${l.label} ${l.tipo_instrumento}`.toLowerCase().includes(q));
  }, [lawsQ.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar normas..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Link
          to="/laws/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nova Norma
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-rule bg-surface-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Norma</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Dispositivos</th>
              <th className="px-4 py-3 font-semibold">PDF</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {filtered.map((law) => (
              <tr key={law.id} className="hover:bg-background/60">
                <td className="px-4 py-3">
                  <Link
                    to={`/laws/${encodeURIComponent(law.slug)}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {law.label}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{law.tipo_instrumento}</td>
                <td className="px-4 py-3 font-mono">{law.dispositivos.length}</td>
                <td className="px-4 py-3">
                  {law.pdf_name ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <FileText className="h-3.5 w-3.5" /> Anexado
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/laws/${encodeURIComponent(law.slug)}/edit`}
                      className="rounded border border-rule p-1.5 hover:bg-surface-muted"
                      title="Editar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Excluir norma "${law.label}"?`)) {
                          deleteMut.mutate(law.slug);
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
