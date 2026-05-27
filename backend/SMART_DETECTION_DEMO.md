# Smart Detection Demo

This demo uses structured simulated camera events to update parking spot state in real time.

## 1. Seed large demo data

From the `backend` folder:

```powershell
python seed_smart_demo_data.py --reset
```

This creates:

- 100 users
- 100 vehicles
- 100 parking spots
- 250 bookings
- 300 occupancy logs
- 100 smart detection events
- 100 daily analytics records

Demo logins:

- Admin: `admin` / `admin123`
- User: `user001` / `password123`

## 2. Start the app

Backend:

```powershell
python main.py
```

Frontend, from the project root:

```powershell
npm run dev
```

## 3. Run the live simulated feed

Keep the backend and frontend running, then from `backend` run:

```powershell
python simulate_detection_feed.py --events 100 --interval 1
```

Each event posts structured data to `POST /api/parking/detections`, such as:

```json
{
  "spot_id": 12,
  "sensor_id": "CAM-A-03",
  "event_type": "live_simulated_camera",
  "detected_status": "occupied",
  "confidence": 0.94,
  "payload": {
    "frame_id": "live-frame-0001",
    "source": "simulate_detection_feed.py"
  }
}
```

The backend stores the detection event, updates the parking spot state, writes an occupancy log when the effective state changes, keeps booking transitions consistent, and broadcasts websocket updates to the dashboard.
