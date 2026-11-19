import { useMemo, useState } from "react";
import { Search, ShieldAlert, X } from "lucide-react";
import type { VariableRecord } from "@/lib/api";

interface VariableMultiPickerProps {
  title: string;
  variables: VariableRecord[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  placeholder?: string;
}

/** Seletor de múltiplas variáveis com chips removíveis e busca rápida. */
export function VariableMultiPicker({
  title,
  variables,
  selectedIds,
  onChange,
  placeholder = "Filtrar variáveis...",
}: VariableMultiPickerProps) {
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => `${v.id} ${v.label}`.toLowerCase().includes(q));
  }, [variables, search]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {selectedIds.length > 0 && (
          <span className="font-mono text-[0.7rem] text-muted-foreground">
            {selectedIds.length} selecionada{selectedIds.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const v = byId.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
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

      <div className="overflow-hidden rounded-lg border border-rule bg-background">
        <div className="flex items-center gap-2 border-b border-rule px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Limpar filtro"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="max-h-40 space-y-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Nenhuma variável encontrada.
            </p>
          ) : (
            filtered.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(v.id)}
                  onChange={() => toggle(v.id)}
                  className="accent-[var(--primary)]"
                />
                <span className="flex-1 truncate text-foreground">{v.label}</span>
                {v.sensivel && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[0.65rem] font-medium text-[oklch(0.45_0.16_30)]"
                    title="Variável sensível / protegida"
                  >
                    <ShieldAlert className="h-3 w-3" /> Sensível
                  </span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
