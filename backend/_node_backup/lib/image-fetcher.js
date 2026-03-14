/**
 * Image Fetcher Utility
 * Fetches event/artist images from DuckDuckGo Instant Answers API
 * Used when event APIs don't provide images for events
 *
 * Strategy:
 * 1. Try DuckDuckGo with original query
 * 2. Try DuckDuckGo with enhanced queries (add "band", "music", "event", "concert")
 * 3. Fall back to category-based Unsplash images
 *
 * No API keys required - uses public DuckDuckGo API
 */

const axios = require('axios');
const WikipediaImageFetcher = require('./wikipedia-image-fetcher');

class ImageFetcher {
  constructor() {
    this.timeout = 10000; // 10 seconds
    // Use Wikipedia as the primary, reliable source inside containers
    this.wikipedia = new WikipediaImageFetcher();
  }

  /**
   * Fetch image from DuckDuckGo Instant Answers API
   * @param {string} query - Search query (artist name or event title)
   * @returns {string|null} - Image URL or null if not found
   */
  async fetchImageFromDuckDuckGo(query) {
    if (!query) return null;

    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1
        },
        timeout: this.timeout
      });

      const data = response.data;
      if (data?.Image) {
        // DuckDuckGo returns relative URLs like "/i/abc123.jpg"
        // Convert to full URL
        if (data.Image.startsWith('/')) {
          return `https://duckduckgo.com${data.Image}`;
        }
        return data.Image;
      }

      // Enhanced fallback: try multiple query variations for better results
      const variations = [];

      // For music/artists, try different search terms
      if (!query.toLowerCase().includes('band') &&
          !query.toLowerCase().includes('music') &&
          !query.toLowerCase().includes('artist')) {
        variations.push(`${query} band`, `${query} music`, `${query} artist`);
      }

      // For events, try different terms
      if (!query.toLowerCase().includes('event') &&
          !query.toLowerCase().includes('concert') &&
          !query.toLowerCase().includes('festival')) {
        variations.push(`${query} concert`, `${query} event`);
      }

      // Try each variation
      for (const variation of variations.slice(0, 2)) { // Limit to 2 variations to avoid too many requests
        console.log(`🔄 Trying DuckDuckGo variation: "${variation}"`);
        try {
          const retryResponse = await axios.get('https://api.duckduckgo.com/', {
            params: {
              q: variation,
              format: 'json',
              no_html: 1,
              skip_disambig: 1
            },
            timeout: this.timeout
          });

          const retryData = retryResponse.data;
          if (retryData?.Image) {
            if (retryData.Image.startsWith('/')) {
              return `https://duckduckgo.com${retryData.Image}`;
            }
            return retryData.Image;
          }
        } catch (retryErr) {
          // Continue to next variation
        }
      }

    } catch (err) {
      console.warn(`DuckDuckGo image fetch failed for "${query}":`, err.message);
    }
    return null;
  }

  /**
   * Fetch image for an event/artist using multiple sources
   * Priority: DuckDuckGo (with smart query variations) -> Fallback images
   * @param {string} artistName - Artist name (used for better search queries)
   * @param {string} eventTitle - Event title (fallback for search)
   * @returns {string|null} - Best available image URL
   */
  async fetchEventImage(artistName, eventTitle) {
    // Primary: try Wikipedia (reliable from containers)
    try {
      if (artistName) {
        const wikiImg = await this.wikipedia.getArtistImage(artistName);
        if (wikiImg) {
          console.log(`🟢 Using Wikipedia image for "${artistName}": ${wikiImg}`);
          return { url: wikiImg, source: 'wikipedia' };
        }
      }

      // Sometimes the event title maps to a Wikipedia page (venues, festivals)
      if (eventTitle) {
        const wikiImg = await this.wikipedia.getArtistImage(eventTitle);
        if (wikiImg) {
          console.log(`🟢 Using Wikipedia image for event "${eventTitle}": ${wikiImg}`);
          return { url: wikiImg, source: 'wikipedia' };
        }
      }
    } catch (e) {
      // Continue to other fallbacks if Wikipedia fails
      console.warn('⚠️ Wikipedia fetch failed, falling back:', e.message || e);
    }

    // Secondary: try DuckDuckGo (legacy) — kept for environments where DDG is reachable
    let searchQuery = artistName || eventTitle;
    if (!searchQuery) return null;

    // Build a smarter search query
    if (artistName) {
      const artistQueries = [
        artistName,
        `${artistName} band`,
        `${artistName} music`,
        `${artistName} artist`
      ];

      for (const query of artistQueries) {
        const image = await this.fetchImageFromDuckDuckGo(query);
        if (image) {
          console.log(`🖼️ Found DuckDuckGo image for artist "${artistName}" using "${query}": ${image}`);
          return { url: image, source: 'duckduckgo' };
        }
      }
    } else if (eventTitle) {
      const eventQueries = [
        eventTitle,
        `${eventTitle} event`,
        `${eventTitle} concert`
      ];

      for (const query of eventQueries) {
        const image = await this.fetchImageFromDuckDuckGo(query);
        if (image) {
          console.log(`🖼️ Found DuckDuckGo image for event "${eventTitle}" using "${query}": ${image}`);
          return { url: image, source: 'duckduckgo' };
        }
      }
    }

    // Final fallback: generic event image based on category (Unsplash curated)
    const fallbackImage = this.getFallbackImage(eventTitle || artistName || '');
    if (fallbackImage) {
      console.log(`🖼️ Using fallback image for "${eventTitle || artistName}": ${fallbackImage}`);
      return { url: fallbackImage, source: 'unsplash' };
    }

    return null;
  }

  /**
   * Get a fallback image URL based on event type or content
   * @param {string} text - Event title or artist name
   * @returns {string|null} - Fallback image URL
   */
  getFallbackImage(text) {
    const lowerText = text.toLowerCase();

    // Array of music/concert images for variety
    const musicImages = [
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center'
    ];

    // Array of sports images for variety
    const sportsImages = [
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&crop=center'
    ];

    // Array of theater/arts images for variety
    const theaterImages = [
      'https://images.unsplash.com/photo-1489599735734-79b4dfe3b22a?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1489599735734-79b4dfe3b22a?w=400&h=300&fit=crop&crop=center'
    ];

    // Array of generic event images for variety
    const genericImages = [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1551818255-e80b9c79e63c?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&h=300&fit=crop&crop=center'
    ];

    // Create a simple hash of the text to get consistent but varied image selection
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Music/concert related - use hash to select from music images
    if (lowerText.includes('concert') || lowerText.includes('music') || lowerText.includes('band') ||
        lowerText.includes('jazz') || lowerText.includes('rock') || lowerText.includes('festival') ||
        lowerText.includes('live') || lowerText.includes('show') || lowerText.includes('tour')) {
      const index = Math.abs(hash) % musicImages.length;
      return musicImages[index];
    }

    // Sports related - use hash to select from sports images
    if (lowerText.includes('football') || lowerText.includes('soccer') || lowerText.includes('game') ||
        lowerText.includes('match') || lowerText.includes('stadium') || lowerText.includes('sport')) {
      const index = Math.abs(hash) % sportsImages.length;
      return sportsImages[index];
    }

    // Theater/arts - use hash to select from theater images
    if (lowerText.includes('theater') || lowerText.includes('theatre') || lowerText.includes('play') ||
        lowerText.includes('show') || lowerText.includes('art') || lowerText.includes('theater')) {
      const index = Math.abs(hash) % theaterImages.length;
      return theaterImages[index];
    }

    // Generic event fallback - use hash to select from generic images
    const index = Math.abs(hash) % genericImages.length;
    return genericImages[index];
  }

  /**
   * Validate if an image URL is accessible
   * @param {string} url - Image URL to validate
   * @returns {boolean} - True if image is accessible
   */
  async validateImageUrl(url) {
    if (!url) return false;

    try {
      const response = await axios.head(url, { timeout: 5000 });
      return response.status === 200 && response.headers['content-type']?.startsWith('image/');
    } catch (err) {
      return false;
    }
  }
}

module.exports = ImageFetcher;