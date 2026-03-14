/**
 * AI-POWERED SEARCH MODULE v2.1
 * Uses AI from .env configuration to intelligently search for events and artists
 * Auto-detects available AI providers and uses the best one
 * 
 * Fallback chain:
 *   1. Configured models (selectedModels from admin config)
 *   2. DeepSeek direct API (if DEEPSEEK_API_KEY set)
 *   3. Free OpenRouter models (auto-activated if OPENROUTER_API_KEY set)
 *   4. Paid OpenRouter models only if manually selected in admin config
 */

const axios = require('axios');
const EventEmitter = require('events');
require('dotenv').config();

// Free models on OpenRouter — auto-activate as fallback.
// Paid models (GPT-4, Claude, etc.) must be manually selected in Admin > AI Config.
const FREE_OPENROUTER_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-4b:free',
];

class AISearch extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Use provided config or auto-detect from .env
        this.selectedModels = config.selectedModels || [];
        this.apiKeys = config.apiKeys || this.loadFromEnv();
        
        if (this.selectedModels.length === 0) {
            this.selectedModels = ['deepseek/deepseek-chat']; // Default
        }
        
        if (Object.keys(this.apiKeys).length === 0) {
            this.emit('warn', '⚠️  No AI API keys found');
        } else {
            this.emit('log', `✅ Loaded ${Object.keys(this.apiKeys).length} AI providers`);
            this.emit('log', `📋 Selected models: ${this.selectedModels.length}`);
        }
    }

    loadFromEnv() {
        const keys = {};
        
        // Load all available API keys from .env
        if (process.env.OPENROUTER_API_KEY) keys['openrouter'] = process.env.OPENROUTER_API_KEY;
        if (process.env.OPENAI_API_KEY) keys['openai'] = process.env.OPENAI_API_KEY;
        if (process.env.DEEPSEEK_API_KEY) keys['deepseek'] = process.env.DEEPSEEK_API_KEY;
        if (process.env.ANTHROPIC_API_KEY) keys['anthropic'] = process.env.ANTHROPIC_API_KEY;
        if (process.env.GOOGLE_AI_KEY) keys['google'] = process.env.GOOGLE_AI_KEY;
        if (process.env.MISTRAL_API_KEY) keys['mistral'] = process.env.MISTRAL_API_KEY;
        if (process.env.GROQ_API_KEY) keys['groq'] = process.env.GROQ_API_KEY;
        
        return keys;
    }

    async searchEventsInCity(city, country = 'Brazil', options = {}) {
        if (Object.keys(this.apiKeys).length === 0) {
            throw new Error('❌ No AI API key configured in .env');
        }

        const maxResults = options.maxResults || 100;
        this.emit('log', `🌍 Searching for events in ${city}, ${country}...`);
        
        try {
            // Generate search queries using AI
            const queries = await this.generateEventQueries(city, country);
            this.emit('log', `📋 Generated ${queries.length} AI search queries`);
            
            let allEvents = [];
            
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                this.emit('log', `🔎 Query ${i+1}/${queries.length}: "${query}"`);
                
                try {
                    // Search and extract events
                    const events = await this.searchAndExtractEvents(query, city, country);
                    allEvents.push(...events);
                    this.emit('log', `   ✅ Found ${events.length} events`);
                    
                    // Rate limiting
                    await this.sleep(800);
                } catch (err) {
                    this.emit('log', `   ⚠️  Error: ${err.message}`);
                }
            }
            
            // Deduplicate
            allEvents = this.deduplicateEvents(allEvents);
            this.emit('log', `📊 Total unique events: ${allEvents.length}`);
            
            return allEvents.slice(0, maxResults);
        } catch (err) {
            this.emit('error', `❌ Search failed: ${err.message}`);
            throw err;
        }
    }

    async generateEventQueries(city, country) {
        const prompt = `Generate 6-8 diverse search queries to find live events and concerts in ${city}, ${country}. 
        Cover: concerts, festivals, theater, cinema, sports, nightlife, community events.
        Return ONLY a JSON array of search queries (no explanation).
        Example: ["concerts ${city} 2025", "live music ${city}", ...]`;

        try {
            const response = await this.callAI(prompt);
            const jsonMatch = response.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            this.emit('log', `⚠️  Using default queries`);
        }
        
        return [
            `upcoming concerts ${city} ${country}`,
            `live music events ${city}`,
            `shows festivals ${city}`,
            `entertainment events ${city}`,
            `nightlife clubs ${city}`,
            `theater cinema ${city}`,
            `community events ${city}`
        ];
    }

    async searchAndExtractEvents(query, city, country) {
        const prompt = `Search for events matching: "${query}" in ${city}, ${country}.
        
Extract ALL relevant events. For each event, provide:
{
  "name": "Event Name",
  "date": "Date or TBA",
  "venue": "Venue Name",
  "city": "${city}",
  "country": "${country}",
  "description": "Description if available"
}

Return ONLY a JSON array of events (no markdown, no explanation).
If no events, return empty array [].`;

        try {
            const response = await this.callAI(prompt);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                if (Array.isArray(events)) {
                    return events.filter(e => e.name).map(e => ({
                        event_name: e.name,
                        event_date: this.parseDate(e.date),
                        venue_name: e.venue || 'TBA',
                        venue_city: city,
                        venue_country: country,
                        description: e.description || '',
                        source: 'ai-search'
                    }));
                }
            }
        } catch (err) {
            this.emit('log', `   ⚠️  Parse error: ${err.message}`);
        }
        
        return [];
    }

    async callAI(prompt) {
        if (Object.keys(this.apiKeys).length === 0) {
            throw new Error('No API keys configured');
        }

        // TIER 1: Try each manually-configured model in order
        for (const model of this.selectedModels) {
            try {
                return await this.callModel(model, prompt);
            } catch (err) {
                this.emit('log', `   ⚠️  ${model} failed: ${err.message}`);
                // Continue to next model
            }
        }

        // TIER 2: Auto-fallback to free OpenRouter models
        if (this.apiKeys['openrouter']) {
            this.emit('log', '   🔄 All configured models failed — trying free OpenRouter fallback...');
            for (const freeModel of FREE_OPENROUTER_MODELS) {
                // Skip if already tried as a selected model
                if (this.selectedModels.includes(freeModel)) continue;
                try {
                    const result = await this.callOpenRouter(prompt, freeModel);
                    this.emit('log', `   ✅ Free fallback succeeded: ${freeModel}`);
                    return result;
                } catch (err) {
                    this.emit('log', `   ⚠️  Free ${freeModel} failed: ${err.message}`);
                }
            }
        }
        
        throw new Error('All configured AI models and free fallbacks failed');
    }

    async callModel(modelName, prompt) {
        // Determine provider and model from modelName
        if (modelName.includes('gpt') || modelName === 'gpt-4' || modelName === 'gpt-3.5-turbo') {
            // OpenAI or OpenRouter with OpenAI
            if (modelName.startsWith('openai/')) {
                const key = this.apiKeys['openrouter'];
                if (!key) throw new Error('OpenRouter API key not configured');
                return await this.callOpenRouter(prompt, modelName);
            } else {
                const key = this.apiKeys['openai'];
                if (!key) throw new Error('OpenAI API key not configured');
                return await this.callOpenAI(prompt, modelName);
            }
        } else if (modelName.includes('claude')) {
            // Anthropic Claude or via OpenRouter
            if (modelName.startsWith('anthropic/')) {
                const key = this.apiKeys['openrouter'];
                if (!key) throw new Error('OpenRouter API key not configured');
                return await this.callOpenRouter(prompt, modelName);
            } else {
                const key = this.apiKeys['anthropic'];
                if (!key) throw new Error('Anthropic API key not configured');
                return await this.callAnthropic(prompt, modelName);
            }
        } else if (modelName.includes('deepseek')) {
            // DeepSeek
            if (modelName.startsWith('deepseek/')) {
                const key = this.apiKeys['openrouter'];
                if (!key) throw new Error('OpenRouter API key not configured');
                return await this.callOpenRouter(prompt, modelName);
            } else {
                const key = this.apiKeys['deepseek'];
                if (!key) throw new Error('DeepSeek API key not configured');
                return await this.callDeepSeek(prompt);
            }
        } else if (modelName.includes('mistral') || modelName.includes('mixtral')) {
            // Mistral
            const key = this.apiKeys['openrouter'] || this.apiKeys['mistral'];
            if (!key) throw new Error('Mistral API key not configured');
            return await this.callOpenRouter(prompt, modelName);
        } else if (modelName.includes('llama') || modelName.includes('groq')) {
            // Groq
            const key = this.apiKeys['openrouter'] || this.apiKeys['groq'];
            if (!key) throw new Error('Groq API key not configured');
            return await this.callOpenRouter(prompt, modelName);
        } else if (modelName.includes('gemini')) {
            // Google Gemini
            const key = this.apiKeys['google'];
            if (!key) throw new Error('Google API key not configured');
            return await this.callGoogle(prompt);
        } else {
            // Default to OpenRouter
            const key = this.apiKeys['openrouter'];
            if (!key) throw new Error('OpenRouter API key not configured');
            return await this.callOpenRouter(prompt, modelName);
        }
    }

    async callOpenRouter(prompt, model) {
        const apiKey = this.apiKeys['openrouter'];
        if (!apiKey) throw new Error('OpenRouter API key not configured');
        
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'KEEPUP'
            },
            timeout: 30000
        });
        
        return response.data.choices[0].message.content;
    }

    async callDeepSeek(prompt) {
        const apiKey = this.apiKeys['deepseek'];
        if (!apiKey) throw new Error('DeepSeek API key not configured');
        
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 30000
        });
        
        return response.data.choices[0].message.content;
    }

    async callOpenAI(prompt, model = 'gpt-3.5-turbo') {
        const apiKey = this.apiKeys['openai'];
        if (!apiKey) throw new Error('OpenAI API key not configured');
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 30000
        });
        
        return response.data.choices[0].message.content;
    }

    async callAnthropic(prompt, model) {
        const apiKey = this.apiKeys['anthropic'];
        if (!apiKey) throw new Error('Anthropic API key not configured');
        
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: model,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'x-api-key': apiKey },
            timeout: 30000
        });
        
        return response.data.content[0].text;
    }

    async callGoogle(prompt) {
        const apiKey = this.apiKeys['google'];
        if (!apiKey) throw new Error('Google API key not configured');
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 30000 }
        );
        
        return response.data.candidates[0].content.parts[0].text;
    }

    parseDate(dateStr) {
        if (!dateStr || dateStr === 'TBA' || dateStr === 'N/A') return null;
        
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // Continue
        }
        
        return null;
    }

    deduplicateEvents(events) {
        const seen = new Set();
        return events.filter(e => {
            const key = `${e.event_name}|${e.venue_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = AISearch;
