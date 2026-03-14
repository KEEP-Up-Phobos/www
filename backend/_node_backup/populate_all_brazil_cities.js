#!/usr/bin/env node
/**
 * Populate All Brazilian Cities with Events
 * Calls the /api/events/populate-town endpoint for each major Brazilian city
 */

const axios = require('axios');
const fs = require('fs');

// Brazilian states and their major cities (top 10 per state)
const BRAZILIAN_CITIES = {
    'SP': ['São Paulo', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Guarulhos', 'São José dos Campos', 'Piracicaba'],
    'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Magé'],
    'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga'],
    'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Juazeiro', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Alagoinhas'],
    'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá'],
    'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande'],
    'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão'],
    'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Crato', 'Maracanaú', 'Sobral', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá'],
    'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas', 'Abaetetuba', 'Cametá', 'Bragança', 'Barcarena'],
    'MA': ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas'],
    'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Lages'],
    'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Jataí'],
    'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cabedelo', 'Cajazeiras', 'Guarabira', 'Sapé'],
    'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'São Mateus', 'Colatina', 'Linhares', 'Aracruz', 'São Gabriel da Palha', 'Itapemirim'],
    'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Açu', 'Currais Novos', 'São José de Mipibu'],
    'AL': ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'São Miguel dos Campos', 'Penedo', 'União dos Palmares', 'São Luís do Quitunde', 'Delmiro Gouveia', 'Coruripe'],
    'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Pedro II', 'Oeiras', 'São Raimundo Nonato', 'Uruçuí'],
    'DF': ['Brasília'],
    'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças'],
    'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Rio Brilhante', 'Maracaju'],
    'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Tocantinópolis', 'Miracema do Tocantins', 'Dianópolis'],
    'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Itaporanga d\'Ajuda', 'Simão Dias', 'Poço Redondo'],
    'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim', 'Ouro Preto do Oeste', 'Pimenta Bueno'],
    'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Mâncio Lima', 'Xapuri', 'Epitaciolândia', 'Plácido de Castro'],
    'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués', 'São Gabriel da Cachoeira', 'Novo Airão'],
    'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'São João da Baliza', 'Pacaraima', 'Amajari', 'Bonfim', 'São Luiz', 'Iracema'],
    'AP': ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande', 'Tartarugalzinho', 'Pedra Branca do Amapari', 'Vitória do Jari', 'Calçoene']
};

// Flatten the cities into a single array
const allCities = [];
for (const state in BRAZILIAN_CITIES) {
    for (const city of BRAZILIAN_CITIES[state]) {
        allCities.push(city);
    }
}

const LOG_FILE = '/media/phobos/KEEP-Up App/backend/population_log.txt';

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

log(`🚀 Starting population of ${allCities.length} Brazilian cities with max events...`);

const BASE_URL = 'http://localhost:3002'; // Backend port
const MAX_EVENTS_PER_CITY = 10; // Reduced from 50 to speed up

async function populateCity(city) {
    try {
        log(`📍 Populating events for: ${city}`);

        const response = await axios.post(`${BASE_URL}/api/events/populate-town`, {
            town: `${city}, Brazil`,
            maxEvents: MAX_EVENTS_PER_CITY,
            useUnified: true
        }, {
            timeout: 60000 // Reduced to 1 minute from 5 minutes
        });

        if (response.data.success) {
            log(`✅ ${city}: ${response.data.message}`);
            return response.data.data?.totalEvents || 0;
        } else {
            log(`❌ ${city}: ${response.data.error || 'Unknown error'}`);
            return 0;
        }
    } catch (error) {
        log(`❌ ${city}: ${error.message}`);
        return 0;
    }
}

async function populateAllCities(startFrom = 0) {
    let totalEvents = 0;
    let successCount = 0;

    for (let i = startFrom; i < allCities.length; i++) {
        const city = allCities[i];
        log(`\n[${i + 1}/${allCities.length}] Processing ${city}...`);

        const eventsAdded = await populateCity(city);
        totalEvents += eventsAdded;
        if (eventsAdded > 0) successCount++;

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    log(`\n🎉 Population complete!`);
    log(`📊 Total cities processed: ${allCities.length}`);
    log(`✅ Cities with events: ${successCount}`);
    log(`🎫 Total events added: ${totalEvents}`);
}

// Run the population
populateAllCities(15).catch(error => {
    log(`💥 Population failed: ${error.message}`);
    process.exit(1);
});