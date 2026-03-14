/**
 * 🐉 SAGE-DRAGON BRIDGE
 * Connects Node.js with Python Wikipedia AI for ultra-fast genre-based artist discovery
 */

const { spawn } = require('child_process');
const path = require('path');

class SageDragonBridge {
    constructor() {
        this.pythonPath = 'python3';
        this.scriptPath = path.join(__dirname, 'wikipedia_ai.py');
    }

    /**
     * Fetch artists by genre using Wikipedia API (Python-powered)
     * @param {string} genre - Music genre
     * @param {number} limit - Max artists to return
     * @returns {Promise<Array<string>>} List of artist names
     */
    async fetchArtistsByGenre(genre, limit = 200) {
        return new Promise((resolve, reject) => {
            const args = [this.scriptPath, 'fetch-genre', genre, limit.toString()];
            
            console.log(`🐉 [Sage-Dragon] Summoning Python to fetch ${genre} artists...`);
            
            const process = spawn(this.pythonPath, args);
            
            let stdout = '';
            let stderr = '';
            let jsonOutput = '';
            
            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                
                // Look for JSON output (starts with {)
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        jsonOutput += line;
                    } else if (jsonOutput) {
                        jsonOutput += line; // Continue multi-line JSON
                    }
                }
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`🐉 [Sage-Dragon] Python error: ${stderr}`);
                    reject(new Error(`Python process exited with code ${code}`));
                    return;
                }
                
                try {
                    // Parse JSON output from Python
                    const result = JSON.parse(jsonOutput);
                    
                    if (result.success) {
                        console.log(`🐉 [Sage-Dragon] ✅ Retrieved ${result.count} ${genre} artists`);
                        resolve(result.artists);
                    } else {
                        reject(new Error('Python returned unsuccessful result'));
                    }
                } catch (err) {
                    console.error(`🐉 [Sage-Dragon] Failed to parse Python output:`, jsonOutput);
                    reject(new Error(`Failed to parse Python output: ${err.message}`));
                }
            });
            
            process.on('error', (err) => {
                console.error(`🐉 [Sage-Dragon] Failed to spawn Python:`, err);
                reject(err);
            });
        });
    }

    /**
     * Fetch artists for multiple genres in parallel
     * @param {Array<string>} genres - List of genres
     * @param {number} limit - Max artists per genre
     * @returns {Promise<Object>} Object mapping genre to artist arrays
     */
    async fetchMultipleGenres(genres, limit = 200) {
        console.log(`🐉 [Sage-Dragon] Fetching artists for ${genres.length} genres...`);
        
        const results = {};
        const promises = genres.map(async (genre) => {
            try {
                const artists = await this.fetchArtistsByGenre(genre, limit);
                results[genre] = artists;
            } catch (err) {
                console.error(`🐉 [Sage-Dragon] Error fetching ${genre}:`, err.message);
                results[genre] = [];
            }
        });
        
        await Promise.all(promises);
        
        const totalArtists = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`🐉 [Sage-Dragon] ✅ Total: ${totalArtists} artists across all genres`);
        
        return results;
    }
}

module.exports = SageDragonBridge;
