// Stub: Python Sage-Dragon Bridge (Wikipedia All-Lord)
// Original Python implementation was removed; this stub returns empty results
// so the fetcher degrades gracefully.

class SageDragonBridge {
    constructor() {
        // no-op stub
    }

    async fetchMultipleGenres(genres, limit = 200) {
        // Return empty results for each genre
        const result = {};
        if (Array.isArray(genres)) {
            for (const genre of genres) {
                result[genre] = [];
            }
        }
        return result;
    }
}

module.exports = SageDragonBridge;
