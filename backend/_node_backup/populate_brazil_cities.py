#!/usr/bin/env python3
"""
Brazil Cities Event Populator
Populates events for the 10 most famous cities in each Brazilian state
Maximum 666 events per city (unless specified otherwise) for ULTIMATE coverage
"""

import requests
import json
import time
import random
from datetime import datetime, timedelta
import mysql.connector
from mysql.connector import Error

# Brazilian states and their major cities (top 10 per state)
BRAZILIAN_CITIES = {
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
}

# Event categories and sample data
EVENT_CATEGORIES = [
    'Concert', 'Festival', 'Theater', 'Sports', 'Exhibition', 'Workshop',
    'Conference', 'Party', 'Market', 'Cultural Event'
]

VENUES = [
    'Municipal Theater', 'Convention Center', 'Sports Arena', 'Cultural Center',
    'Music Hall', 'Expo Center', 'Stadium', 'Community Center', 'Park', 'Museum'
]

ARTISTS = [
    'Local Band', 'Brazilian Artist', 'International Star', 'DJ Collective',
    'Theater Company', 'Dance Group', 'Orchestra', 'Choir', 'Comedian', 'Speaker'
]

def generate_event_data(city, state, event_num):
    """Generate a single event for a city"""
    category = random.choice(EVENT_CATEGORIES)
    venue = random.choice(VENUES)

    # Generate future date (next 30-90 days)
    days_ahead = random.randint(30, 90)
    event_date = datetime.now() + timedelta(days=days_ahead)

    # Generate event name
    event_name = f"{category} in {city}"

    # Generate description
    description = f"Amazing {category.lower()} featuring {random.choice(ARTISTS)} at {venue}"

    # Generate ticket info
    ticket_price = random.randint(20, 200)
    ticket_url = f"https://tickets.example.com/event-{city.lower().replace(' ', '-')}-{event_num}"

    # Generate venue details
    venue_name = f"{venue} {city}"
    venue_city = city
    venue_country = "Brazil"

    # Generate coordinates (approximate for major cities)
    lat_variations = [-0.1, -0.05, 0, 0.05, 0.1]
    lng_variations = [-0.1, -0.05, 0, 0.05, 0.1]

    # Base coordinates for some major cities (simplified)
    base_coords = {
        'São Paulo': (-23.5505, -46.6333),
        'Rio de Janeiro': (-22.9068, -43.1729),
        'Belo Horizonte': (-19.9191, -43.9386),
        'Salvador': (-12.9714, -38.5014),
        'Brasília': (-15.7942, -47.8822),
        'Curitiba': (-25.4284, -49.2733),
        'Porto Alegre': (-30.0346, -51.2177),
        'Recife': (-8.0476, -34.8770),
        'Fortaleza': (-3.7319, -38.5267),
        'Belém': (-1.4558, -48.5044)
    }

    base_lat, base_lng = base_coords.get(city, (-15.0, -47.0))  # Default to near Brasília
    latitude = base_lat + random.choice(lat_variations)
    longitude = base_lng + random.choice(lng_variations)

    return {
        'event_name': event_name,
        'description': description,
        'event_date': event_date.strftime('%Y-%m-%d %H:%M:%S'),
        'venue_name': venue_name,
        'venue_city': venue_city,
        'venue_country': venue_country,
        'venue_latitude': latitude,
        'venue_longitude': longitude,
        'event_url': f"https://events.example.com/{city.lower().replace(' ', '-')}-{event_num}",
        'source': 'brazil_populator',
        'artist_name': random.choice(ARTISTS),
        'ticket_url': ticket_url,
        'ticket_price': ticket_price
    }

def connect_to_database():
    """Connect to the MySQL database"""
    try:
        connection = mysql.connector.connect(
            host='127.0.0.1',
            user='root',
            password='As30281163',
            database='keepup_events',
            charset='utf8mb4',
            collation='utf8mb4_general_ci'
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def insert_event(cursor, event_data):
    """Insert a single event into the database"""
    sql = """
    INSERT INTO events (
        event_name, description, event_date, venue_name, venue_city, venue_country,
        venue_latitude, venue_longitude, event_url, source, artist_name, ticket_url, ticket_price
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    values = (
        event_data['event_name'],
        event_data['description'],
        event_data['event_date'],
        event_data['venue_name'],
        event_data['venue_city'],
        event_data['venue_country'],
        event_data['venue_latitude'],
        event_data['venue_longitude'],
        event_data['event_url'],
        event_data['source'],
        event_data['artist_name'],
        event_data['ticket_url'],
        event_data['ticket_price']
    )

    cursor.execute(sql, values)

def main():
    """Main function to populate Brazilian cities with events"""
    print("🚀 Starting Brazil Cities Event Population")
    print("📍 Populating ULTIMATE events for major cities in all 27 Brazilian states (666 per city!)")

    # Connect to database
    connection = connect_to_database()
    if not connection:
        print("❌ Failed to connect to database")
        return

    cursor = connection.cursor()

    total_events = 0
    total_cities = 0

    try:
        for state, cities in BRAZILIAN_CITIES.items():
            print(f"\n🏛️  Processing state: {state}")

            for city in cities:
                # Check how many events already exist for this city
                cursor.execute("""
                    SELECT COUNT(*) FROM events
                    WHERE venue_city = %s AND source = 'brazil_populator'
                """, (city,))

                existing_count = cursor.fetchone()[0]

                # Generate MAXIMUM events for each city (666 events per city for ultimate coverage)
                # DEFAULT: 666 events per city - change this value if you want different limits
                events_to_add = 666

                print(f"   📅 {city}: Adding {events_to_add} events (had {existing_count} already)")

                # Generate and insert events
                for i in range(events_to_add):
                    event_data = generate_event_data(city, state, existing_count + i + 1)
                    insert_event(cursor, event_data)
                    total_events += 1

                total_cities += 1

                # Commit every 50 cities to avoid large transactions
                if total_cities % 50 == 0:
                    connection.commit()
                    print(f"   💾 Committed {total_events} events so far")

        # Final commit
        connection.commit()

        print("\n🎉 Population Complete!")
        print(f"📊 Total cities processed: {total_cities}")
        print(f"🎫 Total events added: {total_events}")
        print(f"🌍 Coverage: All 27 Brazilian states")

        # Show some statistics
        cursor.execute("SELECT COUNT(*) FROM events WHERE source = 'brazil_populator'")
        brazil_events = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT venue_city) FROM events WHERE source = 'brazil_populator'")
        brazil_cities = cursor.fetchone()[0]

        print(f"📈 Database now has {brazil_events} Brazilian events across {brazil_cities} cities")

    except Error as e:
        print(f"❌ Database error: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    main()