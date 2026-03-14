using System;
using AuthProxy.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Grpc.AspNetCore.Server;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddGrpc();

var app = builder.Build();
app.MapGrpcService<AuthService>();
app.MapGet("/", () => "AuthProxy gRPC service");

// HTTP compatibility endpoint for environments without gRPC (e.g., Joomla PHP)
app.MapPost("/api/validate", async (HttpContext http) =>
{
	try
	{
		var doc = await System.Text.Json.JsonDocument.ParseAsync(http.Request.Body);
		var root = doc.RootElement;
		var token = root.GetProperty("token").GetString();
		var userId = root.TryGetProperty("userId", out var u) ? u.GetString() : null;

		// reuse the same placeholder logic as AuthService
		if (!string.IsNullOrEmpty(token) && token == "dev-token")
		{
			return Results.Json(new { valid = true, username = "devuser", email = "dev@local" });
		}

		return Results.Json(new { valid = false });
	}
	catch (Exception ex)
	{
		return Results.Problem(detail: ex.Message);
	}
});

app.Run();
