/**
 * DuckDuckAI Image Fetcher
 * AI-powered image fetcher using Deepseek AI and DuckDuckGo
 * Provides intelligent search query generation and result organization
 */

const axios = require('axios');

class DuckDuckAIFetcher {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.timeout = 30000; // Increased to 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds between retries
    this.deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  /**
   * Use Deepseek AI to generate optimal search queries for event images
   * @param {string} eventName - Event name
   * @param {string} artistName - Artist name
   * @returns {string[]} - Array of optimized search queries
   */
  async generateSmartQueries(eventName, artistName) {
    if (!this.deepseekApiKey) {
      console.log('⚠️  Deepseek API key not found, using basic queries');
      return this.generateBasicQueries(eventName, artistName);
    }

    try {
      const prompt = `Analyze this event: "${eventName}" by artist "${artistName || 'Unknown'}"

Generate 5 optimal search queries for finding high-quality images of this event/artist. Focus on:
- Official promotional images
- Concert/live performance photos
- Professional headshots
- Event posters/banners
- High-resolution images

Return only a JSON array of 5 search query strings, like: ["query1", "query2", "query3", "query4", "query5"]

Make queries specific and likely to return relevant results.`;

      const response = await axios.post(this.deepseekUrl, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const content = response.data.choices[0].message.content;
      const queries = JSON.parse(content);

      if (Array.isArray(queries) && queries.length > 0) {
        console.log(`🤖 Deepseek generated ${queries.length} smart queries for "${eventName}"`);
        return queries;
      }

    } catch (error) {
      console.warn('Deepseek AI query generation failed:', error.message);
    }

    // Fallback to basic queries
    return this.generateBasicQueries(eventName, artistName);
  }

  /**
   * Generate basic search queries when AI is not available
   * @param {string} eventName - Event name
   * @param {string} artistName - Artist name
   * @returns {string[]} - Array of basic search queries
   */
  generateBasicQueries(eventName, artistName) {
    const queries = [];
    const searchTerm = artistName || eventName;

    // Basic variations
    queries.push(searchTerm);
    queries.push(`${searchTerm} band`);
    queries.push(`${searchTerm} music`);
    queries.push(`${searchTerm} concert`);
    queries.push(`${searchTerm} live`);

    // Add event-specific terms if different from artist
    if (artistName && eventName && artistName !== eventName) {
      queries.push(`${artistName} ${eventName}`);
      queries.push(`${eventName} poster`);
    }

    return queries.slice(0, 5); // Limit to 5 queries
  }

  /**
   * Enhanced DuckDuckGo search with better result filtering and retry logic
   * @param {string} query - Search query
   * @returns {string|null} - Best image URL or null
   */
  async searchDuckDuckGo(query) {
    if (!query) return null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔍 Searching DuckDuckGo for: "${query}" (attempt ${attempt}/${this.maxRetries})`);

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
          let imageUrl = data.Image;
          if (imageUrl.startsWith('/')) {
            imageUrl = `https://duckduckgo.com${imageUrl}`;
          }

          // Validate the image URL
          if (await this.validateImageUrl(imageUrl)) {
            console.log(`✅ Found valid image: ${imageUrl}`);
            return imageUrl;
          }
        }

        // Try related topics if main image not found or invalid
        if (data?.RelatedTopics && data.RelatedTopics.length > 0) {
          for (const topic of data.RelatedTopics.slice(0, 3)) {
            if (topic?.Icon?.URL) {
              let topicImageUrl = topic.Icon.URL;
              if (topicImageUrl.startsWith('/')) {
                topicImageUrl = `https://duckduckgo.com${topicImageUrl}`;
              }

              if (await this.validateImageUrl(topicImageUrl)) {
                console.log(`✅ Found valid related image: ${topicImageUrl}`);
                return topicImageUrl;
              }
            }
          }
        }

        // If we get here, no valid image found, but don't retry for this query
        return null;

      } catch (err) {
        console.warn(`DuckDuckGo search failed for "${query}" (attempt ${attempt}):`, err.message);

        if (attempt < this.maxRetries) {
          console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          console.log(`❌ All ${this.maxRetries} attempts failed for "${query}"`);
        }
      }
    }

    return null;
  }

  /**
   * Main method to fetch event image using AI-powered search
   * @param {string} eventName - Event name
   * @param {string} artistName - Artist name
   * @returns {string|null} - Best available image URL
   */
  async fetchEventImage(eventName, artistName) {
    console.log(`🎯 DuckDuckAI fetching image for: "${eventName}" by "${artistName || 'Unknown'}"`);

    // Generate smart search queries using AI
    const queries = await this.generateSmartQueries(eventName, artistName);

    // Try each query with DuckDuckGo
    for (const query of queries) {
      const imageUrl = await this.searchDuckDuckGo(query);
      if (imageUrl) {
        return imageUrl;
      }

      // Small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Try alternative search methods if DuckDuckGo fails
    console.log('🔄 DuckDuckGo failed, trying alternative methods...');
    const altImageUrl = await this.searchAlternativeSources(eventName, artistName);
    if (altImageUrl) {
      return altImageUrl;
    }

    // Final fallback to AI-organized Unsplash images with variety
    console.log('🏁 Using AI-organized Unsplash fallback');
    return this.getAIFallbackImage(eventName, artistName);
  }

  /**
   * Search alternative sources when DuckDuckGo fails
   * @param {string} eventName - Event name
   * @param {string} artistName - Artist name
   * @returns {string|null} - Image URL from alternative source
   */
  async searchAlternativeSources(eventName, artistName) {
    const searchTerm = artistName || eventName;

    // Try direct Unsplash search with music/art categories
    try {
      console.log(`🎨 Trying Unsplash search for: "${searchTerm}"`);

      // Use Unsplash API if available (requires access key in production)
      const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm + ' music')}&per_page=1&orientation=landscape`;

      const response = await axios.get(unsplashUrl, {
        headers: {
          'Authorization': 'Client-ID YOUR_UNSPLASH_ACCESS_KEY' // Would need actual key
        },
        timeout: 10000
      });

      if (response.data?.results?.length > 0) {
        const image = response.data.results[0];
        const imageUrl = `${image.urls.raw}&w=400&h=300&fit=crop&crop=center`;
        console.log(`✅ Found Unsplash image: ${imageUrl}`);
        return imageUrl;
      }
    } catch (error) {
      console.log('Unsplash API not available, using curated fallbacks');
    }

    // For now, return null to use the AI-organized fallback
    return null;
  }

  /**
   * AI-organized fallback using smart categorization
   * @param {string} eventName - Event name
   * @param {string} artistName - Artist name
   * @returns {string} - Fallback image URL
   */
  getAIFallbackImage(eventName, artistName) {
    const text = (artistName || eventName || '').toLowerCase();

    // Brazilian music genre detection
    const brazilianGenres = {
      samba: ['samba', 'pagode', 'gilberto gil', 'martinho da vila'],
      forro: ['forró', 'wesley safadão', 'luan santana', 'zé neto', 'cristiano'],
      sertanejo: ['sertanejo', 'tt rocha', 'marília mendonça', 'gusttavo lima'],
      pop: ['pop', 'pabllo vittar', 'anitta', 'luísa sonza'],
      mpb: ['mpb', 'bossa nova', 'djavan', 'milton nascimento'],
      rock: ['rock', 'legião urbana', 'barão vermelho', 'titas'],
      reggae: ['reggae', 'natiruts', 'ponto de equilíbrio'],
      funk: ['funk', 'mc kevin', 'lexa', 'kevinho']
    };

    // Detect Brazilian genre from artist/event name
    let detectedGenre = 'generic';
    for (const [genre, keywords] of Object.entries(brazilianGenres)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detectedGenre = genre;
        break;
      }
    }

    // Genre-specific high-quality images (mix of Brazilian and international)
    const genreImages = {
      samba: [
        'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop&crop=center'
      ],
      forro: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center'
      ],
      sertanejo: [
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center'
      ],
      pop: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center'
      ],
      mpb: [
        'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1489599735734-79b4dfe3b22a?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=300&fit=crop&crop=center'
      ],
      rock: [
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop&crop=center'
      ],
      reggae: [
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center'
      ],
      funk: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center'
      ],
      generic: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1551818255-e80b9c79e63c?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&h=300&fit=crop&crop=center'
      ]
    };

    // Use hash of event name for consistent but varied selection
    const hash = this.simpleHash(text);
    const images = genreImages[detectedGenre] || genreImages.generic;
    const index = Math.abs(hash) % images.length;

    const selectedImage = images[index];
    console.log(`🎨 AI-selected ${detectedGenre} image for ${artistName || eventName}: ${selectedImage}`);
    return selectedImage;
  }

  /**
   * Simple hash function for consistent image selection
   * @param {string} str - String to hash
   * @returns {number} - Hash value
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
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

module.exports = DuckDuckAIFetcher;