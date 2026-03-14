"""
KEEP-Up AI Helpers Module
=========================
📚 The Scholar (WikipediaAI) - Knowledge extraction from Wikipedia
🔍 The Scout (DuckDuckAI) - Event discovery via DuckDuckGo

Usage:
    from python.wikipedia_ai import WikipediaAI
    from python.duckduck_ai import DuckDuckAI
"""

from .wikipedia_ai import WikipediaAI
from .duckduck_ai import DuckDuckAI

__all__ = ['WikipediaAI', 'DuckDuckAI']
__version__ = '1.0.0'
