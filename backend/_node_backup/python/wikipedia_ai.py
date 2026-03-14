#!/usr/bin/env python3
"""
📚 The Scholar (WikipediaAI)
============================
"From the great library of Wikipedia, The Scholar extracts wisdom 
about music, cinema, cuisine, and culture."

Class: Knowledge Keeper
Alignment: Wise Neutral
Technology: Python 3.11 + Wikipedia API

This AI helper fetches information from Wikipedia to build a knowledge
base that matches the interest categories in Profile/EditProfile pages.
"""

import json
import os
import re
import time
import hashlib
from typing import Dict, List, Optional, Set
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


class WikipediaAI:
    """The Scholar - Wikipedia knowledge extraction for KEEP-Up events."""
    
    # User agent required by Wikipedia API
    USER_AGENT = "KEEPUP-WikipediaAI/1.0 (https://keepup.app; contact@keepup.app)"
    
    # Wikipedia API endpoint
    API_URL = "https://en.wikipedia.org/w/api.php"
    
    # Cache directory for storing fetched pages
    CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '.cache', 'wikipedia')
    
    # Knowledge base output path
    KB_PATH = os.path.join(os.path.dirname(__file__), '..', 'wikipedia-ai-formularies.json')
    TRAINING_PATH = os.path.join(os.path.dirname(__file__), '..', 'wikipedia-ai-training.json')
    
    # Categories matching Profile/EditProfile interests
    CATEGORIES = {
        'music': {
            'topics': [
                'Rock music', 'Pop music', 'Jazz', 'Electronic music', 'Hip hop music',
                'Classical music', 'R&B', 'Country music', 'Reggae', 'Blues',
                'Metal music', 'Folk music', 'Punk rock', 'Soul music', 'Indie rock',
                'Alternative rock', 'Techno', 'House music', 'Funk', 'Gospel music',
                'Latin music', 'World music', 'Ambient music', 'Trap music', 'K-pop',
                'Sertanejo', 'Pagode', 'MPB', 'Bossa nova', 'Forró'
            ],
            'keywords': ['concert', 'festival', 'live music', 'band', 'musician', 'performance']
        },
        'movies': {
            'topics': [
                'Action film', 'Comedy film', 'Drama (film and television)', 'Horror film',
                'Science fiction film', 'Romance film', 'Thriller (genre)', 'Documentary film',
                'Animation', 'Fantasy film', 'Adventure film', 'Crime film', 'Musical film',
                'War film', 'Western (genre)', 'Film noir', 'Superhero film', 'Biographical film'
            ],
            'keywords': ['cinema', 'movie', 'film', 'screening', 'premiere', 'theater']
        },
        'food': {
            'topics': [
                'Italian cuisine', 'Japanese cuisine', 'Brazilian cuisine', 'Mexican cuisine',
                'French cuisine', 'Chinese cuisine', 'Indian cuisine', 'Thai cuisine',
                'Mediterranean cuisine', 'American cuisine', 'Korean cuisine', 'Vietnamese cuisine',
                'Spanish cuisine', 'Greek cuisine', 'Middle Eastern cuisine', 'African cuisine',
                'Fusion cuisine', 'Street food', 'Vegetarian cuisine', 'Vegan cuisine',
                'Churrasco', 'Feijoada', 'Barbecue'
            ],
            'keywords': ['restaurant', 'food festival', 'gastronomy', 'culinary', 'tasting', 'chef']
        },
        'nightlife': {
            'topics': [
                'Nightclub', 'Bar (establishment)', 'Lounge (establishment)', 'Karaoke',
                'Dance club', 'Live music venue', 'Pub', 'Cocktail bar', 'Rooftop bar',
                'Wine bar', 'Sports bar', 'Jazz club', 'Comedy club'
            ],
            'keywords': ['nightlife', 'party', 'DJ', 'dancing', 'drinks', 'night out']
        },
        'outdoors': {
            'topics': [
                'Hiking', 'Beach', 'Park', 'Camping', 'Nature reserve', 'Mountain',
                'Trail running', 'Surfing', 'Cycling', 'Kayaking', 'Rock climbing',
                'Fishing', 'Wildlife watching', 'Botanical garden', 'Zoo'
            ],
            'keywords': ['outdoor', 'nature', 'adventure', 'trail', 'scenic', 'expedition']
        },
        'culture': {
            'topics': [
                'Museum', 'Art gallery', 'Theater (structure)', 'Cultural festival',
                'Art exhibition', 'Historical site', 'Cultural heritage', 'Literary festival',
                'Book fair', 'Dance performance', 'Opera', 'Ballet', 'Carnival',
                'Street art', 'Photography exhibition'
            ],
            'keywords': ['culture', 'art', 'exhibition', 'museum', 'gallery', 'heritage', 'festival']
        },
        'sports': {
            'topics': [
                'Association football', 'Basketball', 'Tennis', 'Volleyball', 'Swimming',
                'Athletics (sport)', 'Martial arts', 'Golf', 'Baseball', 'American football',
                'Rugby union', 'Cricket', 'Boxing', 'Mixed martial arts', 'Skateboarding',
                'Surfing', 'Yoga', 'Crossfit', 'Esports', 'Futsal'
            ],
            'keywords': ['sports', 'match', 'tournament', 'championship', 'game', 'competition']
        },
        'tech': {
            'topics': [
                'Artificial intelligence', 'Video game', 'Startup company', 'Hackathon',
                'Software development', 'Web development', 'Mobile app', 'Virtual reality',
                'Blockchain', 'Cryptocurrency', 'Internet of things', 'Robotics',
                'Tech conference', 'Coding bootcamp', 'Tech meetup'
            ],
            'keywords': ['tech', 'technology', 'innovation', 'startup', 'coding', 'developer', 'hackathon']
        }
    }
    
    def __init__(self):
        """Initialize The Scholar."""
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': self.USER_AGENT})
        self.knowledge_base: Dict[str, Dict] = {}
        self.training_data: List[Dict] = []
        
        # Ensure cache directory exists
        os.makedirs(self.CACHE_DIR, exist_ok=True)
    
    def _get_cache_path(self, title: str) -> str:
        """Get cache file path for a Wikipedia title."""
        safe_title = hashlib.md5(title.encode()).hexdigest()
        return os.path.join(self.CACHE_DIR, f"{safe_title}.json")
    
    def fetch_page(self, title: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Fetch a Wikipedia page by title.
        
        Powers: Retrieves Wikipedia knowledge with caching.
        
        Args:
            title: Wikipedia article title
            use_cache: Whether to use cached data
            
        Returns:
            Dictionary with page data or None if not found
        """
        cache_path = self._get_cache_path(title)
        
        # Check cache first
        if use_cache and os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                return json.load(f)
        
        # Fetch from Wikipedia API
        params = {
            'action': 'query',
            'titles': title,
            'prop': 'extracts|categories|links',
            'exintro': True,
            'explaintext': True,
            'format': 'json',
            'cllimit': 50,
            'pllimit': 50
        }
        
        try:
            response = self.session.get(self.API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Extract page data
            pages = data.get('query', {}).get('pages', {})
            if not pages:
                return None
            
            page_data = list(pages.values())[0]
            
            if 'missing' in page_data:
                return None
            
            result = {
                'title': page_data.get('title', title),
                'extract': page_data.get('extract', ''),
                'categories': [c['title'] for c in page_data.get('categories', [])],
                'links': [l['title'] for l in page_data.get('links', [])],
                'fetched_at': datetime.now().isoformat()
            }
            
            # Save to cache
            with open(cache_path, 'w') as f:
                json.dump(result, f, indent=2)
            
            # Rate limiting
            time.sleep(0.5)
            
            return result
            
        except Exception as e:
            print(f"[Scholar] Error fetching '{title}': {e}")
            return None
    
    def extract_keywords(self, text: str, min_length: int = 3) -> Set[str]:
        """
        Extract meaningful keywords from text.
        
        Powers: Extracts terms for event classification.
        
        Args:
            text: Input text
            min_length: Minimum word length
            
        Returns:
            Set of extracted keywords
        """
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
            'those', 'it', 'its', 'they', 'them', 'their', 'which', 'who', 'whom',
            'what', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now'
        }
        
        # Extract words
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        
        # Filter and return
        keywords = {
            word for word in words
            if len(word) >= min_length and word not in stop_words
        }
        
        return keywords
    
    def build_knowledge_base(self) -> Dict[str, Dict]:
        """
        Build complete knowledge base from Wikipedia.
        
        Powers: Creates category databases for event classification.
        
        Returns:
            Knowledge base dictionary
        """
        print("[Scholar] 📚 Building knowledge base from Wikipedia...")
        
        for category, data in self.CATEGORIES.items():
            print(f"\n[Scholar] Processing category: {category}")
            
            self.knowledge_base[category] = {
                'topics': [],
                'keywords': set(data['keywords']),
                'descriptions': []
            }
            
            for topic in data['topics']:
                print(f"  Fetching: {topic}")
                page = self.fetch_page(topic)
                
                if page:
                    # Add topic info
                    self.knowledge_base[category]['topics'].append({
                        'title': page['title'],
                        'summary': page['extract'][:500] if page['extract'] else ''
                    })
                    
                    # Extract keywords from content
                    if page['extract']:
                        keywords = self.extract_keywords(page['extract'])
                        self.knowledge_base[category]['keywords'].update(keywords)
                    
                    # Add to training data
                    self.training_data.append({
                        'category': category,
                        'topic': page['title'],
                        'text': page['extract'][:1000] if page['extract'] else '',
                        'keywords': list(self.extract_keywords(page['extract']))[:20] if page['extract'] else []
                    })
            
            # Convert set to list for JSON serialization
            self.knowledge_base[category]['keywords'] = list(self.knowledge_base[category]['keywords'])
        
        print(f"\n[Scholar] ✅ Knowledge base built with {len(self.training_data)} entries")
        return self.knowledge_base
    
    def classify_event(self, event: Dict) -> Dict[str, float]:
        """
        Classify an event into categories based on knowledge base.
        
        Powers: Categorizes events by type using Wikipedia knowledge.
        
        Args:
            event: Event dictionary with name, description, etc.
            
        Returns:
            Dictionary of category scores
        """
        if not self.knowledge_base:
            self.load_knowledge_base()
        
        # Extract text from event
        text = ' '.join([
            event.get('name', ''),
            event.get('description', ''),
            event.get('genre', ''),
            event.get('category', '')
        ]).lower()
        
        event_keywords = self.extract_keywords(text)
        
        scores: Dict[str, float] = {}
        
        for category, data in self.knowledge_base.items():
            kb_keywords = set(data.get('keywords', []))
            
            # Calculate overlap score
            overlap = len(event_keywords & kb_keywords)
            total = len(event_keywords)
            
            if total > 0:
                scores[category] = overlap / total
            else:
                scores[category] = 0.0
        
        return scores
    
    def save_knowledge_base(self) -> None:
        """Save knowledge base to JSON file."""
        # Convert sets to lists for JSON
        kb_serializable = {}
        for category, data in self.knowledge_base.items():
            kb_serializable[category] = {
                'topics': data.get('topics', []),
                'keywords': list(data.get('keywords', [])) if isinstance(data.get('keywords'), set) else data.get('keywords', []),
                'descriptions': data.get('descriptions', [])
            }
        
        with open(self.KB_PATH, 'w') as f:
            json.dump(kb_serializable, f, indent=2)
        print(f"[Scholar] 📜 Knowledge base saved to {self.KB_PATH}")
    
    def save_training_data(self) -> None:
        """Save training data to JSON file."""
        with open(self.TRAINING_PATH, 'w') as f:
            json.dump(self.training_data, f, indent=2)
        print(f"[Scholar] 📜 Training data saved to {self.TRAINING_PATH}")
    
    def load_knowledge_base(self) -> Dict:
        """Load knowledge base from JSON file."""
        if os.path.exists(self.KB_PATH):
            with open(self.KB_PATH, 'r') as f:
                self.knowledge_base = json.load(f)
        return self.knowledge_base
    
    def fetch_artists_by_genre(self, genre: str, limit: int = 200) -> List[str]:
        """
        Fetch artists from Wikipedia by music genre.
        
        This is THE SAGE-DRAGON mode - powerful genre-based artist discovery.
        
        Args:
            genre: Music genre (e.g., 'Rock', 'Jazz', 'Electronic')
            limit: Maximum number of artists to return
            
        Returns:
            List of artist names
        """
        print(f"[Sage-Dragon] 🐲 Fetching {genre} artists from Wikipedia...")
        
        artists = set()
        
        # Wikipedia category API queries for music genres
        category_searches = [
            f"{genre} musicians",
            f"{genre} artists",
            f"{genre} bands",
            f"{genre} singers",
            f"{genre} groups"
        ]
        
        for category_name in category_searches:
            if len(artists) >= limit:
                break
                
            try:
                # Use Wikipedia API to fetch category members
                params = {
                    'action': 'query',
                    'format': 'json',
                    'list': 'categorymembers',
                    'cmtitle': f'Category:{category_name}',
                    'cmlimit': 500,  # Max allowed
                    'cmtype': 'page'
                }
                
                response = self.session.get(self.API_URL, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                if 'query' in data and 'categorymembers' in data['query']:
                    for member in data['query']['categorymembers']:
                        title = member.get('title', '')
                        
                        # Filter out non-artist pages
                        if any(skip in title for skip in ['List of', 'Category:', 'Template:', 'Portal:', 'Wikipedia:', 'File:']):
                            continue
                        
                        # Clean artist name (remove parentheses content)
                        clean_name = re.sub(r'\\s*\\(.*?\\)\\s*$', '', title).strip()
                        
                        if 2 <= len(clean_name) <= 80:
                            artists.add(clean_name)
                            
                            if len(artists) >= limit:
                                break
                
                print(f"[Sage-Dragon] Found {len(artists)} artists so far from '{category_name}'")
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                print(f"[Sage-Dragon] Error fetching category '{category_name}': {e}")
                continue
        
        artists_list = sorted(list(artists))[:limit]
        print(f"[Sage-Dragon] 🐉 Total: {len(artists_list)} {genre} artists found")
        
        return artists_list


# Main execution for testing
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'fetch-genre':
        # CLI mode: fetch artists by genre
        if len(sys.argv) < 3:
            print("Usage: python wikipedia_ai.py fetch-genre <genre> [limit]")
            sys.exit(1)
        
        genre = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 200
        
        scholar = WikipediaAI()
        artists = scholar.fetch_artists_by_genre(genre, limit)
        
        # Output as JSON for Node.js to parse
        print(json.dumps({
            'success': True,
            'genre': genre,
            'count': len(artists),
            'artists': artists
        }))
    else:
        # Default mode: build knowledge base
        print("=" * 60)
        print("📚 THE SCHOLAR - WikipediaAI")
        print("=" * 60)
        
        scholar = WikipediaAI()
        
        # Build knowledge base (fetch from Wikipedia)
        kb = scholar.build_knowledge_base()
        
        # Save results
        scholar.save_knowledge_base()
        scholar.save_training_data()
        
        # Test classification
        test_event = {
            'name': 'Rock Concert in Porto Alegre',
            'description': 'Live rock music performance with local bands',
            'genre': 'Rock',
            'category': 'Music'
        }
        
        scores = scholar.classify_event(test_event)
        print(f"\n[Scholar] Classification for test event:")
        for cat, score in sorted(scores.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {score:.2%}")
