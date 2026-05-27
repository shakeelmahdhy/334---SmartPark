import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { Calendar, Clock, MapPin, Check, X, Car, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import type { Booking as BookingRecord, BookingQuote } from "../../lib/types";

export function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const spot = location.state?.spot;

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleLicense, setVehicleLicense] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const data = await api.getUserBookings();
      setBookings(data);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const buildWindow = useCallback(() => {
    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();
    return { startISO, endISO };
  }, [date, startTime, endTime]);

  useEffect(() => {
    if (!spot?.db_id) return;

    let ignore = false;
    const loadQuote = async () => {
      setQuoteLoading(true);
      setBookingError("");
      try {
        const { startISO, endISO } = buildWindow();
        const serverQuote = await api.getBookingQuote({
          spot_id: spot.db_id,
          start_time: startISO,
          end_time: endISO,
        });
        if (!ignore) setQuote(serverQuote);
      } catch {
        if (!ignore) {
          setQuote(null);
          setBookingError("This spot is no longer available, or the selected time is invalid.");
        }
      } finally {
        if (!ignore) setQuoteLoading(false);
      }
    };

    loadQuote();
    return () => {
      ignore = true;
    };
  }, [spot?.db_id, buildWindow]);

  const confirmBooking = async () => {
    setLoading(true);
    setBookingError("");
    try {
      const { startISO, endISO } = buildWindow();
      await api.createBooking({
        spot_id: spot.db_id,
        vehicle_license: vehicleLicense.trim(),
        start_time: startISO,
        end_time: endISO,
      });

      setBookingConfirmed(true);
      await fetchBookings();
      setTimeout(() => navigate("/booking", { replace: true, state: null }), 2000);
    } catch {
      setBookingError("Booking failed. The spot may no longer be available.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[#0b1120] border border-[#1e2d45] text-slate-200 px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500/60 transition-colors";
  const labelCls = "block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2";
  const totalPrice = quote ? `$${quote.total_price.toFixed(2)}` : "-";
  const activeBookings = bookings.filter((booking) =>
    ["confirmed", "active", "pending"].includes(booking.status)
  );

  const handleCancelBooking = async (bookingId: number) => {
    setBookingError("");
    try {
      await api.cancelBooking(bookingId);
      await fetchBookings();
    } catch {
      setBookingError("Failed to cancel booking.");
    }
  };

  if (!spot?.db_id) {
    return (
      <div className="p-7 bg-[#0b1120] min-h-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Reservations</p>
            <h1 className="text-xl font-semibold text-slate-100">My Bookings</h1>
          </div>
          <button
            onClick={fetchBookings}
            disabled={bookingsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d45] text-slate-400 hover:text-amber-400 text-xs font-mono uppercase disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${bookingsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {bookingError && (
          <p className="text-xs font-mono text-red-400 mb-4 bg-red-500/10 border border-red-500/30 px-3 py-2">
            {bookingError}
          </p>
        )}

        <div className="bg-[#111827] border border-[#1e2d45]">
          {bookingsLoading ? (
            <p className="text-xs font-mono text-slate-500 p-8 text-center">Loading bookings...</p>
          ) : activeBookings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-300 mb-2">No reserved spots yet.</p>
              <button
                onClick={() => navigate("/dashboard")}
                className="text-xs font-mono text-amber-400 hover:text-amber-300"
              >
                Find an available spot
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#1e2d45]">
              {activeBookings.map((booking) => (
                <li key={booking.id} className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {booking.parking_spot?.spot_number ?? `Spot ${booking.spot_id}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span>Zone {booking.parking_spot?.zone ?? "-"}</span>
                      <span>{new Date(booking.start_time).toLocaleString()}</span>
                      <span>{booking.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-amber-400">${booking.price.toFixed(2)}</p>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="mt-2 text-[10px] font-mono text-red-400 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 bg-[#0b1120] min-h-full">
      <div className="mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs font-mono text-slate-500 hover:text-amber-400 transition-colors mb-4 flex items-center gap-1"
        >
          Back to Dashboard
        </button>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Reservation</p>
        <h1 className="text-xl font-semibold text-slate-100">Book Parking Spot</h1>
      </div>

      <div className="max-w-lg">
        <div className="bg-[#111827] border border-[#1e2d45] p-6">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-5">Booking Details</p>

          <div className="flex items-center gap-4 bg-[#0b1120] border border-[#1e2d45] px-4 py-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <span className="text-xs font-mono font-bold text-emerald-400">{spot.id}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Spot {spot.id}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-mono text-slate-500">Zone {spot.zone}</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className={labelCls}><Car className="w-3 h-3 inline mr-1.5" />Vehicle License Plate</label>
            <input
              type="text"
              placeholder="Vehicle plate"
              value={vehicleLicense}
              onChange={(e) => setVehicleLicense(e.target.value.toUpperCase())}
              className={inputCls}
            />
          </div>

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

          {bookingError && !showConfirmation && (
            <p className="text-xs font-mono text-red-400 mb-4 bg-red-500/10 border border-red-500/30 px-3 py-2">
              {bookingError}
            </p>
          )}

          <div className="bg-[#0b1120] border border-[#1e2d45] px-4 py-4 mb-6 space-y-3">
            {[
              ["Duration", quote ? `${quote.duration_hours} hrs` : quoteLoading ? "Loading..." : "-"],
              ["Rate", quote ? `$${quote.hourly_rate.toFixed(2)} / hr` : "-"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="font-mono text-slate-500">{label}</span>
                <span className="font-mono text-slate-300">{value}</span>
              </div>
            ))}
            <div className="border-t border-[#1e2d45] pt-3 flex justify-between">
              <span className="font-mono text-slate-400 text-sm">Total</span>
              <span className="font-mono font-bold text-amber-400 text-lg">{totalPrice}</span>
            </div>
          </div>

          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!quote || quoteLoading || !vehicleLicense.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 text-sm transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1e2d45] w-full max-w-sm p-8">
            {!bookingConfirmed ? (
              <>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Confirm Reservation</p>
                <div className="space-y-3 mb-6">
                  {[
                    ["Spot", spot.id],
                    ["Plate", vehicleLicense || "-"],
                    ["Date", new Date(date).toLocaleDateString()],
                    ["Time", `${startTime} - ${endTime}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="font-mono text-slate-500">{label}</span>
                      <span className="font-mono text-slate-200">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#1e2d45] pt-3">
                    <span className="font-mono text-slate-400">Total</span>
                    <span className="font-mono font-bold text-amber-400 text-lg">{totalPrice}</span>
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
                    {loading ? "Booking..." : "Confirm"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="font-semibold text-slate-100 mb-1">Booking Confirmed</p>
                <p className="text-xs font-mono text-slate-500">Returning to dashboard...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
