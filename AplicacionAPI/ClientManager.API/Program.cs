using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using ClientManager.API;
using ClientManager.API.Data;
using ClientManager.API.Models;
using ClientManager.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Identity ──────────────────────────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;

    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(1);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey es obligatorio. Configúralo en User Secrets.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer es obligatorio. Configúralo en appsettings.json.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience es obligatorio. Configúralo en appsettings.json.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ClockSkew = TimeSpan.Zero,
        RoleClaimType = "role"
    };
    // Leer el access token desde la cookie HttpOnly (Phase C).
    // Si la cookie no está presente, el handler cae al behavior por defecto
    // (header Authorization: Bearer ...) para que Swagger siga funcionando.
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = ctx =>
        {
            var cookie = ctx.Request.Cookies["accessToken"];
            if (!string.IsNullOrEmpty(cookie))
                ctx.Token = cookie;
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// ── HTTP ──────────────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddHostedService<CleanupHostedService>();

// ── Controllers ───────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// ── Swagger con soporte Bearer token ─────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "ClientManager API", Version = "v1" });
    options.OperationFilter<FileUploadOperationFilter>();

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        options.IncludeXmlComments(xmlPath);

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Introduce tu JWT. Ejemplo: eyJhbGci..."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ── CORS ──────────────────────────────────────────────────────────────────────
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException(
        "Cors:AllowedOrigins es obligatorio. Configúralo en appsettings.json o por entorno.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ── Rate Limiting ─────────────────────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }
        ));
});

// ── Kestrel ───────────────────────────────────────────────────────────────────
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
});

var app = builder.Build();

// ── Global exception handler ──────────────────────────────────────────────────
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        var handlerLog = context.RequestServices.GetRequiredService<ILogger<Program>>();

        var (statusCode, message) = exception switch
        {
            ArgumentException ex => (StatusCodes.Status400BadRequest, ex.Message),
            KeyNotFoundException ex => (StatusCodes.Status404NotFound, ex.Message),
            AccountLockedException => (StatusCodes.Status423Locked, "Credenciales inválidas o cuenta temporalmente bloqueada."),
            UnauthorizedAccessException ex => (StatusCodes.Status401Unauthorized, ex.Message),
            _ => (StatusCodes.Status500InternalServerError,
                                               "Ha ocurrido un error interno en el servidor.")
        };

        // Registrar errores inesperados — los esperados (4xx) no necesitan stack trace
        if (statusCode == StatusCodes.Status500InternalServerError && exception is not null)
            handlerLog.LogError(exception, "Error no controlado en {Path}", context.Request.Path);

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { status = statusCode, error = message });
    });
});

app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseRateLimiter();
app.UseAuthentication();   // debe ir antes de UseAuthorization
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "ClientManager API v1");
    });

    // Endpoint solo para k6/dev — expone el último OTP generado para un email sin necesitar smtp4dev.
    app.MapGet("/api/dev/last-otp", (string email) =>
    {
        var code = ClientManager.API.Services.DevOtpStore.Get(email);
        return code is null ? Results.NotFound() : Results.Ok(new { code });
    });

    // Inserta N empresas con datos aleatorios para probar la UI. Solo disponible en desarrollo.
    app.MapPost("/api/dev/seed-companies", async (int count, ClientManager.API.Data.ApplicationDbContext db) =>
    {
        if (count is < 1 or > 200) return Results.BadRequest("count debe estar entre 1 y 200.");

        string[] prefixes  = ["Tech", "Global", "Smart", "Next", "Alpha", "Blue", "Prime", "Nova", "Core", "Apex", "Bright", "Swift", "Open", "Meta", "Vega", "Flux", "Zero", "Orbit", "Pulse", "Agile"];
        string[] suffixes  = ["Solutions", "Systems", "Ventures", "Group", "Labs", "Works", "Tech", "Digital", "Hub", "Net", "Soft", "Data", "Cloud", "AI", "Partners", "Studio", "Forge", "Dynamics", "Corp", "Industries"];
        string[] locations = ["Barcelona", "Madrid", "Valencia", "Sevilla", "Bilbao", "Zaragoza", "Málaga", "Alicante", "Murcia", "Valladolid", "Lisboa", "Porto", "Berlin", "München", "Hamburg", "Lyon", "Paris", "Toulouse", "Milano", "Roma"];
        string[] sectors   = ["tecnología", "consultoría", "logística", "e-commerce", "fintech", "salud digital", "edtech", "manufactura", "retail", "marketing digital", "ciberseguridad", "inteligencia artificial", "automatización", "energía renovable", "biotecnología"];

        var rng       = new Random();
        var now       = DateTime.UtcNow;
        var companies = new List<ClientManager.API.Models.Company>(count);

        var usedNames = new HashSet<string>(
            db.Companies.Select(c => c.Name).ToHashSet()
        );

        for (var i = 0; i < count; i++)
        {
            string name;
            var attempts = 0;
            do
            {
                name = $"{prefixes[rng.Next(prefixes.Length)]} {suffixes[rng.Next(suffixes.Length)]}";
                if (rng.Next(3) == 0) name += $" {rng.Next(2, 30)}";
                attempts++;
            } while (usedNames.Contains(name) && attempts < 50);

            usedNames.Add(name);

            var city   = locations[rng.Next(locations.Length)];
            var sector = sectors[rng.Next(sectors.Length)];
            var years  = rng.Next(1, 25);
            var employees = rng.Next(2, 500);

            companies.Add(new ClientManager.API.Models.Company
            {
                Name        = name,
                Description = $"Empresa especializada en {sector} con sede en {city}. Fundada hace {years} año{(years == 1 ? "" : "s")}, cuenta con un equipo de {employees} profesionales dedicados a ofrecer soluciones innovadoras para sus clientes.",
                CreatedAt   = now.AddDays(-rng.Next(0, 365 * years)),
                UpdatedAt   = now
            });
        }

        db.Companies.AddRange(companies);
        await db.SaveChangesAsync();

        return Results.Ok(new { inserted = companies.Count });
    });

    // Inserta N usuarios aleatorios repartidos entre las empresas existentes.
    app.MapPost("/api/dev/seed-users", async (int count, ClientManager.API.Data.ApplicationDbContext db) =>
    {
        if (count is < 1 or > 500) return Results.BadRequest("count debe estar entre 1 y 500.");

        var companyIds = db.Companies.Select(c => c.Id).ToList();
        if (companyIds.Count == 0) return Results.BadRequest("No hay empresas. Crea empresas primero.");

        string[] firstNames = ["Alejandro", "María", "Carlos", "Laura", "Javier", "Ana", "Pablo", "Sofía", "Miguel", "Elena", "Sergio", "Lucía", "David", "Carmen", "Andrés", "Isabel", "Roberto", "Natalia", "Fernando", "Marta", "Jorge", "Cristina", "Álvaro", "Raquel", "Diego", "Pilar", "Adrián", "Sandra", "Rubén", "Patricia", "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "William", "Sophia", "Benjamin", "Isabella", "Lucas", "Mia", "Henry", "Charlotte", "Alexander", "Amelia", "Sebastian", "Harper", "Jack", "Evelyn"];
        string[] lastNames  = ["García", "Martínez", "López", "Sánchez", "González", "Rodríguez", "Fernández", "Pérez", "Gómez", "Álvarez", "Díaz", "Moreno", "Muñoz", "Jiménez", "Ruiz", "Hernández", "Torres", "Navarro", "Domínguez", "Ramos", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Young", "Walker", "Hall"];
        string[] domains    = ["gmail.com", "outlook.com", "empresa.es", "corp.com", "work.io", "business.net", "mail.com", "company.org", "pro.es", "digital.com"];

        var rng      = new Random();
        var now      = DateTime.UtcNow;
        var users    = new List<ClientManager.API.Models.User>(count);
        var usedEmails = new HashSet<string>(db.CompanyUsers.Select(u => u.Email).ToList());

        for (var i = 0; i < count; i++)
        {
            var first = firstNames[rng.Next(firstNames.Length)];
            var last  = lastNames[rng.Next(lastNames.Length)];
            var name  = $"{first} {last}";

            string email;
            var attempts = 0;
            do
            {
                static string Slugify(string s) => new string(
                    s.ToLower().Normalize(System.Text.NormalizationForm.FormD)
                     .Where(c => c is >= 'a' and <= 'z').ToArray());
                var slug = $"{Slugify(first)}.{Slugify(last.Replace(" ", ""))}";
                var suffix = attempts > 0 ? $"{rng.Next(10, 999)}" : "";
                var domain = domains[rng.Next(domains.Length)];
                email      = $"{slug}{suffix}@{domain}";
                attempts++;
            } while (usedEmails.Contains(email) && attempts < 50);

            usedEmails.Add(email);

            users.Add(new ClientManager.API.Models.User
            {
                Name      = name,
                Email     = email,
                CompanyId = companyIds[rng.Next(companyIds.Count)],
                CreatedAt = now.AddDays(-rng.Next(0, 730)),
                UpdatedAt = now
            });
        }

        db.CompanyUsers.AddRange(users);
        await db.SaveChangesAsync();

        return Results.Ok(new { inserted = users.Count });
    });
}

// ── Auto-migrate + Seed ───────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    var conn = dbContext.Database.GetDbConnection();
    await conn.OpenAsync();
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory')";
    var migrationsTableExists = (bool)(await cmd.ExecuteScalarAsync())!;
    await conn.CloseAsync();

    if (migrationsTableExists)
    {
        logger.LogInformation("Applying pending migrations...");
        await dbContext.Database.MigrateAsync();
    }
    else
    {
        await conn.OpenAsync();
        await using var cmd2 = conn.CreateCommand();
        cmd2.CommandText = "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Clients') AND NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Companies')";
        var hasLegacySchema = (bool)(await cmd2.ExecuteScalarAsync())!;
        await conn.CloseAsync();

        if (hasLegacySchema)
        {
            logger.LogInformation("Legacy schema detectado. Registrando historial de migraciones...");
            await dbContext.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                    "MigrationId" character varying(150) NOT NULL,
                    "ProductVersion" character varying(32) NOT NULL,
                    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
                );
                """);
            await dbContext.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                VALUES ('20260324085131_InitialCreate', '9.0.1')
                ON CONFLICT DO NOTHING;
                """);
            await dbContext.Database.MigrateAsync();
        }
        else
        {
            await dbContext.Database.MigrateAsync();
        }
    }

    // ── Seed roles y SuperAdmin ───────────────────────────────────────────────
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

    foreach (var roleName in new[] { "SuperAdmin", "Cliente" })
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole(roleName));
            logger.LogInformation("Rol creado: {Role}", roleName);
        }
    }

    var adminEmail = config["SuperAdmin:Email"] ?? "admin@clientmanager.local";
    var adminPassword = config["SuperAdmin:Password"]
        ?? throw new InvalidOperationException("SuperAdmin:Password es obligatorio. Configúralo en User Secrets.");

    if (await userManager.FindByEmailAsync(adminEmail) is null)
    {
        var adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await userManager.CreateAsync(adminUser, adminPassword);
        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(adminUser, "SuperAdmin");
            logger.LogInformation("SuperAdmin creado: {Email}", adminEmail);
        }
        else
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            logger.LogError("Error al crear SuperAdmin: {Errors}", errors);
            throw new InvalidOperationException($"Fallo al crear SuperAdmin: {errors}");
        }
    }
    else
    {
        logger.LogInformation("SuperAdmin ya existe: {Email}", adminEmail);
    }
}

app.Run();

// Necesario para que WebApplicationFactory<Program> pueda acceder a esta clase desde el proyecto de tests.
public partial class Program { }
