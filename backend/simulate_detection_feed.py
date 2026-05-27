"""
Post a live simulated smart-spot detection feed to the running backend.

Start the backend first, then run:
    python simulate_detection_feed.py --events 100 --interval 1
"""

import argparse
import json
import random
import time
import urllib.parse
import urllib.request


def request_json(url: str, method: str = "GET", token: str | None = None, data: dict | None = None):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def login(base_url: str, username: str, password: str) -> str:
    form = urllib.parse.urlencode({
        "username": username,
        "password": password,
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/auth/login",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["access_token"]


def choose_next_status(current_status: str) -> str:
    if current_status == "available":
        return random.choices(["occupied", "reserved", "available"], weights=[70, 20, 10], k=1)[0]
    if current_status == "reserved":
        return random.choices(["occupied", "available", "reserved"], weights=[55, 30, 15], k=1)[0]
    if current_status == "occupied":
        return random.choices(["available", "occupied"], weights=[75, 25], k=1)[0]
    return "available"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--events", type=int, default=100)
    parser.add_argument("--interval", type=float, default=1.0)
    args = parser.parse_args()

    random.seed()
    token = login(args.base_url, args.username, args.password)
    print(f"Connected to {args.base_url} as {args.username}")
    print(f"Streaming {args.events} simulated detection events")

    for index in range(1, args.events + 1):
        spots = request_json(f"{args.base_url}/api/parking/spots", token=token)
        spot = random.choice(spots)
        detected_status = choose_next_status(spot["status"])
        sensor_id = f"CAM-{spot['zone']}-{random.randint(1, 8):02d}"

        event = {
            "spot_id": spot["id"],
            "sensor_id": sensor_id,
            "event_type": "live_simulated_camera",
            "detected_status": detected_status,
            "confidence": round(random.uniform(0.84, 0.99), 2),
            "payload": {
                "frame_id": f"live-frame-{index:04d}",
                "spot_number": spot["spot_number"],
                "zone": spot["zone"],
                "previous_status": spot["status"],
                "source": "simulate_detection_feed.py",
            },
        }

        processed = request_json(
            f"{args.base_url}/api/parking/detections",
            method="POST",
            token=token,
            data=event,
        )
        updated_spot = processed.get("parking_spot") or {}
        print(
            f"{index:03d}: {spot['spot_number']} {spot['status']} -> "
            f"{processed['detected_status']} "
            f"(effective: {updated_spot.get('status', 'unknown')}, "
            f"confidence: {processed['confidence']:.0%})"
        )
        time.sleep(args.interval)

    print("Detection feed complete")


if __name__ == "__main__":
    main()
