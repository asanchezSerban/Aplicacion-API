using System.Text;
using System.Text.Json.Serialization;
using ClientManager.API;
using ClientManager.API.Data;
using ClientManager.API.Models;
using ClientManager.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
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
    options.Password.RequireDigit           = true;
    options.Password.RequireLowercase       = true;
    options.Password.RequireUppercase       = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength         = 8;

    options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers      = true;

    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey es obligatorio. Configúralo en User Secrets.");
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "ClientManagerAPI";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ClientManagerApp";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = jwtIssuer,
        ValidAudience            = jwtAudience,
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ClockSkew                = TimeSpan.Zero,
        RoleClaimType            = "role"
    };
});

builder.Services.AddAuthorization();

// ── Caching & HTTP ────────────────────────────────────────────────────────────
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IAuthService, AuthService>();

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
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Introduce tu JWT. Ejemplo: eyJhbGci..."
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
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
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

        var (statusCode, message) = exception switch
        {
            ArgumentException ex          => (StatusCodes.Status400BadRequest,    ex.Message),
            KeyNotFoundException ex        => (StatusCodes.Status404NotFound,      ex.Message),
            UnauthorizedAccessException ex => (StatusCodes.Status401Unauthorized,  ex.Message),
            _                              => (StatusCodes.Status500InternalServerError,
                                               "Ha ocurrido un error interno en el servidor.")
        };

        context.Response.StatusCode  = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { status = statusCode, error = message });
    });
});

app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseCors("AllowAngular");
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
}

// ── Auto-migrate + Seed ───────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger    = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

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
    var config      = scope.ServiceProvider.GetRequiredService<IConfiguration>();

    foreach (var roleName in new[] { "SuperAdmin", "Cliente" })
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole(roleName));
            logger.LogInformation("Rol creado: {Role}", roleName);
        }
    }

    var adminEmail    = config["SuperAdmin:Email"]    ?? "admin@clientmanager.local";
    var adminPassword = config["SuperAdmin:Password"]
        ?? throw new InvalidOperationException("SuperAdmin:Password es obligatorio. Configúralo en User Secrets.");

    if (await userManager.FindByEmailAsync(adminEmail) is null)
    {
        var adminUser = new ApplicationUser
        {
            UserName       = adminEmail,
            Email          = adminEmail,
            EmailConfirmed = true,
            CreatedAt      = DateTime.UtcNow
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
