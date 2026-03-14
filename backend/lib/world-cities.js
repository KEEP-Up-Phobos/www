/**
 * 🌍 WORLD CITIES — Top 10 cities per country for worldwide event population
 * Used by admin populate-world endpoint via Python Serpents
 * Each entry: country name → { code, cities: string[10] }
 */

const WORLD_CITIES = {
  // ── Americas ──────────────────────────────────────────────
  'Brazil': { code: 'BR', cities: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba', 'Salvador', 'Brasília', 'Fortaleza', 'Recife', 'Manaus'] },
  'Argentina': { code: 'AR', cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'San Miguel de Tucumán', 'Mar del Plata', 'Salta', 'Santa Fe', 'San Juan'] },
  'Chile': { code: 'CL', cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Rancagua', 'Talca', 'Iquique', 'Puerto Montt'] },
  'Colombia': { code: 'CO', cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Santa Marta', 'Manizales', 'Cúcuta'] },
  'Peru': { code: 'PE', cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Cusco', 'Piura', 'Iquitos', 'Huancayo', 'Tacna', 'Pucallpa'] },
  'Venezuela': { code: 'VE', cities: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Ciudad Guayana', 'Maturín', 'Barcelona', 'Maracay', 'Cumaná', 'Mérida'] },
  'Ecuador': { code: 'EC', cities: ['Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala', 'Ambato', 'Manta', 'Portoviejo', 'Loja', 'Riobamba'] },
  'Uruguay': { code: 'UY', cities: ['Montevideo', 'Salto', 'Paysandú', 'Las Piedras', 'Rivera', 'Maldonado', 'Tacuarembó', 'Melo', 'Mercedes', 'Colonia del Sacramento'] },
  'Paraguay': { code: 'PY', cities: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Luque', 'Capiatá', 'Lambaré', 'Fernando de la Mora', 'Encarnación', 'Caaguazú', 'Coronel Oviedo'] },
  'Bolivia': { code: 'BO', cities: ['La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre', 'Oruro', 'Tarija', 'Potosí', 'Trinidad', 'Cobija', 'Riberalta'] },
  'Mexico': { code: 'MX', cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún', 'Mérida', 'Querétaro', 'Oaxaca'] },
  'United States': { code: 'US', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco', 'Miami', 'Seattle', 'Denver', 'Austin'] },
  'Canada': { code: 'CA', cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Halifax'] },
  'Costa Rica': { code: 'CR', cities: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Limón', 'Liberia', 'Puntarenas', 'San Isidro', 'Nicoya', 'Turrialba'] },
  'Panama': { code: 'PA', cities: ['Panama City', 'San Miguelito', 'David', 'Colón', 'La Chorrera', 'Santiago', 'Chitré', 'Penonomé', 'Aguadulce', 'Bocas del Toro'] },
  'Cuba': { code: 'CU', cities: ['Havana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara', 'Guantánamo', 'Bayamo', 'Las Tunas', 'Cienfuegos', 'Pinar del Río'] },
  'Dominican Republic': { code: 'DO', cities: ['Santo Domingo', 'Santiago', 'San Pedro de Macorís', 'La Romana', 'Puerto Plata', 'San Cristóbal', 'Higüey', 'La Vega', 'Bonao', 'Barahona'] },

  // ── Europe ────────────────────────────────────────────────
  'United Kingdom': { code: 'GB', cities: ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Leeds', 'Sheffield', 'Cardiff'] },
  'Germany': { code: 'DE', cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden', 'Hanover'] },
  'France': { code: 'FR', cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'] },
  'Spain': { code: 'ES', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Málaga', 'Zaragoza', 'Murcia', 'Palma de Mallorca', 'Granada'] },
  'Italy': { code: 'IT', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Bologna', 'Palermo', 'Genoa', 'Venice', 'Verona'] },
  'Portugal': { code: 'PT', cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Funchal', 'Setúbal', 'Aveiro', 'Évora', 'Viseu'] },
  'Netherlands': { code: 'NL', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Breda', 'Nijmegen', 'Maastricht'] },
  'Belgium': { code: 'BE', cities: ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Mechelen'] },
  'Switzerland': { code: 'CH', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lucerne', 'St. Gallen', 'Lugano', 'Winterthur', 'Biel'] },
  'Austria': { code: 'AT', cities: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'St. Pölten', 'Dornbirn'] },
  'Sweden': { code: 'SE', cities: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Västerås', 'Helsingborg', 'Norrköping', 'Jönköping'] },
  'Norway': { code: 'NO', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Drammen', 'Tromsø', 'Fredrikstad', 'Sandnes', 'Ålesund'] },
  'Denmark': { code: 'DK', cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde'] },
  'Finland': { code: 'FI', cities: ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori', 'Joensuu'] },
  'Poland': { code: 'PL', cities: ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Lublin', 'Katowice', 'Białystok'] },
  'Czech Republic': { code: 'CZ', cities: ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Ústí nad Labem', 'Pardubice'] },
  'Hungary': { code: 'HU', cities: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Szombathely'] },
  'Romania': { code: 'RO', cities: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea'] },
  'Greece': { code: 'GR', cities: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Volos', 'Rhodes', 'Ioannina', 'Chania', 'Corfu'] },
  'Ireland': { code: 'IE', cities: ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Kilkenny', 'Sligo', 'Drogheda', 'Dundalk', 'Athlone'] },
  'Croatia': { code: 'HR', cities: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Dubrovnik', 'Pula', 'Šibenik', 'Varaždin', 'Karlovac'] },

  // ── Asia & Oceania ────────────────────────────────────────
  'Japan': { code: 'JP', cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Kobe', 'Kyoto', 'Fukuoka', 'Sendai', 'Hiroshima'] },
  'South Korea': { code: 'KR', cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Suwon', 'Changwon', 'Seongnam'] },
  'China': { code: 'CN', cities: ['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Nanjing', 'Chongqing', 'Xi\'an'] },
  'India': { code: 'IN', cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'] },
  'Thailand': { code: 'TH', cities: ['Bangkok', 'Chiang Mai', 'Pattaya', 'Phuket', 'Nonthaburi', 'Hat Yai', 'Nakhon Ratchasima', 'Udon Thani', 'Khon Kaen', 'Chiang Rai'] },
  'Vietnam': { code: 'VN', cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Haiphong', 'Can Tho', 'Nha Trang', 'Hue', 'Vung Tau', 'Quy Nhon', 'Buon Ma Thuot'] },
  'Philippines': { code: 'PH', cities: ['Manila', 'Quezon City', 'Cebu City', 'Davao City', 'Makati', 'Taguig', 'Pasig', 'Cagayan de Oro', 'Baguio', 'Iloilo City'] },
  'Indonesia': { code: 'ID', cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Palembang', 'Makassar', 'Tangerang', 'Depok', 'Denpasar'] },
  'Malaysia': { code: 'MY', cities: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Shah Alam', 'Kota Kinabalu', 'Kuching', 'Malacca', 'Petaling Jaya', 'Subang Jaya'] },
  'Singapore': { code: 'SG', cities: ['Singapore', 'Jurong East', 'Tampines', 'Woodlands', 'Sengkang', 'Punggol', 'Ang Mo Kio', 'Bedok', 'Bukit Batok', 'Clementi'] },
  'Australia': { code: 'AU', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Hobart', 'Darwin'] },
  'New Zealand': { code: 'NZ', cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Palmerston North', 'Napier', 'Nelson', 'Rotorua'] },
  'Israel': { code: 'IL', cities: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 'Ashdod', 'Netanya', 'Beer Sheva', 'Holon', 'Bnei Brak'] },
  'United Arab Emirates': { code: 'AE', cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Khor Fakkan', 'Dibba'] },
  'Turkey': { code: 'TR', cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya', 'Mersin', 'Kayseri'] },

  // ── Africa ────────────────────────────────────────────────
  'South Africa': { code: 'ZA', cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Polokwane', 'Kimberley', 'Pietermaritzburg'] },
  'Nigeria': { code: 'NG', cities: ['Lagos', 'Kano', 'Ibadan', 'Abuja', 'Port Harcourt', 'Benin City', 'Maiduguri', 'Kaduna', 'Zaria', 'Aba'] },
  'Egypt': { code: 'EG', cities: ['Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez', 'Luxor', 'Mansoura', 'Tanta', 'Asyut'] },
  'Kenya': { code: 'KE', cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Malindi', 'Naivasha', 'Thika', 'Nanyuki', 'Lamu'] },
  'Morocco': { code: 'MA', cities: ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tangier', 'Agadir', 'Meknes', 'Oujda', 'Kenitra', 'Tetouan'] },
  'Ghana': { code: 'GH', cities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Tema', 'Cape Coast', 'Sunyani', 'Koforidua', 'Ho', 'Bolgatanga'] },
  'Tanzania': { code: 'TZ', cities: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Zanzibar City', 'Mbeya', 'Morogoro', 'Tanga', 'Iringa', 'Moshi'] },
};

/**
 * Get all countries
 * @returns {string[]} Array of country names
 */
function getCountries() {
  return Object.keys(WORLD_CITIES);
}

/**
 * Get cities for a country
 * @param {string} country
 * @returns {{ code: string, cities: string[] } | null}
 */
function getCountryData(country) {
  return WORLD_CITIES[country] || null;
}

/**
 * Get a flat list of all { country, code, city } entries
 * @returns {Array<{ country: string, code: string, city: string }>}
 */
function getAllCityEntries() {
  const entries = [];
  for (const [country, data] of Object.entries(WORLD_CITIES)) {
    for (const city of data.cities) {
      entries.push({ country, code: data.code, city });
    }
  }
  return entries;
}

module.exports = { WORLD_CITIES, getCountries, getCountryData, getAllCityEntries };
