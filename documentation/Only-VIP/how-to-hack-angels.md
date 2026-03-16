# 🔍 How to Hack Angels
### Reverse Engineering Event Platform APIs for KEEPUP Fetcher
> *"Every site has a door. You just have to find it."*

Last updated: March 16, 2026

---

## Methodology

For every new event platform, the process is always the same:

1. **Open Playwright** — intercept ALL JSON responses while the page loads
2. **Identify the real API** — filter out ads/tracking noise, find the actual data endpoint
3. **Inspect the response structure** — map fields to our DB schema
4. **Replace scraper with direct API call** — ditch BeautifulSoup/HTML parsing whenever possible
5. **Build slug generator** — automate city/country URL formatting

If the API is protected (Vercel WAF, Cloudflare Bot Protection), fall back to:
- **JSON-LD** in the HTML (`<script type="application/ld+json">`) — most sites embed structured data
- **`__NEXT_DATA__`** in Next.js apps — server-side rendered data in a script tag
- **mitmproxy** on mobile app — intercepts HTTPS from native apps (last resort)

---

## 🎫 Ticketmaster

**Type:** Official REST API  
**Key required:** Yes (`TICKETMASTER_API_KEY`)  
**Register:** https://developer.ticketmaster.com/

**Endpoint:**
```
GET https://app.ticketmaster.com/discovery/v2/events
    ?apikey={key}
    &latlong={lat},{lon}
    &radius={km}
    &unit=km
    &size=200
    &sort=date,asc
```

**Key fields:**
```json
{
  "name": "Event Name",
  "url": "https://www.ticketmaster.com/...",
  "dates.start.dateTime": "2026-03-17T19:00:00Z",
  "images": [{"url": "...", "width": 1024, "ratio": "16_9"}],
  "_embedded.venues[0].name": "Venue Name",
  "_embedded.venues[0].location.latitude": -30.03,
  "_embedded.venues[0].location.longitude": -51.23,
  "classifications[0].segment.name": "Music"
}
```

**Image strategy:** Sort `images[]` by `width` descending, take first `.url`

**Fallback:** If city search returns 0, retry with `countryCode` only (country-wide search)

---

## 🎭 Sympla

**Type:** Internal discovery-bff API (no key needed)  
**Key required:** No  
**Discovered via:** Playwright network intercept on `/eventos/porto-alegre-rs`

**How we found it:**
```
Page: https://www.sympla.com.br/eventos/porto-alegre-rs
Intercepted: https://www.sympla.com.br/api/discovery-bff/search/category-type?...
```

**Endpoint:**
```
GET https://www.sympla.com.br/api/discovery-bff/search/category-type
    ?service=/v4/search
    &has_banner=1
    &only=name,start_date,end_date,images,location,id,url,organizer
    &sort=day-trending-score
    &type=normal
    &location={City Name}
    &state={UF}          ← Brazilian state code (RS, SP, RJ...)
    &limit=24
    &page=1              ← paginate until data[] is empty
```

**Required headers:**
```
Referer: https://www.sympla.com.br/eventos/{city-slug}-{state-lower}
User-Agent: Mozilla/5.0 ...
Accept: application/json
```

**URL format:**
```
Porto Alegre → /eventos/porto-alegre-rs
Florianópolis → /eventos/florianopolis-sc
São Paulo → /eventos/sao-paulo-sp
```

**Key fields:**
```json
{
  "data": [{
    "id": 50117738,
    "name": "VEIGH - 22/05/26",
    "start_date": "2026-05-23T01:00:00+00:00",
    "images": {"lg": "https://...", "original": "https://...", "xs": "https://..."},
    "location": {
      "name": "Araújo Vianna",
      "city": "Porto Alegre",
      "state": "RS",
      "lat": -30.0356256,
      "lon": -51.2164471
    },
    "organizer": {"name": "Producer Name"},
    "url": "https://bileto.sympla.com.br/event/117738"
  }]
}
```

**Pagination:** Keep incrementing `page` until `data[]` returns empty array  
**City/State map:** Maintained in `SYMPLA_STATE_MAP` dict in `keepup_fetcher.py`

---

## 🎟️ Viagogo

**Type:** Internal getExploreEvents JSON endpoint (no key needed)  
**Key required:** No (OAuth2 API also available if you have credentials)  
**Discovered via:** Playwright network intercept on `/br/Porto-Alegre`

**How we found it:**
```
Page: https://www.viagogo.com/br/Porto-Alegre
Intercepted: https://www.viagogo.com/br/Porto-Alegre?method=getExploreEvents
```

**Endpoint:**
```
GET https://www.viagogo.com/{country_code}/{City-Name}?method=getExploreEvents
```

**Required headers:**
```
Referer: https://www.viagogo.com/{country_code}/{City-Name}
User-Agent: Mozilla/5.0 ...
Accept: application/json
```

**URL slug format:**
```
Porto Alegre + BR → /br/Porto-Alegre
Buenos Aires + AR → /ar/Buenos-Aires
New York + US     → /us/New-York
São Paulo + BR    → /br/Sao-Paulo    ← strip accents, title case, spaces→hyphens
```

**Country code map (ISO2 → Viagogo):**
```
BR→br, US→us, GB→gb, DE→de, FR→fr, ES→es, IT→it, AR→ar, MX→mx,
CL→cl, CO→co, PE→pe, UY→uy, AU→au, NZ→nz, CA→ca, JP→jp, KR→kr,
NL→nl, BE→be, PT→pt, CH→ch, AT→at, SE→se, NO→no, DK→dk, ZA→za
```

**Key fields:**
```json
{
  "events": [{
    "eventId": 159935059,
    "name": "Guns N' Roses",
    "url": "https://www.viagogo.com/br/Ingressos-Shows/.../E-159935059",
    "imageUrl": "https://media.stubhubstatic.com/...",
    "venueName": "Jockey Club of Rio Grande do Sul",
    "formattedVenueLocation": "Porto Alegre, Brasil",
    "formattedDateWithoutYear": "01 abr",
    "formattedTime": "19:00",
    "isParkingEvent": false
  }]
}
```

**Date parsing:** `"01 abr"` + `"19:00"` → parse PT month names → ISO datetime  
**Filter:** Skip events where `isParkingEvent: true`

---

## 🎵 Bandsintown

**Type:** JSON-LD structured data embedded in HTML (no key needed)  
**Key required:** No  
**Discovered via:** Playwright content inspection on `/c/porto-alegre-brazil`

**How we found it:**
```
Page: https://www.bandsintown.com/c/porto-alegre-brazil
Content: <script type="application/ld+json"> with @type: MusicEvent array
```

The page loads via SSR — events are in the HTML as structured data, NOT via API calls.  
No JSON API was found intercepting network requests (only ads/tracking).

**Approach:** Playwright renders the page (needed for JS execution), then we parse JSON-LD.

**URL format:**
```
Porto Alegre + Brazil    → /c/porto-alegre-brazil
Buenos Aires + Argentina → /c/buenos-aires-argentina
New York + United States → /c/new-york-united-states
São Paulo + Brazil       → /c/sao-paulo-brazil   ← strip accents, lowercase, spaces→hyphens
```

**JSON-LD structure:**
```json
[{
  "@type": "MusicEvent",
  "name": "Cypress Hill @ Opinião",
  "startDate": "2026-03-17T19:00:00",
  "url": "https://www.bandsintown.com/e/107494391-cypress-hill-at-opiniao",
  "location": {
    "@type": "Place",
    "name": "Opinião",
    "geo": {"@type": "GeoCoordinates", "latitude": -30.03, "longitude": -51.22}
  },
  "performer": {"@type": "PerformingGroup", "name": "Cypress Hill"},
  "description": "Cypress Hill",
  "image": "https://photos.bandsintown.com/thumb/23146064.jpeg",
  "offers": {"url": "https://www.bandsintown.com/e/..."}
}]
```

**Name parsing:** `"Artist @ Venue"` → split on ` @ ` → artist name + venue name  
**Typical yield:** ~36 events per city page  
**Requires:** Playwright + Chromium (`playwright install chromium`)

---

## 🎪 Eventbrite

**Type:** Internal city-browse API (no key needed)  
**Key required:** No  
**Discovered via:** Playwright network intercept on `/d/brazil--porto-alegre/events/`

**How we found it:**
```
Page: https://www.eventbrite.com.br/d/brazil--porto-alegre/events/
Intercepted: https://www.eventbrite.com.br/api/v3/destination/city-browse/?slug=brazil--porto-alegre
```

Also found: `/api/v3/geo/place_from_request/` which resolves city → place_id + slug automatically.

**Primary endpoint:**
```
GET https://www.eventbrite.com.br/api/v3/destination/city-browse/
    ?slug={country}--{city}
    &page_size=50
```

**Required headers:**
```
Referer: https://www.eventbrite.com.br/d/{slug}/events/
User-Agent: Mozilla/5.0 ...
Accept: application/json
```

**URL slug format:**
```
Porto Alegre + Brazil    → brazil--porto-alegre
Buenos Aires + Argentina → argentina--buenos-aires
New York + United States → united-states--new-york
São Paulo + Brazil       → brazil--sao-paulo   ← strip accents, lowercase, spaces→hyphens
```

**Response structure:**
```json
{
  "buckets": [{
    "name": "Shows e Concertos",
    "key": "music",
    "events": [{
      "id": "787580734177",
      "name": "Seminar on Big Data",
      "start_date": "2026-03-18",
      "url": "https://www.eventbrite.com/e/...",
      "image": {
        "url": "https://img.evbuc.com/...",
        "image_sizes": {
          "small": "...", "medium": "...", "large": "..."
        }
      },
      "venue": {
        "name": "Online",
        "latitude": -30.03,
        "longitude": -51.23
      },
      "summary": "Brief description..."
    }]
  }]
}
```

**Fallback:** If `/city-browse/` returns non-200, fall back to JSON-LD parsing from the HTML page  
(Eventbrite also embeds `@type: Event` / `@type: ItemList` in `<script>` tags)

---

## 🛡️ Shotgun

**Type:** BLOCKED — Vercel Bot Protection  
**Status:** ⚠️ Pending — needs mitmproxy on mobile app

**What we tried:**
- `curl` → Vercel Security Checkpoint HTML
- Playwright headless → Vercel Security Checkpoint HTML
- RSC headers → Still blocked

**Why it's blocked:**
Shotgun runs on Vercel with bot protection enabled. Any headless browser or curl gets a JS challenge page instead of content.

**How to crack it (future):**
1. Install mitmproxy on the server
2. Configure Android/iOS to use server as HTTPS proxy
3. Install mitmproxy CA cert on phone
4. Open Shotgun app, browse events
5. Capture requests in mitmproxy → find the REST API endpoints
6. Replicate the API calls with the discovered auth headers/tokens

**URL pattern (for reference):**
```
https://shotgun.live/cities/porto-alegre/events
https://shotgun.live/pt-br/cities/porto-alegre/events
```

---

## 🌍 Generic Playwright Intercept Template

Use this whenever you need to discover a new site's API:

```python
python3 - << 'PYEOF'
import asyncio, json, re
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='pt-BR',
        )
        page = await context.new_page()
        
        api_calls = []
        async def handle_response(response):
            ct = response.headers.get('content-type', '')
            if 'json' in ct:
                try:
                    body = await response.json()
                    api_calls.append({'url': response.url, 'data': body})
                except:
                    pass
        
        page.on('response', handle_response)
        await page.goto('TARGET_URL_HERE', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(5000)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.wait_for_timeout(3000)
        
        # Print all JSON responses
        print(f'JSON responses: {len(api_calls)}')
        for r in api_calls:
            print('URL:', r['url'][:150])
            print('Preview:', json.dumps(r['data'])[:300])
            print()
        
        # Check for JSON-LD
        content = await page.content()
        ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', content, re.DOTALL)
        print(f'JSON-LD blocks: {len(ld_blocks)}')
        for block in ld_blocks[:2]:
            try:
                print(json.dumps(json.loads(block), indent=2)[:600])
            except:
                pass
        
        await browser.close()

asyncio.run(test())
PYEOF
```

---

## 📊 Source Status Summary

| Source | Method | Key | Yield/City | Status |
|--------|--------|-----|-----------|--------|
| Ticketmaster | Official API | ✅ Required | 50-200 | ✅ Working |
| Sympla | Internal API (discovery-bff) | ❌ None | 24-200+ | ✅ Working |
| Viagogo | Internal API (getExploreEvents) | ❌ None | 10-30 | ✅ Working |
| Bandsintown | JSON-LD from HTML (Playwright) | ❌ None | ~36 | ✅ Working |
| Eventbrite | Internal API (city-browse) | ❌ None | 20-100 | ✅ Working |
| Shotgun | Blocked (Vercel WAF) | ❌ None | — | ⚠️ Pending |
| AI (DeepSeek) | LLM prompt | ✅ Required | 5-20 | ✅ Working |
| AI (OpenRouter) | LLM prompt (4 free models) | ✅ Required | 5-20 each | ✅ Working |

---

## 🔑 Key Lessons

1. **Never assume HTML scraping is the only way** — intercept network requests first, always
2. **JSON-LD is gold** — schema.org structured data is on most modern event sites, clean and reliable
3. **Internal APIs > Public APIs** — internal APIs have no rate limits, no auth, richer data
4. **Referer header matters** — many internal APIs check the Referer to block direct calls
5. **`domcontentloaded` not `networkidle`** — sites with ads never reach networkidle, use domcontentloaded + manual wait
6. **Vercel WAF = use mitmproxy on mobile** — no way around it with headless browsers
7. **Paginate everything** — always check if the API paginates and loop until empty
