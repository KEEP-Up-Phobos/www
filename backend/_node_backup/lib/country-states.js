/**
 * 🗺️ COUNTRY STATES — States/provinces with 10 cities each for deep country population
 * Used by admin populate-country endpoint via Python Serpents
 * Each entry: country → { code, states: { stateName: string[10] } }
 */

const COUNTRY_STATES = {
  // ── Brazil (27 states) ────────────────────────────────────
  'Brazil': {
    code: 'BR',
    states: {
      'São Paulo': ['São Paulo', 'Campinas', 'Guarulhos', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Sorocaba', 'Ribeirão Preto', 'São José dos Campos', 'Santos'],
      'Rio de Janeiro': ['Rio de Janeiro', 'Niterói', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Petrópolis', 'Volta Redonda', 'Campos dos Goytacazes', 'Macaé', 'Angra dos Reis'],
      'Minas Gerais': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Poços de Caldas'],
      'Rio Grande do Sul': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Novo Hamburgo', 'São Leopoldo', 'Passo Fundo', 'Rio Grande'],
      'Paraná': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'Foz do Iguaçu', 'São José dos Pinhais', 'Colombo', 'Guarapuava', 'Paranaguá'],
      'Bahia': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Juazeiro', 'Jequié', 'Barreiras'],
      'Santa Catarina': ['Florianópolis', 'Joinville', 'Blumenau', 'Chapecó', 'Itajaí', 'Criciúma', 'Balneário Camboriú', 'Lages', 'Jaraguá do Sul', 'Palhoça'],
      'Pernambuco': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Paulista', 'Petrolina', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Serra Talhada'],
      'Ceará': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá'],
      'Goiás': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Catalão', 'Itumbiara'],
      'Pará': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas', 'Abaetetuba', 'Cametá', 'Altamira', 'Bragança'],
      'Amazonas': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués', 'Humaitá', 'Autazes'],
      'Maranhão': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas'],
      'Espírito Santo': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'Colatina', 'Guarapari', 'São Mateus', 'Aracruz'],
      'Distrito Federal': ['Brasília', 'Taguatinga', 'Ceilândia', 'Samambaia', 'Planaltina', 'Gama', 'Águas Claras', 'Sobradinho', 'Recanto das Emas', 'Santa Maria'],
      'Mato Grosso': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças'],
      'Mato Grosso do Sul': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Maracaju', 'Paranaíba'],
      'Paraíba': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Cabedelo', 'Sousa', 'Cajazeiras', 'Guarabira', 'Sapé'],
      'Rio Grande do Norte': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Assu', 'Currais Novos', 'São José de Mipibu'],
      'Piauí': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Barras', 'União', 'Pedro II', 'Oeiras'],
      'Alagoas': ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares', 'Penedo', 'São Miguel dos Campos', 'Delmiro Gouveia', 'Coruripe', 'Marechal Deodoro'],
      'Sergipe': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias', 'Capela', 'Propriá'],
      'Rondônia': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Jaru', 'Rolim de Moura', 'Guajará-Mirim', 'Ouro Preto do Oeste', 'Buritis'],
      'Tocantins': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Dianópolis', 'Miracema do Tocantins', 'Tocantinópolis'],
      'Acre': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Senador Guiomard', 'Plácido de Castro', 'Xapuri', 'Epitaciolândia'],
      'Amapá': ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande', 'Pedra Branca do Amapari', 'Tartarugalzinho', 'Vitória do Jari', 'Calçoene'],
      'Roraima': ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Pacaraima', 'Cantá', 'Mucajaí', 'Bonfim', 'Normandia', 'São João da Baliza'],
    }
  },

  // ── United States (50 states) ─────────────────────────────
  'United States': {
    code: 'US',
    states: {
      'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Santa Barbara', 'Anaheim'],
      'New York': ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers', 'New Rochelle', 'Ithaca', 'Saratoga Springs', 'White Plains'],
      'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Plano', 'Corpus Christi', 'Lubbock'],
      'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Fort Lauderdale', 'Tallahassee', 'Sarasota', 'Naples', 'Gainesville'],
      'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Rockford', 'Springfield', 'Peoria', 'Elgin', 'Champaign', 'Joliet', 'Evanston'],
      'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'State College'],
      'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Canton', 'Youngstown', 'Athens', 'Sandusky'],
      'Georgia': ['Atlanta', 'Augusta', 'Savannah', 'Columbus', 'Macon', 'Athens', 'Roswell', 'Sandy Springs', 'Albany', 'Marietta'],
      'Michigan': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Flint', 'Kalamazoo', 'Dearborn', 'Troy', 'Traverse City', 'Saginaw'],
      'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'Asheville', 'Chapel Hill'],
      'New Jersey': ['Newark', 'Jersey City', 'Hoboken', 'Princeton', 'Trenton', 'Atlantic City', 'Camden', 'Paterson', 'Elizabeth', 'New Brunswick'],
      'Virginia': ['Virginia Beach', 'Norfolk', 'Richmond', 'Arlington', 'Charlottesville', 'Alexandria', 'Newport News', 'Hampton', 'Roanoke', 'Fredericksburg'],
      'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Olympia', 'Everett', 'Bellingham', 'Yakima', 'Kennewick'],
      'Massachusetts': ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Lowell', 'New Bedford', 'Salem', 'Somerville', 'Quincy', 'Northampton'],
      'Arizona': ['Phoenix', 'Tucson', 'Scottsdale', 'Mesa', 'Tempe', 'Chandler', 'Flagstaff', 'Sedona', 'Gilbert', 'Glendale'],
      'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Murfreesboro', 'Clarksville', 'Franklin', 'Jackson', 'Johnson City', 'Gatlinburg'],
      'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Boulder', 'Fort Collins', 'Lakewood', 'Arvada', 'Pueblo', 'Aspen', 'Telluride'],
      'Maryland': ['Baltimore', 'Annapolis', 'Bethesda', 'Silver Spring', 'Columbia', 'Rockville', 'Frederick', 'Gaithersburg', 'Bowie', 'Ocean City'],
      'Oregon': ['Portland', 'Eugene', 'Salem', 'Bend', 'Corvallis', 'Medford', 'Ashland', 'Beaverton', 'Hillsboro', 'Lake Oswego'],
      'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Bloomington', 'Carmel', 'Lafayette', 'Muncie', 'Terre Haute', 'Anderson'],
      'Minnesota': ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington', 'Plymouth', 'Brooklyn Park', 'Mankato', 'St. Cloud', 'Edina'],
      'Missouri': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'Branson', 'Joplin', 'Jefferson City', 'Cape Girardeau'],
      'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Oshkosh', 'Eau Claire', 'La Crosse', 'Janesville'],
      'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria', 'Houma'],
      'Nevada': ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas', 'Sparks', 'Carson City', 'Elko', 'Mesquite', 'Boulder City', 'Laughlin'],
      'Hawaii': ['Honolulu', 'Hilo', 'Kailua', 'Kapolei', 'Kaneohe', 'Pearl City', 'Lahaina', 'Waimea', 'Kihei', 'Lihue'],
    }
  },

  // ── United Kingdom (4 nations + regions) ──────────────────
  'United Kingdom': {
    code: 'GB',
    states: {
      'England - London': ['London', 'Westminster', 'Camden', 'Greenwich', 'Islington', 'Hackney', 'Croydon', 'Brixton', 'Shoreditch', 'Wimbledon'],
      'England - South East': ['Brighton', 'Southampton', 'Oxford', 'Reading', 'Canterbury', 'Portsmouth', 'Guildford', 'Milton Keynes', 'Maidstone', 'Hastings'],
      'England - South West': ['Bristol', 'Bath', 'Exeter', 'Plymouth', 'Bournemouth', 'Cheltenham', 'Gloucester', 'Salisbury', 'Taunton', 'Torquay'],
      'England - Midlands': ['Birmingham', 'Nottingham', 'Leicester', 'Coventry', 'Derby', 'Wolverhampton', 'Stoke-on-Trent', 'Worcester', 'Northampton', 'Warwick'],
      'England - North West': ['Manchester', 'Liverpool', 'Chester', 'Blackpool', 'Preston', 'Bolton', 'Wigan', 'Stockport', 'Oldham', 'Lancaster'],
      'England - North East': ['Newcastle', 'Leeds', 'Sheffield', 'York', 'Durham', 'Hull', 'Bradford', 'Sunderland', 'Middlesbrough', 'Harrogate'],
      'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'St Andrews', 'Perth', 'Fort William', 'Oban'],
      'Wales': ['Cardiff', 'Swansea', 'Newport', 'Bangor', 'Aberystwyth', 'Wrexham', 'Carmarthen', 'Llandudno', 'Tenby', 'Brecon'],
      'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Bangor', 'Armagh', 'Omagh', 'Enniskillen', 'Coleraine', 'Ballymena'],
    }
  },

  // ── Germany (16 Bundesländer) ─────────────────────────────
  'Germany': {
    code: 'DE',
    states: {
      'Bavaria': ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Würzburg', 'Erlangen', 'Bamberg', 'Bayreuth', 'Passau', 'Ingolstadt'],
      'North Rhine-Westphalia': ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Bonn', 'Duisburg', 'Münster', 'Bielefeld', 'Wuppertal', 'Aachen'],
      'Baden-Württemberg': ['Stuttgart', 'Karlsruhe', 'Mannheim', 'Freiburg', 'Heidelberg', 'Ulm', 'Tübingen', 'Konstanz', 'Pforzheim', 'Reutlingen'],
      'Lower Saxony': ['Hanover', 'Braunschweig', 'Oldenburg', 'Osnabrück', 'Göttingen', 'Wolfsburg', 'Hildesheim', 'Lüneburg', 'Celle', 'Emden'],
      'Hesse': ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach', 'Marburg', 'Gießen', 'Fulda', 'Bad Homburg', 'Hanau'],
      'Saxony': ['Dresden', 'Leipzig', 'Chemnitz', 'Zwickau', 'Plauen', 'Görlitz', 'Freiberg', 'Bautzen', 'Pirna', 'Meißen'],
      'Berlin': ['Berlin', 'Mitte', 'Kreuzberg', 'Charlottenburg', 'Prenzlauer Berg', 'Friedrichshain', 'Neukölln', 'Schöneberg', 'Spandau', 'Tempelhof'],
      'Hamburg': ['Hamburg', 'Altona', 'Eimsbüttel', 'Wandsbek', 'Bergedorf', 'Harburg', 'St. Pauli', 'Blankenese', 'Ottensen', 'Barmbek'],
      'Thuringia': ['Erfurt', 'Jena', 'Weimar', 'Gera', 'Gotha', 'Eisenach', 'Suhl', 'Nordhausen', 'Altenburg', 'Ilmenau'],
      'Brandenburg': ['Potsdam', 'Cottbus', 'Brandenburg an der Havel', 'Frankfurt (Oder)', 'Oranienburg', 'Falkensee', 'Eberswalde', 'Bernau', 'Schwedt', 'Königs Wusterhausen'],
    }
  },

  // ── France (13 metropolitan regions) ──────────────────────
  'France': {
    code: 'FR',
    states: {
      'Île-de-France': ['Paris', 'Versailles', 'Boulogne-Billancourt', 'Saint-Denis', 'Montreuil', 'Nanterre', 'Argenteuil', 'Créteil', 'Fontainebleau', 'Meaux'],
      'Auvergne-Rhône-Alpes': ['Lyon', 'Grenoble', 'Saint-Étienne', 'Clermont-Ferrand', 'Annecy', 'Valence', 'Chambéry', 'Villeurbanne', 'Roanne', 'Vichy'],
      'Provence-Alpes-Côte d\'Azur': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon', 'Cannes', 'Antibes', 'Arles', 'Menton', 'Saint-Tropez'],
      'Occitanie': ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers', 'Carcassonne', 'Albi', 'Auch', 'Tarbes', 'Narbonne'],
      'Nouvelle-Aquitaine': ['Bordeaux', 'Limoges', 'Poitiers', 'La Rochelle', 'Pau', 'Angoulême', 'Bayonne', 'Biarritz', 'Périgueux', 'Niort'],
      'Hauts-de-France': ['Lille', 'Amiens', 'Roubaix', 'Dunkirk', 'Calais', 'Tourcoing', 'Arras', 'Lens', 'Valenciennes', 'Beauvais'],
      'Grand Est': ['Strasbourg', 'Reims', 'Metz', 'Mulhouse', 'Nancy', 'Colmar', 'Troyes', 'Charleville-Mézières', 'Épinal', 'Châlons-en-Champagne'],
      'Pays de la Loire': ['Nantes', 'Angers', 'Le Mans', 'Saint-Nazaire', 'La Roche-sur-Yon', 'Cholet', 'Laval', 'Saumur', 'Les Sables-d\'Olonne', 'Pornic'],
      'Brittany': ['Rennes', 'Brest', 'Lorient', 'Vannes', 'Saint-Malo', 'Quimper', 'Saint-Brieuc', 'Lannion', 'Dinan', 'Concarneau'],
      'Normandy': ['Rouen', 'Caen', 'Le Havre', 'Cherbourg', 'Évreux', 'Dieppe', 'Lisieux', 'Bayeux', 'Deauville', 'Honfleur'],
    }
  },

  // ── Spain (17 autonomous communities) ─────────────────────
  'Spain': {
    code: 'ES',
    states: {
      'Madrid': ['Madrid', 'Alcalá de Henares', 'Getafe', 'Leganés', 'Móstoles', 'Alcorcón', 'Fuenlabrada', 'Torrejón de Ardoz', 'Alcobendas', 'Las Rozas'],
      'Catalonia': ['Barcelona', 'Girona', 'Tarragona', 'Lleida', 'Sabadell', 'Terrassa', 'Badalona', 'Mataró', 'Sitges', 'Figueres'],
      'Andalusia': ['Seville', 'Málaga', 'Granada', 'Córdoba', 'Cádiz', 'Jerez', 'Almería', 'Huelva', 'Jaén', 'Marbella'],
      'Basque Country': ['Bilbao', 'San Sebastián', 'Vitoria-Gasteiz', 'Barakaldo', 'Getxo', 'Irun', 'Durango', 'Eibar', 'Zarautz', 'Portugalete'],
      'Valencia': ['Valencia', 'Alicante', 'Elche', 'Castellón', 'Torrevieja', 'Benidorm', 'Gandía', 'Alcoy', 'Sagunto', 'Dénia'],
      'Galicia': ['Santiago de Compostela', 'A Coruña', 'Vigo', 'Ourense', 'Lugo', 'Pontevedra', 'Ferrol', 'Vilagarcía de Arousa', 'Sanxenxo', 'Ribeira'],
      'Balearic Islands': ['Palma de Mallorca', 'Ibiza', 'Manacor', 'Inca', 'Ciutadella', 'Mahón', 'Sóller', 'Alcúdia', 'Pollença', 'Calvià'],
      'Canary Islands': ['Las Palmas', 'Santa Cruz de Tenerife', 'La Laguna', 'Arrecife', 'Puerto del Rosario', 'Los Llanos', 'Puerto de la Cruz', 'Adeje', 'Playa del Inglés', 'Maspalomas'],
    }
  },

  // ── Italy (20 regions) ────────────────────────────────────
  'Italy': {
    code: 'IT',
    states: {
      'Lombardy': ['Milan', 'Bergamo', 'Brescia', 'Como', 'Monza', 'Cremona', 'Pavia', 'Mantua', 'Varese', 'Lecco'],
      'Lazio': ['Rome', 'Latina', 'Frosinone', 'Viterbo', 'Rieti', 'Civitavecchia', 'Tivoli', 'Velletri', 'Frascati', 'Ostia'],
      'Campania': ['Naples', 'Salerno', 'Caserta', 'Pompei', 'Amalfi', 'Sorrento', 'Avellino', 'Benevento', 'Torre del Greco', 'Capri'],
      'Tuscany': ['Florence', 'Pisa', 'Siena', 'Livorno', 'Arezzo', 'Lucca', 'Pistoia', 'Grosseto', 'Prato', 'San Gimignano'],
      'Veneto': ['Venice', 'Verona', 'Padua', 'Vicenza', 'Treviso', 'Rovigo', 'Belluno', 'Chioggia', 'Bassano del Grappa', 'Cortina d\'Ampezzo'],
      'Piedmont': ['Turin', 'Novara', 'Asti', 'Alessandria', 'Cuneo', 'Vercelli', 'Biella', 'Verbania', 'Alba', 'Ivrea'],
      'Emilia-Romagna': ['Bologna', 'Parma', 'Modena', 'Rimini', 'Ravenna', 'Ferrara', 'Reggio Emilia', 'Cesena', 'Piacenza', 'Forlì'],
      'Sicily': ['Palermo', 'Catania', 'Messina', 'Syracuse', 'Ragusa', 'Trapani', 'Agrigento', 'Taormina', 'Cefalù', 'Enna'],
      'Sardinia': ['Cagliari', 'Sassari', 'Olbia', 'Alghero', 'Nuoro', 'Oristano', 'Iglesias', 'Carbonia', 'Villasimius', 'Carloforte'],
      'Liguria': ['Genoa', 'La Spezia', 'Sanremo', 'Savona', 'Imperia', 'Rapallo', 'Portofino', 'Cinque Terre', 'Chiavari', 'Alassio'],
    }
  },

  // ── Argentina (23 provinces + CABA) ───────────────────────
  'Argentina': {
    code: 'AR',
    states: {
      'Buenos Aires': ['Buenos Aires', 'La Plata', 'Mar del Plata', 'Bahía Blanca', 'Quilmes', 'Lomas de Zamora', 'Lanús', 'Morón', 'San Isidro', 'Tigre'],
      'Córdoba': ['Córdoba', 'Villa María', 'Río Cuarto', 'San Francisco', 'Carlos Paz', 'Alta Gracia', 'Bell Ville', 'Jesús María', 'La Falda', 'Cosquín'],
      'Santa Fe': ['Rosario', 'Santa Fe', 'Rafaela', 'Reconquista', 'Venado Tuerto', 'Villa Constitución', 'Casilda', 'San Lorenzo', 'Esperanza', 'Sunchales'],
      'Mendoza': ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú', 'San Martín', 'Rivadavia', 'Tunuyán'],
      'Tucumán': ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Concepción', 'Banda del Río Salí', 'Famaillá', 'Monteros', 'Aguilares', 'Lules', 'Simoca'],
      'Entre Ríos': ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Colón', 'Victoria', 'Villaguay', 'Federación', 'Diamante', 'Nogoyá'],
      'Salta': ['Salta', 'San Ramón de la Nueva Orán', 'Tartagal', 'Cafayate', 'Metán', 'Rosario de la Frontera', 'General Güemes', 'San Antonio de los Cobres', 'Embarcación', 'Iruya'],
      'Misiones': ['Posadas', 'Puerto Iguazú', 'Oberá', 'Eldorado', 'San Vicente', 'Apóstoles', 'Leandro N. Alem', 'Garupá', 'Jardín América', 'Montecarlo'],
      'Neuquén': ['Neuquén', 'San Martín de los Andes', 'Villa La Angostura', 'Zapala', 'Centenario', 'Plottier', 'Junín de los Andes', 'Chos Malal', 'Cutral Có', 'Rincón de los Sauces'],
      'Patagonia - Río Negro': ['Viedma', 'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'El Bolsón', 'Allen', 'Choele Choel', 'Sierra Grande', 'Las Grutas', 'Ingeniero Jacobacci'],
    }
  },

  // ── Mexico (32 states) ────────────────────────────────────
  'Mexico': {
    code: 'MX',
    states: {
      'Ciudad de México': ['Mexico City', 'Coyoacán', 'Tlalpan', 'Iztapalapa', 'Xochimilco', 'Álvaro Obregón', 'Benito Juárez', 'Miguel Hidalgo', 'Azcapotzalco', 'Cuauhtémoc'],
      'Jalisco': ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Puerto Vallarta', 'Tlajomulco', 'Chapala', 'Lagos de Moreno', 'Tequila', 'Tapalpa'],
      'Nuevo León': ['Monterrey', 'San Pedro Garza García', 'San Nicolás', 'Apodaca', 'Guadalupe', 'Santa Catarina', 'Escobedo', 'García', 'Cadereyta', 'Santiago'],
      'Quintana Roo': ['Cancún', 'Playa del Carmen', 'Tulum', 'Chetumal', 'Cozumel', 'Isla Mujeres', 'Bacalar', 'Puerto Morelos', 'Felipe Carrillo Puerto', 'Holbox'],
      'Puebla': ['Puebla', 'Cholula', 'Tehuacán', 'Atlixco', 'San Martín Texmelucan', 'Huauchinango', 'Izúcar de Matamoros', 'Cuetzalan', 'Zacatlán', 'Chignahuapan'],
      'Yucatán': ['Mérida', 'Valladolid', 'Progreso', 'Tizimín', 'Izamal', 'Motul', 'Ticul', 'Tekax', 'Oxkutzcab', 'Umán'],
      'Guanajuato': ['León', 'Guanajuato', 'San Miguel de Allende', 'Irapuato', 'Celaya', 'Silao', 'Salamanca', 'Dolores Hidalgo', 'San Francisco del Rincón', 'Acámbaro'],
      'Querétaro': ['Querétaro', 'San Juan del Río', 'El Marqués', 'Corregidora', 'Tequisquiapan', 'Bernal', 'Jalpan de Serra', 'Pedro Escobedo', 'Amealco', 'Cadereyta de Montes'],
      'Oaxaca': ['Oaxaca', 'Huatulco', 'Puerto Escondido', 'Juchitán', 'Salina Cruz', 'Tuxtepec', 'Mitla', 'Monte Albán', 'Tlacolula', 'Ixtlán de Juárez'],
      'Baja California': ['Tijuana', 'Ensenada', 'Mexicali', 'Rosarito', 'Tecate', 'San Felipe', 'Valle de Guadalupe', 'San Quintín', 'La Rumorosa', 'El Sauzal'],
    }
  },

  // ── Japan (8 regions) ─────────────────────────────────────
  'Japan': {
    code: 'JP',
    states: {
      'Kantō (Tokyo Region)': ['Tokyo', 'Yokohama', 'Kawasaki', 'Saitama', 'Chiba', 'Hachioji', 'Machida', 'Kamakura', 'Yokosuka', 'Odawara'],
      'Kansai (Osaka Region)': ['Osaka', 'Kyoto', 'Kobe', 'Nara', 'Wakayama', 'Sakai', 'Himeji', 'Amagasaki', 'Otsu', 'Uji'],
      'Chūbu (Nagoya Region)': ['Nagoya', 'Niigata', 'Shizuoka', 'Hamamatsu', 'Kanazawa', 'Toyama', 'Gifu', 'Fukui', 'Nagano', 'Matsumoto'],
      'Hokkaido': ['Sapporo', 'Asahikawa', 'Hakodate', 'Obihiro', 'Kushiro', 'Otaru', 'Kitami', 'Abashiri', 'Furano', 'Niseko'],
      'Tōhoku': ['Sendai', 'Morioka', 'Aomori', 'Akita', 'Yamagata', 'Fukushima', 'Kamaishi', 'Hirosaki', 'Sakata', 'Tsuruoka'],
      'Kyūshū': ['Fukuoka', 'Kitakyushu', 'Kumamoto', 'Kagoshima', 'Nagasaki', 'Oita', 'Miyazaki', 'Saga', 'Beppu', 'Sasebo'],
      'Chūgoku': ['Hiroshima', 'Okayama', 'Matsue', 'Tottori', 'Yamaguchi', 'Kurashiki', 'Onomichi', 'Shimonoseki', 'Izumo', 'Hagi'],
      'Shikoku': ['Takamatsu', 'Matsuyama', 'Kōchi', 'Tokushima', 'Niihama', 'Naruto', 'Imabari', 'Marugame', 'Uwajima', 'Iya Valley'],
    }
  },

  // ── Australia (6 states + 2 territories) ──────────────────
  'Australia': {
    code: 'AU',
    states: {
      'New South Wales': ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast', 'Coffs Harbour', 'Wagga Wagga', 'Port Macquarie', 'Tamworth', 'Orange', 'Bathurst'],
      'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Warrnambool', 'Mildura', 'Traralgon', 'Wodonga', 'Wangaratta'],
      'Queensland': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns', 'Toowoomba', 'Mackay', 'Rockhampton', 'Bundaberg', 'Hervey Bay'],
      'Western Australia': ['Perth', 'Fremantle', 'Bunbury', 'Geraldton', 'Kalgoorlie', 'Albany', 'Broome', 'Mandurah', 'Karratha', 'Port Hedland'],
      'South Australia': ['Adelaide', 'Mount Gambier', 'Whyalla', 'Murray Bridge', 'Port Augusta', 'Port Lincoln', 'Victor Harbor', 'Gawler', 'Barossa Valley', 'McLaren Vale'],
      'Tasmania': ['Hobart', 'Launceston', 'Devonport', 'Burnie', 'Ulverstone', 'Cradle Mountain', 'Strahan', 'Richmond', 'Port Arthur', 'Coles Bay'],
      'Northern Territory': ['Darwin', 'Alice Springs', 'Katherine', 'Palmerston', 'Tennant Creek', 'Jabiru', 'Nhulunbuy', 'Yulara', 'Pine Creek', 'Litchfield'],
      'Australian Capital Territory': ['Canberra', 'Queanbeyan', 'Belconnen', 'Woden Valley', 'Tuggeranong', 'Gungahlin', 'Weston Creek', 'Molonglo Valley', 'Jerrabomberra', 'Hall'],
    }
  },

  // ── South Korea (8 provinces + metros) ────────────────────
  'South Korea': {
    code: 'KR',
    states: {
      'Seoul Capital': ['Seoul', 'Incheon', 'Suwon', 'Seongnam', 'Goyang', 'Yongin', 'Bucheon', 'Ansan', 'Anyang', 'Uijeongbu'],
      'Gyeongsang': ['Busan', 'Daegu', 'Ulsan', 'Changwon', 'Gimhae', 'Gyeongju', 'Pohang', 'Jinju', 'Tongyeong', 'Andong'],
      'Chungcheong': ['Daejeon', 'Cheongju', 'Cheonan', 'Sejong', 'Asan', 'Gongju', 'Danyang', 'Boryeong', 'Chungju', 'Jecheon'],
      'Jeolla': ['Gwangju', 'Jeonju', 'Yeosu', 'Suncheon', 'Mokpo', 'Iksan', 'Gunsan', 'Namwon', 'Damyang', 'Boseong'],
      'Gangwon': ['Chuncheon', 'Gangneung', 'Sokcho', 'Wonju', 'Pyeongchang', 'Donghae', 'Samcheok', 'Taebaek', 'Yangyang', 'Inje'],
      'Jeju': ['Jeju City', 'Seogwipo', 'Hallim', 'Jungmun', 'Udo', 'Seongsanpo', 'Aewol', 'Pyoseon', 'Daejeong', 'Gujwa'],
    }
  },

  // ── India (major states) ──────────────────────────────────
  'India': {
    code: 'IN',
    states: {
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Solapur', 'Kolhapur', 'Amravati', 'Satara'],
      'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum', 'Gulbarga', 'Shimoga', 'Udupi', 'Hampi', 'Coorg'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Vellore', 'Thanjavur', 'Pondicherry', 'Ooty', 'Kanchipuram'],
      'Delhi NCR': ['New Delhi', 'Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad', 'Greater Noida', 'Dwarka', 'Rohini', 'Connaught Place', 'Chandni Chowk'],
      'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Secunderabad', 'Siddipet'],
      'West Bengal': ['Kolkata', 'Darjeeling', 'Siliguri', 'Asansol', 'Durgapur', 'Howrah', 'Kharagpur', 'Malda', 'Burdwan', 'Shantiniketan'],
      'Rajasthan': ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Ajmer', 'Pushkar', 'Bikaner', 'Kota', 'Mount Abu', 'Alwar'],
      'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kannur', 'Kollam', 'Palakkad', 'Alappuzha', 'Munnar', 'Wayanad'],
      'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Junagadh', 'Dwarka', 'Kutch', 'Anand'],
      'Uttar Pradesh': ['Lucknow', 'Varanasi', 'Agra', 'Kanpur', 'Allahabad', 'Meerut', 'Gorakhpur', 'Mathura', 'Aligarh', 'Bareilly'],
    }
  },

  // ── Colombia (major departments) ──────────────────────────
  'Colombia': {
    code: 'CO',
    states: {
      'Bogotá D.C.': ['Bogotá', 'Suba', 'Kennedy', 'Engativá', 'Bosa', 'Usaquén', 'Chapinero', 'La Candelaria', 'Fontibón', 'Teusaquillo'],
      'Antioquia': ['Medellín', 'Envigado', 'Bello', 'Itagüí', 'Rionegro', 'Guatapé', 'Santa Fe de Antioquia', 'Jardín', 'Jericó', 'El Retiro'],
      'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Buga', 'Cartago', 'Yumbo', 'Jamundí', 'Dagua', 'Ginebra'],
      'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Puerto Colombia', 'Sabanalarga', 'Luruaco', 'Baranoa', 'Galapa', 'Juan de Acosta', 'Usiacurí'],
      'Bolívar': ['Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar', 'San Jacinto', 'Mompox', 'Turbana', 'Maria La Baja', 'San Juan Nepomuceno'],
      'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Barbosa', 'Lebrija', 'Zapatoca'],
    }
  },

  // ── Canada (10 provinces) ─────────────────────────────────
  'Canada': {
    code: 'CA',
    states: {
      'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London', 'Brampton', 'Markham', 'Kitchener', 'Niagara Falls', 'Kingston'],
      'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Sherbrooke', 'Trois-Rivières', 'Saguenay', 'Lévis', 'Drummondville', 'Mont-Tremblant'],
      'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Kelowna', 'Kamloops', 'Nanaimo', 'Whistler', 'Tofino', 'Prince George'],
      'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Banff', 'Jasper', 'Medicine Hat', 'Grande Prairie', 'Canmore', 'Airdrie'],
      'Manitoba': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie', 'Selkirk', 'Winkler', 'Morden', 'Dauphin', 'The Pas'],
      'Saskatchewan': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster'],
      'Nova Scotia': ['Halifax', 'Sydney', 'Dartmouth', 'Truro', 'Wolfville', 'Lunenburg', 'Antigonish', 'New Glasgow', 'Yarmouth', 'Amherst'],
      'New Brunswick': ['Fredericton', 'Saint John', 'Moncton', 'Bathurst', 'Edmundston', 'Miramichi', 'Campbellton', 'Dieppe', 'Riverview', 'Sackville'],
    }
  },
};

/**
 * Get list of countries that have state-level data
 * @returns {string[]}
 */
function getCountriesWithStates() {
  return Object.keys(COUNTRY_STATES);
}

/**
 * Get states for a country
 * @param {string} country
 * @returns {{ code: string, states: Record<string, string[]> } | null}
 */
function getCountryStates(country) {
  return COUNTRY_STATES[country] || null;
}

/**
 * Get flat list of all { country, code, state, city } entries for a country
 * @param {string} country
 * @returns {Array<{ country: string, code: string, state: string, city: string }>}
 */
function getCountryCityEntries(country) {
  const data = COUNTRY_STATES[country];
  if (!data) return [];
  const entries = [];
  for (const [state, cities] of Object.entries(data.states)) {
    for (const city of cities) {
      entries.push({ country, code: data.code, state, city });
    }
  }
  return entries;
}

module.exports = { COUNTRY_STATES, getCountriesWithStates, getCountryStates, getCountryCityEntries };
