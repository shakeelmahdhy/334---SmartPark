import { useState, useEffect } from "react";
import { Search, RefreshCw, MapPin, TrendingUp } from "lucide-react";
import { ParkingZone, ParkingSpot } from "../components/ParkingZone";
import { api } from "../../lib/api";

// Fallback mock data used when backend is unavailable or returns no spots
const MOCK_SPOTS: ParkingSpot[] = [
  { id: "A1", status: "available" }, { id: "A2", status: "occupied" },
  { id: "A3", status: "available" }, { id: "A4", status: "available" },
  { id: "A5", status: "reserved" }, { id: "A6", status: "occupied" },
  { id: "A7", status: "available" }, { id: "A8", status: "available" },
  { id: "B1", status: "occupied" }, { id: "B2", status: "occupied" },
  { id: "B3", status: "available" }, { id: "B4", status: "reserved" },
  { id: "B5", status: "occupied" }, { id: "B6", status: "available" },
  { id: "C1", status: "available" }, { id: "C2", status: "available" },
  { id: "C3", status: "available" }, { id: "C4", status: "available" },
  { id: "C5", status: "occupied" }, { id: "C6", status: "available" },
  { id: "C7", status: "available" }, { id: "C8", status: "reserved" },
  { id: "C9", status: "available" }, { id: "C10", status: "available" },
  { id: "D1", status: "occupied" }, { id: "D2", status: "occupied" },
  { id: "D3", status: "occupied" }, { id: "D4", status: "available" },
  { id: "D5", status: "occupied" }, { id: "D6", status: "reserved" },
];

type ZoneMap = Record<string, ParkingSpot[]>;

function groupByZone(spots: ParkingSpot[]): ZoneMap {
  return spots.reduce<ZoneMap>((acc, spot) => {
    const zone = spot.id[0];
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(spot);
    return acc;
  }, {});
}

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [zoneMap, setZoneMap] = useState<ZoneMap>(groupByZone(MOCK_SPOTS));
  const [loading, setLoading] = useState(true);

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const data = await api.getParkingSpots();
      // Map API response: {id, spot_number, zone, status, ...}
      const mapped: ParkingSpot[] = data.map((s: any) => ({
        id: s.spot_number,
        db_id: s.id,
        status: s.status === "maintenance" ? "occupied" : s.status,
      }));
      // Fall back to mock data if backend returns empty list
      setZoneMap(groupByZone(mapped.length > 0 ? mapped : MOCK_SPOTS));
    } catch {
      // Backend unavailable — use mock data
      setZoneMap(groupByZone(MOCK_SPOTS));
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => { fetchSpots(); }, []);

  const allSpots = Object.values(zoneMap).flat();
  const available = allSpots.filter((s) => s.status === "available").length;
  const occupied = allSpots.filter((s) => s.status === "occupied").length;
  const reserved = allSpots.filter((s) => s.status === "reserved").length;

  const filteredZones = Object.entries(zoneMap).filter(
    ([zone]) => selectedZone === "all" || selectedZone === zone
  );

  const bestZone = Object.entries(zoneMap).reduce<{ zone: string; avail: number; pct: number } | null>(
    (best, [zone, spots]) => {
      const avail = spots.filter((s) => s.status === "available").length;
      const pct = spots.length ? Math.round((avail / spots.length) * 100) : 0;
      return !best || pct > best.pct ? { zone, avail, pct } : best;
    },
    null
  );

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Real-Time Status</p>
          <h1 className="text-xl font-semibold text-slate-100">Parking Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
            {loading ? "Loading…" : `Live · ${lastUpdate.toLocaleTimeString()}`}
          </div>
          <button
            onClick={fetchSpots}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-amber-400 hover:border-amber-500/40 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-px bg-[#1e2d45] mb-6 border border-[#1e2d45]">
        {[
          { label: "Available", value: available, color: "text-emerald-400" },
          { label: "Occupied", value: occupied, color: "text-red-400" },
          { label: "Reserved", value: reserved, color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111827] px-5 py-4">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-xs font-mono text-slate-600 mt-1">spots</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search spot ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-[#1e2d45] text-slate-200 placeholder-slate-600 pl-9 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="bg-[#111827] border border-[#1e2d45] text-slate-300 px-4 py-2.5 text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-amber-500/60 transition-colors"
        >
          <option value="all">All Zones</option>
          {Object.keys(zoneMap).sort().map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-5">
        {/* Zones */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-[#111827] border border-[#1e2d45] p-10 text-center">
              <p className="text-xs font-mono text-slate-500">Loading parking data…</p>
            </div>
          ) : (
            filteredZones.map(([zone, spots]) => (
              <ParkingZone key={zone} zone={zone} spots={spots} searchQuery={searchQuery} />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#111827] border border-amber-500/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Recommended</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Best Zone</p>
            <p className="text-4xl font-bold font-mono text-amber-400 mb-1">{bestZone?.zone ?? "—"}</p>
            <p className="text-sm font-mono text-slate-400 mb-3">{bestZone?.pct ?? 0}% availability</p>
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
              <MapPin className="w-3 h-3" />{bestZone?.avail ?? 0} spots open now
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Zone Overview</p>
            <div className="space-y-4">
              {Object.entries(zoneMap).sort().map(([zone, spots]) => {
                const avail = spots.filter((s) => s.status === "available").length;
                const pct = spots.length ? Math.round((avail / spots.length) * 100) : 0;
                return (
                  <div key={zone}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-slate-300">Zone {zone}</span>
                      <span className="text-xs font-mono text-slate-500">{avail}/{spots.length}</span>
                    </div>
                    <div className="w-full h-1 bg-[#1e2d45]">
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
