#!/usr/bin/env python3
"""
🗝️ Keeper Runner - AI Orchestrator
====================================
Commands The Scholar and The Scout to perform AI tasks for KEEP-Up.

Usage:
    python keeper_runner.py wikipedia     # Build Wikipedia knowledge base
    python keeper_runner.py duckduck      # Test DuckDuckGo searches
    python keeper_runner.py populate      # Populate a town with events
    python keeper_runner.py all           # Run all AI helpers

Options:
    --city "City Name"    # Specify city for population
    --category "music"    # Specify category filter
"""

import argparse
import json
import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 🏪 Load from The Market (.env)
try:
    from dotenv import load_dotenv
    ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(ENV_PATH)
    print(f"🏪 Loaded config from The Market (.env)")
except ImportError:
    print("⚠️  python-dotenv not installed, using system env only")

from python.wikipedia_ai import WikipediaAI
from python.duckduck_ai import DuckDuckAI


def banner():
    """Display the Keeper Runner banner."""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🗝️  KEEPER RUNNER - AI Orchestrator                           ║
║                                                                  ║
║   Commanding the AI Helpers:                                     ║
║   📚 The Scholar (WikipediaAI)                                   ║
║   🔍 The Scout (DuckDuckAI)                                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    """)


def run_wikipedia(args):
    """Run The Scholar to build knowledge base."""
    print("\n📚 Summoning The Scholar (WikipediaAI)...")
    print("=" * 60)
    
    scholar = WikipediaAI()
    
    # Build knowledge base
    kb = scholar.build_knowledge_base()
    
    # Save results
    scholar.save_knowledge_base()
    scholar.save_training_data()
    
    # Print summary
    print("\n📊 Knowledge Base Summary:")
    for category, data in kb.items():
        topics_count = len(data.get('topics', []))
        keywords_count = len(data.get('keywords', []))
        print(f"  {category}: {topics_count} topics, {keywords_count} keywords")
    
    print("\n✅ The Scholar's work is complete!")


def run_duckduck(args):
    """Run The Scout for event discovery."""
    print("\n🔍 Summoning The Scout (DuckDuckAI)...")
    print("=" * 60)
    
    scout = DuckDuckAI()
    city = args.city if hasattr(args, 'city') and args.city else "Porto Alegre"
    category = args.category if hasattr(args, 'category') and args.category else None
    
    print(f"\nSearching for events in {city}...")
    if category:
        print(f"Category filter: {category}")
    
    # Search for events
    events = scout.search_events(city, category)
    
    # Print results
    print(f"\n📊 Found {len(events)} event sources:")
    for event in events[:10]:
        print(f"\n  Category: {event['category']}")
        print(f"  Query: {event['query']}")
        print(f"  Heading: {event['heading'][:50]}..." if event['heading'] else "  No heading")
        if event['abstract']:
            print(f"  Abstract: {event['abstract'][:100]}...")
    
    print("\n✅ The Scout's scouting is complete!")


def run_populate(args):
    """Run town population with AI helpers."""
    print("\n🏰 Populating Town with AI Helpers...")
    print("=" * 60)
    
    scout = DuckDuckAI()
    city = args.city if hasattr(args, 'city') and args.city else "Porto Alegre"
    country = args.country if hasattr(args, 'country') and args.country else "Brazil"
    
    print(f"\nPopulating: {city}, {country}")
    
    # Scout the town
    town_data = scout.populate_town(city, country)
    
    # Print summary
    print(f"\n📊 Town Population Summary for {city}:")
    for category, events in town_data['categories'].items():
        print(f"  {category}: {len(events)} sources")
    
    print("\n✅ Town population complete!")


def run_all(args):
    """Run all AI helpers."""
    print("\n⚔️ Running Full AI Mission...")
    print("=" * 60)
    
    # Run Wikipedia first
    run_wikipedia(args)
    
    print("\n" + "-" * 60 + "\n")
    
    # Run DuckDuck
    run_duckduck(args)
    
    print("\n" + "-" * 60 + "\n")
    
    # Run town population
    run_populate(args)
    
    print("\n" + "=" * 60)
    print("✅ Full AI Mission Complete!")
    print("=" * 60)


def main():
    """Main entry point."""
    banner()
    
    parser = argparse.ArgumentParser(
        description="KEEP-Up AI Orchestrator - Commands The Scholar and The Scout"
    )
    
    parser.add_argument(
        'command',
        choices=['wikipedia', 'duckduck', 'populate', 'all'],
        help='AI command to run'
    )
    
    parser.add_argument(
        '--city',
        type=str,
        default='Porto Alegre',
        help='City for event searches (default: Porto Alegre)'
    )
    
    parser.add_argument(
        '--country',
        type=str,
        default='Brazil',
        help='Country for event searches (default: Brazil)'
    )
    
    parser.add_argument(
        '--category',
        type=str,
        choices=['music', 'movies', 'food', 'nightlife', 'outdoors', 'culture', 'sports', 'tech'],
        help='Category filter for searches'
    )
    
    args = parser.parse_args()
    
    # Log execution
    print(f"🕐 Execution started at {datetime.now().isoformat()}")
    
    # Run the selected command
    commands = {
        'wikipedia': run_wikipedia,
        'duckduck': run_duckduck,
        'populate': run_populate,
        'all': run_all
    }
    
    try:
        commands[args.command](args)
    except KeyboardInterrupt:
        print("\n\n⚠️ Execution interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print(f"\n🕐 Execution completed at {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
