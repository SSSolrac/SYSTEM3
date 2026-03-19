import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useAdminData } from "../hooks/use-admin-data";
import { resolveTier } from "../../lib/loyalty-engine";
import { buildInactiveMemberInsights, loadEngagementState } from "../../lib/member-engagement";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminDashboard() {
  const { members, transactions, loading, error, metrics, tierRules } = useAdminData();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return toInputDate(date);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));

  const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const joined = new Date(member.enrollment_date).getTime();
        return joined >= start && joined <= end;
      }),
    [members, start, end]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const timestamp = new Date(tx.transaction_date).getTime();
        return timestamp >= start && timestamp <= end;
      }),
    [transactions, start, end]
  );
  const engagementState = useMemo(() => loadEngagementState(), []);
  const inactiveMembers = useMemo(() => buildInactiveMemberInsights(members, transactions, []), [members, transactions]);

  const totalTierMembers =
    metrics.tierDistribution.gold +
    metrics.tierDistribution.silver +
    metrics.tierDistribution.bronze;

  if (loading) return <p className="text-base text-gray-700">Loading dashboard...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Loyalty Program Analytics & Reports</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">End Date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-[#eef6ff] to-white rounded-xl p-6 border border-[#9ed8ff]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Total Members</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.totalMembers.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-[#e6f8fa] to-white rounded-xl p-6 border border-[#7fd7de]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Points Liability</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.pointsLiability.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total unredeemed points</p>
        </div>
        <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-xl p-6 border border-[#f7c58b]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Points Redeemed</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.totalPointsRedeemed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">All-time redemptions</p>
        </div>
        <div className="bg-gradient-to-br from-[#f5f0ff] to-white rounded-xl p-6 border border-[#d7c2ff]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Member Growth</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.newMembersThisMonth.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            New this month ({metrics.growthRate >= 0 ? "+" : ""}
            {metrics.growthRate.toFixed(1)}% vs last month)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">New Members Today</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.newMembersToday}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">New Members This Week</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.newMembersThisWeek}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">New Members This Month</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.newMembersThisMonth}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Active Members (30d)</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.activeMembers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/engagement" className="block">
          <div className="bg-gradient-to-br from-[#e6f8fa] to-white rounded-xl p-5 border border-[#7fd7de] hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">Push Campaigns</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{engagementState.notificationCampaigns.length}</p>
            <p className="text-xs text-gray-500 mt-1">Open the engagement workspace</p>
          </div>
        </Link>
        <Link to="/admin/engagement" className="block">
          <div className="bg-gradient-to-br from-[#f5f0ff] to-white rounded-xl p-5 border border-[#d7c2ff] hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">Live Surveys</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {engagementState.surveys.filter((survey) => survey.status === "live").length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Targeted feedback with bonus points</p>
          </div>
        </Link>
        <Link to="/admin/engagement" className="block">
          <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-xl p-5 border border-[#f7c58b] hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">Inactive 60+ Days</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{inactiveMembers.length}</p>
            <p className="text-xs text-gray-500 mt-1">Ready for win-back automation</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#9ed8ff]">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Member Growth Report</h2>
            <p className="text-sm text-gray-500 mb-4">Monthly new member signups (last 6 months)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.growthSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [`${value} members`, "New Signups"]} />
                  <Bar dataKey="count" fill="#1A2B47" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-[#d7c2ff]">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Members</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member #</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Points</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tier</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.slice(0, 10).map((member) => {
                    const balance = member.points_balance || 0;
                    let tier = resolveTier(balance, tierRules);
                    let tierColor = "text-[#1A2B47] bg-[#e9edf5]";
                    if (tier.toLowerCase() === "gold") {
                      tier = "Gold";
                      tierColor = "text-amber-600 bg-amber-100";
                    } else if (tier.toLowerCase() === "silver") {
                      tier = "Silver";
                      tierColor = "text-slate-600 bg-slate-100";
                    } else {
                      tier = "Bronze";
                    }
                    return (
                      <tr key={member.member_id || String(member.id)} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-medium text-gray-800">{member.member_number}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">
                          {member.first_name} {member.last_name}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">{member.email}</td>
                        <td className="py-4 px-4 text-sm font-semibold text-gray-800">{balance.toLocaleString()}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tierColor}`}>{tier}</span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {new Date(member.enrollment_date).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredMembers.length === 0 ? <p className="py-6 text-gray-500">No members found in the selected date range.</p> : null}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-[#f7c58b]">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Points Activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member #</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.slice(0, 20).map((tx, index) => (
                    <tr key={tx.transaction_id || `${tx.member_id}-${tx.transaction_date}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-sm text-gray-700">{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : "-"}</td>
                      <td className="py-4 px-4 text-sm font-medium text-gray-800">{tx.loyalty_members?.member_number || "N/A"}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {tx.loyalty_members ? `${tx.loyalty_members.first_name} ${tx.loyalty_members.last_name}` : "Unknown"}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{tx.transaction_type}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-gray-800">{tx.points.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 ? <p className="py-6 text-gray-500">No transactions found in the selected date range.</p> : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 border border-[#7fd7de] sticky top-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Rewards & Member Distribution</h2>
            {totalTierMembers > 0 ? (
              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Gold", value: metrics.tierDistribution.gold, color: "#f59e0b" },
                        { name: "Silver", value: metrics.tierDistribution.silver, color: "#64748b" },
                        { name: "Bronze", value: metrics.tierDistribution.bronze, color: "#f97316" },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#64748b" />
                      <Cell fill="#f97316" />
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} members`, ""]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500">No data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
