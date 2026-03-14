#!/usr/bin/env python3
"""
🎫 Viagogo API Client for KEEPUP
Fetches real events from Viagogo using their official API.

Usage:
    python viagogo_api.py [city] [--save]

Examples:
    python viagogo_api.py "Porto Alegre" --save
    python viagogo_api.py "São Paulo"
    
Environment Variables:
    VIAGOGO_CLIENT_ID     - Your Viagogo API client ID
    VIAGOGO_CLIENT_SECRET - Your Viagogo API client secret
    PG_DB_USER, PG_DB_PASSWORD, PG_DB_NAME - Postgres credentials
"""

import os
import sys
import json
import base64
import requests
from datetime import datetime
from urllib.parse import urlencode

# Postgres connection
import psycopg2

# City coordinates for geolocation
CITY_COORDS = {
    'Porto Alegre': {'lat': -30.0346, 'lng': -51.2177, 'country': 'BR'},
    'São Paulo': {'lat': -23.5505, 'lng': -46.6333, 'country': 'BR'},
    'Rio de Janeiro': {'lat': -22.9068, 'lng': -43.1729, 'country': 'BR'},
    'Brasília': {'lat': -15.7939, 'lng': -47.8828, 'country': 'BR'},
    'Salvador': {'lat': -12.9714, 'lng': -38.5014, 'country': 'BR'},
    'Curitiba': {'lat': -25.4290, 'lng': -49.2671, 'country': 'BR'},
    'Belo Horizonte': {'lat': -19.9167, 'lng': -43.9345, 'country': 'BR'},
    'Manaus': {'lat': -3.1190, 'lng': -60.0217, 'country': 'BR'},
    'Recife': {'lat': -8.0476, 'lng': -34.8770, 'country': 'BR'},
    'Fortaleza': {'lat': -3.7172, 'lng': -38.5433, 'country': 'BR'},
}

# API endpoints
VIAGOGO_TOKEN_URL = 'https://account.viagogo.com/oauth2/token'
VIAGOGO_API_BASE = 'https://api.viagogo.net'


class ViagogoAPIClient:
    """Official Viagogo API client"""
    
    def __init__(self, client_id: str = None, client_secret: str = None):
        self.client_id = client_id or os.getenv('VIAGOGO_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('VIAGOGO_CLIENT_SECRET')
        self.access_token = None
        self.session = requests.Session()
        
        if not self.client_id or not self.client_secret:
            print("⚠️  Viagogo API credentials not set!")
            print("   Set VIAGOGO_CLIENT_ID and VIAGOGO_CLIENT_SECRET environment variables")
            print("   Or register at: https://developer.viagogo.net/")
    
    def authenticate(self) -> bool:
        """Get OAuth2 access token using client credentials flow"""
        if not self.client_id or not self.client_secret:
            return False
        
        print("🔐 Authenticating with Viagogo API...")
        
        # Create Basic Auth header
        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {basic_auth}',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        
        data = {
            'grant_type': 'client_credentials',
            'scope': 'read:events read:venues',
        }
        
        try:
            response = self.session.post(VIAGOGO_TOKEN_URL, headers=headers, data=data)
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data.get('access_token')
                expires_in = token_data.get('expires_in', 0)
                print(f"✅ Authenticated! Token expires in {expires_in // 3600} hours")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"   {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def _api_request(self, endpoint: str, params: dict = None) -> dict | None:
        """Make authenticated API request"""
        if not self.access_token:
            print("❌ Not authenticated. Call authenticate() first.")
            return None
        
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/hal+json',
        }
        
        url = f"{VIAGOGO_API_BASE}{endpoint}"
        
        try:
            response = self.session.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print("⚠️ Token expired, re-authenticating...")
                if self.authenticate():
                    return self._api_request(endpoint, params)
            else:
                print(f"❌ API error: {response.status_code}")
                print(f"   {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"❌ Request error: {e}")
            return None
    
    def search_events(self, query: str = None, city: str = 'Porto Alegre', 
                      max_distance_km: int = 100, page_size: int = 50) -> list:
        """Search for events near a city"""
        coords = CITY_COORDS.get(city, CITY_COORDS['Porto Alegre'])
        
        params = {
            'country_code': coords['country'],
            'latitude': coords['lat'],
            'longitude': coords['lng'],
            'max_distance_in_meters': max_distance_km * 1000,
            'page_size': page_size,
            'exclude_parking_passes': 'true',
        }
        
        if query:
            params['q'] = query
        
        print(f"🔍 Searching events near {city} (lat={coords['lat']}, lng={coords['lng']})...")
        
        result = self._api_request('/catalog/events/search', params)
        
        if not result:
            # Try without location filter
            print("🔄 Trying broader search with just country code...")
            params = {
                'country_code': coords['country'],
                'page_size': page_size,
                'exclude_parking_passes': 'true',
            }
            if query:
                params['q'] = query
            result = self._api_request('/catalog/events/search', params)
        
        if not result:
            return []
        
        total = result.get('total_items', 0)
        print(f"📊 Found {total} events total")
        
        events = []
        embedded = result.get('_embedded', {})
        items = embedded.get('items', [])
        
        for item in items:
            event = self._parse_event(item, city, coords)
            if event:
                events.append(event)
                print(f"  🎵 {event['event_name'][:45]:<45} | {event.get('event_date', 'TBA')[:10]}")
        
        return events
    
    def list_events_by_country(self, country_code: str = 'BR', page_size: int = 100) -> list:
        """List all events in a country"""
        params = {
            'country_code': country_code,
            'page_size': page_size,
            'exclude_parking_passes': 'true',
        }
        
        print(f"🔍 Listing events in country: {country_code}...")
        
        result = self._api_request('/catalog/events', params)
        
        if not result:
            return []
        
        total = result.get('total_items', 0)
        print(f"📊 Found {total} events in {country_code}")
        
        events = []
        embedded = result.get('_embedded', {})
        items = embedded.get('items', [])
        
        for item in items:
            event = self._parse_event(item, country_code, {'lat': -15.0, 'lng': -50.0})
            if event:
                events.append(event)
        
        return events
    
    def _parse_event(self, item: dict, city: str, coords: dict) -> dict | None:
        """Parse event from API response"""
        try:
            event_id = item.get('id')
            name = item.get('name', '')
            start_date = item.get('start_date')
            status = item.get('status', 'Normal')
            
            # Skip cancelled events
            if status in ['Cancelled', 'Deleted']:
                return None
            
            # Get venue info from embedded resources
            embedded = item.get('_embedded', {})
            venue_data = embedded.get('venue', {})
            venue_name = venue_data.get('name', 'Venue TBA')
            venue_city = venue_data.get('city', city)
            venue_lat = venue_data.get('latitude', coords['lat'])
            venue_lng = venue_data.get('longitude', coords['lng'])
            
            # Get country from venue embedded
            venue_embedded = venue_data.get('_embedded', {})
            country_data = venue_embedded.get('country', {})
            venue_country = country_data.get('name', 'Brazil')
            
            # Get event webpage URL
            links = item.get('_links', {})
            webpage = links.get('event:webpage', {})
            event_url = webpage.get('href', f'https://www.viagogo.com/E-{event_id}')
            
            # Get min ticket price
            min_price = item.get('min_ticket_price', {})
            price_display = min_price.get('display', '')
            
            # Parse date
            event_date = None
            if start_date:
                try:
                    # API returns ISO format: 2019-08-24T14:15:22Z
                    event_date = start_date.replace('Z', '+00:00')
                except:
                    event_date = start_date
            
            return {
                'event_key': f"viagogo_{event_id}"[:190],
                'event_name': name,
                'artist_name': name,  # For concerts, name is usually the artist
                'description': f"{name} in {venue_city}. {price_display}".strip(),
                'event_date': event_date,
                'venue_name': venue_name,
                'venue_city': venue_city,
                'venue_country': venue_country,
                'venue_latitude': venue_lat if venue_lat else coords['lat'],
                'venue_longitude': venue_lng if venue_lng else coords['lng'],
                'event_url': event_url,
                'ticket_url': event_url,
                'source': 'viagogo_api',
                'category': 'Concert',
                'status': status,
            }
        except Exception as e:
            print(f"⚠️ Parse error: {e}")
            return None


def get_postgres_connection():
    """Get Postgres connection using same env vars as Node"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        import pathlib
        backend_env = pathlib.Path(__file__).parent.parent / '.env'
        if backend_env.exists():
            load_dotenv(backend_env)
    except ImportError:
        pass
    
    return psycopg2.connect(
        host=os.getenv('PG_DB_HOST', 'localhost'),
        port=int(os.getenv('PG_DB_PORT', '5432')),
        user=os.getenv('PG_DB_USER', 'keepup_user'),
        password=os.getenv('PG_DB_PASSWORD', ''),
        database=os.getenv('PG_DB_NAME', 'keepup_events'),
    )


def save_events_to_postgres(events: list) -> int:
    """Save events to Postgres with PostGIS"""
    if not events:
        print("❌ No events to save")
        return 0
    
    print(f"\n💾 Saving {len(events)} events to Postgres...")
    
    try:
        conn = get_postgres_connection()
        cur = conn.cursor()
        
        saved = 0
        for event in events:
            try:
                cur.execute("""
                    INSERT INTO events (
                        event_key, event_name, description, event_date,
                        venue_name, venue_city, venue_country, 
                        venue_latitude, venue_longitude,
                        event_url, ticket_url, source, category, artist_name
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (event_key) DO UPDATE SET
                        event_name = EXCLUDED.event_name,
                        event_date = COALESCE(EXCLUDED.event_date, events.event_date),
                        venue_name = EXCLUDED.venue_name,
                        venue_city = EXCLUDED.venue_city,
                        venue_latitude = EXCLUDED.venue_latitude,
                        venue_longitude = EXCLUDED.venue_longitude,
                        updated_at = NOW()
                """, (
                    event['event_key'],
                    event['event_name'],
                    event.get('description', ''),
                    event.get('event_date'),
                    event.get('venue_name', 'TBA'),
                    event.get('venue_city', 'Porto Alegre'),
                    event.get('venue_country', 'Brazil'),
                    event.get('venue_latitude'),
                    event.get('venue_longitude'),
                    event.get('event_url', ''),
                    event.get('ticket_url', ''),
                    'viagogo_api',
                    event.get('category', 'Concert'),
                    event.get('artist_name'),
                ))
                saved += 1
            except Exception as e:
                print(f"  ⚠️ Error saving {event.get('event_name')}: {e}")
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Saved {saved} events to Postgres")
        return saved
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return 0


def main():
    """Main entry point"""
    city = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'Porto Alegre'
    save_to_db = '--save' in sys.argv
    
    print(f"""
╔════════════════════════════════════════════════════════════╗
║  🎫 VIAGOGO API Client for KEEPUP                          ║
║  City: {city:<50} ║
╚════════════════════════════════════════════════════════════╝
""")
    
    # Check for API credentials
    client_id = os.getenv('VIAGOGO_CLIENT_ID')
    client_secret = os.getenv('VIAGOGO_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        print("⚠️  API credentials not configured!")
        print("")
        print("To use the Viagogo API, you need to:")
        print("  1. Register at https://developer.viagogo.net/")
        print("  2. Create an application to get client_id and client_secret")
        print("  3. Set environment variables:")
        print("")
        print("     export VIAGOGO_CLIENT_ID='your_client_id'")
        print("     export VIAGOGO_CLIENT_SECRET='your_client_secret'")
        print("")
        print("Then run this script again with --save to save events to the database.")
        return
    
    # Create API client
    client = ViagogoAPIClient(client_id, client_secret)
    
    # Authenticate
    if not client.authenticate():
        print("❌ Failed to authenticate with Viagogo API")
        return
    
    # Search for events
    events = client.search_events(city=city)
    
    if not events:
        print("\n🔄 No events found with location filter, trying country-wide search...")
        events = client.list_events_by_country('BR')
    
    if not events:
        print("\n❌ No events found")
        return
    
    print(f"\n📊 Found {len(events)} events:")
    for i, event in enumerate(events[:15], 1):
        date = event.get('event_date', 'TBA')
        if date and date != 'TBA':
            date = date[:10]
        venue = event.get('venue_city', 'Unknown')
        print(f"  {i}. {event['event_name'][:40]:<40} | {date} @ {venue}")
    
    if len(events) > 15:
        print(f"  ... and {len(events) - 15} more")
    
    if save_to_db:
        save_events_to_postgres(events)
    else:
        print("\n💡 Use --save to save events to database")


if __name__ == '__main__':
    main()
