/**
 * 🐍🦅📚 PYTHON SERPENTS & DRAGONS BRIDGE
 * Node.js bridge to unleash Python Serpents & Dragons for parallel fetching
 * 
 * CREATURES:
 *   🐍 Serpents: Viper (Ticketmaster), Cobra (Sympla)
 *   🦅 Feather-Dragon: DuckDuckGo web searches
 *   📚 Sage-Dragon: Wikipedia knowledge extraction
 */

const { spawn } = require('child_process');
const path = require('path');

class SerpentsBridge {
    constructor() {
        this.pythonScript = path.join(__dirname, 'event_serpents.py');
    }

    /**
     * Release Python Serpents & Dragons for lightning-fast parallel fetching
     * @param {string} city - City name
     * @param {string} country - Country name
     * @param {string} countryCode - Country code (e.g., 'BR', 'US', 'FR')
     * @param {object} options - Additional options
     * @param {boolean} options.enableDragons - Whether to unleash the Dragons (default: false)
     * @param {number} options.limit - Max events to return
     * @param {number} options.maxParallel - Max parallel requests
     * @param {string[]} options.sources - Sources to use (ticketmaster, sympla, duckduckgo, wikipedia)
     * @param {boolean} options.parallel - Use parallel fetching (default: true)
     */
    async releaseSerpents(city, country, countryCode = 'BR', options = {}) {
        return new Promise((resolve, reject) => {
            const args = [this.pythonScript, city, country, '--country-code', countryCode];
            
            // Add optional arguments
            if (options.enableDragons) {
                args.push('--dragons');
            }
            if (options.limit) {
                args.push('--limit', options.limit.toString());
            }
            if (options.maxParallel) {
                args.push('--max-parallel', options.maxParallel.toString());
            }
            if (options.sources && options.sources.length > 0) {
                args.push('--sources', ...options.sources);
            }
            if (options.parallel === false) {
                // Currently always parallel in Python, but could be added
            }
            
            const dragonStatus = options.enableDragons ? '🦅📚' : '';
            console.log(`🐍${dragonStatus} Releasing Python ${options.enableDragons ? 'Serpents & Dragons' : 'Serpents'}...`);
            console.log(`   Args: ${args.slice(1).join(' ')}`);
            
            const python = spawn('python3', args, {
                cwd: path.dirname(this.pythonScript)
            });

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
                // Show Python output in real-time
                process.stdout.write(data);
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                console.log(`🐍 Python process exited with code ${code}`);
                console.log(`🐍 STDERR: ${stderr}`);
                console.log(`🐍 STDOUT length: ${stdout.length}`);
                if (stdout.length > 0) {
                    console.log(`🐍 STDOUT preview: ${stdout.substring(0, 200)}...`);
                }
                if (code === 0) {
                    try {
                        // Extract JSON from Python output between markers
                        const jsonStart = stdout.indexOf('===JSON_START===');
                        const jsonEnd = stdout.indexOf('===JSON_END===');
                        console.log(`🐍 JSON markers found: start=${jsonStart}, end=${jsonEnd}`);
                        if (jsonStart !== -1 && jsonEnd !== -1) {
                            let jsonString = stdout.substring(jsonStart + 15, jsonEnd).trim();
                            // Trim any leading characters before the first JSON object start (robustness)
                            const firstBrace = jsonString.indexOf('{');
                            if (firstBrace > 0) {
                              console.log('🐍 Trimming leading chars before JSON start');
                              jsonString = jsonString.substring(firstBrace);
                            }
                            console.log(`🐍 JSON string length: ${jsonString.length}`);
                            console.log(`🐍 JSON preview: ${jsonString.substring(0, 100)}...`);
                            const result = JSON.parse(jsonString);
                            console.log(`✅ Python Serpents returned ${result.total} events in ${result.time_seconds}s`);
                            resolve(result);
                        } else {
                            // Fallback to old regex method
                            const jsonMatch = stdout.match(/\{[\s\S]*"events"[\s\S]*\}/);
                            console.log(`🐍 Regex match: ${!!jsonMatch}`);
                            if (jsonMatch) {
                                console.log(`🐍 Regex match length: ${jsonMatch[0].length}`);
                                const result = JSON.parse(jsonMatch[0]);
                                console.log(`✅ Python Serpents returned ${result.total} events (fallback regex)`);
                                resolve(result);
                            } else {
                                console.log('⚠️  Python Serpents completed but no JSON found');
                                resolve({ events: [], total: 0, errors: 0 });
                            }
                        }
                    } catch (error) {
                        console.log('⚠️  Python Serpents output parse error:', error.message);
                        resolve({ events: [], total: 0, errors: 1 });
                    }
                } else {
                    if (stderr.includes('No module named')) {
                        console.log('⚠️  Python dependencies missing (aiohttp). Install: apt install python3-aiohttp python3-dotenv');
                    } else {
                        console.log('⚠️  Python Serpents failed:', stderr.substring(0, 200));
                    }
                    // Return empty result instead of rejecting
                    resolve({ events: [], total: 0, errors: 1, pythonError: true });
                }
            });

            python.on('error', (error) => {
                console.log('⚠️  Cannot spawn Python:', error.message);
                resolve({ events: [], total: 0, errors: 1, pythonError: true });
            });
        });
    }

    /**
     * Check if Python Serpents are available
     */
    async checkAvailability() {
        return new Promise((resolve) => {
            const python = spawn('python3', ['-c', 'import aiohttp; import asyncio; print("OK")']);
            
            let output = '';
            python.stdout.on('data', (data) => { output += data.toString(); });
            python.on('close', (code) => {
                resolve(code === 0 && output.includes('OK'));
            });
            python.on('error', () => resolve(false));
        });
    }
}

module.exports = SerpentsBridge;

// Test if run directly
if (require.main === module) {
    (async () => {
        const bridge = new SerpentsBridge();
        
        console.log('🧪 Testing Python Serpents availability...\n');
        const available = await bridge.checkAvailability();
        
        if (available) {
            console.log('✅ Python Serpents are READY!\n');
            const result = await bridge.releaseSerpents('São Paulo', 'Brazil', 'BR', {
                enableDragons: false,
                limit: 50,
                sources: ['ticketmaster', 'sympla']
            });
            console.log('\n📊 Final Result:', result);
        } else {
            console.log('⚠️  Python Serpents NOT available (missing aiohttp)');
            console.log('   Install: apt install python3-aiohttp python3-dotenv');
        }
    })();
}
