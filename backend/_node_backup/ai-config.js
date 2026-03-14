/**
 * AI CONFIGURATION MANAGER
 * Stores and retrieves AI provider settings, API keys, and search engine preferences
 */

const fs = require('fs').promises;
const path = require('path');

class AIConfig {
    constructor(configPath = './ai-config.json') {
        this.configPath = path.resolve(configPath);
        this.config = this.getDefaults();
    }

    /**
     * Get default configuration
     */
    getDefaults() {
        return {
            aiProvider: 'deepseek', // 'openrouter', 'deepseek', 'google', 'mistral', 'groq'
            aiModel: 'deepseek-chat', // Model selection
            apiKey: '', // Will be populated from env or saved config
            selectedModels: ['deepseek-chat'],
            selectedEngines: ['eventbrite', 'ticketmaster', 'sympla', 'foursquare'],
            searchEngines: {
                google: true,
                duckduckgo: true,
                bing: false,
                perplexity: false,
                serper: false
            },
            advancedOptions: {
                timeout: 30000,
                maxRetries: 3,
                temperature: 0.7,
                maxTokens: 2000
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Load configuration from file
     */
    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf-8');
            this.config = JSON.parse(data);
            
            // Always check environment variables as fallback if no key in file
            if (!this.config.apiKey) {
                this.config.apiKey = process.env.DEEPSEEK_API_KEY || 
                                     process.env.OPENROUTER_API_KEY || 
                                     process.env.GOOGLE_API_KEY || 
                                     process.env.MISTRAL_API_KEY ||
                                     process.env.GROQ_API_KEY ||
                                     '';
            }
            
            console.log('✅ AI Config loaded from file');
            console.log(`🔑 API Key status: ${this.config.apiKey ? 'Found' : 'Missing'}`);
            return this.config;
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log('ℹ️  No saved config, using defaults');
                // Try to get API key from environment
                this.config.apiKey = process.env.DEEPSEEK_API_KEY || 
                                     process.env.OPENROUTER_API_KEY || 
                                     process.env.GOOGLE_API_KEY || 
                                     process.env.MISTRAL_API_KEY ||
                                     process.env.GROQ_API_KEY ||
                                     '';
                
                console.log(`🔑 API Key from env: ${this.config.apiKey ? 'Found' : 'Missing'}`);
                
                // If we have a key from env, auto-detect provider
                if (this.config.apiKey) {
                    if (process.env.DEEPSEEK_API_KEY && this.config.apiKey === process.env.DEEPSEEK_API_KEY) {
                        this.config.aiProvider = 'deepseek';
                        this.config.aiModel = 'deepseek-chat';
                        console.log('🤖 Primary AI: DeepSeek (direct)');
                    } else if (this.config.apiKey.includes('sk-or-')) {
                        this.config.aiProvider = 'openrouter';
                        this.config.aiModel = 'deepseek/deepseek-chat';
                        console.log('🤖 Primary AI: OpenRouter');
                    } else if (this.config.apiKey.startsWith('sk-')) {
                        this.config.aiProvider = 'deepseek';
                        this.config.aiModel = 'deepseek-chat';
                        console.log('🤖 Primary AI: DeepSeek (direct)');
                    }
                    // Note: Free OpenRouter models auto-activate as fallback
                    // Paid models (GPT-4, Claude, etc.) must be manually selected
                    if (process.env.OPENROUTER_API_KEY) {
                        console.log('🔄 OpenRouter free fallback: ACTIVE');
                    }
                }
                
                return this.config;
            }
            throw err;
        }
    }

    /**
     * Save configuration to file
     */
    async save(newConfig) {
        try {
            const config = { ...this.config, ...newConfig };
            config.lastUpdated = new Date().toISOString();
            
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
            this.config = config;
            
            console.log('✅ AI Config saved');
            return this.config;
        } catch (err) {
            console.error('❌ Failed to save config:', err.message);
            throw err;
        }
    }

    /**
     * Get current configuration
     */
    get() {
        return { ...this.config };
    }

    /**
     * Update AI provider
     */
    async setAIProvider(provider, model, apiKey) {
        return this.save({
            aiProvider: provider,
            aiModel: model,
            apiKey: apiKey
        });
    }

    /**
     * Update search engines
     */
    async setSearchEngines(engines) {
        const updated = { ...this.config };
        updated.searchEngines = engines;
        return this.save(updated);
    }

    /**
     * Toggle specific search engine
     */
    async toggleSearchEngine(engine) {
        const updated = { ...this.config };
        updated.searchEngines[engine] = !updated.searchEngines[engine];
        return this.save(updated);
    }

    /**
     * Get enabled search engines
     */
    getEnabledSearchEngines() {
        return Object.keys(this.config.searchEngines)
            .filter(engine => this.config.searchEngines[engine]);
    }

    /**
     * Validate API key (make a test call)
     */
    async validateAPIKey() {
        if (!this.config.apiKey) {
            return { valid: false, message: 'No API key configured' };
        }
        
        try {
            const AISearch = require('./ai-search');
            const ai = new AISearch(this.config);
            
            // Simple test prompt
            const response = await ai.callAI('Respond with just "OK"');
            
            if (response && response.includes('OK')) {
                return { valid: true, message: 'API key is valid' };
            }
            
            return { valid: false, message: 'API key test failed' };
        } catch (err) {
            return { valid: false, message: `API error: ${err.message}` };
        }
    }
}

module.exports = AIConfig;
