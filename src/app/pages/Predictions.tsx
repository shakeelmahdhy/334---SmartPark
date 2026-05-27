import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Calendar, Clock, MapPin, Lightbulb, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../lib/api";
import type { AnalyticsResponse, RecommendationResponse } from "../../lib/types";

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

export function Predictions() {
  const [selectedTime, setSelectedTime] = useState("15:00");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rec, setRec] = useState<RecommendationResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const startISO = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const end = new Date(`${selectedDate}T${selectedTime}:00`);
      end.setHours(end.getHours() + 2);
      const endISO = end.toISOString();

      const [recommendations, analyticsData] = await Promise.all([
        api.getRecommendations({ start_time: startISO, end_time: endISO }),
        api.getAnalytics(),
      ]);
      setRec(recommendations);
      setAnalytics(analyticsData);
    } catch {
      setError("Could not load predictions. Ensure you are signed in and the backend is running.");
      setRec(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTime]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const zoneAvailability = rec?.zone_availability ?? {};
  const predictedOccupancy = rec?.predicted_occupancy ?? {};

  const availabilityValues = Object.values(zoneAvailability);
  const overallAvailability =
    availabilityValues.length > 0
      ? Math.round(
          availabilityValues.reduce((a, b) => a + b, 0) / availabilityValues.length
        )
      : 0;

  const bestZoneEntry = Object.entries(zoneAvailability).sort((a, b) => b[1] - a[1])[0];
  const bestZone = bestZoneEntry?.[0] ?? "-";
  const bestZonePct = bestZoneEntry?.[1] ?? 0;

  const zoneChartData = Object.keys(zoneAvailability).map((zone) => ({
    zone: `Zone ${zone}`,
    current: zoneAvailability[zone] ?? 0,
    predicted: Math.max(0, 100 - (predictedOccupancy[zone] ?? 0)),
  }));

  const peakHours = analytics?.peak_hours ?? [];
  const topPeak = [...peakHours]
    .sort((a, b) => b.occupancy_rate - a.occupancy_rate)
    .slice(0, 3);

  const hourlyTrend = peakHours
    .filter((p) => p.hour >= 6 && p.hour <= 20)
    .map((p) => ({
      time: formatHour(p.hour),
      availability: Math.max(0, 100 - p.occupancy_rate),
    }));

  const confidence = analytics?.predictions?.[0]?.confidence;
  const confidencePct = confidence == null ? null : Math.round(confidence * 100);

  const inputCls =
    "w-full bg-[#0b1120] border border-[#1e2d45] text-slate-200 px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500/60 transition-colors";
  const labelCls = "block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2";

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">AI Predictions</p>
          <h1 className="text-xl font-semibold text-slate-100">Predictive Analytics</h1>
        </div>
        <button
          onClick={fetchPredictions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-amber-400 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
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

      <div className="grid grid-cols-[1fr_260px] gap-5">
        <div className="space-y-4">
          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">
              Predict Availability
            </p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="bg-[#0b1120] border border-amber-500/20 px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                  Prediction Result
                </span>
              </div>
              <div className="flex items-end gap-4 mb-4">
                <span className="text-6xl font-bold font-mono text-amber-400">
                  {loading ? "..." : overallAvailability}%
                </span>
                <div className="pb-1">
                  <p className="text-sm text-slate-300">avg zone availability</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    at {selectedTime} - {new Date(selectedDate).toLocaleDateString()}
                  </p>
                  {rec && (
                    <p className="text-xs font-mono text-emerald-400/80 mt-1">
                      {rec.recommended_spots.length} spots bookable for this window
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1.5">
                  <span>Confidence</span>
                  <span>{confidencePct == null ? "-" : `${confidencePct}%`}</span>
                </div>
                <div className="w-full h-1 bg-[#1e2d45]">
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${confidencePct ?? 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">
              Hourly Availability Trend
            </p>
            {hourlyTrend.length === 0 ? (
              <p className="text-xs font-mono text-slate-600 py-8 text-center">No hourly data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={hourlyTrend}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono, monospace" }} />
                  <Line type="monotone" dataKey="availability" stroke="#f59e0b" strokeWidth={2} dot={false} name="Availability %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Zone Comparison</p>
            {zoneChartData.length === 0 ? (
              <p className="text-xs font-mono text-slate-600 py-8 text-center">No zone data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zoneChartData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                  <XAxis dataKey="zone" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono, monospace" }} />
                  <Bar dataKey="current" fill="#f59e0b" name="Availability %" />
                  <Bar dataKey="predicted" fill="#38bdf8" name="Predicted avail %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#111827] border border-amber-500/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Suggested Zone</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Best availability</p>
            <p className="text-4xl font-bold font-mono text-amber-400 mb-1">{bestZone}</p>
            <p className="text-sm font-mono text-slate-400 mb-3">{bestZonePct}% available now</p>
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
              <MapPin className="w-3 h-3" />
              Based on live spot & booking data
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Peak Hours</p>
            {topPeak.length === 0 ? (
              <p className="text-xs font-mono text-slate-600">No peak hour data yet.</p>
            ) : (
              <div className="space-y-2">
                {topPeak.map((p, i) => {
                  const label = `Rank ${i + 1}`;
                  const colors = [
                    "text-red-400 bg-red-500/10 border-red-500/20",
                    "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  ];
                  return (
                    <div
                      key={p.hour}
                      className={`flex items-center justify-between px-3 py-2.5 border ${colors[i] ?? colors[2]}`}
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-200">{label}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          {formatHour(p.hour)} - {p.bookings} bookings
                        </p>
                      </div>
                      <span className={`text-sm font-bold font-mono ${colors[i]?.split(" ")[0]}`}>
                        {Math.round(p.occupancy_rate)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
