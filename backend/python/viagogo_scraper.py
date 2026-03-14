#!/usr/bin/env python3
"""
🎫 Viagogo Event Scraper for KEEPUP
Fetches real events from Viagogo for Brazilian cities using Selenium.

Usage:
    python viagogo_scraper.py [city] [--save]

Examples:
    python viagogo_scraper.py "Porto Alegre" --save
    python viagogo_scraper.py "São Paulo"
"""

import re
import sys
import os
import time
from datetime import datetime
from urllib.parse import urljoin
from bs4 import BeautifulSoup

# Selenium for JavaScript-rendered pages
from selenium import webdriver
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import geckodriver_autoinstaller

# Postgres connection (uses same env vars as Node)
import psycopg2

# City coordinates for geolocation
CITY_COORDS = {
    'Porto Alegre': {'lat': -30.0346, 'lng': -51.2177},
    'São Paulo': {'lat': -23.5505, 'lng': -46.6333},
    'Rio de Janeiro': {'lat': -22.9068, 'lng': -43.1729},
    'Brasília': {'lat': -15.7939, 'lng': -47.8828},
    'Salvador': {'lat': -12.9714, 'lng': -38.5014},
    'Curitiba': {'lat': -25.4290, 'lng': -49.2671},
    'Belo Horizonte': {'lat': -19.9167, 'lng': -43.9345},
    'Manaus': {'lat': -3.1190, 'lng': -60.0217},
    'Recife': {'lat': -8.0476, 'lng': -34.8770},
    'Fortaleza': {'lat': -3.7172, 'lng': -38.5433},
}

# City name normalization for URL (remove accents, lowercase, replace spaces)
def normalize_city_for_url(city: str) -> str:
    """Convert city name to URL-friendly format"""
    import unicodedata
    # Remove accents
    normalized = unicodedata.normalize('NFD', city)
    normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    # Lowercase and replace spaces with +
    return normalized.lower().replace(' ', '+')

# Viagogo Brazilian search URL - this returns Brazil events!
def get_viagogo_search_url(city: str) -> str:
    """Get Viagogo search URL for a Brazilian city"""
    city_normalized = normalize_city_for_url(city)
    return f'https://www.viagogo.com/br/secure/Search?q={city_normalized}'

# Viagogo URLs - DEPRECATED, use get_viagogo_search_url() instead
VIAGOGO_URLS = {
    'Porto Alegre': 'https://www.viagogo.com/br/secure/Search?q=porto+alegre',
    'São Paulo': 'https://www.viagogo.com/br/secure/Search?q=sao+paulo',
    'Rio de Janeiro': 'https://www.viagogo.com/br/secure/Search?q=rio+de+janeiro',
    'Curitiba': 'https://www.viagogo.com/br/secure/Search?q=curitiba',
    'Brasília': 'https://www.viagogo.com/br/secure/Search?q=brasilia',
    'Salvador': 'https://www.viagogo.com/br/secure/Search?q=salvador',
    'Belo Horizonte': 'https://www.viagogo.com/br/secure/Search?q=belo+horizonte',
    'Brazil': 'https://www.viagogo.com/br/secure/Search?q=brasil',
}

# Alternative: Use the homepage with location
VIAGOGO_HOMEPAGE = 'https://www.viagogo.com/br/'


class ViagogoScraper:
    """Scrapes real events from Viagogo using Selenium"""
    
    def __init__(self, city: str = 'Porto Alegre'):
        self.city = city
        self.coords = CITY_COORDS.get(city, CITY_COORDS['Porto Alegre'])
        self.events = []
        self.driver = None
        
    def __enter__(self):
        # Install geckodriver if needed
        geckodriver_autoinstaller.install()
        
        # Setup Firefox with headless mode
        firefox_options = FirefoxOptions()
        firefox_options.add_argument('--headless')
        firefox_options.add_argument('--width=1920')
        firefox_options.add_argument('--height=1080')
        firefox_options.set_preference('intl.accept_languages', 'pt-BR,pt,en-US,en')
        firefox_options.set_preference('general.useragent.override', 
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0')
        
        # Disable images for faster loading
        firefox_options.set_preference('permissions.default.image', 2)
        
        try:
            self.driver = webdriver.Firefox(options=firefox_options)
            self.driver.set_page_load_timeout(30)
        except Exception as e:
            print(f"❌ Could not start Firefox: {e}")
            raise
        
        return self
        
    def __exit__(self, *args):
        if self.driver:
            self.driver.quit()
    
    def parse_date(self, date_str: str) -> str | None:
        """Parse Viagogo date format to ISO"""
        if not date_str:
            return None
            
        # Clean up the string
        date_str = date_str.strip()
        
        try:
            # Try to extract date parts - pattern: "Tue, Feb 03" or "Feb 03"
            match = re.search(r'(\w+)\s+(\d+)', date_str)
            if match:
                month_str, day = match.groups()
                # Assume current year or next year
                year = datetime.now().year
                try:
                    month_num = datetime.strptime(month_str[:3], '%b').month
                except:
                    return None
                    
                if month_num < datetime.now().month:
                    year += 1
                
                # Extract time if present
                time_match = re.search(r'(\d+):(\d+)\s*(AM|PM)?', date_str)
                if time_match:
                    hour, minute = int(time_match.group(1)), int(time_match.group(2))
                    ampm = time_match.group(3)
                    if ampm == 'PM' and hour != 12:
                        hour += 12
                    elif ampm == 'AM' and hour == 12:
                        hour = 0
                    return f'{year}-{month_num:02d}-{int(day):02d}T{hour:02d}:{minute:02d}:00'
                else:
                    return f'{year}-{month_num:02d}-{int(day):02d}'
        except Exception as e:
            print(f"⚠️ Date parse error for '{date_str}': {e}")
        
        return None
    
    def parse_event_card(self, card_html: str, base_url: str) -> dict | None:
        """Extract event info from an event card element"""
        try:
            soup = BeautifulSoup(card_html, 'html.parser')
            
            # Find the main link
            link = soup.find('a', href=True)
            if not link:
                return None
            
            href = link['href']
            full_url = urljoin(base_url, href)
            
            # Skip non-event links - must have /E- (event ID) to be a real event
            if '/E-' not in href:
                return None
            
            # Get text content
            text = link.get_text(' ', strip=True)
            if not text or len(text) < 10:
                return None
            
            # Skip "Ver ingressos" only links
            if text.strip().lower() in ['ver ingressos', 'see tickets']:
                return None
            
            # Extract event ID
            event_id_match = re.search(r'/E-(\d+)', href)
            event_id = event_id_match.group(1) if event_id_match else str(hash(full_url) & 0xFFFFFFFF)
            
            # Month mappings - Portuguese first (site uses Portuguese), then English
            months = {
                'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
                'feb': 2, 'apr': 4, 'may': 5, 'aug': 8, 'sep': 9, 'oct': 10, 'dec': 12
            }
            
            event_date = None
            artist_name = None
            venue_name = 'Venue TBA'
            venue_city = self.city
            
            # Portuguese format: "DD mon DAY Artist Time | Venue | City, Brasil"
            # Example: "11 mar QUA Bryan Adams 21:00 | Auditório Araújo Vianna | Porto Alegre, Brasil"
            # Day names: SEG TER QUA QUI SEX SÁB DOM (Mon-Sun)
            pt_format = re.search(
                r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)',
                text, re.IGNORECASE
            )
            
            if pt_format:
                day, month_str, artist_part, time_str, venue_part, location_part = pt_format.groups()
                month_num = months.get(month_str.lower(), 1)
                year = datetime.now().year
                if month_num < datetime.now().month:
                    year += 1
                
                hour, minute = map(int, time_str.split(':'))
                event_date = f'{year}-{month_num:02d}-{int(day):02d}T{hour:02d}:{minute:02d}:00'
                artist_name = artist_part.strip()
                venue_name = venue_part.strip()
                venue_city = location_part.strip()
            else:
                # Try simpler Portuguese format without venue: "DD mon DAY Artist Time | City"
                pt_simple = re.search(
                    r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*(.+)',
                    text, re.IGNORECASE
                )
                
                if pt_simple:
                    day, month_str, artist_part, time_str, location_part = pt_simple.groups()
                    month_num = months.get(month_str.lower(), 1)
                    year = datetime.now().year
                    if month_num < datetime.now().month:
                        year += 1
                    
                    hour, minute = map(int, time_str.split(':'))
                    event_date = f'{year}-{month_num:02d}-{int(day):02d}T{hour:02d}:{minute:02d}:00'
                    artist_name = artist_part.strip()
                    venue_city = location_part.strip()
                else:
                    # Couldn't parse
                    return None
            
            if not artist_name or not event_date:
                return None
            
            # Clean artist name - remove qualifiers and trailing text
            artist_name = re.sub(r'\s*(Ver ingressos|See tickets|Tickets|Buy).*$', '', artist_name, flags=re.IGNORECASE).strip()
            artist_name = re.sub(r'\s+', ' ', artist_name).strip()
            
            # Clean venue and city
            venue_name = re.sub(r'\s*(Ver ingressos|See tickets).*$', '', venue_name, flags=re.IGNORECASE).strip()
            venue_city = re.sub(r'\s*(Ver ingressos|See tickets).*$', '', venue_city, flags=re.IGNORECASE).strip()
            
            if not artist_name or len(artist_name) < 2:
                return None
            
            # Determine country - default Brazil for Brazilian site
            venue_country = 'Brazil'
            
            return {
                'event_key': f"viagogo_{event_id}"[:190],
                'event_name': artist_name,
                'artist_name': artist_name,
                'description': f"{artist_name} live in {venue_city}",
                'event_date': event_date,
                'venue_name': venue_name or 'Venue TBA',
                'venue_city': venue_city,
                'venue_country': venue_country,
                'venue_latitude': self.coords['lat'],
                'venue_longitude': self.coords['lng'],
                'event_url': full_url,
                'ticket_url': full_url,
                'source': 'viagogo',
                'category': 'Concert',
            }
        except Exception as e:
            return None
    
    def fetch_page(self, url: str) -> list:
        """Fetch events from a Viagogo page using Selenium"""
        print(f"🌐 Loading {url}...")
        events = []
        
        try:
            self.driver.get(url)
            
            # Wait for page to load
            time.sleep(5)
            
            # Wait for content to appear
            try:
                WebDriverWait(self.driver, 15).until(
                    EC.presence_of_element_located((By.TAG_NAME, "a"))
                )
            except:
                pass
            
            # Scroll to load ALL content (load lazy-loaded events)
            last_height = 0
            for _ in range(10):
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1.5)
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
            
            # Scroll back to top
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
            # Get page source
            html = self.driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            
            # Debug: print some of the page content
            # print(f"Page length: {len(html)} chars")
            
            # Find all links that look like events (must have /E- which is actual event ID)
            for link in soup.find_all('a', href=True):
                href = link['href']
                
                # Only process actual event links with event ID
                if '/E-' in href:
                    event = self.parse_event_card(str(link), url)
                    if event and not any(e['event_key'] == event['event_key'] for e in events):
                        events.append(event)
                        date_str = event.get('event_date', 'TBA')
                        if date_str and date_str != 'TBA':
                            date_str = date_str[:10]  # Just the date part
                        print(f"  🎵 {event['artist_name'][:40]:<40} | {date_str}")
            
            print(f"✅ Found {len(events)} real events with dates")
            
        except Exception as e:
            print(f"❌ Error loading page: {e}")
        
        return events
    
    def fetch_all(self) -> list:
        """Fetch events from all sources using the new Brazilian search URL"""
        # Use the new search URL format: /br/secure/Search?q=city+name
        url = get_viagogo_search_url(self.city)
        print(f"🔍 Searching for events in: {self.city}")
        events = self.fetch_page(url)
        
        self.events = events
        return events


def get_postgres_connection():
    """Get Postgres connection using same env vars as Node"""
    # Try to load from .env file if python-dotenv is available
    try:
        from dotenv import load_dotenv
        load_dotenv()
        # Also try backend/.env
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
        password=os.getenv('PG_DB_PASSWORD', 'keepup_pass_2026'),
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
                    'viagogo',
                    event.get('category', 'Concert'),
                    event.get('artist_name'),
                ))
                saved += 1
            except Exception as e:
                print(f"  ⚠️ Error saving {event.get('artist_name')}: {e}")
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Saved {saved} events to Postgres (with PostGIS coordinates)")
        return saved
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return 0


def main():
    """Main entry point"""
    import json as json_module
    
    city = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'Porto Alegre'
    save_to_db = '--save' in sys.argv
    output_json = '--json' in sys.argv
    
    if not output_json:
        print(f"""
╔════════════════════════════════════════════════════════════╗
║  🎫 VIAGOGO Event Scraper for KEEPUP                       ║
║  City: {city:<50} ║
╚════════════════════════════════════════════════════════════╝
""")
    
    with ViagogoScraper(city) as scraper:
        events = scraper.fetch_all()
    
    if not events:
        if output_json:
            print("[JSON_START][]JSON_END]")
        else:
            print("\n❌ No events found")
        return
    
    if not output_json:
        print(f"\n📊 Found {len(events)} real events:")
        for i, event in enumerate(events[:15], 1):
            date = event.get('event_date', 'TBA')
            print(f"  {i}. {event['artist_name']} - {date} @ {event.get('venue_name', 'TBA')}")
        
        if len(events) > 15:
            print(f"  ... and {len(events) - 15} more")
    
    if save_to_db:
        save_events_to_postgres(events)
    elif not output_json:
        print("\n💡 Use --save to save events to database")
        print(f"   python viagogo_scraper.py \"{city}\" --save")
    
    # Output JSON if requested (for Node.js integration)
    if output_json:
        # Prepare events for JSON output
        json_events = []
        for e in events:
            json_events.append({
                'event_key': e.get('event_key', ''),
                'event_name': e.get('event_name', ''),
                'artist_name': e.get('artist_name', ''),
                'event_date': e.get('event_date'),
                'venue_name': e.get('venue_name', ''),
                'venue_city': e.get('venue_city', ''),
                'venue_country': e.get('venue_country', 'Brazil'),
                'venue_latitude': e.get('venue_latitude'),
                'venue_longitude': e.get('venue_longitude'),
                'event_url': e.get('event_url', ''),
                'ticket_url': e.get('ticket_url', ''),
                'source': 'viagogo'
            })
        print(f"[JSON_START]{json_module.dumps(json_events)}[JSON_END]")


if __name__ == '__main__':
    main()
