/**
 * 🦅 Feather-Dragon Bridge
 * =========================
 * Node.js ↔ Python communication layer for omnipresent event discovery
 * 
 * The Feather-Dragon flies through the digital realm with multiple clones,
 * searching DuckDuckGo and analyzing with DeepSeek AI in parallel.
 */

const { spawn } = require('child_process');
const path = require('path');

class FeatherDragonBridge {
    constructor() {
        this.pythonPath = path.join(__dirname, 'feather_dragon.py');
        this.isAvailable = false;
        this.checkAvailability();
    }

    /**
     * Check if Feather-Dragon Python script is available
     */
    checkAvailability() {
        const fs = require('fs');
        this.isAvailable = fs.existsSync(this.pythonPath);
        if (this.isAvailable) {
            console.log('🦅 Feather-Dragon bridge initialized');
        } else {
            console.warn('⚠️  Feather-Dragon Python script not found at:', this.pythonPath);
        }
    }

    /**
     * Execute Python Feather-Dragon and parse results
     * @param {Array<string>} artists - Artists to search for
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async executeFeatherDragon(artists, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Feather-Dragon Python script not available');
        }

        const { useAI = false, maxClones = 10 } = options;

        return new Promise((resolve, reject) => {
            const args = [...artists];
            
            if (useAI) {
                args.push('--ai');
            }
            
            args.push('--clones', maxClones.toString());

            console.log(`🦅 Spawning Feather-Dragon with ${maxClones} clones for ${artists.length} artists...`);
            console.log(`🧠 AI Mode: ${useAI ? 'ENABLED' : 'DISABLED'}`);

            const pythonProcess = spawn('python3', [this.pythonPath, ...args]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                
                // Log progress messages (non-JSON)
                if (!output.trim().startsWith('{') && output.trim().length > 0) {
                    console.log(`🦅 ${output.trim()}`);
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`🦅 Error: ${data.toString().trim()}`);
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Feather-Dragon exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Extract JSON from output (last JSON object)
                    const jsonMatches = stdout.match(/\{[\s\S]*\}/g);
                    if (jsonMatches && jsonMatches.length > 0) {
                        const result = JSON.parse(jsonMatches[jsonMatches.length - 1]);
                        resolve(result);
                    } else {
                        reject(new Error('No valid JSON output from Feather-Dragon'));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse Feather-Dragon output: ${error.message}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Feather-Dragon: ${error.message}`));
            });
        });
    }

    /**
     * Search for events using Feather-Dragon's omnipresent clones
     * @param {Array<string>} artists - Artist names to search for
     * @param {boolean} useAI - Whether to use DeepSeek AI analysis
     * @param {number} maxClones - Maximum parallel clones
     * @returns {Promise<Array>} Array of discovered events
     */
    async searchEventsOmnipresent(artists, useAI = false, maxClones = 10) {
        try {
            const result = await this.executeFeatherDragon(artists, { useAI, maxClones });
            
            console.log(`🦅 Feather-Dragon discovered ${result.events_found} events for ${result.artists.length} artists`);
            
            return result.events || [];
        } catch (error) {
            console.error('🦅 Feather-Dragon search failed:', error.message);
            return [];
        }
    }

    /**
     * Search for a single artist's events
     * @param {string} artist - Artist name
     * @param {boolean} useAI - Whether to use DeepSeek AI
     * @returns {Promise<Array>} Array of discovered events
     */
    async searchArtistEvents(artist, useAI = false) {
        return this.searchEventsOmnipresent([artist], useAI, 5);
    }

    /**
     * Batch search with Dragons mode (uses max clones)
     * @param {Array<string>} artists - Artists to search
     * @param {boolean} useAI - Whether to use DeepSeek AI
     * @returns {Promise<Object>} Results with events grouped by artist
     */
    async batchSearchDragonsMode(artists, useAI = false) {
        console.log('🦅 DRAGONS MODE ACTIVATED - Feather-Dragon deploys all clones!');
        
        const events = await this.searchEventsOmnipresent(artists, useAI, 20);
        
        // Group events by artist
        const grouped = {};
        for (const event of events) {
            const artist = event.artist || 'Unknown';
            if (!grouped[artist]) {
                grouped[artist] = [];
            }
            grouped[artist].push(event);
        }
        
        return {
            success: true,
            total_artists: artists.length,
            total_events: events.length,
            grouped_events: grouped,
            all_events: events
        };
    }
}

module.exports = FeatherDragonBridge;

// Test if run directly
if (require.main === module) {
    const bridge = new FeatherDragonBridge();
    
    const testArtists = ['Metallica', 'Iron Maiden'];
    
    bridge.searchEventsOmnipresent(testArtists, false, 5)
        .then(events => {
            console.log('\n🦅 TEST RESULTS:');
            console.log(JSON.stringify(events, null, 2));
        })
        .catch(error => {
            console.error('Test failed:', error.message);
        });
}
