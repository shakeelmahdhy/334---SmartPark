import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Users, MapPin, Trash2, Plus, Check, X, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import type { Booking, ParkingSettings, User, ZoneStats } from "../../lib/types";

const PIE_COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#f87171"];

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 0,
    fontSize: 11,
    fontFamily: "DM Mono, monospace",
  },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#dde3ee" },
};

function formatHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${suffix}`;
}

type UserRow = User & { bookings: number };

export function Admin() {
  const [activeTab, setActiveTab] = useState<"analytics" | "zones" | "users">("analytics");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    total: 0,
    active_bookings: 0,
    total_users: 0,
    revenue: "$0",
  });
  const [weeklyData, setWeeklyData] = useState<{ day: string; bookings: number; revenue: number }[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<{ hour: string; occupancy: number }[]>([]);
  const [occupancyRateData, setOccupancyRateData] = useState<{ name: string; value: number }[]>([]);

  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([]);
  const [parkingSettings, setParkingSettings] = useState<ParkingSettings | null>(null);
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [newSpot, setNewSpot] = useState({ zone: "", spot_number: "", count: 1 });

  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, analytics, users, bookings, settings] = await Promise.all([
        api.getDashboardStats(),
        api.getAnalytics(),
        api.getUsers(),
        api.getAllBookings(),
        api.getParkingSettings(),
      ]);

      setZoneStats(dashboard.zone_stats);
      setParkingSettings(settings);
      setNewSpot((current) => ({
        ...current,
        zone: current.zone || settings.zones[0] || "",
      }));

      const bookingsByUser = (bookings as Booking[]).reduce<Record<number, number>>((acc, b) => {
        acc[b.user_id] = (acc[b.user_id] ?? 0) + 1;
        return acc;
      }, {});

      setUserRows(
        users.map((u) => ({
          ...u,
          bookings: bookingsByUser[u.id] ?? 0,
        }))
      );

      setStats({
        total: dashboard.total_spots,
        active_bookings: dashboard.active_bookings ?? 0,
        total_users: users.length,
        revenue: `$${Number(analytics.total_revenue ?? 0).toLocaleString()}`,
      });

      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const trends = analytics.revenue_trends ?? [];
      setWeeklyData(
        trends.slice(-7).map((r) => ({
          day: DAY_NAMES[new Date(r.date).getDay()],
          bookings: r.bookings,
          revenue: r.revenue,
        }))
      );

      const peaks = (analytics.peak_hours ?? [])
        .filter((p) => p.hour >= 6 && p.hour <= 20)
        .map((p) => ({
          hour: formatHour(p.hour),
          occupancy: Math.round(p.occupancy_rate),
        }));
      setPeakHoursData(peaks);

      setOccupancyRateData(
        (analytics.zone_performance ?? []).map((z) => ({
          name: `Zone ${z.zone}`,
          value: Math.round(z.avg_occupancy_rate),
        }))
      );
    } catch {
      setError("Failed to load admin data. Check backend and admin login.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleInitialize = async () => {
    try {
      await api.initializeParkingSpots();
      await loadAll();
    } catch {
      setError("Failed to initialize parking spots.");
    }
  };

  const handleAddSpots = async () => {
    if (!newSpot.zone) return;
    try {
      const zone = newSpot.zone.toUpperCase();
      const existing = zoneStats.find((z) => z.zone === zone)?.total_spots ?? 0;
      const startNum = existing + 1;

      for (let i = 0; i < Math.max(1, newSpot.count); i++) {
        const num = newSpot.spot_number
          ? newSpot.count > 1
            ? `${newSpot.spot_number.toUpperCase()}-${i + 1}`
            : newSpot.spot_number.toUpperCase()
          : `${zone}${String(startNum + i).padStart(2, "0")}`;
        await api.createParkingSpot({
          spot_number: num,
          zone,
        });
      }
      setShowAddSpot(false);
      setNewSpot({ zone: parkingSettings?.zones[0] ?? "", spot_number: "", count: 1 });
      await loadAll();
    } catch {
      setError("Failed to create spot(s). Spot number may already exist.");
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) return;
    try {
      await api.register({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name || undefined,
      });
      setShowAddUser(false);
      setNewUser({ username: "", email: "", password: "", full_name: "" });
      await loadAll();
    } catch {
      setError("Failed to create user. Username or email may already exist.");
    }
  };

  const toggleUserStatus = async (user: UserRow) => {
    try {
      await api.updateUserAdmin(user.id, { is_active: !user.is_active });
      await loadAll();
    } catch {
      setError("Failed to update user status.");
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await api.deleteUser(id);
      await loadAll();
    } catch {
      setError("Failed to delete user.");
    }
  };

  const inputCls =
    "bg-[#0b1120] border border-[#1e2d45] text-slate-200 placeholder-slate-600 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full transition-colors";
  const initializeLabel = parkingSettings
    ? `Initialize ${parkingSettings.total_parking_spots} parking spots (${parkingSettings.zones.join(", ")})`
    : "Initialize parking spots";
  const nextSpotNumber =
    (zoneStats.find((z) => z.zone === newSpot.zone)?.total_spots ?? 0) + 1;
  const spotPlaceholder = newSpot.zone
    ? `${newSpot.zone}${String(nextSpotNumber).padStart(2, "0")}`
    : "Spot number";
  const tabs = [
    { key: "analytics", label: "Analytics & Reports" },
    { key: "zones", label: "Manage Zones" },
    { key: "users", label: "Manage Users" },
  ] as const;

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Control Panel</p>
          <h1 className="text-xl font-semibold text-slate-100">Admin Dashboard</h1>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-amber-400 text-xs font-mono uppercase disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-2">
          <p className="text-xs font-mono text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-px bg-[#1e2d45] border border-[#1e2d45] mb-6">
        {[
          { icon: MapPin, label: "Total Spots", value: stats.total, color: "text-amber-400", bg: "bg-amber-500/10" },
          { icon: TrendingUp, label: "Active Bookings", value: stats.active_bookings, color: "text-sky-400", bg: "bg-sky-500/10" },
          { icon: Users, label: "Total Users", value: stats.total_users, color: "text-violet-400", bg: "bg-violet-500/10" },
          { icon: TrendingUp, label: "Revenue (period)", value: stats.revenue, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-[#111827] px-5 py-4">
            <div className={`w-8 h-8 ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#1e2d45] mb-0">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === key ? "border-amber-500 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-[#111827] border border-[#1e2d45] border-t-0 p-6">
        {loading && activeTab === "analytics" ? (
          <p className="text-xs font-mono text-slate-500 py-10 text-center">Loading…</p>
        ) : null}

        {activeTab === "analytics" && !loading && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-[#0b1120] border border-[#1e2d45] p-5 col-span-2">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Parking setup</p>
              {stats.total === 0 ? (
                <button
                  onClick={handleInitialize}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono uppercase"
                >
                  {initializeLabel}
                </button>
              ) : (
                <p className="text-xs font-mono text-slate-500">{stats.total} spots configured.</p>
              )}
            </div>

            <div className="bg-[#0b1120] border border-[#1e2d45] p-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Peak Hours</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="occupancy" fill="#f59e0b" name="Occupancy %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#0b1120] border border-[#1e2d45] p-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Zone Performance</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={occupancyRateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {occupancyRateData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#0b1120] border border-[#1e2d45] p-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Weekly Bookings</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line type="monotone" dataKey="bookings" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#0b1120] border border-[#1e2d45] p-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Weekly Revenue</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="revenue" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "zones" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Zones (from live spots)</p>
              <button
                onClick={() => {
                  setNewSpot((current) => ({
                    ...current,
                    zone: current.zone || parkingSettings?.zones[0] || zoneStats[0]?.zone || "",
                  }));
                  setShowAddSpot(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono uppercase"
              >
                <Plus className="w-3.5 h-3.5" /> Add Spot
              </button>
            </div>

            {showAddSpot && (
              <div className="bg-[#0b1120] border border-amber-500/30 p-4 mb-4 grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Zone</label>
                  <select
                    className={inputCls}
                    value={newSpot.zone}
                    onChange={(e) => setNewSpot((p) => ({ ...p, zone: e.target.value.toUpperCase() }))}
                  >
                    {(parkingSettings?.zones ?? zoneStats.map((z) => z.zone)).map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Spot #</label>
                  <input
                    className={inputCls}
                    placeholder={spotPlaceholder}
                    value={newSpot.spot_number}
                    onChange={(e) => setNewSpot((p) => ({ ...p, spot_number: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Count</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={newSpot.count}
                    onChange={(e) => setNewSpot((p) => ({ ...p, count: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={handleAddSpots} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
                    <Check className="w-3.5 h-3.5 inline" /> Save
                  </button>
                  <button onClick={() => setShowAddSpot(false)} className="px-3 py-1.5 border border-[#1e2d45] text-slate-500 text-xs font-mono">
                    <X className="w-3.5 h-3.5 inline" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {zoneStats.map((z) => (
                <div key={z.zone} className="bg-[#0b1120] border border-[#1e2d45] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <span className="text-base font-bold font-mono text-amber-400">{z.zone}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-200 text-sm">Zone {z.zone}</p>
                      <p className="text-[10px] font-mono text-slate-500">{z.total_spots} spots</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Available</span>
                      <span className="text-emerald-400">{z.available}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Occupied</span>
                      <span className="text-red-400">{z.occupied}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Reserved</span>
                      <span className="text-amber-400">{z.reserved}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 pt-2 border-t border-[#1e2d45]">
                      <span>Occupancy</span>
                      <span className="text-slate-300">{z.occupancy_rate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">System Users</p>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono uppercase"
              >
                <Plus className="w-3.5 h-3.5" /> Add User
              </button>
            </div>

            <div className="border border-[#1e2d45] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0b1120] border-b border-[#1e2d45]">
                    {["Username", "Email", "Bookings", "Role", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-slate-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d45]">
                  {showAddUser && (
                    <tr className="bg-amber-500/5">
                      <td className="px-4 py-3">
                        <input
                          className={inputCls}
                          placeholder="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={inputCls}
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={inputCls}
                          type="password"
                          placeholder="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">user</td>
                      <td className="px-4 py-3">—</td>
                      <td className="px-4 py-3">
                        <button onClick={handleAddUser} className="p-1.5 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowAddUser(false)} className="p-1.5 ml-1 border border-[#1e2d45]">
                          <X className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  )}
                  {userRows.map((user) => (
                    <tr key={user.id} className="hover:bg-[#0d1627]">
                      <td className="px-4 py-3 text-sm text-slate-200">{user.username}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{user.email}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300">{user.bookings}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {user.is_admin ? "admin" : "user"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={`px-2 py-1 text-[10px] font-mono uppercase border ${
                            user.is_active
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                        >
                          {user.is_active ? "active" : "inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {!user.is_admin && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1.5 border border-[#1e2d45] hover:border-red-500/40"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
