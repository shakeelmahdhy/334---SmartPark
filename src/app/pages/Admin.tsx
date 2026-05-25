import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Users, MapPin, Edit2, Trash2, Plus, Check, X } from "lucide-react";
import { api } from "../../lib/api";

const MOCK_PEAK_HOURS = [
  { hour: "6AM", occupancy: 20 }, { hour: "7AM", occupancy: 35 },
  { hour: "8AM", occupancy: 65 }, { hour: "9AM", occupancy: 85 },
  { hour: "10AM", occupancy: 90 }, { hour: "11AM", occupancy: 88 },
  { hour: "12PM", occupancy: 75 }, { hour: "1PM", occupancy: 70 },
  { hour: "2PM", occupancy: 65 }, { hour: "3PM", occupancy: 50 },
  { hour: "4PM", occupancy: 45 }, { hour: "5PM", occupancy: 35 },
  { hour: "6PM", occupancy: 25 },
];
const MOCK_OCCUPANCY = [
  { name: "Zone A", value: 75 }, { name: "Zone B", value: 60 },
  { name: "Zone C", value: 85 }, { name: "Zone D", value: 50 },
];
const MOCK_WEEKLY = [
  { day: "Mon", bookings: 45, revenue: 450 }, { day: "Tue", bookings: 52, revenue: 520 },
  { day: "Wed", bookings: 48, revenue: 480 }, { day: "Thu", bookings: 61, revenue: 610 },
  { day: "Fri", bookings: 70, revenue: 700 }, { day: "Sat", bookings: 35, revenue: 350 },
  { day: "Sun", bookings: 28, revenue: 280 },
];
const PIE_COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#f87171"];

const chartTooltipStyle = {
  contentStyle: { backgroundColor: "#111827", border: "1px solid #1e2d45", borderRadius: 0, fontSize: 11, fontFamily: "DM Mono, monospace" },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#dde3ee" },
};

type Zone = { id: string; name: string; spots: number; rate: number };
type UserRow = { id: number; name: string; email: string; bookings: number; status: "active" | "inactive" };

const initialZones: Zone[] = [
  { id: "A", name: "Zone A", spots: 8, rate: 5 },
  { id: "B", name: "Zone B", spots: 6, rate: 5 },
  { id: "C", name: "Zone C", spots: 10, rate: 7 },
  { id: "D", name: "Zone D", spots: 6, rate: 4 },
];
const initialUsers: UserRow[] = [
  { id: 1, name: "John Doe", email: "john@example.com", bookings: 12, status: "active" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", bookings: 8, status: "active" },
  { id: 3, name: "Mike Johnson", email: "mike@example.com", bookings: 15, status: "active" },
  { id: 4, name: "Sarah Williams", email: "sarah@example.com", bookings: 5, status: "inactive" },
];

export function Admin() {
  const [activeTab, setActiveTab] = useState<"analytics" | "zones" | "users">("analytics");

  // Live stats from backend
  const [stats, setStats] = useState({ total: 30, active_bookings: 18, revenue: "$3,390" });
  const [weeklyData, setWeeklyData] = useState(MOCK_WEEKLY);
  const [peakHoursData] = useState(MOCK_PEAK_HOURS);
  const [occupancyRateData] = useState(MOCK_OCCUPANCY);

  useEffect(() => {
    // Fetch dashboard stats
    api.getDashboardStats().then((d) => {
      setStats({
        total: d.total_spots ?? 30,
        active_bookings: d.active_bookings ?? 18,
        revenue: d.total_revenue ? `$${Number(d.total_revenue).toLocaleString()}` : "$3,390",
      });
    }).catch(() => {});

    // Fetch analytics for weekly chart
    api.getAnalytics().then((data: any[]) => {
      if (!Array.isArray(data) || data.length === 0) return;
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7 = data.slice(-7).map((r: any) => ({
        day: DAY_NAMES[new Date(r.date).getDay()],
        bookings: r.total_bookings ?? 0,
        revenue: r.total_revenue ?? 0,
      }));
      if (last7.length > 0) setWeeklyData(last7);
    }).catch(() => {});
  }, []);

  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneEdit, setZoneEdit] = useState<Partial<Zone>>({});
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZone, setNewZone] = useState<Partial<Zone>>({ id: "", name: "", spots: 0, rate: 0 });

  const [userRows, setUserRows] = useState<UserRow[]>(initialUsers);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userEdit, setUserEdit] = useState<Partial<UserRow>>({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<UserRow>>({ name: "", email: "", bookings: 0, status: "active" });

  const startEditZone = (z: Zone) => { setEditingZoneId(z.id); setZoneEdit({ ...z }); };
  const saveZone = () => { setZones((p) => p.map((z) => z.id === editingZoneId ? { ...z, ...zoneEdit } as Zone : z)); setEditingZoneId(null); };
  const deleteZone = (id: string) => setZones((p) => p.filter((z) => z.id !== id));
  const addZone = () => {
    if (!newZone.id || !newZone.name) return;
    setZones((p) => [...p, { id: newZone.id!, name: newZone.name!, spots: newZone.spots ?? 0, rate: newZone.rate ?? 0 }]);
    setNewZone({ id: "", name: "", spots: 0, rate: 0 }); setShowAddZone(false);
  };

  const startEditUser = (u: UserRow) => { setEditingUserId(u.id); setUserEdit({ ...u }); };
  const saveUser = () => { setUserRows((p) => p.map((u) => u.id === editingUserId ? { ...u, ...userEdit } as UserRow : u)); setEditingUserId(null); };
  const deleteUser = (id: number) => setUserRows((p) => p.filter((u) => u.id !== id));
  const toggleStatus = (id: number) => setUserRows((p) => p.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));
  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    const id = Math.max(0, ...userRows.map((u) => u.id)) + 1;
    setUserRows((p) => [...p, { id, name: newUser.name!, email: newUser.email!, bookings: newUser.bookings ?? 0, status: newUser.status ?? "active" }]);
    setNewUser({ name: "", email: "", bookings: 0, status: "active" }); setShowAddUser(false);
  };

  const inputCls = "bg-[#0b1120] border border-[#1e2d45] text-slate-200 placeholder-slate-600 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full transition-colors";
  const tabs = [
    { key: "analytics", label: "Analytics & Reports" },
    { key: "zones", label: "Manage Zones" },
    { key: "users", label: "Manage Users" },
  ] as const;

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Control Panel</p>
        <h1 className="text-xl font-semibold text-slate-100">Admin Dashboard</h1>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-px bg-[#1e2d45] border border-[#1e2d45] mb-6">
        {[
          { icon: MapPin, label: "Total Spots", value: stats.total, color: "text-amber-400", bg: "bg-amber-500/10", delta: "+12%" },
          { icon: TrendingUp, label: "Active Bookings", value: stats.active_bookings, color: "text-sky-400", bg: "bg-sky-500/10", delta: "+8%" },
          { icon: Users, label: "Total Users", value: userRows.length, color: "text-violet-400", bg: "bg-violet-500/10", delta: "+15%" },
          { icon: TrendingUp, label: "Revenue (Week)", value: stats.revenue, color: "text-emerald-400", bg: "bg-emerald-500/10", delta: "+22%" },
        ].map(({ icon: Icon, label, value, color, bg, delta }) => (
          <div key={label} className="bg-[#111827] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-[10px] font-mono text-emerald-400">{delta}</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#1e2d45] mb-0">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-[#111827] border border-[#1e2d45] border-t-0 p-6">
        {/* Analytics */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-2 gap-5">
            {[
              {
                id: "chart-peak-hours", title: "Peak Hours Analysis",
                chart: (
                  <BarChart id="chart-peak-hours" data={peakHoursData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="occupancy" fill="#f59e0b" />
                  </BarChart>
                ),
              },
              {
                id: "chart-occupancy", title: "Zone Occupancy Rate",
                chart: (
                  <PieChart id="chart-occupancy">
                    <Pie data={occupancyRateData} cx="50%" cy="50%" labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`} outerRadius={90} dataKey="value">
                      {occupancyRateData.map((entry, i) => (
                        <Cell key={`occ-${entry.name}-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltipStyle} />
                  </PieChart>
                ),
              },
              {
                id: "chart-weekly-bookings", title: "Weekly Bookings",
                chart: (
                  <LineChart id="chart-weekly-bookings" data={weeklyData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono, monospace" }} />
                    <Line type="monotone" dataKey="bookings" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                ),
              },
              {
                id: "chart-weekly-revenue", title: "Weekly Revenue",
                chart: (
                  <BarChart id="chart-weekly-revenue" data={weeklyData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="revenue" fill="#34d399" />
                  </BarChart>
                ),
              },
            ].map(({ id, title, chart }) => (
              <div key={id} className="bg-[#0b1120] border border-[#1e2d45] p-5">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">{title}</p>
                <ResponsiveContainer width="100%" height={240}>{chart}</ResponsiveContainer>
              </div>
            ))}
          </div>
        )}

        {/* Zones */}
        {activeTab === "zones" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Parking Zones</p>
              <button
                onClick={() => setShowAddZone(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Zone
              </button>
            </div>

            {showAddZone && (
              <div className="bg-[#0b1120] border border-amber-500/30 p-4 mb-4">
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-3">New Zone</p>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div><label className="text-[9px] font-mono text-slate-500 uppercase block mb-1">ID</label>
                    <input className={inputCls} placeholder="E" value={newZone.id}
                      onChange={(e) => setNewZone((p) => ({ ...p, id: e.target.value.toUpperCase() }))} /></div>
                  <div><label className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Name</label>
                    <input className={inputCls} placeholder="Zone E" value={newZone.name}
                      onChange={(e) => setNewZone((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div><label className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Spots</label>
                    <input className={inputCls} type="number" min={1} value={newZone.spots}
                      onChange={(e) => setNewZone((p) => ({ ...p, spots: Number(e.target.value) }))} /></div>
                  <div><label className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Rate $/hr</label>
                    <input className={inputCls} type="number" min={1} value={newZone.rate}
                      onChange={(e) => setNewZone((p) => ({ ...p, rate: Number(e.target.value) }))} /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addZone} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono transition-colors">
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setShowAddZone(false)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {zones.map((zone) => {
                const isEditing = editingZoneId === zone.id;
                return (
                  <div key={zone.id} className="bg-[#0b1120] border border-[#1e2d45] p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                          <span className="text-base font-bold font-mono text-amber-400">{zone.id}</span>
                        </div>
                        {isEditing ? (
                          <input className={inputCls} value={zoneEdit.name ?? ""}
                            onChange={(e) => setZoneEdit((p) => ({ ...p, name: e.target.value }))} />
                        ) : (
                          <div>
                            <p className="font-medium text-slate-200 text-sm">{zone.name}</p>
                            <p className="text-[10px] font-mono text-slate-500">{zone.spots} spots</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveZone} className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                            <button onClick={() => setEditingZoneId(null)} className="p-1.5 border border-[#1e2d45] hover:bg-[#1e2d45] transition-colors">
                              <X className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditZone(zone)} className="p-1.5 border border-[#1e2d45] hover:border-amber-500/40 hover:text-amber-400 transition-colors">
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                            <button onClick={() => deleteZone(zone.id)} className="p-1.5 border border-[#1e2d45] hover:border-red-500/40 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2.5 pt-3 border-t border-[#1e2d45]">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Spots</span>
                        {isEditing ? (
                          <input className={`${inputCls} w-20 text-right`} type="number" min={1} value={zoneEdit.spots ?? ""}
                            onChange={(e) => setZoneEdit((p) => ({ ...p, spots: Number(e.target.value) }))} />
                        ) : (
                          <span className="text-xs font-mono text-slate-300">{zone.spots}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Rate</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 text-xs">$</span>
                            <input className={`${inputCls} w-16 text-right`} type="number" min={1} value={zoneEdit.rate ?? ""}
                              onChange={(e) => setZoneEdit((p) => ({ ...p, rate: Number(e.target.value) }))} />
                            <span className="text-slate-500 text-xs">/hr</span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-slate-300">${zone.rate}/hr</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">System Users</p>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-mono uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add User
              </button>
            </div>

            <div className="border border-[#1e2d45] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0b1120] border-b border-[#1e2d45]">
                    {["Name", "Email", "Bookings", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-slate-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d45]">
                  {showAddUser && (
                    <tr className="bg-amber-500/5">
                      <td className="px-4 py-3"><input className={inputCls} placeholder="Full name" value={newUser.name}
                        onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} /></td>
                      <td className="px-4 py-3"><input className={inputCls} type="email" placeholder="email@example.com" value={newUser.email}
                        onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} /></td>
                      <td className="px-4 py-3"><input className={`${inputCls} w-16`} type="number" min={0} value={newUser.bookings}
                        onChange={(e) => setNewUser((p) => ({ ...p, bookings: Number(e.target.value) }))} /></td>
                      <td className="px-4 py-3">
                        <select className={inputCls} value={newUser.status}
                          onChange={(e) => setNewUser((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))}>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={addUser} className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button onClick={() => setShowAddUser(false)} className="p-1.5 border border-[#1e2d45] hover:bg-[#1e2d45] transition-colors">
                            <X className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {userRows.map((user) => {
                    const isEditing = editingUserId === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-[#0d1627] transition-colors">
                        <td className="px-4 py-3">
                          {isEditing ? <input className={inputCls} value={userEdit.name ?? ""}
                            onChange={(e) => setUserEdit((p) => ({ ...p, name: e.target.value }))} />
                            : <span className="text-sm text-slate-200">{user.name}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? <input className={inputCls} type="email" value={userEdit.email ?? ""}
                            onChange={(e) => setUserEdit((p) => ({ ...p, email: e.target.value }))} />
                            : <span className="text-xs font-mono text-slate-400">{user.email}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? <input className={`${inputCls} w-16`} type="number" min={0} value={userEdit.bookings ?? 0}
                            onChange={(e) => setUserEdit((p) => ({ ...p, bookings: Number(e.target.value) }))} />
                            : <span className="text-xs font-mono text-slate-300">{user.bookings}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => !isEditing && toggleStatus(user.id)}
                            disabled={isEditing}
                            className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors border ${
                              user.status === "active"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700"
                            } ${isEditing ? "cursor-default opacity-60" : "cursor-pointer"}`}
                          >
                            {user.status}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {isEditing ? (
                              <>
                                <button onClick={saveUser} className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                </button>
                                <button onClick={() => setEditingUserId(null)} className="p-1.5 border border-[#1e2d45] hover:bg-[#1e2d45] transition-colors">
                                  <X className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditUser(user)} className="p-1.5 border border-[#1e2d45] hover:border-amber-500/40 transition-colors group">
                                  <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                                </button>
                                <button onClick={() => deleteUser(user.id)} className="p-1.5 border border-[#1e2d45] hover:border-red-500/40 transition-colors group">
                                  <Trash2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
