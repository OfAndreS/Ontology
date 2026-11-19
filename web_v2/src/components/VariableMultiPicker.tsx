import { useMemo, useState } from "react";
import { Check, Plus, Search, ShieldAlert, X } from "lucide-react";
import type { VariableRecord } from "@/lib/api";

interface VariableMultiPickerProps {
  variables: VariableRecord[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  placeholder?: string;
  actionLabel?: string;
}

/** Seletor no padrão da busca Schema.org: chips acima e resultados exibidos ao digitar. */
export function VariableMultiPicker({
  variables,
  selectedIds,
  onChange,
  placeholder = "Pesquisar variáveis...",
  actionLabel = "Selecionar",
}: VariableMultiPickerProps) {
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return variables
      .filter((v) => `${v.id} ${v.label}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [variables, search]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const v = byId.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {v?.sensivel && (
                  <ShieldAlert className="h-3 w-3 shrink-0 text-[oklch(0.45_0.16_30)]" />
                )}
                <span>{v?.label ?? id}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded-full p-0.5 opacity-70 hover:opacity-100"
                  aria-label={`Remover ${v?.label ?? id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {search.trim() !== "" &&
        (filtered.length > 0 ? (
          <div className="max-h-56 divide-y divide-rule overflow-y-auto rounded-lg border border-rule bg-background">
            {filtered.map((v) => {
              const selected = selectedIds.includes(v.id);
              return (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{v.label}</span>
                      {v.sensivel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.94_0.08_30)] px-2 py-0.5 text-[0.65rem] font-semibold text-[oklch(0.40_0.15_30)]">
                          <ShieldAlert className="h-3 w-3" /> Sensível
                        </span>
                      )}
                    </div>
                    {v.riscos[0]?.descricao && (
                      <p className="truncate text-muted-foreground">{v.riscos[0].descricao}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(v.id)}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "border border-rule bg-surface-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check className="h-3 w-3" /> Vinculada
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" /> {actionLabel}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma variável encontrada para "{search}".
          </p>
        ))}
    </div>
  );
}
