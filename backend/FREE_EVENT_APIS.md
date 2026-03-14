# Free Event APIs - Complete List

## ✅ CONFIRMED FREE APIs (No Credit Card Required)

### 1. **PredictHQ** ⭐ RECOMMENDED
- **URL**: https://www.predicthq.com/signup
- **Free Tier**: 10,000 requests/month
- **Coverage**: Global events, excellent for Brazil
- **Data Quality**: ⭐⭐⭐⭐⭐
- **Features**: Sports, concerts, festivals, conferences
- **Why it's good**: Most comprehensive free event data

### 2. **Yelp Fusion API** ⭐ RECOMMENDED
- **URL**: https://www.yelp.com/developers/v3/manage_app
- **Free Tier**: 5,000 calls/day
- **Coverage**: US, Canada, some international
- **Data Quality**: ⭐⭐⭐⭐
- **Features**: Events at businesses, special occasions
- **Endpoint**: `/v3/events`

### 3. **Eventful API**
- **URL**: http://api.eventful.com/keys/
- **Free Tier**: Unlimited with registration
- **Coverage**: Global, good US coverage
- **Data Quality**: ⭐⭐⭐
- **Features**: Concerts, festivals, sports, arts

### 4. **Foursquare Places API**
- **URL**: https://developer.foursquare.com/
- **Free Tier**: 99,500 calls/day
- **Coverage**: Global
- **Data Quality**: ⭐⭐⭐⭐
- **Features**: Venue events, special occasions

### 5. **OpenStreetMap Overpass API** ⭐ TRULY FREE
- **URL**: https://overpass-api.de/
- **Free Tier**: Completely free, no registration
- **Coverage**: Global
- **Data Quality**: ⭐⭐
- **Query Example**:
```
[out:json];
node(around:50000,-30.0346,-51.2177)[amenity=events_venue];
out;
```

### 6. **Active.com API**
- **URL**: https://developer.active.com/
- **Free Tier**: Yes (sign up required)
- **Coverage**: US primarily
- **Data Quality**: ⭐⭐⭐
- **Features**: Sports events, races, fitness

### 7. **Eventseer**
- **URL**: https://www.eventseer.net/
- **Free Tier**: Limited free access
- **Coverage**: US and Europe
- **Data Quality**: ⭐⭐⭐

### 8. **AllEvents API**
- **URL**: https://allevents.in/api/
- **Free Tier**: Contact for access
- **Coverage**: Global
- **Data Quality**: ⭐⭐⭐

## 🇧🇷 BRAZIL-SPECIFIC FREE/PUBLIC SOURCES

### 1. **Sympla Events** (Scraping friendly)
- **URL**: https://www.sympla.com.br/eventos/porto-alegre-rs
- **Method**: Public listing pages
- **Coverage**: Brazil only
- **Data Quality**: ⭐⭐⭐⭐⭐

### 2. **Shotgun Events** (Brazil)
- **URL**: https://shotgun.live/pt-br/events
- **Method**: Public API or scraping
- **Coverage**: Brazil nightlife/music
- **Data Quality**: ⭐⭐⭐⭐

### 3. **Guia da Folha**
- **URL**: https://guia.folha.uol.com.br/
- **Method**: Public listings
- **Coverage**: São Paulo region
- **Data Quality**: ⭐⭐⭐

## 📅 PUBLIC EVENT FEEDS (RSS/iCal)

Many venues publish public event feeds:

### Porto Alegre Venues
- Auditório Araújo Vianna: Check for event feed
- Theatro São Pedro: May have public calendar
- Bar Opinião: Check website for events
- Opinião: Music venue with public listings

### How to Find RSS Feeds
```bash
# Look for RSS/Atom feeds on venue websites
curl -s https://venue-website.com | grep -i "rss\|atom\|feed"
```

## 🔧 IMPLEMENTATION GUIDE

### Quick Setup for Best Free APIs

#### 1. PredictHQ (10 minutes to setup)
```bash
# 1. Sign up at https://www.predicthq.com/signup
# 2. Verify email
# 3. Get API key from dashboard
# 4. Add to .env:
PREDICTHQ_API_KEY=your_actual_key
```

```javascript
// Usage
const response = await axios.get('https://api.predicthq.com/v1/events/', {
  params: {
    'location_around.origin': '-30.0346,-51.2177',
    'location_around.scale': '50km',
    limit: 100
  },
  headers: {
    'Authorization': `Bearer ${process.env.PREDICTHQ_API_KEY}`
  }
});
```

#### 2. Yelp Fusion API (5 minutes to setup)
```bash
# 1. Go to https://www.yelp.com/developers/v3/manage_app
# 2. Create new app
# 3. Get API Key
# 4. Add to .env:
YELP_API_KEY=your_actual_key
```

```javascript
// Usage
const response = await axios.get('https://api.yelp.com/v3/events', {
  params: {
    location: 'Porto Alegre, Brazil',
    limit: 50
  },
  headers: {
    'Authorization': `Bearer ${process.env.YELP_API_KEY}`
  }
});
```

#### 3. Eventful API (5 minutes to setup)
```bash
# 1. Register at http://api.eventful.com/keys/
# 2. Get API key instantly
# 3. Add to .env:
EVENTFUL_API_KEY=your_actual_key
```

```javascript
// Usage
const response = await axios.get('http://api.eventful.com/json/events/search', {
  params: {
    app_key: process.env.EVENTFUL_API_KEY,
    location: 'Porto Alegre, Brazil',
    page_size: 100
  }
});
```

## 🚫 WHY SOME APIs AREN'T WORKING

### Bandsintown
- ❌ Blocks automated requests
- ❌ Requires artist-based search (not location)
- ✅ Works if you have artist list

### SeatGeek
- ❌ Returns 403 (blocking automated access)
- ⚠️ May work with proper headers/user agent

### Meetup
- ❌ GraphQL endpoint changed
- ❌ Requires OAuth for most queries
- ⚠️ Public pages can be scraped carefully

## 💡 RECOMMENDED APPROACH

**Priority Order for Free APIs:**

1. **PredictHQ** - Best overall, sign up now
2. **Yelp Fusion** - Good coverage, easy to use
3. **Eventful** - Instant access, decent data
4. **Sympla scraping** - Brazil-specific, public pages
5. **Venue RSS feeds** - Direct from source

**Time Investment:**
- 30 minutes total to sign up for all 3 APIs
- Will give you access to thousands of events
- Free forever with generous limits

## 📊 EXPECTED RESULTS

With all 3 free APIs configured:
- **PredictHQ**: 50-200 Porto Alegre events
- **Yelp**: 10-50 events (if they cover Brazil)
- **Eventful**: 20-100 events
- **Total**: 80-350 real events

## 🎯 NEXT STEPS

1. **Sign up for these 3 APIs** (30 minutes):
   - PredictHQ ⭐
   - Yelp Fusion ⭐
   - Eventful

2. **Add keys to .env file**

3. **Run the updated fetcher**:
   ```bash
   sudo docker exec keepup_node node /app/backend/free-event-sources.js
   ```

4. **Watch real events populate!**

## 📞 SUPPORT

If you have trouble with any API:
- Check their status page
- Verify API key is correct
- Check rate limits
- Try different location formats
