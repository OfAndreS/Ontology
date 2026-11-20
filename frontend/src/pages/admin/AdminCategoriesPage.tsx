import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, type CategoryRecord } from "@/lib/api";

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<CategoryRecord | null>(null);

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api.updateCategory(editing.id, { label: label.trim(), description: description.trim() })
        : api.createCategory({ label: label.trim(), description: description.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["variables"] });
      toast.success(editing ? "Categoria atualizada." : "Categoria criada.");
      setLabel("");
      setDescription("");
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar categoria."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria removida.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir categoria."),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    saveMut.mutate();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-rule bg-surface p-5 lg:col-span-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            {editing ? `Editar: ${editing.label}` : "Nova Categoria Temática"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setLabel("");
                setDescription("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Nome *</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Risco Climático / ESG"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Descrição</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          disabled={saveMut.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {editing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editing ? "Salvar Categoria" : "Criar Categoria"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-rule bg-surface lg:col-span-8">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-rule bg-surface-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Variáveis</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {(catsQ.data ?? []).map((cat) => (
              <tr key={cat.id} className="hover:bg-background/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{cat.label}</p>
                  {cat.description && (
                    <p className="mt-0.5 text-muted-foreground">{cat.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{cat.variable_count}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(cat);
                        setLabel(cat.label);
                        setDescription(cat.description);
                      }}
                      className="rounded border border-rule p-1.5 hover:bg-surface-muted"
                      title="Editar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Excluir categoria "${cat.label}"?`)) {
                          deleteMut.mutate(cat.id);
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
