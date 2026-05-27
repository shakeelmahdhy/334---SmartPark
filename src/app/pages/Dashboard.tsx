import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, MapPin, TrendingUp, Calendar, Radio } from "lucide-react";
import { ParkingZone, ParkingSpot } from "../components/ParkingZone";
import { api } from "../../lib/api";
import type { Booking, DashboardStats, DetectionEvent, ParkingSpotApi } from "../../lib/types";

type ZoneMap = Record<string, ParkingSpot[]>;

function mapSpot(s: ParkingSpotApi): ParkingSpot {
  const status =
    s.status === "maintenance"
      ? "occupied"
      : (s.status as ParkingSpot["status"]);
  return {
    id: s.spot_number,
    zone: s.zone,
    db_id: s.id,
    status,
  };
}

function groupByZone(spots: ParkingSpot[]): ZoneMap {
  return spots.reduce<ZoneMap>((acc, spot) => {
    const zone = spot.zone;
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(spot);
    return acc;
  }, {});
}

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [zoneMap, setZoneMap] = useState<ZoneMap>({});
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [spots, stats, bookings, detections] = await Promise.all([
        api.getParkingSpots(),
        api.getDashboardStats(),
        api.getUserBookings(),
        api.getDetectionEvents(8),
      ]);
      setZoneMap(groupByZone(spots.map(mapSpot)));
      setDashboardStats(stats);
      setMyBookings(bookings);
      setDetectionEvents(detections);
    } catch {
      setLoadError("Could not load parking data. Check that the backend is running and you are signed in.");
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const ws = api.createWebSocket();
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (["initial_data", "parking_update", "booking_update", "stats_update"].includes(msg.type)) {
          fetchData();
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [fetchData]);

  const allSpots = Object.values(zoneMap).flat();
  const available =
    dashboardStats?.available ?? allSpots.filter((s) => s.status === "available").length;
  const occupied =
    dashboardStats?.occupied ?? allSpots.filter((s) => s.status === "occupied").length;
  const reserved =
    dashboardStats?.reserved ?? allSpots.filter((s) => s.status === "reserved").length;

  const filteredZones = Object.entries(zoneMap).filter(
    ([zone]) => selectedZone === "all" || selectedZone === zone
  );

  const bestZone = dashboardStats?.zone_stats?.length
    ? [...dashboardStats.zone_stats].sort(
        (a, b) => b.available / b.total_spots - a.available / a.total_spots
      )[0]
    : null;

  const handleCancelBooking = async (id: number) => {
    try {
      await api.cancelBooking(id);
      await fetchData();
    } catch {
      setLoadError("Failed to cancel booking.");
    }
  };

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Real-Time Status</p>
          <h1 className="text-xl font-semibold text-slate-100">Parking Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${
                loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"
              }`}
            />
            {loading ? "Loading…" : `Live · ${lastUpdate.toLocaleTimeString()}`}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-amber-400 hover:border-amber-500/40 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

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

      {loadError && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-2">
          <p className="text-xs font-mono text-red-400">{loadError}</p>
        </div>
      )}

      {!loading && allSpots.length === 0 && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-mono text-amber-400">
            No parking spots in the database. Ask an admin to run parking initialization from the admin panel.
          </p>
        </div>
      )}

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
            <option key={z} value={z}>
              Zone {z}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-5">
        <div className="space-y-4">
          {loading ? (
            <div className="bg-[#111827] border border-[#1e2d45] p-10 text-center">
              <p className="text-xs font-mono text-slate-500">Loading parking data…</p>
            </div>
          ) : filteredZones.length === 0 ? (
            <div className="bg-[#111827] border border-[#1e2d45] p-10 text-center">
              <p className="text-xs font-mono text-slate-500">No zones to display.</p>
            </div>
          ) : (
            filteredZones.map(([zone, spots]) => (
              <ParkingZone key={zone} zone={zone} spots={spots} searchQuery={searchQuery} />
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-[#111827] border border-amber-500/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Recommended</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Best Zone</p>
            <p className="text-4xl font-bold font-mono text-amber-400 mb-1">{bestZone?.zone ?? "—"}</p>
            <p className="text-sm font-mono text-slate-400 mb-3">
              {bestZone
                ? `${Math.round((bestZone.available / bestZone.total_spots) * 100)}% availability`
                : "—"}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
              <MapPin className="w-3 h-3" />
              {bestZone?.available ?? 0} spots open now
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Zone Overview</p>
            <div className="space-y-4">
              {(dashboardStats?.zone_stats ?? []).map((zs) => {
                const pct = zs.total_spots
                  ? Math.round((zs.available / zs.total_spots) * 100)
                  : 0;
                return (
                  <div key={zs.zone}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-slate-300">Zone {zs.zone}</span>
                      <span className="text-xs font-mono text-slate-500">
                        {zs.available}/{zs.total_spots}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#1e2d45]">
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Smart Detection Feed</span>
            </div>
            {detectionEvents.length === 0 ? (
              <p className="text-xs font-mono text-slate-600">No sensor events yet.</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {detectionEvents.map((event) => (
                  <li key={event.id} className="border border-[#1e2d45] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-mono text-slate-300">
                        {event.parking_spot?.spot_number ?? `Spot ${event.spot_id}`}
                      </p>
                      <span className="text-[10px] font-mono text-sky-400">
                        {Math.round(event.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {event.previous_status} to {event.detected_status}
                    </p>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                      {event.sensor_id} - {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">My Bookings</span>
            </div>
            {myBookings.length === 0 ? (
              <p className="text-xs font-mono text-slate-600">No bookings yet.</p>
            ) : (
              <ul className="space-y-3 max-h-48 overflow-y-auto">
                {myBookings.slice(0, 8).map((b) => (
                  <li key={b.id} className="border border-[#1e2d45] px-3 py-2">
                    <p className="text-xs font-mono text-slate-300">
                      {b.parking_spot?.spot_number ?? `Spot #${b.spot_id}`}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {new Date(b.start_time).toLocaleString()} · {b.status}
                    </p>
                    {["confirmed", "active", "pending"].includes(b.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(b.id)}
                        className="mt-2 text-[10px] font-mono text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
