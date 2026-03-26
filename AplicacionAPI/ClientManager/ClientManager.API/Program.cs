using System.Text.Json.Serialization;
using ClientManager.API;
using ClientManager.API.Data;
using ClientManager.API.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Caching & HTTP
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

// Services
builder.Services.AddScoped<IClientService, ClientService>();

// Controllers with enum-as-string serialization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "ClientManager API", Version = "v1" });
    options.OperationFilter<FileUploadOperationFilter>();

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// Kestrel limits for file uploads
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB
});

var app = builder.Build();

// Global exception handler
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

        var (statusCode, message) = exception switch
        {
            ArgumentException ex => (StatusCodes.Status400BadRequest, ex.Message),
            KeyNotFoundException ex => (StatusCodes.Status404NotFound, ex.Message),
            _ => (StatusCodes.Status500InternalServerError, "Ha ocurrido un error interno en el servidor.")
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            status = statusCode,
            error = message
        });
    });
});

// Static files (serves wwwroot/uploads/)
app.UseStaticFiles();

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseAuthorization();
app.MapControllers();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "ClientManager API v1");
    });
}

// Auto-migrate on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Check if the schema already exists before attempting migration (avoids noisy failed-command logs)
    var conn = dbContext.Database.GetDbConnection();
    await conn.OpenAsync();
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Clients')";
    var clientsTableExists = (bool)(await cmd.ExecuteScalarAsync())!;
    await conn.CloseAsync();

    if (clientsTableExists)
    {
        // Tables exist but migrations history may be missing — register silently
        logger.LogInformation("Schema already exists, registering migration history if needed.");
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                "MigrationId" character varying(150) NOT NULL,
                "ProductVersion" character varying(32) NOT NULL,
                CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
            );
            """);
        foreach (var migrationId in dbContext.Database.GetMigrations())
        {
#pragma warning disable EF1002 // Migration IDs are internal EF values, not user input
            await dbContext.Database.ExecuteSqlRawAsync($"""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                VALUES ('{migrationId}', '9.0.1')
                ON CONFLICT DO NOTHING;
                """);
#pragma warning restore EF1002
        }
    }
    else
    {
        await dbContext.Database.MigrateAsync();
    }
}

app.Run();
