/**
 * Wikipedia Image Fetcher - Fast, reliable image fetching using Wikipedia API
 * DuckDuckGo is blocked from Docker containers, so Wikipedia is our primary source
 */

const https = require('https');
const http = require('http');

class WikipediaImageFetcher {
  constructor() {
    this.timeout = 10000;
    // Pre-mapped Wikipedia article titles for known Brazilian artists
    this.artistWikiMap = {
      // ── MPB / Bossa Nova / Classic ──
      'anitta': 'Anitta_(singer)',
      'gilberto gil': 'Gilberto_Gil',
      'caetano veloso': 'Caetano_Veloso',
      'tom jobim': 'Antônio_Carlos_Jobim',
      'antônio carlos jobim': 'Antônio_Carlos_Jobim',
      'jorge ben jor': 'Jorge_Ben_Jor',
      'jorge ben': 'Jorge_Ben_Jor',
      'chico buarque': 'Chico_Buarque',
      'maria bethânia': 'Maria_Bethânia',
      'gal costa': 'Gal_Costa',
      'elis regina': 'Elis_Regina',
      'djavan': 'Djavan',
      'milton nascimento': 'Milton_Nascimento',
      'tim maia': 'Tim_Maia',
      'gonzaguinha': 'Gonzaguinha',
      'luiz gonzaga': 'Luiz_Gonzaga',
      'alceu valença': 'Alceu_Valença',
      'raul seixas': 'Raul_Seixas',
      'rita lee': 'Rita_Lee',
      'lulu santos': 'Lulu_Santos',
      'fernanda takai': 'Fernanda_Takai',
      'roberta sá': 'Roberta_Sá',
      'ivete sangalo': 'Ivete_Sangalo',
      'daniela mercury': 'Daniela_Mercury',
      'claudia leitte': 'Claudia_Leitte',
      'maria gadú': 'Maria_Gadú',
      'adriana calcanhotto': 'Adriana_Calcanhotto',
      'mart\'nália': 'Mart%27nália',
      'nando reis': 'Nando_Reis',
      'seu jorge': 'Seu_Jorge',
      'liniker': 'Liniker',
      'emicida': 'Emicida',
      'criolo': 'Criolo_(musician)',

      // ── Sertanejo ──
      'pabllo vittar': 'Pabllo_Vittar',
      'wesley safadão': 'Wesley_Safadão',
      'marília mendonça': 'Marília_Mendonça',
      'marília mendes': 'Marília_Mendonça',
      'henrique & juliano': 'Henrique_%26_Juliano',
      'simone & simaria': 'Simone_%26_Simaria',
      'maiara & maraisa': 'Maiara_%26_Maraisa',
      'zé neto & cristiano': 'Zé_Neto_%26_Cristiano',
      'gusttavo lima': 'Gusttavo_Lima',
      'jorge & mateus': 'Jorge_%26_Mateus',
      'luan santana': 'Luan_Santana',
      'leonardo': 'Leonardo_(singer)',
      'chitãozinho & xororó': 'Chitãozinho_%26_Xororó',
      'bruno & marrone': 'Bruno_%26_Marrone',
      'fernando & sorocaba': 'Fernando_%26_Sorocaba',
      'matheus & kauan': 'Matheus_%26_Kauan',
      'hugo & guilherme': 'Hugo_%26_Guilherme',
      'ana castela': 'Ana_Castela',
      'israel & rodolffo': 'Israel_%26_Rodolffo',
      'léo & raphael': 'Léo_%26_Raphael',
      'michel teló': 'Michel_Teló',

      // ── Pop / Funk / Urban ──
      'ludmilla': 'Ludmilla',
      'mc kevinho': 'MC_Kevinho',
      'mc livinho': 'MC_Livinho',
      'mc poze do rodo': 'MC_Poze_do_Rodo',
      'mc cabelinho': 'MC_Cabelinho',
      'luísa sonza': 'Luísa_Sonza',
      'jão': 'Jão_(singer)',
      'gloria groove': 'Gloria_Groove',
      'lucas lucco': 'Lucas_Lucco',
      'iza': 'IZA_(singer)',
      'vitor kley': 'Vitor_Kley',
      'nego do borel': 'Nego_do_Borel',
      'lexa': 'Lexa_(singer)',
      'pedro sampaio': 'Pedro_Sampaio',
      'dennis dj': 'Dennis_DJ',
      'alok': 'Alok_(musician)',
      'vintage culture': 'Vintage_Culture',

      // ── Rock / Alternative ──
      'legião urbana': 'Legião_Urbana',
      'titãs': 'Titãs',
      'paralamas do sucesso': 'Os_Paralamas_do_Sucesso',
      'os paralamas do sucesso': 'Os_Paralamas_do_Sucesso',
      'sepultura': 'Sepultura',
      'angra': 'Angra_(band)',
      'charlie brown jr.': 'Charlie_Brown_Jr.',
      'charlie brown jr': 'Charlie_Brown_Jr.',
      'banda calypso': 'Banda_Calypso',
      'los hermanos': 'Los_Hermanos',
      'detonautas': 'Detonautas',
      'skank': 'Skank_(band)',
      'jota quest': 'Jota_Quest',
      'barão vermelho': 'Barão_Vermelho',
      'capital inicial': 'Capital_Inicial',
      'engenheiros do hawaii': 'Engenheiros_do_Hawaii',
      'fresno': 'Fresno_(band)',
      'pitty': 'Pitty',
      'nx zero': 'NX_Zero',
      'raimundos': 'Raimundos',
      'planet hemp': 'Planet_Hemp',
      'o rappa': 'O_Rappa',
      'natiruts': 'Natiruts',
      'grupo revelação': 'Grupo_Revelação',
      'grupo pixote': 'Pixote_(band)',

      // ── Pagode / Samba ──
      'thiaguinho': 'Thiaguinho',
      'dilsinho': 'Dilsinho',
      'péricles': 'Péricles_(singer)',
      'ferrugem': 'Ferrugem_(singer)',
      'zeca pagodinho': 'Zeca_Pagodinho',
      'beth carvalho': 'Beth_Carvalho',
      'cartola': 'Cartola_(musician)',
      'jorge aragão': 'Jorge_Aragão',
      'arlindo cruz': 'Arlindo_Cruz',

      // ── Forró / Regional ──
      'solange almeida': 'Solange_Almeida',
      'xand avião': 'Xand_Avião',
      'aviões do forró': 'Aviões_do_Forró',
      'flávio josé': 'Flávio_José',

      // ── International (commonly searched in BR events) ──
      'neymar jr': 'Neymar',
      'neymar': 'Neymar',
      'feid': 'Feid',
      'pollo': 'Pollo_(singer)',
      'coldplay': 'Coldplay',
      'metallica': 'Metallica',
      'iron maiden': 'Iron_Maiden',
      'guns n\' roses': 'Guns_N%27_Roses',
      'red hot chili peppers': 'Red_Hot_Chili_Peppers',
      'the weeknd': 'The_Weeknd',
      'bad bunny': 'Bad_Bunny',
      'taylor swift': 'Taylor_Swift',
      'ed sheeran': 'Ed_Sheeran',
      'harry styles': 'Harry_Styles',
      'madonna': 'Madonna_(entertainer)',
      'beyoncé': 'Beyoncé',
      'drake': 'Drake_(musician)',
      'travis scott': 'Travis_Scott',
      'billie eilish': 'Billie_Eilish',
      'dua lipa': 'Dua_Lipa',
      'shakira': 'Shakira',
      'karol g': 'Karol_G',
    };
  }

  /**
   * Fetch image from Wikipedia API for a given article title
   */
  fetchWikipediaImage(articleTitle) {
    return new Promise((resolve, reject) => {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${articleTitle}&prop=pageimages&pithumbsize=500`;

      const req = https.get(url, { timeout: this.timeout }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const pages = json?.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              const thumb = pages[pageId]?.thumbnail?.source;
              if (thumb) {
                resolve(thumb);
                return;
              }
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Try to find an image for an artist via Wikipedia
   */
  async getArtistImage(artistName) {
    if (!artistName) return null;

    const key = artistName.toLowerCase().trim();

    // Direct mapping first
    if (this.artistWikiMap[key]) {
      const img = await this.fetchWikipediaImage(this.artistWikiMap[key]);
      if (img) {
        console.log(`✅ Wikipedia image for "${artistName}": ${img.substring(0, 80)}...`);
        return img;
      }
    }

    // Try direct search with artist name
    const encoded = encodeURIComponent(artistName);
    const img = await this.fetchWikipediaImage(encoded);
    if (img) {
      console.log(`✅ Wikipedia search image for "${artistName}": ${img.substring(0, 80)}...`);
      return img;
    }

    // Try with _singer suffix
    const imgSinger = await this.fetchWikipediaImage(encoded + '_(singer)');
    if (imgSinger) {
      console.log(`✅ Wikipedia singer image for "${artistName}": ${imgSinger.substring(0, 80)}...`);
      return imgSinger;
    }

    // Try with _band suffix
    const imgBand = await this.fetchWikipediaImage(encoded + '_(band)');
    if (imgBand) {
      console.log(`✅ Wikipedia band image for "${artistName}": ${imgBand.substring(0, 80)}...`);
      return imgBand;
    }

    // Try Portuguese Wikipedia
    const ptImg = await this.fetchPtWikipediaImage(encoded);
    if (ptImg) {
      console.log(`✅ PT Wikipedia image for "${artistName}": ${ptImg.substring(0, 80)}...`);
      return ptImg;
    }

    console.log(`⚠️  No Wikipedia image found for "${artistName}"`);
    return null;
  }

  /**
   * Search Portuguese Wikipedia as fallback for Brazilian artists
   */
  fetchPtWikipediaImage(articleTitle) {
    return new Promise((resolve) => {
      const url = `https://pt.wikipedia.org/w/api.php?action=query&format=json&titles=${articleTitle}&prop=pageimages&pithumbsize=500`;

      const req = https.get(url, { timeout: this.timeout }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const pages = json?.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              const thumb = pages[pageId]?.thumbnail?.source;
              if (thumb) {
                resolve(thumb);
                return;
              }
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Get a venue/location image from Wikipedia
   */
  async getVenueImage(venueName, city) {
    if (!venueName) return null;

    // Try venue name first
    const encoded = encodeURIComponent(venueName);
    let img = await this.fetchWikipediaImage(encoded);
    if (img) return img;

    // Try Portuguese Wikipedia for Brazilian venues
    img = await this.fetchPtWikipediaImage(encoded);
    if (img) return img;

    // Try venue + city
    if (city) {
      img = await this.fetchPtWikipediaImage(encodeURIComponent(`${venueName} ${city}`));
      if (img) return img;
    }

    return null;
  }

  /**
   * Get a category-appropriate fallback image
   * Uses consistent hashing so each event gets a unique but stable image
   */
  getCategoryFallback(eventName, category, artistName) {
    const text = (eventName || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    const artist = (artistName || '').toLowerCase();

    // Category-based curated images (high quality, relevant)
    const categoryImages = {
      music: [
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop',
      ],
      theater: [
        'https://images.unsplash.com/photo-1503095396549-807759245b35?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1460881680858-30d872d5b530?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1568485248685-019a98426c14?w=600&h=400&fit=crop',
      ],
      sports: [
        'https://images.unsplash.com/photo-1461896836934-bd45ba688b6d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&h=400&fit=crop',
      ],
      nightclub: [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1545128485-c400e7702796?w=600&h=400&fit=crop',
      ],
      art: [
        'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=600&h=400&fit=crop',
      ],
      park: [
        'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1585938389612-a552a28d6914?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop',
      ],
      cultural: [
        'https://images.unsplash.com/photo-1569587112025-0d460e81a126?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=400&fit=crop',
      ],
      cinema: [
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&h=400&fit=crop',
      ],
      generic: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&h=400&fit=crop',
      ],
    };

    // Detect category
    let detectedCat = 'generic';
    if (cat.includes('music') || cat.includes('concert') || artist) detectedCat = 'music';
    else if (cat.includes('theater') || cat.includes('theatre')) detectedCat = 'theater';
    else if (cat.includes('sport') || cat.includes('stadium') || cat.includes('soccer') || cat.includes('gym')) detectedCat = 'sports';
    else if (cat.includes('night') || cat.includes('club') || cat.includes('bar')) detectedCat = 'nightclub';
    else if (cat.includes('art') || cat.includes('museum') || cat.includes('gallery')) detectedCat = 'art';
    else if (cat.includes('park') || cat.includes('garden') || cat.includes('lookout')) detectedCat = 'park';
    else if (cat.includes('cultural') || cat.includes('center') || cat.includes('non-profit')) detectedCat = 'cultural';
    else if (cat.includes('cinema') || cat.includes('movie') || cat.includes('cine')) detectedCat = 'cinema';
    else if (text.includes('rock') || text.includes('show') || text.includes('live')) detectedCat = 'music';
    else if (text.includes('teatro') || text.includes('theater')) detectedCat = 'theater';
    else if (text.includes('parque') || text.includes('park')) detectedCat = 'park';
    else if (text.includes('museu') || text.includes('museum') || text.includes('masp')) detectedCat = 'art';
    else if (text.includes('arena') || text.includes('estádio') || text.includes('stadium')) detectedCat = 'sports';
    else if (text.includes('sesc') || text.includes('cultural') || text.includes('memorial') || text.includes('bienal') || text.includes('fundação')) detectedCat = 'cultural';
    else if (text.includes('cine') || text.includes('cinema')) detectedCat = 'cinema';

    const images = categoryImages[detectedCat];
    const hash = this.simpleHash(eventName || artistName || '');
    const index = Math.abs(hash) % images.length;

    return images[index];
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
}

module.exports = WikipediaImageFetcher;
