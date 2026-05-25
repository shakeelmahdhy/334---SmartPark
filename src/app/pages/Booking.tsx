import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Calendar, Clock, MapPin, Check, X, Car } from "lucide-react";
import { api } from "../../lib/api";

export function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const spot = location.state?.spot || { id: "A1", db_id: undefined, status: "available" };

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleLicense, setVehicleLicense] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmBooking = async () => {
    setLoading(true);
    setBookingError("");
    try {
      if (spot.db_id) {
        // Build ISO datetime strings
        const startISO = new Date(`${date}T${startTime}:00`).toISOString();
        const endISO = new Date(`${date}T${endTime}:00`).toISOString();
        await api.createBooking({
          spot_id: spot.db_id,
          vehicle_license: vehicleLicense || "DEMO-001",
          start_time: startISO,
          end_time: endISO,
        });
      }
      // Mock confirm if no db_id (backend not connected)
      setBookingConfirmed(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch {
      setBookingError("Booking failed. The spot may no longer be available.");
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = () => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  const calculatePrice = () => (calculateDuration() * 5).toFixed(2);

  const inputCls =
    "w-full bg-[#0b1120] border border-[#1e2d45] text-slate-200 px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500/60 transition-colors";
  const labelCls = "block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2";

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      <div className="mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs font-mono text-slate-500 hover:text-amber-400 transition-colors mb-4 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Reservation</p>
        <h1 className="text-xl font-semibold text-slate-100">Book Parking Spot</h1>
      </div>

      <div className="max-w-lg">
        <div className="bg-[#111827] border border-[#1e2d45] p-6">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-5">Booking Details</p>

          {/* Selected spot */}
          <div className="flex items-center gap-4 bg-[#0b1120] border border-[#1e2d45] px-4 py-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <span className="text-xs font-mono font-bold text-emerald-400">{spot.id}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Spot {spot.id}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-mono text-slate-500">Zone {spot.id[0]}</span>
              </div>
            </div>
          </div>

          {/* Vehicle license */}
          <div className="mb-4">
            <label className={labelCls}><Car className="w-3 h-3 inline mr-1.5" />Vehicle License Plate</label>
            <input
              type="text"
              placeholder="e.g. ABC-1234"
              value={vehicleLicense}
              onChange={(e) => setVehicleLicense(e.target.value.toUpperCase())}
              className={inputCls}
            />
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className={labelCls}><Calendar className="w-3 h-3 inline mr-1.5" />Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className={labelCls}><Clock className="w-3 h-3 inline mr-1.5" />Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Clock className="w-3 h-3 inline mr-1.5" />End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#0b1120] border border-[#1e2d45] px-4 py-4 mb-6 space-y-3">
            {[
              ["Duration", `${calculateDuration()} hrs`],
              ["Rate", "$5.00 / hr"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="font-mono text-slate-500">{label}</span>
                <span className="font-mono text-slate-300">{value}</span>
              </div>
            ))}
            <div className="border-t border-[#1e2d45] pt-3 flex justify-between">
              <span className="font-mono text-slate-400 text-sm">Total</span>
              <span className="font-mono font-bold text-amber-400 text-lg">${calculatePrice()}</span>
            </div>
          </div>

          <button
            onClick={() => setShowConfirmation(true)}
            disabled={calculateDuration() <= 0}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 text-sm transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1e2d45] w-full max-w-sm p-8">
            {!bookingConfirmed ? (
              <>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Confirm Reservation</p>
                <div className="space-y-3 mb-6">
                  {[
                    ["Spot", spot.id],
                    ["Plate", vehicleLicense || "—"],
                    ["Date", new Date(date).toLocaleDateString()],
                    ["Time", `${startTime} – ${endTime}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="font-mono text-slate-500">{label}</span>
                      <span className="font-mono text-slate-200">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#1e2d45] pt-3">
                    <span className="font-mono text-slate-400">Total</span>
                    <span className="font-mono font-bold text-amber-400 text-lg">${calculatePrice()}</span>
                  </div>
                </div>

                {bookingError && (
                  <p className="text-xs font-mono text-red-400 mb-4 bg-red-500/10 border border-red-500/30 px-3 py-2">
                    {bookingError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#1e2d45] text-slate-400 hover:text-slate-200 text-sm font-mono transition-colors"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={confirmBooking}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold text-sm transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    {loading ? "Booking…" : "Confirm"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="font-semibold text-slate-100 mb-1">Booking Confirmed</p>
                <p className="text-xs font-mono text-slate-500">Returning to dashboard…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
