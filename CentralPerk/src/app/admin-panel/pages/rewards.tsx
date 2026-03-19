import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../../components/ui/button";
import { useAdminData } from "../hooks/use-admin-data";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminRewardsPage() {
  const { loading, error, metrics, members } = useAdminData();
  const [redemptionWindow, setRedemptionWindow] = useState<"3m" | "6m">("6m");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return toInputDate(date);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));

  const total =
    metrics.tierDistribution.gold +
    metrics.tierDistribution.silver +
    metrics.tierDistribution.bronze;

  const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

  const chartData = useMemo(() => {
    const filteredMembers = members.filter((member) => {
      const joined = new Date(member.enrollment_date).getTime();
      return joined >= start && joined <= end;
    });
    const distribution = filteredMembers.reduce(
      (acc, member) => {
        const tier = String(member.tier || "Bronze").toLowerCase();
        if (tier === "gold") acc.gold += 1;
        else if (tier === "silver") acc.silver += 1;
        else acc.bronze += 1;
        return acc;
      },
      { gold: 0, silver: 0, bronze: 0 }
    );
    return [
      { name: "Gold", value: distribution.gold, color: "#f59e0b" },
      { name: "Silver", value: distribution.silver, color: "#64748b" },
      { name: "Bronze", value: distribution.bronze, color: "#f97316" },
    ];
  }, [members, start, end]);

  const redemptionSeries = useMemo(
    () => (redemptionWindow === "3m" ? metrics.redemptionSeries.slice(-3) : metrics.redemptionSeries),
    [metrics.redemptionSeries, redemptionWindow]
  );
  const redeemedInWindow = redemptionSeries.reduce((sum, point) => sum + point.value, 0);

  if (loading) return <p className="text-base text-gray-700">Loading rewards data...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const exportLiabilityExcel = () => {
    const rows = [
      ["Month", "Unredeemed Points", "Monetary Liability"],
      ...metrics.liabilityTrend.map((t) => [t.month, t.points, t.monetary]),
    ];

    const xmlRows = rows
      .map(
        (r) =>
          `<Row>${r
            .map((c) => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${c}</Data></Cell>`)
            .join("")}</Row>`
      )
      .join("");

    const content = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
       xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
       <Worksheet ss:Name="Liability Report"><Table>${xmlRows}</Table></Worksheet>
      </Workbook>`;

    const blob = new Blob([content], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `points-liability-report-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rewards & Tier Distribution</h1>
        <p className="text-gray-500 mt-1">Monitor reward liabilities, redemptions, and tier movement</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">End Date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Redemption Window</span>
            <select value={redemptionWindow} onChange={(e) => setRedemptionWindow(e.target.value as "3m" | "6m")} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="3m">3 months</option>
              <option value="6m">6 months</option>
            </select>
          </label>
          <div className="flex items-end justify-end">
            <Button variant="outline" onClick={exportLiabilityExcel}>Export Excel</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-[#e6f8fa] to-white rounded-xl p-6 border border-[#7fd7de]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Points Liability</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.pointsLiability.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-xl p-6 border border-[#f7c58b]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Points Redeemed</h3>
          <p className="text-3xl font-bold text-gray-800">{redeemedInWindow.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {redemptionWindow === "3m" ? "Last 3 months" : "Last 6 months"}
          </p>
        </div>
        <div className="bg-gradient-to-br from-[#ecfeff] to-white rounded-xl p-6 border border-cyan-200">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Monetary Liability</h3>
          <p className="text-3xl font-bold text-gray-800">PHP {metrics.monetaryLiability.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Rate: PHP {metrics.redemptionValuePerPoint} per point</p>
        </div>
        <div className="bg-gradient-to-br from-[#f5f0ff] to-white rounded-xl p-6 border border-[#d7c2ff]">
          <h3 className="text-gray-600 text-sm font-medium mb-1">Redemption Rate</h3>
          <p className="text-3xl font-bold text-gray-800">{metrics.redemptionRate.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Redeemed vs earned points</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Liability Trend</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.liabilityTrend}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="points" stroke="#1A2B47" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Redemption Trend</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={redemptionSeries}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`${value} pts`, "Redeemed"]} />
              <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#d7c2ff]">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Most Popular Rewards</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {metrics.rewardPopularity.length === 0 ? (
            <p className="text-sm text-gray-500">No reward redemption data yet.</p>
          ) : (
            metrics.rewardPopularity.map((reward) => (
              <div key={reward.label} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-900">{reward.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{reward.count}</p>
                <p className="text-xs text-gray-500">redemptions</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#d7c2ff]">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Tier Breakdown</h2>
        {chartData.every((entry) => entry.value === 0) ? (
          <p className="text-gray-500">No members found in the selected date range.</p>
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={100}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, _name, item) => [`${value} members`, item?.payload?.name ?? "Tier"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              {chartData.map((entry) => (
                <div key={`legend-${entry.name}`} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#d7c2ff]">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Tier Movement Trend</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.tierMovementTrend}>
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="upgrades" fill="#00A3AD" radius={[4, 4, 0, 0]} />
              <Bar dataKey="downgrades" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
