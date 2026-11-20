import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { LegalBaseVocabItem } from "@/lib/api";

interface LegalBasePickerProps {
  options: LegalBaseVocabItem[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  placeholder?: string;
  chipTone?: "auth" | "risk";
}

export function LegalBasePicker({
  options,
  selectedIds,
  onChange,
  placeholder = "+ Adicionar norma ou dispositivo...",
  chipTone = "auth",
}: LegalBasePickerProps) {
  const [selectValue, setSelectValue] = useState("");

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const grouped = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const instruments = options.filter((o) => o.kind === "InstrumentoNormativo");
    const devicesByInst = new Map<string, LegalBaseVocabItem[]>();

    for (const item of options) {
      if (item.kind === "DispositivoLegal" && item.instrumento_id) {
        const list = devicesByInst.get(item.instrumento_id) ?? [];
        list.push(item);
        devicesByInst.set(item.instrumento_id, list);
      }
    }

    const groups: Array<{ label: string; items: LegalBaseVocabItem[] }> = [];
    for (const inst of instruments) {
      const items: LegalBaseVocabItem[] = [];
      if (!selectedSet.has(inst.id)) items.push(inst);
      for (const dev of devicesByInst.get(inst.id) ?? []) {
        if (!selectedSet.has(dev.id)) items.push(dev);
      }
      if (items.length > 0) {
        groups.push({ label: inst.label, items });
      }
    }

    const orphanDevices = options.filter(
      (o) => o.kind === "DispositivoLegal" && !o.instrumento_id && !selectedSet.has(o.id),
    );
    if (orphanDevices.length > 0) {
      groups.push({ label: "Outros Dispositivos", items: orphanDevices });
    }

    return groups;
  }, [options, selectedIds]);

  const handleAdd = (id: string) => {
    if (!id) return;
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
    setSelectValue("");
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const chipClass =
    chipTone === "risk"
      ? "border-[oklch(0.85_0.10_30)] bg-[oklch(0.96_0.03_30)] text-[oklch(0.36_0.15_30)]"
      : "border-primary/40 bg-primary/10 text-foreground";

  return (
    <div className="space-y-2.5">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const item = byId.get(id);
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chipClass}`}
              >
                <span>{item?.label ?? id}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  className="rounded-full p-0.5 opacity-70 hover:opacity-100"
                  aria-label={`Remover ${item?.label ?? id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative flex items-center">
        <Plus className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={selectValue}
          onChange={(e) => handleAdd(e.target.value)}
          disabled={grouped.length === 0}
          className="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-xs outline-none focus:border-primary disabled:opacity-50"
        >
          <option value="">
            {grouped.length === 0 ? "Todas as normas já foram vinculadas" : placeholder}
          </option>
          {grouped.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kind === "InstrumentoNormativo"
                    ? `${item.label} (Instrumento completo)`
                    : item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
