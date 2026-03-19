import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { useAdminData } from "../hooks/use-admin-data";
import { toast } from "sonner";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminActivityPage() {
  const { transactions, loading, error, metrics } = useAdminData();
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "warm" | "inactive">("all");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return toInputDate(date);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));

  const filteredTransactions = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    return transactions.filter((tx) => {
      const timestamp = new Date(tx.transaction_date).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }, [transactions, startDate, endDate]);

  const filteredActivityRows = useMemo(
    () =>
      metrics.memberActivityRows.filter((row) =>
        activityFilter === "all" ? true : row.activityLevel === activityFilter
      ),
    [metrics.memberActivityRows, activityFilter]
  );

  const downloadStatement = () => {
    if (filteredTransactions.length === 0) return;

    const header = "Date,Member Number,Member Name,Type,Points\n";
    const rows = filteredTransactions
      .map((transaction) => {
        const memberNumber = transaction.loyalty_members?.member_number || "N/A";
        const memberName = transaction.loyalty_members
          ? `${transaction.loyalty_members.first_name} ${transaction.loyalty_members.last_name}`
          : "Unknown";
        const date = new Date(transaction.transaction_date).toLocaleDateString();
        return `${date},${memberNumber},"${memberName}",${transaction.transaction_type},${transaction.points}`;
      })
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "points_statement.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdf = () => {
    try {
      if (filteredTransactions.length === 0) {
        toast.error("No activity available to export.");
        return;
      }

      const htmlRows = filteredTransactions
        .map((transaction) => {
          const memberNumber = transaction.loyalty_members?.member_number || "N/A";
          const memberName = transaction.loyalty_members
            ? `${transaction.loyalty_members.first_name} ${transaction.loyalty_members.last_name}`
            : "Unknown";
          const date = new Date(transaction.transaction_date).toLocaleDateString();
          return `<tr><td>${date}</td><td>${memberNumber}</td><td>${memberName}</td><td>${transaction.transaction_type}</td><td>${transaction.points}</td></tr>`;
        })
        .join("");

      const html = `
        <html>
          <head>
            <title>CentralPerk Admin Activity Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
              .brand { display:flex; justify-content:space-between; align-items:center; background:#1A2B47; color:#fff; padding:12px 16px; border-radius:8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <div class="brand"><strong>CentralPerk Rewards</strong><span>Admin Activity Report</span></div>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Member #</th><th>Member Name</th><th>Type</th><th>Points</th>
                </tr>
              </thead>
              <tbody>${htmlRows}</tbody>
            </table>
          </body>
        </html>
      `;

      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) throw new Error("Popup blocked. Allow popups to print your PDF.");
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      toast.success("PDF ready. Print dialog opened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF.");
    }
  };

  if (loading) return <p className="text-base text-gray-700">Loading activity...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Member Activity Report</h1>
          <p className="text-gray-500 mt-1">Analyze member activity, earned points, and engagement levels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadStatement}
            className="bg-[#00A3AD] hover:bg-[#08939c] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Download CSV
          </button>
          <button
            onClick={downloadPdf}
            className="bg-[#1A2B47] hover:bg-[#23385a] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">End Date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Activity Level</span>
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="all">All Members</option>
              <option value="active">Active</option>
              <option value="warm">Warm</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Points Earned Per Month</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.earnedPointsSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value} pts`, "Earned"]} />
                <Bar dataKey="value" fill="#00A3AD" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Segmentation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {metrics.memberSegments.map((segment) => (
              <div key={segment.label} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{segment.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{segment.count}</p>
              </div>
            ))}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.memberSegments.map((segment) => ({ name: segment.label, value: segment.count }))} dataKey="value" outerRadius={90}>
                  <Cell fill="#1A2B47" />
                  <Cell fill="#00A3AD" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} members`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#9ed8ff]">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active vs Inactive Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {metrics.memberActivityRows.filter((row) => row.activityLevel === "active").length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Warm</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {metrics.memberActivityRows.filter((row) => row.activityLevel === "warm").length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {metrics.memberActivityRows.filter((row) => row.activityLevel === "inactive").length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#f7c58b]">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Member Activity Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member #</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Last Activity</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Activity Level</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Points Earned</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivityRows.map((row) => (
                <tr key={row.memberNumber} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 text-sm font-medium text-gray-800">{row.memberNumber}</td>
                  <td className="py-4 px-4 text-sm text-gray-700">{row.fullName}</td>
                  <td className="py-4 px-4 text-sm text-gray-700">
                    {row.lastActivityDate ? new Date(row.lastActivityDate).toLocaleString() : "No activity"}
                  </td>
                  <td className="py-4 px-4 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.activityLevel === "active"
                        ? "bg-[#dcfce7] text-[#15803d]"
                        : row.activityLevel === "warm"
                        ? "bg-[#fff7ed] text-[#c2410c]"
                        : "bg-[#f5f0ff] text-[#7e22ce]"
                    }`}>
                      {row.activityLevel}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-semibold text-gray-800">{row.earnedPoints.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredActivityRows.length === 0 ? <p className="py-6 text-gray-500">No members match the selected activity level.</p> : null}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#f7c58b]">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Filtered Transactions</h2>
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
              {filteredTransactions.map((tx, index) => (
                <tr key={tx.transaction_id || `${tx.member_id}-${tx.transaction_date}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 text-sm text-gray-700">{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : "-"}</td>
                  <td className="py-4 px-4 text-sm font-medium text-gray-800">{tx.loyalty_members?.member_number || "N/A"}</td>
                  <td className="py-4 px-4 text-sm text-gray-700">
                    {tx.loyalty_members
                      ? `${tx.loyalty_members.first_name} ${tx.loyalty_members.last_name}`
                      : "Unknown"}
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
  );
}
