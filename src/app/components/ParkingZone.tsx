import { useNavigate } from "react-router";

export interface ParkingSpot {
  id: string;
  zone: string;
  db_id?: number;
  status: "available" | "occupied" | "reserved";
}

interface ParkingZoneProps {
  zone: string;
  spots: ParkingSpot[];
  searchQuery: string;
}

export function ParkingZone({ zone, spots, searchQuery }: ParkingZoneProps) {
  const navigate = useNavigate();

  const filteredSpots = spots.filter((spot) =>
    spot.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/30 hover:border-emerald-400";
      case "occupied":
        return "bg-red-500/20 border border-red-500/40 text-red-400 cursor-not-allowed";
      case "reserved":
        return "bg-amber-500/20 border border-amber-500/40 text-amber-400 cursor-not-allowed";
      default:
        return "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed";
    }
  };

  const handleSpotClick = (spot: ParkingSpot) => {
    if (spot.status === "available") {
      navigate("/booking", { state: { spot } });
    }
  };

  const available = spots.filter((s) => s.status === "available").length;
  const percentage = Math.round((available / spots.length) * 100);

  return (
    <div className="bg-[#111827] border border-[#1e2d45] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Zone</span>
            <span className="text-lg font-bold text-slate-100 font-mono">{zone}</span>
          </div>
          <p className="text-xs font-mono text-slate-500">{available}/{spots.length} available</p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold font-mono text-amber-400">{percentage}%</span>
          <div className="w-32 h-1.5 bg-[#1e2d45] mt-1.5">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {filteredSpots.map((spot) => (
          <button
            key={spot.id}
            onClick={() => handleSpotClick(spot)}
            disabled={spot.status !== "available"}
            title={spot.id}
            className={`aspect-square flex flex-col items-center justify-center text-[10px] font-mono font-medium transition-all ${getStatusColor(spot.status)}`}
          >
            {spot.id}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#1e2d45]">
        {[
          { color: "bg-emerald-500", label: "Available" },
          { color: "bg-red-500", label: "Occupied" },
          { color: "bg-amber-500", label: "Reserved" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase">
            <span className={`w-2 h-2 ${color} inline-block`} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}
