import type { EarningRule } from "../../lib/loyalty-supabase";
import {
  normalizeTierLabel,
  resolveTier,
  type SupportedTier,
  type TierRule,
} from "../../lib/loyalty-engine";
import type { LoyaltyTransaction, Member } from "../types";

export type AnalyticsTierFilter = "all" | SupportedTier;

export type AnalyticsMemberRow = {
  rank: number;
  memberId: string;
  fullName: string;
  tier: SupportedTier;
  totalPoints: number;
  conversionRate: number;
  ltv: number;
  projectedLtv: number;
  monthsActive: number;
  averageMonthlyPoints: number;
  lastActivityDate: string | null;
};

export type AnalyticsOverview = {
  totalMembers: number;
  totalLtv: number;
  averageLtv: number;
  projectedLtv: number;
};

export type AnalyticsTrendPoint = {
  label: string;
  averageLtv: number;
  projectedLtv: number;
  totalLtv: number;
  memberCount: number;
};

export type AnalyticsTierSegment = {
  tier: SupportedTier;
  value: number;
  members: number;
  color: string;
};

export type AnalyticsTierRow = {
  tier: SupportedTier;
  memberCount: number;
  totalLtv: number;
  averageLtv: number;
  projectedLtv: number;
};

export type AnalyticsDataset = {
  overview: AnalyticsOverview;
  trend: AnalyticsTrendPoint[];
  tierSegmentation: AnalyticsTierSegment[];
  tierAnalysis: AnalyticsTierRow[];
  topMembers: AnalyticsMemberRow[];
  filteredMembers: AnalyticsMemberRow[];
  tierFilter: AnalyticsTierFilter;
};

type MemberSnapshot = Omit<AnalyticsMemberRow, "rank">;

const TIER_ORDER: SupportedTier[] = ["Bronze", "Silver", "Gold"];

const TIER_COLORS: Record<SupportedTier, string> = {
  Bronze: "#f97316",
  Silver: "#94a3b8",
  Gold: "#facc15",
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function monthsBetweenInclusive(start: Date, end: Date) {
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

function memberKey(member: Member) {
  return String(member.id ?? member.member_id ?? member.member_number ?? "");
}

function txMemberKey(transaction: LoyaltyTransaction) {
  return String(transaction.member_id ?? "");
}

function classifyTransaction(transactionType: string, points: number): "earned" | "redeemed" | "ignored" {
  const raw = String(transactionType || "").trim().toUpperCase();
  if (raw === "EXPIRY_DEDUCTION" || raw === "EXPIRED") return "ignored";
  if (raw.includes("REDEEM")) return "redeemed";
  if (raw === "PURCHASE" || raw === "EARN" || raw === "MANUAL_AWARD" || raw === "WELCOME_PACKAGE") return "earned";
  if (points > 0) return "earned";
  if (points < 0) return "redeemed";
  return "ignored";
}

function buildTierMultiplierMap(earningRules: EarningRule[]) {
  const map = new Map<SupportedTier, number>();
  for (const tier of TIER_ORDER) {
    const rule = earningRules.find((entry) => normalizeTierLabel(entry.tier_label) === tier);
    map.set(tier, Math.max(0.01, Number(rule?.multiplier ?? 1)));
  }
  return map;
}

function computeConversionRatePercent(input: {
  tier: SupportedTier;
  earnedPoints: number;
  redeemedPoints: number;
  monthsActive: number;
  engagedMonths: number;
  redemptionValuePerPoint: number;
  tierMultipliers: Map<SupportedTier, number>;
}) {
  const baseRate = Math.max(0, Number(input.redemptionValuePerPoint || 0.01) * 100);
  const tierMultiplier = input.tierMultipliers.get(input.tier) ?? 1;
  const engagementRatio = input.monthsActive > 0 ? clamp(input.engagedMonths / input.monthsActive, 0, 1) : 0;
  const redemptionRatio =
    input.earnedPoints > 0 ? clamp(input.redeemedPoints / input.earnedPoints, 0, 1) : 0;

  return Number(clamp(baseRate * tierMultiplier * (1 + engagementRatio + redemptionRatio), 1, 5).toFixed(2));
}

function buildMemberSnapshot(input: {
  member: Member;
  transactions: LoyaltyTransaction[];
  tierRules: TierRule[];
  tierMultipliers: Map<SupportedTier, number>;
  redemptionValuePerPoint: number;
  snapshotEnd: Date;
}): MemberSnapshot | null {
  const { member, tierRules, tierMultipliers, redemptionValuePerPoint, snapshotEnd } = input;
  const enrollmentDate = parseDate(member.enrollment_date);
  if (!enrollmentDate || enrollmentDate.getTime() > snapshotEnd.getTime()) return null;

  const tier = normalizeTierLabel(resolveTier(Number(member.points_balance || 0), tierRules));
  const scopedTransactions = input.transactions
    .filter((transaction) => {
      const txDate = parseDate(transaction.transaction_date);
      return txDate ? txDate.getTime() <= snapshotEnd.getTime() : false;
    })
    .sort((left, right) => {
      const leftDate = parseDate(left.transaction_date)?.getTime() ?? 0;
      const rightDate = parseDate(right.transaction_date)?.getTime() ?? 0;
      return leftDate - rightDate;
    });

  let earnedPoints = 0;
  let redeemedPoints = 0;
  let lastActivityDate: string | null = null;
  const engagedMonths = new Set<string>();

  for (const transaction of scopedTransactions) {
    const txDate = parseDate(transaction.transaction_date);
    if (!txDate) continue;

    engagedMonths.add(monthKey(txDate));
    lastActivityDate = txDate.toISOString();

    const points = Number(transaction.points || 0);
    const txClass = classifyTransaction(transaction.transaction_type, points);
    if (txClass === "earned" && points > 0) {
      earnedPoints += points;
    } else if (txClass === "redeemed" && points < 0) {
      redeemedPoints += Math.abs(points);
    }
  }

  const monthsActive = monthsBetweenInclusive(enrollmentDate, snapshotEnd);
  const averageMonthlyPoints = monthsActive > 0 ? earnedPoints / monthsActive : 0;
  const conversionRate = computeConversionRatePercent({
    tier,
    earnedPoints,
    redeemedPoints,
    monthsActive,
    engagedMonths: engagedMonths.size,
    redemptionValuePerPoint,
    tierMultipliers,
  });
  const ltv = toMoney(earnedPoints * (conversionRate / 100));
  const projectedLtv = toMoney(ltv + averageMonthlyPoints * 12 * (conversionRate / 100));

  return {
    memberId: String(member.member_number || member.member_id || member.id || "N/A"),
    fullName: `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown Member",
    tier,
    totalPoints: earnedPoints,
    conversionRate,
    ltv,
    projectedLtv,
    monthsActive,
    averageMonthlyPoints: toMoney(averageMonthlyPoints),
    lastActivityDate,
  };
}

function buildTrend(input: {
  members: Member[];
  transactionsByMember: Map<string, LoyaltyTransaction[]>;
  tierRules: TierRule[];
  tierMultipliers: Map<SupportedTier, number>;
  redemptionValuePerPoint: number;
  tierFilter: AnalyticsTierFilter;
}) {
  const now = new Date();
  const points: AnalyticsTrendPoint[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = endOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    const monthMembers = input.members
      .map((member) =>
        buildMemberSnapshot({
          member,
          transactions: input.transactionsByMember.get(memberKey(member)) || [],
          tierRules: input.tierRules,
          tierMultipliers: input.tierMultipliers,
          redemptionValuePerPoint: input.redemptionValuePerPoint,
          snapshotEnd: date,
        })
      )
      .filter((row): row is MemberSnapshot => Boolean(row))
      .filter((row) => (input.tierFilter === "all" ? true : row.tier === input.tierFilter));

    const totalLtv = monthMembers.reduce((sum, row) => sum + row.ltv, 0);
    const totalProjected = monthMembers.reduce((sum, row) => sum + row.projectedLtv, 0);
    const count = monthMembers.length;

    points.push({
      label: monthLabel(date),
      averageLtv: count > 0 ? toMoney(totalLtv / count) : 0,
      projectedLtv: count > 0 ? toMoney(totalProjected / count) : 0,
      totalLtv: toMoney(totalLtv),
      memberCount: count,
    });
  }

  return points;
}

export function buildAnalyticsDataset(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  tierRules: TierRule[];
  earningRules: EarningRule[];
  redemptionValuePerPoint: number;
  tierFilter: AnalyticsTierFilter;
}): AnalyticsDataset {
  const transactionsByMember = new Map<string, LoyaltyTransaction[]>();
  for (const transaction of input.transactions) {
    const key = txMemberKey(transaction);
    const bucket = transactionsByMember.get(key) || [];
    bucket.push(transaction);
    transactionsByMember.set(key, bucket);
  }

  const tierMultipliers = buildTierMultiplierMap(input.earningRules);
  const now = new Date();

  const allMembers = input.members
    .map((member) =>
      buildMemberSnapshot({
        member,
        transactions: transactionsByMember.get(memberKey(member)) || [],
        tierRules: input.tierRules,
        tierMultipliers,
        redemptionValuePerPoint: input.redemptionValuePerPoint,
        snapshotEnd: now,
      })
    )
    .filter((row): row is MemberSnapshot => Boolean(row));

  const filteredMembers = allMembers
    .filter((row) => (input.tierFilter === "all" ? true : row.tier === input.tierFilter))
    .sort((left, right) => {
      if (right.ltv !== left.ltv) return right.ltv - left.ltv;
      if (right.projectedLtv !== left.projectedLtv) return right.projectedLtv - left.projectedLtv;
      return right.totalPoints - left.totalPoints;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const totalLtv = filteredMembers.reduce((sum, row) => sum + row.ltv, 0);
  const totalProjected = filteredMembers.reduce((sum, row) => sum + row.projectedLtv, 0);

  const tiersToShow = input.tierFilter === "all" ? TIER_ORDER : [input.tierFilter];
  const tierAnalysis = tiersToShow.map((tier) => {
    const rows = filteredMembers.filter((member) => member.tier === tier);
    const tierTotalLtv = rows.reduce((sum, row) => sum + row.ltv, 0);
    const tierProjected = rows.reduce((sum, row) => sum + row.projectedLtv, 0);

    return {
      tier,
      memberCount: rows.length,
      totalLtv: toMoney(tierTotalLtv),
      averageLtv: rows.length > 0 ? toMoney(tierTotalLtv / rows.length) : 0,
      projectedLtv: rows.length > 0 ? toMoney(tierProjected / rows.length) : 0,
    };
  });

  const tierSegmentation = tierAnalysis.map((row) => ({
    tier: row.tier,
    value: row.totalLtv,
    members: row.memberCount,
    color: TIER_COLORS[row.tier],
  }));

  return {
    overview: {
      totalMembers: filteredMembers.length,
      totalLtv: toMoney(totalLtv),
      averageLtv: filteredMembers.length > 0 ? toMoney(totalLtv / filteredMembers.length) : 0,
      projectedLtv: filteredMembers.length > 0 ? toMoney(totalProjected / filteredMembers.length) : 0,
    },
    trend: buildTrend({
      members: input.members,
      transactionsByMember,
      tierRules: input.tierRules,
      tierMultipliers,
      redemptionValuePerPoint: input.redemptionValuePerPoint,
      tierFilter: input.tierFilter,
    }),
    tierSegmentation,
    tierAnalysis,
    topMembers: filteredMembers.slice(0, 100),
    filteredMembers,
    tierFilter: input.tierFilter,
  };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function workbookCell(value: string | number) {
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`;
}

function workbookRow(values: Array<string | number>) {
  return `<Row>${values.map(workbookCell).join("")}</Row>`;
}

export function buildAnalyticsWorkbook(dataset: AnalyticsDataset) {
  const rows: Array<Array<string | number>> = [
    ["CentralPerk Analytics Report"],
    ["Tier Filter", dataset.tierFilter === "all" ? "All Tiers" : dataset.tierFilter],
    [],
    ["Summary"],
    ["Total Members", dataset.overview.totalMembers],
    ["Total LTV", dataset.overview.totalLtv],
    ["Average LTV", dataset.overview.averageLtv],
    ["Projected LTV", dataset.overview.projectedLtv],
    [],
    ["Tier Analysis"],
    ["Tier", "Member Count", "Total LTV", "Average LTV", "Projected LTV"],
    ...dataset.tierAnalysis.map((row) => [
      row.tier,
      row.memberCount,
      row.totalLtv,
      row.averageLtv,
      row.projectedLtv,
    ]),
    [],
    ["LTV Trend"],
    ["Month", "Average LTV", "Projected LTV", "Total LTV", "Member Count"],
    ...dataset.trend.map((row) => [
      row.label,
      row.averageLtv,
      row.projectedLtv,
      row.totalLtv,
      row.memberCount,
    ]),
    [],
    ["Top Members"],
    ["Rank", "Member ID", "Tier", "Total Points", "Conversion Rate", "LTV", "Projected LTV", "Months Active"],
    ...dataset.topMembers.map((row) => [
      row.rank,
      row.memberId,
      row.tier,
      row.totalPoints,
      row.conversionRate,
      row.ltv,
      row.projectedLtv,
      row.monthsActive,
    ]),
  ];

  const xmlRows = rows.map(workbookRow).join("");

  return `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Analytics">
        <Table>${xmlRows}</Table>
      </Worksheet>
    </Workbook>`;
}
