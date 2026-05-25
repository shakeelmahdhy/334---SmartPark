import { useState } from "react";
import { TrendingUp, Calendar, Clock, MapPin, Lightbulb } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const hourlyData = [
  { time: "8 AM", availability: 45, predicted: 50 },
  { time: "9 AM", availability: 30, predicted: 35 },
  { time: "10 AM", availability: 25, predicted: 28 },
  { time: "11 AM", availability: 20, predicted: 22 },
  { time: "12 PM", availability: 15, predicted: 18 },
  { time: "1 PM", availability: 18, predicted: 20 },
  { time: "2 PM", availability: 25, predicted: 28 },
  { time: "3 PM", availability: 40, predicted: 42 },
  { time: "4 PM", availability: 50, predicted: 48 },
  { time: "5 PM", availability: 60, predicted: 58 },
  { time: "6 PM", availability: 70, predicted: 72 },
];

const zoneData = [
  { zone: "Zone A", current: 65, predicted: 70 },
  { zone: "Zone B", current: 45, predicted: 50 },
  { zone: "Zone C", current: 85, predicted: 90 },
  { zone: "Zone D", current: 30, predicted: 35 },
];

const chartTooltipStyle = {
  contentStyle: { backgroundColor: "#111827", border: "1px solid #1e2d45", borderRadius: 0, fontSize: 11, fontFamily: "DM Mono, monospace" },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#dde3ee" },
};

export function Predictions() {
  const [selectedTime, setSelectedTime] = useState("15:00");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const getPrediction = (time: string) => {
    const h = parseInt(time.split(":")[0]);
    if (h >= 8 && h <= 11) return 25;
    if (h >= 12 && h <= 14) return 18;
    if (h >= 15 && h <= 17) return 45;
    return 70;
  };

  const prediction = getPrediction(selectedTime);
  const bestZone = zoneData.reduce((best, z) => (z.predicted > best.predicted ? z : best));

  const inputCls =
    "w-full bg-[#0b1120] border border-[#1e2d45] text-slate-200 px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500/60 transition-colors";
  const labelCls = "block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2";

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">AI Predictions</p>
        <h1 className="text-xl font-semibold text-slate-100">Predictive Analytics</h1>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-5">
        {/* Main */}
        <div className="space-y-4">
          {/* Predict card */}
          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">
              Predict Availability
            </p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}><Calendar className="w-3 h-3 inline mr-1" />Date</label>
                <input type="date" value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}><Clock className="w-3 h-3 inline mr-1" />Time</label>
                <input type="time" value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className={inputCls} />
              </div>
            </div>

            {/* Result */}
            <div className="bg-[#0b1120] border border-amber-500/20 px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                  Prediction Result
                </span>
              </div>
              <div className="flex items-end gap-4 mb-4">
                <span className="text-6xl font-bold font-mono text-amber-400">{prediction}%</span>
                <div className="pb-1">
                  <p className="text-sm text-slate-300">chance of availability</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    at {selectedTime} · {new Date(selectedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1.5">
                  <span>Confidence</span><span>95%</span>
                </div>
                <div className="w-full h-1 bg-[#1e2d45]">
                  <div className="h-full bg-amber-500 w-[95%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Hourly trend */}
          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">
              Hourly Availability Trend
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart id="chart-hourly-trend" data={hourlyData}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono, monospace" }} />
                <Line type="monotone" dataKey="availability" stroke="#f59e0b" strokeWidth={2} dot={false} name="Current" />
                <Line type="monotone" dataKey="predicted" stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Zone comparison */}
          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">
              Zone Comparison
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart id="chart-zone-comparison" data={zoneData}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1e2d45" />
                <XAxis dataKey="zone" tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono, monospace", fill: "#64748b" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono, monospace" }} />
                <Bar dataKey="current" fill="#f59e0b" name="Current" />
                <Bar dataKey="predicted" fill="#38bdf8" name="Predicted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Suggested zone */}
          <div className="bg-[#111827] border border-amber-500/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                Suggested Zone
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Least Congested</p>
            <p className="text-4xl font-bold font-mono text-amber-400 mb-1">{bestZone.zone.split(" ")[1]}</p>
            <p className="text-sm font-mono text-slate-400 mb-3">{bestZone.predicted}% predicted</p>
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
              <MapPin className="w-3 h-3" />Closest to main entrance
            </div>
          </div>

          {/* Peak hours */}
          <div className="bg-[#111827] border border-[#1e2d45] p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Peak Hours</p>
            <div className="space-y-2">
              {[
                { label: "High Traffic", time: "9 AM – 11 AM", pct: 85, color: "text-red-400 bg-red-500/10 border-red-500/20" },
                { label: "Moderate", time: "12 PM – 2 PM", pct: 60, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { label: "Low Traffic", time: "3 PM – 6 PM", pct: 25, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              ].map(({ label, time, pct, color }) => (
                <div key={label} className={`flex items-center justify-between px-3 py-2.5 border ${color}`}>
                  <div>
                    <p className="text-xs font-medium text-slate-200">{label}</p>
                    <p className="text-[10px] font-mono text-slate-500">{time}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${color.split(" ")[0]}`}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
