"""
Simple API test script to verify the backend is working
Run this after starting the backend server
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

def test_api():
    print("\n🚀 Starting API Tests...\n")

    # Test 1: Health Check
    print("Test 1: Health Check")
    response = requests.get(f"{BASE_URL}/health")
    print_response("Health Check", response)
    assert response.status_code == 200, "Health check failed"

    # Test 2: Register User
    print("\nTest 2: Register User")
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpass123",
        "full_name": "Test User"
    }
    response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
    print_response("Register User", response)

    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"\n✅ User registered successfully! Token: {token[:20]}...")
    else:
        print("\n⚠️ User might already exist, trying to login...")

        # Test 3: Login
        print("\nTest 3: Login")
        login_data = {
            "username": "testuser",
            "password": "testpass123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print_response("Login", response)
        assert response.status_code == 200, "Login failed"
        token = response.json()["access_token"]
        print(f"\n✅ Login successful! Token: {token[:20]}...")

    headers = {"Authorization": f"Bearer {token}"}

    # Test 4: Get Current User
    print("\nTest 4: Get Current User")
    response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    print_response("Current User", response)
    assert response.status_code == 200, "Get current user failed"

    # Test 5: Get Dashboard Stats
    print("\nTest 5: Get Dashboard Stats")
    response = requests.get(f"{BASE_URL}/api/parking/dashboard", headers=headers)
    print_response("Dashboard Stats", response)
    assert response.status_code == 200, "Get dashboard stats failed"

    stats = response.json()
    if stats["total_spots"] == 0:
        print("\n⚠️ No parking spots found. You need to initialize them.")
        print("Run: POST /api/parking/initialize (requires admin access)")
    else:
        print(f"\n✅ Found {stats['total_spots']} parking spots")

    # Test 6: Get Parking Spots
    print("\nTest 6: Get Parking Spots")
    response = requests.get(f"{BASE_URL}/api/parking/spots", headers=headers)
    print_response("Parking Spots", response)
    assert response.status_code == 200, "Get parking spots failed"

    spots = response.json()
    if len(spots) > 0:
        print(f"\n✅ Retrieved {len(spots)} parking spots")

        spot_id = spots[0]["id"]

        # Test 7: Create Booking
        print("\nTest 7: Create Booking")
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)

        booking_data = {
            "spot_id": spot_id,
            "vehicle_license": "ABC-1234",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers=headers
        )
        print_response("Create Booking", response)

        if response.status_code == 200:
            print("\n✅ Booking created successfully!")
            booking_id = response.json()["id"]

            # Test 8: Get User Bookings
            print("\nTest 8: Get User Bookings")
            response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
            print_response("User Bookings", response)
            assert response.status_code == 200, "Get user bookings failed"

            # Test 9: Get Recommendations
            print("\nTest 9: Get Recommendations")
            rec_data = {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "zone_preference": "A"
            }
            response = requests.post(
                f"{BASE_URL}/api/bookings/recommendations",
                json=rec_data,
                headers=headers
            )
            print_response("Recommendations", response)
            assert response.status_code == 200, "Get recommendations failed"

            print("\n✅ Got recommendations successfully!")

            # Test 10: Cancel Booking
            print("\nTest 10: Cancel Booking")
            response = requests.delete(
                f"{BASE_URL}/api/bookings/{booking_id}",
                headers=headers
            )
            print_response("Cancel Booking", response)
            assert response.status_code == 200, "Cancel booking failed"
            print("\n✅ Booking cancelled successfully!")

    print("\n" + "="*60)
    print("🎉 All API tests completed successfully!")
    print("="*60)
    print("\nBackend is working correctly! ✅")
    print("\nNext steps:")
    print("1. Start the frontend: pnpm dev")
    print("2. Create an admin user and initialize parking spots")
    print("3. Access the application in your browser")
    print("\n")

if __name__ == "__main__":
    try:
        test_api()
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to backend server")
        print("Make sure the backend is running on http://localhost:8000")
        print("Run: cd backend && python main.py")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
