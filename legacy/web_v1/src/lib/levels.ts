export type GovernanceId =
  | "Governanca_Baixa"
  | "Governanca_Media"
  | "Governanca_Alta"
  | "Governanca_Maxima"
  | "Governanca_Veto";

export const GOVERNANCE_SHORT: Record<string, string> = {
  Governanca_Baixa: "Baixa",
  Governanca_Media: "Média",
  Governanca_Alta: "Alta",
  Governanca_Maxima: "Máxima",
  Governanca_Veto: "Veto",
};

export const GOVERNANCE_BADGE: Record<string, string> = {
  Governanca_Baixa: "bg-[oklch(0.95_0.05_140)] text-[oklch(0.32_0.12_140)]",
  Governanca_Media: "bg-[oklch(0.95_0.07_80)] text-[oklch(0.35_0.13_70)]",
  Governanca_Alta: "bg-[oklch(0.94_0.08_45)] text-[oklch(0.42_0.16_40)]",
  Governanca_Maxima: "bg-[oklch(0.94_0.08_30)] text-[oklch(0.40_0.15_30)]",
  Governanca_Veto: "bg-[oklch(0.92_0.10_25)] text-[oklch(0.38_0.20_25)] border border-[oklch(0.84_0.12_25)]",
};

export function governanceBadgeClass(govId?: string | null): string {
  if (!govId) return "bg-surface-muted text-muted-foreground";
  return GOVERNANCE_BADGE[govId] ?? "bg-surface-muted text-muted-foreground";
}

export function governanceShortLabel(govId?: string | null): string {
  if (!govId) return "—";
  return GOVERNANCE_SHORT[govId] ?? govId;
}

export function statusBadgeClass(statusId?: string | null): string {
  if (statusId === "Status_Auditada") {
    return "bg-[oklch(0.95_0.05_140)] text-[oklch(0.32_0.12_140)]";
  }
  return "bg-[oklch(0.95_0.07_80)] text-[oklch(0.35_0.13_70)]";
}
