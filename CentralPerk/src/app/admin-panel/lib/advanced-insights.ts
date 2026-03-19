import {
  normalizeTierLabel,
  resolveTier,
  type SupportedTier,
  type TierRule,
} from "../../lib/loyalty-engine";
import type {
  LoyaltyTransaction,
  Member,
  MemberLoginActivity,
  PointsLot,
  ReengagementAction,
  RewardCatalogRow,
} from "../types";

const TIER_ORDER: SupportedTier[] = ["Bronze", "Silver", "Gold"];

type TransactionClass = "earned" | "redeemed" | "expired" | "ignored";

export type ChurnRiskLevel = "Low" | "Medium" | "High";
export type EngagementLevel = "Low" | "Medium" | "High";
export type EngagementDriver = "Transactions" | "Points Earned" | "Redemptions" | "Logins";

export type ChurnMemberRow = {
  memberId: string;
  fullName: string;
  tier: SupportedTier;
  pointsBalance: number;
  lastActivityDate: string | null;
  daysInactive: number;
  recentTransactions: number;
  previousTransactions: number;
  declineRate: number;
  riskScore: number;
  riskLevel: ChurnRiskLevel;
  indicators: string[];
  recommendedAction: string;
  latestActionStatus: string;
  latestActionAt: string | null;
  reengagementSuccess: boolean;
};

export type ChurnSegmentRate = {
  segment: string;
  members: number;
  atRiskMembers: number;
  churnRate: number;
};

export type ChurnInsights = {
  overview: {
    totalMembers: number;
    atRiskMembers: number;
    highRiskMembers: number;
    mediumRiskMembers: number;
    dormantMembers: number;
    reengagementSuccessRate: number;
  };
  atRiskMembers: ChurnMemberRow[];
  segmentRates: ChurnSegmentRate[];
  reengagementSummary: {
    totalActions: number;
    successfulActions: number;
    pendingActions: number;
    successRate: number;
  };
};

export type BreakageTierRow = {
  tier: SupportedTier;
  earnedPoints: number;
  expiredPoints: number;
  breakageRate: number;
  expiredValue: number;
};

export type BreakageTrendPoint = {
  month: string;
  actualPoints: number;
  actualValue: number;
  projectedPoints: number;
  projectedValue: number;
};

export type BreakageForecastPoint = {
  month: string;
  expiringPoints: number;
  projectedBreakagePoints: number;
  projectedBreakageValue: number;
};

export type BreakageFinancialImpactRow = {
  label: string;
  points: number;
  value: number;
};

export type BreakageInsights = {
  overview: {
    totalExpiredPoints: number;
    totalExpiredValue: number;
    breakageRate: number;
    openExpiringPoints: number;
    projectedFutureBreakagePoints: number;
    projectedFutureBreakageValue: number;
  };
  tierAnalysis: BreakageTierRow[];
  monthlyTrend: BreakageTrendPoint[];
  forecast: BreakageForecastPoint[];
  financialImpact: BreakageFinancialImpactRow[];
};

export type RewardEffectivenessRow = {
  rewardId: string;
  rewardName: string;
  category: string;
  pointsCost: number;
  redemptionCount: number;
  uniqueRedeemers: number;
  eligibleMembers: number;
  redemptionRate: number;
  averageDaysToRedeem: number;
  roi: number;
  estimatedCost: number;
  incrementalRevenue: number;
  recommendation: string;
};

export type RewardEffectivenessInsights = {
  overview: {
    totalRewards: number;
    totalRedemptions: number;
    averageRedemptionRate: number;
    totalEstimatedCost: number;
    totalIncrementalRevenue: number;
  };
  effectiveness: RewardEffectivenessRow[];
  mostPopular: RewardEffectivenessRow[];
  leastPopular: RewardEffectivenessRow[];
  recommendations: string[];
};

export type EngagementMemberRow = {
  memberId: string;
  fullName: string;
  tier: SupportedTier;
  score: number;
  level: EngagementLevel;
  scoreChange: number;
  transactionCount: number;
  pointsEarned: number;
  redemptionCount: number;
  loginCount: number;
  primaryDriver: EngagementDriver;
  lastActivityDate: string | null;
};

export type EngagementTrendPoint = {
  month: string;
  averageScore: number;
  highMembers: number;
  mediumMembers: number;
  lowMembers: number;
};

export type EngagementDriverSummary = {
  driver: EngagementDriver;
  members: number;
  averageContribution: number;
};

export type EngagementInsights = {
  overview: {
    averageScore: number;
    highMembers: number;
    mediumMembers: number;
    lowMembers: number;
  };
  members: EngagementMemberRow[];
  trend: EngagementTrendPoint[];
  drivers: EngagementDriverSummary[];
};

export type AdvancedAnalyticsDatasets = {
  churn: ChurnInsights;
  breakage: BreakageInsights;
  rewards: RewardEffectivenessInsights;
  engagement: EngagementInsights;
};

type MemberIndex = {
  key: string;
  memberId: string;
  fullName: string;
  tier: SupportedTier;
  pointsBalance: number;
};

type EngagementRawRow = {
  memberId: string;
  fullName: string;
  tier: SupportedTier;
  transactionCount: number;
  pointsEarned: number;
  redemptionCount: number;
  loginCount: number;
  lastActivityDate: string | null;
};

type ScoredEngagementRow = EngagementRawRow & {
  score: number;
  level: EngagementLevel;
  contributions: Record<EngagementDriver, number>;
  primaryDriver: EngagementDriver;
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundNumber(value: number, digits = 2) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function toMoney(value: number) {
  return roundNumber(value, 2);
}

function toPercent(value: number) {
  return roundNumber(value, 2);
}

function daysBetween(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24)));
}

function stringKey(value: unknown) {
  return String(value ?? "");
}

function memberKey(member: Member) {
  return stringKey(member.id ?? member.member_id ?? member.member_number);
}

function transactionMemberKey(transaction: LoyaltyTransaction) {
  return stringKey(transaction.member_id);
}

function pointsLotMemberKey(pointsLot: PointsLot) {
  return stringKey(pointsLot.member_id);
}

function loginMemberKey(activity: MemberLoginActivity) {
  return stringKey(activity.member_id);
}

function actionMemberKey(action: ReengagementAction) {
  return stringKey(action.member_id);
}

function rewardLabel(transaction: LoyaltyTransaction) {
  return String(transaction.reason ?? transaction.description ?? "").trim();
}

function classifyTransaction(transaction: LoyaltyTransaction): TransactionClass {
  const rawType = String(transaction.transaction_type || "").trim().toUpperCase();
  const points = Number(transaction.points || 0);
  if (rawType === "EXPIRY_DEDUCTION" || rawType === "EXPIRED") return "expired";
  if (rawType.includes("REDEEM") || rawType === "GIFT") return "redeemed";
  if (rawType === "PURCHASE" || rawType === "EARN" || rawType === "MANUAL_AWARD" || rawType === "WELCOME_PACKAGE") {
    return "earned";
  }
  if (points > 0) return "earned";
  if (points < 0) return "redeemed";
  return "ignored";
}

function currentTier(member: Member, tierRules: TierRule[]) {
  return normalizeTierLabel(resolveTier(Number(member.points_balance || 0), tierRules));
}

function transactionIdentity(transaction: LoyaltyTransaction) {
  return [
    stringKey(transaction.transaction_id),
    stringKey(transaction.transaction_date),
    stringKey(transaction.transaction_type),
    stringKey(transaction.points),
    rewardLabel(transaction),
  ].join("|");
}

function isPurchaseLike(transaction: LoyaltyTransaction) {
  return Number(transaction.amount_spent || 0) > 0;
}

function normalizeMemberIndex(members: Member[], tierRules: TierRule[]) {
  return members.map((member) => ({
    key: memberKey(member),
    memberId: String(member.member_number || member.member_id || member.id || "N/A"),
    fullName: `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown Member",
    tier: currentTier(member, tierRules),
    pointsBalance: Math.max(0, Number(member.points_balance || 0)),
  }));
}

function buildTransactionsByMember(transactions: LoyaltyTransaction[]) {
  const map = new Map<string, LoyaltyTransaction[]>();
  for (const transaction of transactions) {
    const key = transactionMemberKey(transaction);
    const bucket = map.get(key) || [];
    bucket.push(transaction);
    map.set(key, bucket);
  }
  for (const [key, rows] of map.entries()) {
    rows.sort((left, right) => {
      const leftDate = parseDate(left.transaction_date)?.getTime() ?? 0;
      const rightDate = parseDate(right.transaction_date)?.getTime() ?? 0;
      return leftDate - rightDate;
    });
    map.set(key, rows);
  }
  return map;
}

function buildLoginsByMember(loginActivity: MemberLoginActivity[]) {
  const map = new Map<string, MemberLoginActivity[]>();
  for (const entry of loginActivity) {
    const key = loginMemberKey(entry);
    const bucket = map.get(key) || [];
    bucket.push(entry);
    map.set(key, bucket);
  }
  for (const [key, rows] of map.entries()) {
    rows.sort((left, right) => {
      const leftDate = parseDate(left.login_at)?.getTime() ?? 0;
      const rightDate = parseDate(right.login_at)?.getTime() ?? 0;
      return leftDate - rightDate;
    });
    map.set(key, rows);
  }
  return map;
}

function buildActionsByMember(actions: ReengagementAction[]) {
  const map = new Map<string, ReengagementAction[]>();
  for (const action of actions) {
    const key = actionMemberKey(action);
    const bucket = map.get(key) || [];
    bucket.push(action);
    map.set(key, bucket);
  }
  for (const [key, rows] of map.entries()) {
    rows.sort((left, right) => {
      const leftDate = parseDate(left.created_at)?.getTime() ?? 0;
      const rightDate = parseDate(right.created_at)?.getTime() ?? 0;
      return rightDate - leftDate;
    });
    map.set(key, rows);
  }
  return map;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeChurnScore(input: {
  daysInactive: number;
  recentTransactions: number;
  previousTransactions: number;
  recentSpend: number;
  previousSpend: number;
  pointsBalance: number;
}) {
  let score = 0;
  const indicators: string[] = [];

  if (input.daysInactive >= 90) {
    score += 45;
    indicators.push("No activity for 90+ days");
  } else if (input.daysInactive >= 60) {
    score += 28;
    indicators.push("No activity for 60+ days");
  } else if (input.daysInactive >= 30) {
    score += 12;
  }

  const declineRate =
    input.previousTransactions > 0
      ? clamp((input.previousTransactions - input.recentTransactions) / input.previousTransactions, 0, 1)
      : input.recentTransactions === 0
      ? 1
      : 0;

  if (declineRate >= 0.5) {
    score += 25;
    indicators.push(`Transactions declined by ${Math.round(declineRate * 100)}%`);
  } else if (declineRate >= 0.25) {
    score += 15;
    indicators.push(`Transactions declined by ${Math.round(declineRate * 100)}%`);
  }

  if (input.previousSpend > 0 && input.recentSpend < input.previousSpend) {
    const spendDropRate = clamp((input.previousSpend - input.recentSpend) / input.previousSpend, 0, 1);
    if (spendDropRate >= 0.35) {
      score += 18;
      indicators.push("Spend dropped sharply in the latest 90 days");
    } else if (spendDropRate >= 0.15) {
      score += 8;
    }
  }

  if (input.recentTransactions === 0 && input.pointsBalance > 0) {
    score += 7;
    indicators.push("Has unused points but no recent activity");
  }

  const riskScore = Math.round(clamp(score, 0, 100));
  const riskLevel: ChurnRiskLevel = riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";

  return {
    riskScore,
    riskLevel,
    declineRate: toPercent(declineRate * 100),
    indicators,
  };
}

function recommendReengagementAction(input: {
  tier: SupportedTier;
  riskLevel: ChurnRiskLevel;
  daysInactive: number;
  pointsBalance: number;
}) {
  if (input.riskLevel === "High" && input.tier === "Gold") {
    return "Assign a VIP outreach call and offer a limited-time bonus multiplier.";
  }
  if (input.riskLevel === "High" && input.pointsBalance > 0) {
    return "Send an expiry reminder with a bonus redemption incentive within 7 days.";
  }
  if (input.riskLevel === "High") {
    return "Launch a win-back campaign with bonus points for the next purchase.";
  }
  if (input.riskLevel === "Medium" && input.daysInactive >= 60) {
    return "Send a targeted email and app message highlighting easy-to-redeem rewards.";
  }
  if (input.riskLevel === "Medium") {
    return "Offer a personalized reward bundle to restore transaction frequency.";
  }
  return "Keep in a nurture segment and monitor for further decline.";
}

function isReengagementSuccessful(action: ReengagementAction, transactions: LoyaltyTransaction[]) {
  if (action.success === true) return true;
  if (action.success === false) return false;
  if (action.status === "dismissed") return false;

  const startDate = parseDate(action.sent_at ?? action.created_at);
  if (!startDate) return false;
  const endDate = addDays(startDate, 30);

  return transactions.some((transaction) => {
    const txDate = parseDate(transaction.transaction_date);
    if (!txDate) return false;
    return txDate.getTime() >= startDate.getTime() && txDate.getTime() <= endDate.getTime();
  });
}

export function buildChurnInsights(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  reengagementActions: ReengagementAction[];
  tierRules: TierRule[];
}): ChurnInsights {
  const now = new Date();
  const transactionsByMember = buildTransactionsByMember(input.transactions);
  const actionsByMember = buildActionsByMember(input.reengagementActions);
  const members = normalizeMemberIndex(input.members, input.tierRules);

  const rows = members.map((member) => {
    const transactions = transactionsByMember.get(member.key) || [];
    const latestTransactionDate = transactions.length
      ? parseDate(transactions[transactions.length - 1]?.transaction_date)?.toISOString() ?? null
      : null;
    const lastActivity = parseDate(latestTransactionDate);
    const daysInactive = lastActivity ? daysBetween(now, lastActivity) : 999;

    const recentWindowStart = addDays(now, -90);
    const previousWindowStart = addDays(now, -180);

    const recentTransactions = transactions.filter((transaction) => {
      const txDate = parseDate(transaction.transaction_date);
      return txDate ? txDate.getTime() >= recentWindowStart.getTime() : false;
    });
    const previousTransactions = transactions.filter((transaction) => {
      const txDate = parseDate(transaction.transaction_date);
      return txDate
        ? txDate.getTime() >= previousWindowStart.getTime() && txDate.getTime() < recentWindowStart.getTime()
        : false;
    });

    const recentSpend = recentTransactions.reduce((sum, transaction) => sum + Number(transaction.amount_spent || 0), 0);
    const previousSpend = previousTransactions.reduce((sum, transaction) => sum + Number(transaction.amount_spent || 0), 0);
    const churnScore = computeChurnScore({
      daysInactive,
      recentTransactions: recentTransactions.length,
      previousTransactions: previousTransactions.length,
      recentSpend,
      previousSpend,
      pointsBalance: member.pointsBalance,
    });

    const relatedActions = actionsByMember.get(member.key) || [];
    const latestAction = relatedActions[0];

    return {
      memberId: member.memberId,
      fullName: member.fullName,
      tier: member.tier,
      pointsBalance: member.pointsBalance,
      lastActivityDate: latestTransactionDate,
      daysInactive,
      recentTransactions: recentTransactions.length,
      previousTransactions: previousTransactions.length,
      declineRate: churnScore.declineRate,
      riskScore: churnScore.riskScore,
      riskLevel: churnScore.riskLevel,
      indicators: churnScore.indicators,
      recommendedAction: recommendReengagementAction({
        tier: member.tier,
        riskLevel: churnScore.riskLevel,
        daysInactive,
        pointsBalance: member.pointsBalance,
      }),
      latestActionStatus: latestAction ? `${latestAction.action_type} (${latestAction.status})` : "No action logged",
      latestActionAt: latestAction?.sent_at ?? latestAction?.created_at ?? null,
      reengagementSuccess: relatedActions.some((action) => isReengagementSuccessful(action, transactions)),
    } satisfies ChurnMemberRow;
  });

  const atRiskMembers = rows
    .filter((row) => row.riskLevel !== "Low")
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) return right.riskScore - left.riskScore;
      return right.daysInactive - left.daysInactive;
    });

  const segmentRates = TIER_ORDER.map((tier) => {
    const tierRows = rows.filter((row) => row.tier === tier);
    const atRiskCount = tierRows.filter((row) => row.riskLevel !== "Low").length;
    return {
      segment: tier,
      members: tierRows.length,
      atRiskMembers: atRiskCount,
      churnRate: tierRows.length > 0 ? toPercent((atRiskCount / tierRows.length) * 100) : 0,
    } satisfies ChurnSegmentRate;
  });

  const successfulActions = input.reengagementActions.filter((action) =>
    isReengagementSuccessful(action, transactionsByMember.get(actionMemberKey(action)) || [])
  ).length;
  const pendingActions = input.reengagementActions.filter((action) => action.status === "planned" || action.status === "sent").length;

  return {
    overview: {
      totalMembers: rows.length,
      atRiskMembers: atRiskMembers.length,
      highRiskMembers: atRiskMembers.filter((row) => row.riskLevel === "High").length,
      mediumRiskMembers: atRiskMembers.filter((row) => row.riskLevel === "Medium").length,
      dormantMembers: rows.filter((row) => row.daysInactive >= 90).length,
      reengagementSuccessRate:
        input.reengagementActions.length > 0 ? toPercent((successfulActions / input.reengagementActions.length) * 100) : 0,
    },
    atRiskMembers,
    segmentRates,
    reengagementSummary: {
      totalActions: input.reengagementActions.length,
      successfulActions,
      pendingActions,
      successRate:
        input.reengagementActions.length > 0 ? toPercent((successfulActions / input.reengagementActions.length) * 100) : 0,
    },
  };
}

export function buildBreakageInsights(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  pointsLots: PointsLot[];
  tierRules: TierRule[];
  redemptionValuePerPoint: number;
}): BreakageInsights {
  const now = new Date();
  const memberIndex = normalizeMemberIndex(input.members, input.tierRules);
  const historicalRateBase = Math.max(Number(input.redemptionValuePerPoint || 0.01), 0.000001);

  const expiredTransactions = input.transactions.filter(
    (transaction) => classifyTransaction(transaction) === "expired" && Number(transaction.points || 0) < 0
  );
  const earnedTransactions = input.transactions.filter(
    (transaction) => classifyTransaction(transaction) === "earned" && Number(transaction.points || 0) > 0
  );

  const totalExpiredPoints = expiredTransactions.reduce((sum, transaction) => sum + Math.abs(Number(transaction.points || 0)), 0);
  const totalEarnedPoints = earnedTransactions.reduce((sum, transaction) => sum + Number(transaction.points || 0), 0);
  const breakageRatio = totalEarnedPoints > 0 ? clamp(totalExpiredPoints / totalEarnedPoints, 0, 1) : 0;

  const tierAnalysis = TIER_ORDER.map((tier) => {
    const tierMemberKeys = new Set(memberIndex.filter((member) => member.tier === tier).map((member) => member.key));
    const tierEarnedPoints = earnedTransactions
      .filter((transaction) => tierMemberKeys.has(transactionMemberKey(transaction)))
      .reduce((sum, transaction) => sum + Number(transaction.points || 0), 0);
    const tierExpiredPoints = expiredTransactions
      .filter((transaction) => tierMemberKeys.has(transactionMemberKey(transaction)))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.points || 0)), 0);

    return {
      tier,
      earnedPoints: tierEarnedPoints,
      expiredPoints: tierExpiredPoints,
      breakageRate: tierEarnedPoints > 0 ? toPercent((tierExpiredPoints / tierEarnedPoints) * 100) : 0,
      expiredValue: toMoney(tierExpiredPoints * historicalRateBase),
    } satisfies BreakageTierRow;
  });

  const monthlyTrend: BreakageTrendPoint[] = [];
  const actualPointsByMonth = new Map<string, number>();
  for (const transaction of expiredTransactions) {
    const txDate = parseDate(transaction.transaction_date);
    if (!txDate) continue;
    const key = monthKey(txDate);
    actualPointsByMonth.set(key, (actualPointsByMonth.get(key) || 0) + Math.abs(Number(transaction.points || 0)));
  }

  const historicalActualPoints: number[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthStartDate = startOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    const key = monthKey(monthStartDate);
    const actualPoints = actualPointsByMonth.get(key) || 0;
    const projectedPoints = historicalActualPoints.length > 0 ? roundNumber(average(historicalActualPoints.slice(-3))) : 0;
    monthlyTrend.push({
      month: monthLabel(monthStartDate),
      actualPoints,
      actualValue: toMoney(actualPoints * historicalRateBase),
      projectedPoints,
      projectedValue: toMoney(projectedPoints * historicalRateBase),
    });
    historicalActualPoints.push(actualPoints);
  }

  const forecast: BreakageForecastPoint[] = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const monthStartDate = startOfMonth(new Date(now.getFullYear(), now.getMonth() + offset, 1));
    const monthEndDate = endOfMonth(monthStartDate);
    const expiringPoints = input.pointsLots.reduce((sum, pointsLot) => {
      const expiryDate = parseDate(pointsLot.expiry_date);
      if (!expiryDate) return sum;
      if (Number(pointsLot.remaining_points || 0) <= 0) return sum;
      if (expiryDate.getTime() < now.getTime()) return sum;
      return expiryDate.getTime() >= monthStartDate.getTime() && expiryDate.getTime() <= monthEndDate.getTime()
        ? sum + Number(pointsLot.remaining_points || 0)
        : sum;
    }, 0);

    const projectedBreakagePoints = roundNumber(expiringPoints * breakageRatio);
    forecast.push({
      month: monthLabel(monthStartDate),
      expiringPoints,
      projectedBreakagePoints,
      projectedBreakageValue: toMoney(projectedBreakagePoints * historicalRateBase),
    });
  }

  const openExpiringPoints = forecast.reduce((sum, row) => sum + row.expiringPoints, 0);
  const projectedFutureBreakagePoints = forecast.reduce((sum, row) => sum + row.projectedBreakagePoints, 0);
  const actualRecentPoints = monthlyTrend.slice(-6).reduce((sum, row) => sum + row.actualPoints, 0);
  const projectedRecentPoints = monthlyTrend.slice(-6).reduce((sum, row) => sum + row.projectedPoints, 0);

  return {
    overview: {
      totalExpiredPoints,
      totalExpiredValue: toMoney(totalExpiredPoints * historicalRateBase),
      breakageRate: totalEarnedPoints > 0 ? toPercent((totalExpiredPoints / totalEarnedPoints) * 100) : 0,
      openExpiringPoints,
      projectedFutureBreakagePoints,
      projectedFutureBreakageValue: toMoney(projectedFutureBreakagePoints * historicalRateBase),
    },
    tierAnalysis,
    monthlyTrend,
    forecast,
    financialImpact: [
      {
        label: "Actual expired points",
        points: totalExpiredPoints,
        value: toMoney(totalExpiredPoints * historicalRateBase),
      },
      {
        label: "Projected future breakage",
        points: projectedFutureBreakagePoints,
        value: toMoney(projectedFutureBreakagePoints * historicalRateBase),
      },
      {
        label: "Actual vs projected variance (last 6 months)",
        points: actualRecentPoints - projectedRecentPoints,
        value: toMoney((actualRecentPoints - projectedRecentPoints) * historicalRateBase),
      },
      {
        label: "Open points expiring in next 6 months",
        points: openExpiringPoints,
        value: toMoney(openExpiringPoints * historicalRateBase),
      },
    ],
  };
}

function findRewardMatch(transaction: LoyaltyTransaction, rewards: RewardCatalogRow[]) {
  const label = rewardLabel(transaction).toLowerCase();
  if (!label) return null;

  const exactId = rewards.find((reward) => label.includes(String(reward.reward_id || "").toLowerCase()));
  if (exactId) return exactId;

  const exactName = rewards.find((reward) => label === String(reward.name || "").trim().toLowerCase());
  if (exactName) return exactName;

  return (
    rewards.find((reward) => {
      const rewardName = String(reward.name || "").trim().toLowerCase();
      return rewardName ? label.includes(rewardName) : false;
    }) || null
  );
}

function sumRevenueInWindow(transactions: LoyaltyTransaction[], start: Date, end: Date) {
  return transactions.reduce((sum, transaction) => {
    const txDate = parseDate(transaction.transaction_date);
    if (!txDate) return sum;
    if (txDate.getTime() < start.getTime() || txDate.getTime() > end.getTime()) return sum;
    return sum + (isPurchaseLike(transaction) ? Number(transaction.amount_spent || 0) : 0);
  }, 0);
}

function computeDaysToRedeem(reward: RewardCatalogRow, transactions: LoyaltyTransaction[], targetIdentity: string) {
  let runningBalance = 0;
  let thresholdDate: Date | null = null;

  for (const transaction of transactions) {
    const txDate = parseDate(transaction.transaction_date);
    if (!txDate) continue;

    runningBalance += Number(transaction.points || 0);
    if (runningBalance < Number(reward.points_cost || 0)) {
      thresholdDate = null;
    }
    if (!thresholdDate && runningBalance >= Number(reward.points_cost || 0)) {
      thresholdDate = txDate;
    }

    if (transactionIdentity(transaction) === targetIdentity) {
      return thresholdDate ? daysBetween(txDate, thresholdDate) : null;
    }
  }

  return null;
}

function rewardRecommendation(row: RewardEffectivenessRow) {
  if (row.redemptionCount === 0) {
    return "Consider retiring or relaunching with a stronger value proposition.";
  }
  if (row.roi >= 25 && row.redemptionRate >= 15) {
    return "Promote this reward more aggressively because it is converting and driving revenue.";
  }
  if (row.roi < 0 && row.redemptionRate >= 15) {
    return "Review points cost or sourcing cost because engagement is high but ROI is weak.";
  }
  if (row.redemptionRate < 5 && row.roi >= 0) {
    return "Improve catalog visibility with targeted recommendations.";
  }
  if (row.redemptionRate < 5 && row.roi < 0) {
    return "Consider replacing this reward with a more relevant option.";
  }
  return "Monitor performance and keep this reward in the catalog.";
}

export function buildRewardEffectivenessInsights(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  rewardsCatalog: RewardCatalogRow[];
  tierRules: TierRule[];
  redemptionValuePerPoint: number;
}): RewardEffectivenessInsights {
  const memberIndex = normalizeMemberIndex(input.members, input.tierRules);
  const transactionsByMember = buildTransactionsByMember(input.transactions);
  const rewards = input.rewardsCatalog.filter((reward) => reward.reward_id && reward.name);
  const redemptionTransactions = input.transactions.filter((transaction) => classifyTransaction(transaction) === "redeemed");

  const lifetimeEarnedByMember = new Map<string, number>();
  for (const transaction of input.transactions) {
    if (classifyTransaction(transaction) !== "earned" || Number(transaction.points || 0) <= 0) continue;
    const key = transactionMemberKey(transaction);
    lifetimeEarnedByMember.set(key, (lifetimeEarnedByMember.get(key) || 0) + Number(transaction.points || 0));
  }

  const effectiveness = rewards.map((reward) => {
    const matchedRedemptions = redemptionTransactions.filter(
      (transaction) => findRewardMatch(transaction, rewards)?.reward_id === reward.reward_id
    );
    const uniqueRedeemers = new Set(matchedRedemptions.map((transaction) => transactionMemberKey(transaction)));
    const eligibleMembers = memberIndex.filter(
      (member) => Math.max(lifetimeEarnedByMember.get(member.key) || 0, member.pointsBalance) >= Number(reward.points_cost || 0)
    ).length;

    const daysToRedeem: number[] = [];
    let preRevenue = 0;
    let postRevenue = 0;

    for (const redemption of matchedRedemptions) {
      const memberTransactions = transactionsByMember.get(transactionMemberKey(redemption)) || [];
      const redemptionDate = parseDate(redemption.transaction_date);
      if (!redemptionDate) continue;

      const days = computeDaysToRedeem(reward, memberTransactions, transactionIdentity(redemption));
      if (days !== null) daysToRedeem.push(days);

      preRevenue += sumRevenueInWindow(memberTransactions, addDays(redemptionDate, -30), redemptionDate);
      postRevenue += sumRevenueInWindow(memberTransactions, redemptionDate, addDays(redemptionDate, 30));
    }

    const incrementalRevenue = postRevenue - preRevenue;
    const estimatedCost = Number(reward.points_cost || 0) * Number(input.redemptionValuePerPoint || 0.01) * matchedRedemptions.length;
    const roi = estimatedCost > 0 ? toPercent(((incrementalRevenue - estimatedCost) / estimatedCost) * 100) : 0;

    const row: RewardEffectivenessRow = {
      rewardId: String(reward.reward_id),
      rewardName: String(reward.name),
      category: String(reward.category || "uncategorized"),
      pointsCost: Number(reward.points_cost || 0),
      redemptionCount: matchedRedemptions.length,
      uniqueRedeemers: uniqueRedeemers.size,
      eligibleMembers,
      redemptionRate: eligibleMembers > 0 ? toPercent((uniqueRedeemers.size / eligibleMembers) * 100) : 0,
      averageDaysToRedeem: daysToRedeem.length > 0 ? toPercent(average(daysToRedeem)) : 0,
      roi,
      estimatedCost: toMoney(estimatedCost),
      incrementalRevenue: toMoney(incrementalRevenue),
      recommendation: "",
    };

    row.recommendation = rewardRecommendation(row);
    return row;
  });

  effectiveness.sort((left, right) => {
    if (right.redemptionCount !== left.redemptionCount) return right.redemptionCount - left.redemptionCount;
    if (right.redemptionRate !== left.redemptionRate) return right.redemptionRate - left.redemptionRate;
    return right.roi - left.roi;
  });

  const recommendations = effectiveness
    .slice()
    .sort((left, right) => right.roi - left.roi)
    .slice(0, 3)
    .map((row) => `${row.rewardName}: ${row.recommendation}`);

  return {
    overview: {
      totalRewards: rewards.length,
      totalRedemptions: effectiveness.reduce((sum, row) => sum + row.redemptionCount, 0),
      averageRedemptionRate: effectiveness.length > 0 ? toPercent(average(effectiveness.map((row) => row.redemptionRate))) : 0,
      totalEstimatedCost: toMoney(effectiveness.reduce((sum, row) => sum + row.estimatedCost, 0)),
      totalIncrementalRevenue: toMoney(effectiveness.reduce((sum, row) => sum + row.incrementalRevenue, 0)),
    },
    effectiveness,
    mostPopular: effectiveness.slice(0, 5),
    leastPopular: effectiveness
      .slice()
      .sort((left, right) => {
        if (left.redemptionCount !== right.redemptionCount) return left.redemptionCount - right.redemptionCount;
        return left.redemptionRate - right.redemptionRate;
      })
      .slice(0, 5),
    recommendations,
  };
}

function buildEngagementRawRows(input: {
  members: MemberIndex[];
  transactionsByMember: Map<string, LoyaltyTransaction[]>;
  loginActivityByMember: Map<string, MemberLoginActivity[]>;
  snapshotDate: Date;
}) {
  const windowStart = addDays(input.snapshotDate, -90);

  return input.members.map((member) => {
    const transactions = (input.transactionsByMember.get(member.key) || []).filter((transaction) => {
      const txDate = parseDate(transaction.transaction_date);
      return txDate ? txDate.getTime() >= windowStart.getTime() && txDate.getTime() <= input.snapshotDate.getTime() : false;
    });
    const logins = (input.loginActivityByMember.get(member.key) || []).filter((entry) => {
      const loginDate = parseDate(entry.login_at);
      return loginDate ? loginDate.getTime() >= windowStart.getTime() && loginDate.getTime() <= input.snapshotDate.getTime() : false;
    });

    const latestTransactionDate = transactions.length
      ? parseDate(transactions[transactions.length - 1]?.transaction_date)
      : null;
    const latestLoginDate = logins.length ? parseDate(logins[logins.length - 1]?.login_at) : null;
    const lastActivityDate =
      latestTransactionDate && latestLoginDate
        ? latestTransactionDate.getTime() >= latestLoginDate.getTime()
          ? latestTransactionDate.toISOString()
          : latestLoginDate.toISOString()
        : latestTransactionDate?.toISOString() ?? latestLoginDate?.toISOString() ?? null;

    return {
      memberId: member.memberId,
      fullName: member.fullName,
      tier: member.tier,
      transactionCount: transactions.length,
      pointsEarned: transactions
        .filter((transaction) => classifyTransaction(transaction) === "earned" && Number(transaction.points || 0) > 0)
        .reduce((sum, transaction) => sum + Number(transaction.points || 0), 0),
      redemptionCount: transactions.filter((transaction) => classifyTransaction(transaction) === "redeemed").length,
      loginCount: logins.length,
      lastActivityDate,
    } satisfies EngagementRawRow;
  });
}

function scoreEngagementRows(rawRows: EngagementRawRow[]) {
  const maxTransactionCount = Math.max(1, ...rawRows.map((row) => row.transactionCount));
  const maxPointsEarned = Math.max(1, ...rawRows.map((row) => row.pointsEarned));
  const maxRedemptionCount = Math.max(1, ...rawRows.map((row) => row.redemptionCount));
  const maxLoginCount = Math.max(1, ...rawRows.map((row) => row.loginCount));

  return rawRows.map((row) => {
    const contributions: Record<EngagementDriver, number> = {
      Transactions: roundNumber((row.transactionCount / maxTransactionCount) * 35),
      "Points Earned": roundNumber((row.pointsEarned / maxPointsEarned) * 25),
      Redemptions: roundNumber((row.redemptionCount / maxRedemptionCount) * 20),
      Logins: roundNumber((row.loginCount / maxLoginCount) * 20),
    };
    const score = Math.round(
      contributions.Transactions +
        contributions["Points Earned"] +
        contributions.Redemptions +
        contributions.Logins
    );
    const level: EngagementLevel = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
    const primaryDriver = (Object.entries(contributions) as Array<[EngagementDriver, number]>).sort(
      (left, right) => right[1] - left[1]
    )[0]?.[0] ?? "Transactions";

    return {
      ...row,
      score,
      level,
      contributions,
      primaryDriver,
    } satisfies ScoredEngagementRow;
  });
}

export function buildEngagementInsights(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  loginActivity: MemberLoginActivity[];
  tierRules: TierRule[];
}): EngagementInsights {
  const now = new Date();
  const memberIndex = normalizeMemberIndex(input.members, input.tierRules);
  const transactionsByMember = buildTransactionsByMember(input.transactions);
  const loginActivityByMember = buildLoginsByMember(input.loginActivity);

  const currentRows = scoreEngagementRows(
    buildEngagementRawRows({
      members: memberIndex,
      transactionsByMember,
      loginActivityByMember,
      snapshotDate: now,
    })
  );
  const previousRows = scoreEngagementRows(
    buildEngagementRawRows({
      members: memberIndex,
      transactionsByMember,
      loginActivityByMember,
      snapshotDate: endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    })
  );
  const previousScoreByMember = new Map(previousRows.map((row) => [row.memberId, row.score]));

  const members = currentRows
    .map((row) => ({
      memberId: row.memberId,
      fullName: row.fullName,
      tier: row.tier,
      score: row.score,
      level: row.level,
      scoreChange: row.score - (previousScoreByMember.get(row.memberId) || 0),
      transactionCount: row.transactionCount,
      pointsEarned: row.pointsEarned,
      redemptionCount: row.redemptionCount,
      loginCount: row.loginCount,
      primaryDriver: row.primaryDriver,
      lastActivityDate: row.lastActivityDate,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.loginCount !== left.loginCount) return right.loginCount - left.loginCount;
      return right.transactionCount - left.transactionCount;
    });

  const trend: EngagementTrendPoint[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const snapshotDate = endOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    const rows = scoreEngagementRows(
      buildEngagementRawRows({
        members: memberIndex,
        transactionsByMember,
        loginActivityByMember,
        snapshotDate,
      })
    );
    trend.push({
      month: monthLabel(snapshotDate),
      averageScore: rows.length > 0 ? toPercent(average(rows.map((row) => row.score))) : 0,
      highMembers: rows.filter((row) => row.level === "High").length,
      mediumMembers: rows.filter((row) => row.level === "Medium").length,
      lowMembers: rows.filter((row) => row.level === "Low").length,
    });
  }

  const drivers = (["Transactions", "Points Earned", "Redemptions", "Logins"] as EngagementDriver[]).map((driver) => {
    const rows = currentRows.filter((row) => row.primaryDriver === driver);
    return {
      driver,
      members: rows.length,
      averageContribution: rows.length > 0 ? toPercent(average(rows.map((row) => row.contributions[driver]))) : 0,
    } satisfies EngagementDriverSummary;
  });

  return {
    overview: {
      averageScore: members.length > 0 ? toPercent(average(members.map((row) => row.score))) : 0,
      highMembers: members.filter((row) => row.level === "High").length,
      mediumMembers: members.filter((row) => row.level === "Medium").length,
      lowMembers: members.filter((row) => row.level === "Low").length,
    },
    members,
    trend,
    drivers,
  };
}

export function buildAdvancedAnalyticsDatasets(input: {
  members: Member[];
  transactions: LoyaltyTransaction[];
  pointsLots: PointsLot[];
  rewardsCatalog: RewardCatalogRow[];
  loginActivity: MemberLoginActivity[];
  reengagementActions: ReengagementAction[];
  tierRules: TierRule[];
  redemptionValuePerPoint: number;
}): AdvancedAnalyticsDatasets {
  return {
    churn: buildChurnInsights({
      members: input.members,
      transactions: input.transactions,
      reengagementActions: input.reengagementActions,
      tierRules: input.tierRules,
    }),
    breakage: buildBreakageInsights({
      members: input.members,
      transactions: input.transactions,
      pointsLots: input.pointsLots,
      tierRules: input.tierRules,
      redemptionValuePerPoint: input.redemptionValuePerPoint,
    }),
    rewards: buildRewardEffectivenessInsights({
      members: input.members,
      transactions: input.transactions,
      rewardsCatalog: input.rewardsCatalog,
      tierRules: input.tierRules,
      redemptionValuePerPoint: input.redemptionValuePerPoint,
    }),
    engagement: buildEngagementInsights({
      members: input.members,
      transactions: input.transactions,
      loginActivity: input.loginActivity,
      tierRules: input.tierRules,
    }),
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

export function buildEngagementWorkbook(dataset: EngagementInsights) {
  const rows: Array<Array<string | number>> = [
    ["CentralPerk Member Engagement Report"],
    [],
    ["Summary"],
    ["Average Score", dataset.overview.averageScore],
    ["High Engagement Members", dataset.overview.highMembers],
    ["Medium Engagement Members", dataset.overview.mediumMembers],
    ["Low Engagement Members", dataset.overview.lowMembers],
    [],
    ["Trend"],
    ["Month", "Average Score", "High", "Medium", "Low"],
    ...dataset.trend.map((row) => [row.month, row.averageScore, row.highMembers, row.mediumMembers, row.lowMembers]),
    [],
    ["Members"],
    ["Member ID", "Name", "Tier", "Score", "Level", "Score Change", "Transactions", "Points Earned", "Redemptions", "Logins", "Primary Driver"],
    ...dataset.members.map((row) => [
      row.memberId,
      row.fullName,
      row.tier,
      row.score,
      row.level,
      row.scoreChange,
      row.transactionCount,
      row.pointsEarned,
      row.redemptionCount,
      row.loginCount,
      row.primaryDriver,
    ]),
  ];

  return `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Engagement">
        <Table>${rows.map(workbookRow).join("")}</Table>
      </Worksheet>
    </Workbook>`;
}
