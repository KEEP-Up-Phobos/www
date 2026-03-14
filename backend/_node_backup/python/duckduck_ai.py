#!/usr/bin/env python3
"""
🔍 The Scout (DuckDuckAI)
=========================
"Swift and privacy-respecting, The Scout searches the realm 
for events without leaving traces."

Class: Information Seeker
Alignment: Chaotic Good (Privacy-First)
Technology: Python 3.11 + DuckDuckGo API

This AI helper uses DuckDuckGo's Instant Answer API to search
for events, artists, and venues without tracking users.
"""

import json
import os
import re
import time
from typing import Dict, List, Optional
from datetime import datetime

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'requests'])
    import requests

try:
    from dotenv import load_dotenv
except ImportError:
    print("Installing python-dotenv...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-dotenv'])
    from dotenv import load_dotenv

# 🏪 Load from The Market (.env)
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(ENV_PATH)


class DuckDuckAI:
    """The Scout - Privacy-respecting event discovery for KEEP-Up."""
    
    # DuckDuckGo Instant Answer API
    API_URL = "https://api.duckduckgo.com/"
    
    # User agent
    USER_AGENT = "KEEPUP-DuckDuckAI/1.0"
    
    # Cache directory
    CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '.cache', 'duckduck')
    
    # Event search templates for different categories
    SEARCH_TEMPLATES = {
        'music': [
            '{city} music concerts',
            '{city} live music events',
            '{city} music festivals',
            '{city} band performances',
            '{city} concert venues'
        ],
        'movies': [
            '{city} movie theaters',
            '{city} film festivals',
            '{city} cinema events',
            '{city} movie premieres',
            '{city} film screenings'
        ],
        'food': [
            '{city} food festivals',
            '{city} restaurant events',
            '{city} culinary tours',
            '{city} food fairs',
            '{city} gastronomy events'
        ],
        'nightlife': [
            '{city} nightclubs',
            '{city} bars nightlife',
            '{city} party events',
            '{city} DJ events',
            '{city} night entertainment'
        ],
        'outdoors': [
            '{city} outdoor activities',
            '{city} hiking trails',
            '{city} parks events',
            '{city} nature tours',
            '{city} outdoor festivals'
        ],
        'culture': [
            '{city} museums exhibitions',
            '{city} art galleries',
            '{city} cultural events',
            '{city} theater performances',
            '{city} heritage sites'
        ],
        'sports': [
            '{city} sports events',
            '{city} football matches',
            '{city} sports tournaments',
            '{city} fitness events',
            '{city} sports venues'
        ],
        'tech': [
            '{city} tech meetups',
            '{city} hackathons',
            '{city} startup events',
            '{city} tech conferences',
            '{city} coding workshops'
        ]
    }
    
    def __init__(self):
        """Initialize The Scout."""
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': self.USER_AGENT})
        self.results_cache: Dict[str, Dict] = {}
        
        # Ensure cache directory exists
        os.makedirs(self.CACHE_DIR, exist_ok=True)
    
    def instant_answer(self, query: str) -> Optional[Dict]:
        """
        Get instant answer from DuckDuckGo.
        
        Powers: Quick topic summaries without tracking.
        
        Args:
            query: Search query
            
        Returns:
            Dictionary with answer data or None
        """
        params = {
            'q': query,
            'format': 'json',
            'no_html': 1,
            'skip_disambig': 1
        }
        
        try:
            response = self.session.get(self.API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Rate limiting
            time.sleep(0.5)
            
            # Extract useful information
            result = {
                'heading': data.get('Heading', ''),
                'abstract': data.get('Abstract', ''),
                'abstract_text': data.get('AbstractText', ''),
                'abstract_source': data.get('AbstractSource', ''),
                'abstract_url': data.get('AbstractURL', ''),
                'image': data.get('Image', ''),
                'related_topics': [],
                'results': []
            }
            
            # Extract related topics
            for topic in data.get('RelatedTopics', [])[:10]:
                if isinstance(topic, dict) and 'Text' in topic:
                    result['related_topics'].append({
                        'text': topic.get('Text', ''),
                        'url': topic.get('FirstURL', ''),
                        'icon': topic.get('Icon', {}).get('URL', '')
                    })
            
            # Extract results
            for item in data.get('Results', [])[:5]:
                if isinstance(item, dict):
                    result['results'].append({
                        'text': item.get('Text', ''),
                        'url': item.get('FirstURL', '')
                    })
            
            return result
            
        except Exception as e:
            print(f"[Scout] Error searching '{query}': {e}")
            return None
    
    def search_events(self, city: str, category: str = None) -> List[Dict]:
        """
        Search for events in a city.
        
        Powers: Finds events by category and location.
        
        Args:
            city: City name
            category: Optional category filter
            
        Returns:
            List of event-related results
        """
        print(f"[Scout] 🔍 Searching events in {city}...")
        
        events = []
        templates = {}
        
        if category and category in self.SEARCH_TEMPLATES:
            templates = {category: self.SEARCH_TEMPLATES[category]}
        else:
            templates = self.SEARCH_TEMPLATES
        
        for cat, queries in templates.items():
            for query_template in queries[:2]:  # Limit queries per category
                query = query_template.format(city=city)
                result = self.instant_answer(query)
                
                if result and (result['abstract'] or result['related_topics']):
                    events.append({
                        'category': cat,
                        'query': query,
                        'heading': result['heading'],
                        'abstract': result['abstract'],
                        'image': result['image'],
                        'related': result['related_topics'][:5],
                        'source_url': result['abstract_url']
                    })
        
        print(f"[Scout] ✅ Found {len(events)} results")
        return events
    
    def search_artist(self, name: str) -> Optional[Dict]:
        """
        Search for artist information.
        
        Powers: Retrieves artist details for event enrichment.
        
        Args:
            name: Artist name
            
        Returns:
            Artist information dictionary
        """
        result = self.instant_answer(f"{name} musician artist")
        
        if result and result['abstract']:
            return {
                'name': result['heading'] or name,
                'bio': result['abstract_text'],
                'source': result['abstract_source'],
                'url': result['abstract_url'],
                'image': result['image'],
                'related_artists': [
                    t['text'][:50] for t in result['related_topics'][:5]
                ]
            }
        
        return None
    
    def search_venue(self, name: str, city: str = None) -> Optional[Dict]:
        """
        Search for venue information.
        
        Powers: Retrieves venue details for event enrichment.
        
        Args:
            name: Venue name
            city: Optional city for disambiguation
            
        Returns:
            Venue information dictionary
        """
        query = f"{name} venue"
        if city:
            query += f" {city}"
        
        result = self.instant_answer(query)
        
        if result and result['abstract']:
            return {
                'name': result['heading'] or name,
                'description': result['abstract_text'],
                'source': result['abstract_source'],
                'url': result['abstract_url'],
                'image': result['image']
            }
        
        return None
    
    def enrich_event(self, event: Dict) -> Dict:
        """
        Enrich an event with additional information.
        
        Powers: Adds metadata from web searches.
        
        Args:
            event: Event dictionary
            
        Returns:
            Enriched event dictionary
        """
        enriched = event.copy()
        
        # Try to get artist info
        if 'artist_name' in event and event['artist_name']:
            artist_info = self.search_artist(event['artist_name'])
            if artist_info:
                enriched['artist_info'] = artist_info
        
        # Try to get venue info
        if 'venue_name' in event and event['venue_name']:
            venue_info = self.search_venue(
                event['venue_name'], 
                event.get('city', '')
            )
            if venue_info:
                enriched['venue_info'] = venue_info
        
        return enriched
    
    def populate_town(self, city: str, country: str = 'Brazil') -> Dict:
        """
        Gather event information for a specific city.
        
        Powers: Builds city event profiles for town population.
        
        Args:
            city: City name
            country: Country name
            
        Returns:
            Dictionary with city event information
        """
        print(f"[Scout] 🏰 Scouting {city}, {country}...")
        
        town_data = {
            'city': city,
            'country': country,
            'scouted_at': datetime.now().isoformat(),
            'categories': {}
        }
        
        for category in self.SEARCH_TEMPLATES.keys():
            events = self.search_events(city, category)
            town_data['categories'][category] = events
        
        # Save to cache
        cache_path = os.path.join(
            self.CACHE_DIR, 
            f"town_{city.lower().replace(' ', '_')}.json"
        )
        with open(cache_path, 'w') as f:
            json.dump(town_data, f, indent=2)
        
        print(f"[Scout] 📜 Town data saved to {cache_path}")
        return town_data
    
    def suggest_events(self, interests: List[str], city: str) -> List[Dict]:
        """
        Suggest events based on user interests.
        
        Powers: Matches user preferences with local events.
        
        Args:
            interests: List of user interests from profile
            city: User's city
            
        Returns:
            List of suggested events
        """
        suggestions = []
        
        for interest in interests[:5]:  # Limit to 5 interests
            # Map interest to category
            category = None
            for cat, templates in self.SEARCH_TEMPLATES.items():
                if interest.lower() in cat.lower():
                    category = cat
                    break
            
            # Search for matching events
            result = self.instant_answer(f"{interest} events in {city}")
            
            if result and result['abstract']:
                suggestions.append({
                    'interest': interest,
                    'category': category,
                    'title': result['heading'],
                    'description': result['abstract'],
                    'url': result['abstract_url'],
                    'related': result['related_topics'][:3]
                })
        
        return suggestions


# Main execution for testing
if __name__ == '__main__':
    print("=" * 60)
    print("🔍 THE SCOUT - DuckDuckAI")
    print("=" * 60)
    
    scout = DuckDuckAI()
    
    # Test instant answer
    print("\n--- Testing Instant Answer ---")
    result = scout.instant_answer("Porto Alegre events")
    if result:
        print(f"Heading: {result['heading']}")
        print(f"Abstract: {result['abstract'][:200]}..." if result['abstract'] else "No abstract")
    
    # Test event search
    print("\n--- Testing Event Search ---")
    events = scout.search_events("Porto Alegre", "music")
    for event in events[:3]:
        print(f"Category: {event['category']}")
        print(f"Query: {event['query']}")
        print(f"Heading: {event['heading']}")
        print()
    
    # Test town population
    print("\n--- Testing Town Population ---")
    town = scout.populate_town("Porto Alegre", "Brazil")
    print(f"Scouted categories: {list(town['categories'].keys())}")
    
    # Test artist search
    print("\n--- Testing Artist Search ---")
    artist = scout.search_artist("Legião Urbana")
    if artist:
        print(f"Artist: {artist['name']}")
        print(f"Bio: {artist['bio'][:200]}..." if artist['bio'] else "No bio")
    
    print("\n[Scout] ✅ All tests complete!")
