using System.Net.Http.Json;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHttpClient();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocal", policy =>
    {
        policy.WithOrigins("http://localhost:3001", "http://localhost:3002")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors("AllowLocal");

app.MapGet("/health", () => Results.Ok(new { ok = true }));

app.MapGet("/api/serpents", async (HttpClient httpClient) =>
{
    var ticketmasterApiKey = Environment.GetEnvironmentVariable("TICKETMASTER_API_KEY");
    var events = new List<object>();

    if (!string.IsNullOrEmpty(ticketmasterApiKey))
    {
        try
        {
            // Try to get events from Ticketmaster API
            var url = $"https://app.ticketmaster.com/discovery/v2/events.json?apikey={ticketmasterApiKey}&countryCode=BR&size=50";
            var response = await httpClient.GetAsync(url);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("_embedded", out var embedded) &&
                    embedded.TryGetProperty("events", out var eventsArray))
                {
                    foreach (var eventElement in eventsArray.EnumerateArray().Take(50))
                    {
                        var eventObj = new
                        {
                            event_key = $"ticketmaster_{eventElement.GetProperty("id").GetString()}",
                            event_name = eventElement.GetProperty("name").GetString() ?? "Unknown Event",
                            artist_name = eventElement.GetProperty("name").GetString() ?? "Unknown Artist",
                            description = eventElement.TryGetProperty("info", out var info) ? info.GetString() : "",
                            event_date = eventElement.TryGetProperty("dates", out var dates) &&
                                        dates.TryGetProperty("start", out var start) &&
                                        start.TryGetProperty("dateTime", out var dateTime)
                                        ? dateTime.GetString() : null,
                            venue_name = "TBD",
                            venue_city = "Unknown",
                            venue_country = "Brazil",
                            event_url = eventElement.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : "",
                            ticket_url = eventElement.TryGetProperty("url", out var ticketUrl) ? ticketUrl.GetString() : "",
                            source = "ticketmaster_dotnet",
                            category = "Event"
                        };

                        // Try to extract venue info
                        if (eventElement.TryGetProperty("_embedded", out var eventEmbedded) &&
                            eventEmbedded.TryGetProperty("venues", out var venues) &&
                            venues.EnumerateArray().Any())
                        {
                            var venue = venues.EnumerateArray().First();
                            var venueName = venue.TryGetProperty("name", out var name) ? name.GetString() : "TBD";
                            var venueCity = "Unknown";
                            if (venue.TryGetProperty("city", out var city) &&
                                city.TryGetProperty("name", out var cityName))
                            {
                                venueCity = cityName.GetString() ?? "Unknown";
                            }

                            eventObj = new
                            {
                                event_key = eventObj.event_key,
                                event_name = eventObj.event_name,
                                artist_name = eventObj.artist_name,
                                description = eventObj.description,
                                event_date = eventObj.event_date,
                                venue_name = venueName,
                                venue_city = venueCity,
                                venue_country = eventObj.venue_country,
                                event_url = eventObj.event_url,
                                ticket_url = eventObj.ticket_url,
                                source = eventObj.source,
                                category = eventObj.category
                            };
                        }

                        events.Add(eventObj);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ticketmaster API error: {ex.Message}");
        }
    }

    // If no events from APIs, return some mock events for testing
    if (events.Count == 0)
    {
        events.Add(new
        {
            event_key = "mock_1",
            event_name = "Mock Event 1",
            artist_name = "Mock Artist",
            description = "This is a mock event from .NET EventSerpent service",
            event_date = DateTime.UtcNow.AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            venue_name = "Mock Venue",
            venue_city = "São Paulo",
            venue_country = "Brazil",
            event_url = "https://example.com",
            ticket_url = "https://example.com",
            source = "mock_dotnet",
            category = "Music"
        });

        events.Add(new
        {
            event_key = "mock_2",
            event_name = "Mock Event 2",
            artist_name = "Another Artist",
            description = "Another mock event for testing",
            event_date = DateTime.UtcNow.AddDays(14).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            venue_name = "Another Venue",
            venue_city = "Rio de Janeiro",
            venue_country = "Brazil",
            event_url = "https://example.com",
            ticket_url = "https://example.com",
            source = "mock_dotnet",
            category = "Arts & Theatre"
        });
    }

    return Results.Json(new
    {
        events = events,
        total = events.Count,
        time_seconds = 0.5,
        errors = 0
    });
});

app.Run();
