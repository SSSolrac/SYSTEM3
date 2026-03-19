export type TierRule = {
  tier_label: string;
  min_points: number;
  is_active?: boolean;
};

export const DEFAULT_TIER_RULES: TierRule[] = [
  { tier_label: "Gold", min_points: 750 },
  { tier_label: "Silver", min_points: 250 },
  { tier_label: "Bronze", min_points: 0 },
];

const ALLOWED_TIERS = ["Bronze", "Silver", "Gold"] as const;
export type SupportedTier = (typeof ALLOWED_TIERS)[number];

export function normalizeTierLabel(value: string | null | undefined): SupportedTier {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "silver") return "Silver";
  if (raw === "gold") return "Gold";
  return "Bronze";
}

export function normalizeTierRules(rules: TierRule[] | null | undefined): TierRule[] {
  const source = rules && rules.length > 0 ? rules : DEFAULT_TIER_RULES;
  const filtered = source.filter((r) => {
    const raw = String(r.tier_label || "").trim().toLowerCase();
    return raw === "bronze" || raw === "silver" || raw === "gold";
  });
  const hasBronze = filtered.some((r) => r.tier_label.toLowerCase() === "bronze");
  const withBronze = hasBronze ? [...filtered] : [...filtered, { tier_label: "Bronze", min_points: 0 }];

  return withBronze
    .map((r) => {
      const tierLabel = normalizeTierLabel(r.tier_label);
      // Bronze is the base tier and must always start at 0.
      const minPoints = tierLabel === "Bronze" ? 0 : Math.max(0, Number(r.min_points) || 0);
      return { tier_label: tierLabel, min_points: minPoints };
    })
    .sort((a, b) => b.min_points - a.min_points);
}

export function calculatePurchasePoints(amount: number): number {
  // SQUAD3 logic: 1 point per $1, floored.
  return Math.floor(Math.max(0, amount) * 1);
}

export function resolveTier(points: number, rules: TierRule[] | null | undefined): string {
  const normalized = normalizeTierRules(rules);
  for (const rule of normalized) {
    if (points >= rule.min_points) return normalizeTierLabel(rule.tier_label);
  }
  return "Bronze";
}

export function monthKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
