export type RiskLevelId =
  | "Risco_Baixo"
  | "Risco_Medio"
  | "Risco_Alto"
  | "Risco_Maximo"
  | "Risco_Veto";

export const RISK_SHORT: Record<string, string> = {
  Risco_Baixo: "Baixo",
  Risco_Medio: "Médio",
  Risco_Alto: "Alto",
  Risco_Maximo: "Máximo",
  Risco_Veto: "Veto",
};

export const RISK_BADGE: Record<string, string> = {
  Risco_Baixo: "bg-[oklch(0.95_0.05_140)] text-[oklch(0.32_0.12_140)]",
  Risco_Medio: "bg-[oklch(0.95_0.07_80)] text-[oklch(0.35_0.13_70)]",
  Risco_Alto: "bg-[oklch(0.94_0.08_45)] text-[oklch(0.42_0.16_40)]",
  Risco_Maximo: "bg-[oklch(0.94_0.08_30)] text-[oklch(0.40_0.15_30)]",
  Risco_Veto:
    "bg-[oklch(0.92_0.10_25)] text-[oklch(0.38_0.20_25)] border border-[oklch(0.84_0.12_25)]",
};

export function riskBadgeClass(riskId?: string | null): string {
  if (!riskId) return "bg-surface-muted text-muted-foreground";
  return RISK_BADGE[riskId] ?? "bg-surface-muted text-muted-foreground";
}

export function riskShortLabel(riskId?: string | null): string {
  if (!riskId) return "Não avaliado";
  return RISK_SHORT[riskId] ?? riskId;
}

export function statusBadgeClass(statusId?: string | null): string {
  if (statusId === "Status_Auditada") {
    return "bg-[oklch(0.95_0.05_140)] text-[oklch(0.32_0.12_140)]";
  }
  return "bg-[oklch(0.95_0.07_80)] text-[oklch(0.35_0.13_70)]";
}
