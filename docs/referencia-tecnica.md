# ClientManager — Referencia Técnica Completa

> Documento definitivo de la aplicación. Cubre absolutamente todo: stack, arquitectura, backend, frontend, seguridad, flujos, base de datos y despliegue. Escrito para poder responder cualquier pregunta técnica sin necesidad de consultar el código.

---

## ÍNDICE

1. [Visión general](#1-visión-general)
2. [Por qué este stack](#2-por-qué-este-stack)
3. [Arquitectura general](#3-arquitectura-general)
4. [Base de datos](#4-base-de-datos)
5. [Backend — capa por capa](#5-backend--capa-por-capa)
6. [Frontend — capa por capa](#6-frontend--capa-por-capa)
7. [Seguridad completa](#7-seguridad-completa)
8. [Flujos completos de usuario](#8-flujos-completos-de-usuario)
9. [Tests de integración](#9-tests-de-integración)
10. [Despliegue en IIS](#10-despliegue-en-iis)
11. [CI/CD](#11-cicd)

---

## 1. Visión general

ClientManager es una aplicación web de gestión de empresas y sus usuarios de contacto. Tiene dos tipos de usuarios:

- **SuperAdmin**: administrador único con acceso total. Gestiona empresas, crea usuarios, ve estadísticas.
- **Usuario de empresa**: empleado o contacto de una empresa. Solo puede ver su propio perfil. Internamente el sistema lo identifica con el rol `Cliente`.

La app es una **SPA (Single Page Application)** con un backend API REST separado. El frontend en Angular se comunica con el backend en .NET a través de HTTP. La autenticación usa JWT almacenado en cookies HttpOnly, lo que significa que el token nunca es accesible desde JavaScript.

---

## 2. Por qué este stack

### 2.1 .NET 10 + ASP.NET Core

**Qué es**: .NET es la plataforma de desarrollo de Microsoft. ASP.NET Core es el framework web que corre sobre ella. La versión 10 es la más reciente LTS.

**Por qué se eligió**:
- Rendimiento excepcional — ASP.NET Core está consistentemente en el top 5 de los benchmarks de TechEmpower para frameworks web
- Sistema de inyección de dependencias integrado y maduro
- ASP.NET Core Identity — solución completa para autenticación con usuarios, roles, hashing de contraseñas, lockout, etc. No hay que construirla desde cero
- EF Core — ORM potente con migraciones automáticas y LINQ
- Ecosistema maduro con librerías de calidad para JWT, OTP, email

**Alternativas descartadas**:
- Node.js/Express: menos tipado, más propenso a errores en runtime
- Spring Boot (Java): más verboso, mayor overhead de configuración
- FastAPI (Python): excelente para ML/datos pero el ecosistema de Identity no es tan completo

### 2.2 Entity Framework Core 9

**Qué es**: ORM (Object-Relational Mapper) de Microsoft. Permite trabajar con la base de datos usando objetos C# en lugar de SQL puro. Las "migraciones" son scripts que EF genera automáticamente para crear/modificar tablas.

**Por qué se eligió**:
- Code-first: defines el modelo en C# y EF genera el SQL
- Migraciones versionadas que se aplican automáticamente al arrancar
- LINQ: consultas tipadas que se traducen a SQL eficiente
- Integración nativa con ASP.NET Core Identity

**Cómo funciona internamente**: EF mantiene un grafo de objetos en memoria (`DbContext`). Cuando llamas a `SaveChangesAsync()`, EF compara el estado actual con el estado original y genera el SQL mínimo necesario (INSERT/UPDATE/DELETE). Las migraciones son clases C# con métodos `Up()` y `Down()` que EF usa para evolucionar el schema.

### 2.3 PostgreSQL

**Qué es**: Sistema de gestión de bases de datos relacionales de código abierto. Considerado el más avanzado técnicamente en el mundo open source.

**Por qué se eligió**:
- ACID completo: las transacciones son seguras
- Tipos de datos avanzados (JSONB, arrays, etc.)
- Rendimiento excelente con índices bien configurados
- `IDENTITY ALWAYS` para claves primarias (más seguro que SERIAL)
- Soporte nativo en EF Core a través de Npgsql

**Alternativas descartadas**:
- MySQL: históricamente más lento en operaciones complejas, menos estricto con tipos
- SQL Server: de pago para producción, dependencia de Microsoft
- SQLite: no apto para producción con concurrencia

### 2.4 Angular 21

**Qué es**: Framework JavaScript de Google para construir SPAs. Una SPA (Single Page Application) es una web que carga una sola vez y navega sin recargar la página completa. Angular 21 introduce el sistema de "signals" para reactividad y componentes standalone sin NgModules.

**Por qué se eligió**:
- TypeScript nativo: tipado fuerte que evita errores en runtime
- Standalone components y signals: arquitectura moderna sin el boilerplate de los módulos
- Angular Material: librería de componentes UI completa y accesible
- Inyección de dependencias integrada: `inject()` en lugar de constructores
- Angular Router: routing avanzado con guards, lazy loading y resolvers
- Ecosistema maduro con herramientas de testing, build, etc.

**Alternativas descartadas**:
- React: biblioteca (no framework), requiere más decisiones manuales de arquitectura
- Vue.js: menos tipado fuerte, ecosistema más pequeño para apps enterprise
- Svelte: excelente rendimiento pero ecosistema más joven

### 2.5 JWT (JSON Web Tokens)

**Qué es**: Estándar para transmitir información de autenticación de forma segura entre partes. Un JWT tiene tres partes separadas por puntos: `header.payload.signature`. El header dice el algoritmo de firma, el payload contiene los claims (datos del usuario), y la signature verifica que no fue alterado.

**Por qué en cookie HttpOnly**: Si el JWT se guarda en localStorage (como hacen muchas apps), JavaScript puede leerlo, lo que abre el vector de ataque XSS (un script malicioso roba el token). Al guardarlo en una cookie HttpOnly, el navegador lo envía automáticamente en cada request pero JavaScript no puede accederlo, eliminando ese vector.

**Por qué se eligió sobre alternativas**:
- Sessions en servidor: requieren almacenamiento en servidor (Redis, DB), no escalan horizontalmente tan bien
- OAuth2/OIDC: excesivamente complejo para una app con un solo proveedor de identidad propio

### 2.6 ASP.NET Core Identity

**Qué es**: Sistema de gestión de usuarios de Microsoft para .NET. Incluye: hashing de contraseñas (PBKDF2 con salt), gestión de roles, lockout de cuentas, tokens de reset de contraseña, tokens de verificación de email, SecurityStamp para invalidar sesiones.

**Por qué se eligió**: Construir un sistema de autenticación seguro desde cero es extremadamente difícil. Identity resuelve correctamente docenas de problemas de seguridad que son fáciles de hacer mal.

### 2.7 MailKit

**Qué es**: Librería .NET para enviar emails via SMTP. Es la recomendación oficial de Microsoft (sustituyó a `System.Net.Mail`).

**Para qué se usa**: Envío de OTPs (códigos de un solo uso) a usuarios clientes y links de reset de contraseña.

**En desarrollo**: Se usa smtp4dev, un servidor SMTP falso que intercepta los emails y los muestra en una UI web en `localhost:5010`. Los emails nunca llegan realmente.

### 2.8 OtpNet

**Qué es**: Librería .NET que implementa los estándares RFC 6238 (TOTP) y RFC 4226 (HOTP).

**TOTP (Time-based One-Time Password)**: Algoritmo que genera códigos de 6 dígitos válidos durante 30 segundos basándose en una clave secreta compartida y el tiempo actual. Es lo que usa Google Authenticator.

**Cómo funciona**: El backend genera una clave secreta aleatoria de 160 bits, la convierte a Base32 y genera un URI `otpauth://`. El usuario escanea ese URI con Google Authenticator. Desde ese momento, tanto el servidor como la app del usuario pueden generar independientemente el mismo código de 6 dígitos para el mismo instante de tiempo (sin comunicación de red).

---

## 3. Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR                            │
│  Angular 21 SPA (localhost:4200 en dev / IIS en prod)  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Services │  │  Guards  │  │Interceptor│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│        │              │              │                  │
│        └──────────────┴──────────────┘                  │
│                       │ HTTP + cookies                   │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              ASP.NET Core API (localhost:5000)           │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │
│  │Controllers │  │  Services  │  │ Background Svc │    │
│  └────────────┘  └────────────┘  └────────────────┘    │
│         │               │                               │
│         └───────────────┘                               │
│                   │ EF Core                              │
└───────────────────┼─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│              PostgreSQL (localhost:5432)                 │
│                                                         │
│  Companies │ Users │ AspNetUsers │ RefreshTokens │ OTPs │
└─────────────────────────────────────────────────────────┘
```

**Principio**: el frontend nunca accede directamente a la base de datos. Todo pasa por la API. La API valida la autenticación (JWT en cookie) antes de ejecutar cualquier operación.

---

## 4. Base de datos

### 4.1 Tablas principales

#### `Companies`
Almacena las empresas que gestiona el SuperAdmin.

| Columna | Tipo | Notas |
|---------|------|-------|
| Id | int | IDENTITY ALWAYS (auto-incremental) |
| Name | varchar(200) | UNIQUE — no pueden existir dos empresas con el mismo nombre |
| Description | varchar(2000) | Obligatorio |
| LogoFileName | varchar(500) | Nombre del archivo de logo guardado en wwwroot/uploads/ |
| Status | varchar(20) | Enum como string: 'Active', 'Prospect', 'Inactive', 'Churned' |
| ContactEmail | varchar(200) | Opcional. Único globalmente (ver validación en servicios) |
| ContactPhone | varchar(30) | Opcional |
| Address | varchar(300) | Opcional |
| CreatedAt | timestamp | Default NOW() |
| UpdatedAt | timestamp | Default NOW() |

**Índices**: `Name` (UNIQUE), `Status`, `UpdatedAt`

**Por qué Status es string y no int**: Los enums como strings son más legibles en la BD y más mantenibles. Si se añade un valor al enum, no hay que hacer una migración para cambiar el tipo numérico. EF Core convierte automáticamente entre el enum C# y el string en BD.

#### `Users`
Contactos de empresa. Cada usuario pertenece a una empresa.

| Columna | Tipo | Notas |
|---------|------|-------|
| Id | int | IDENTITY ALWAYS |
| Name | varchar(200) | Obligatorio |
| Email | varchar(200) | UNIQUE — un email solo puede pertenecer a un usuario |
| CompanyId | int | FK a Companies |
| CreatedAt | timestamp | Default NOW() |
| UpdatedAt | timestamp | Default NOW() |

**Índices**: `Email` (UNIQUE), `CompanyId`, `Name`

**Relación con Companies**: `CASCADE DELETE` — si se borra una empresa, se borran todos sus usuarios automáticamente.

**Relación con AspNetUsers**: Cada `User` tiene un `ApplicationUser` correspondiente con la cuenta de login. Cuando se crea un `User`, en la misma transacción se crea el `ApplicationUser`. Cuando se borra un `User`, el `ApplicationUser` tiene `UserId = null` (SET NULL).

#### `AspNetUsers` (gestionada por Identity)
Tabla de cuentas de acceso. ASP.NET Core Identity genera esta tabla automáticamente.

| Columna relevante | Notas |
|-------------------|-------|
| Id | GUID (string) — Identity usa GUIDs como PK |
| UserName | Email del usuario (mismo valor que Email) |
| Email | Email normalizado |
| NormalizedEmail | Email en mayúsculas para búsquedas case-insensitive |
| PasswordHash | PBKDF2 con salt — nunca se guarda la contraseña en texto plano |
| SecurityStamp | GUID que cambia cuando cambia la contraseña. Se incluye en el JWT y se valida en cada request |
| LockoutEnd | Fecha hasta la que la cuenta está bloqueada (null = no bloqueada) |
| AccessFailedCount | Contador de intentos fallidos |
| TotpSecret | Clave secreta TOTP en Base32 (null si TOTP no configurado) — COLUMNA AÑADIDA |
| TotpEnabled | Boolean — indica si el 2FA está activo — COLUMNA AÑADIDA |
| TotpBackupCodes | JSON con array de hashes SHA256 de los códigos de respaldo — COLUMNA AÑADIDA |
| UserId | FK nullable a Users — null para SuperAdmin — COLUMNA AÑADIDA |
| CreatedAt | Fecha de creación — COLUMNA AÑADIDA |

**Por qué Identity usa GUIDs**: Evita que un atacante pueda enumerar usuarios probando IDs secuenciales.

#### `RefreshTokens`
Tokens de larga duración que permiten renovar el access token (JWT de 15 min) sin pedir contraseña.

| Columna | Notas |
|---------|-------|
| Id | IDENTITY ALWAYS |
| Token | 32 bytes aleatorios en Base64 — criptográficamente seguro |
| UserId | FK a AspNetUsers |
| ExpiresAt | 24 horas desde creación |
| RevokedAt | null si activo. Fecha si fue revocado (logout, cambio de contraseña) |
| ReplacedByToken | Al rotar el token, aquí se guarda el nuevo. Permite auditoría de cadena |
| CreatedAt | Fecha de creación |

**Propiedad calculada `IsActive`**: `RevokedAt == null && ExpiresAt > DateTime.UtcNow`

**Índices**: `Token` (UNIQUE), `UserId`, `ExpiresAt`

#### `EmailOtpCodes`
Códigos de un solo uso enviados por email a los clientes para verificar su identidad.

| Columna | Notas |
|---------|-------|
| Id | IDENTITY ALWAYS |
| UserId | FK a AspNetUsers |
| CodeHash | SHA256 del código de 6 dígitos — nunca se guarda el código en texto plano |
| ExpiresAt | 30 segundos desde creación |
| IsUsed | Boolean — una vez usado, no puede usarse de nuevo |
| Attempts | Contador de intentos fallidos. Máximo 3 antes de invalidar |
| CreatedAt | Fecha de creación |

**Por qué se hashea el OTP**: Si alguien accede a la BD durante la ventana de 30 segundos, no puede usar el código porque solo está el hash.

**Índices**: `UserId`, `ExpiresAt`, `(ExpiresAt, IsUsed)` (índice compuesto para la limpieza)

### 4.2 Tablas de Identity (generadas automáticamente)

Además de `AspNetUsers`, Identity crea:
- `AspNetRoles`: roles del sistema (SuperAdmin, Cliente)
- `AspNetUserRoles`: relación N:M entre usuarios y roles
- `AspNetUserClaims`, `AspNetRoleClaims`: claims adicionales
- `AspNetUserLogins`, `AspNetUserTokens`: para proveedores externos (no usados)

### 4.3 Datos de seed

Al iniciar la app, Program.cs crea automáticamente:
1. Los roles `SuperAdmin` y `Cliente` en `AspNetRoles`
2. El usuario SuperAdmin con el email y contraseña de configuración
3. Dos empresas de ejemplo: "Acme Corp" y "Tech Startup SL"

Las empresas de seed están en `ApplicationDbContext.OnModelCreating()` via `HasData()`. El SuperAdmin se crea en `Program.cs` via `UserManager`.

### 4.4 Migraciones

EF Core gestiona la evolución del schema con migraciones. Cada migración es un archivo C# con:
- `Up()`: cambios a aplicar (CREATE TABLE, ALTER COLUMN, etc.)
- `Down()`: cómo revertirlos (DROP TABLE, etc.)

Al arrancar la app, `db.Database.MigrateAsync()` aplica automáticamente todas las migraciones pendientes. Historial de migraciones del proyecto:

1. `InitialCreate` — Schema inicial
2. `Phase1_RenameClientsToCompanies_AddClientsTable` — Renombrado + tabla Users
3. `Phase2_AddIdentityTables` — Tablas de Identity
4. `Phase4_AddRefreshTokens` — Tabla RefreshTokens
5. `Phase6_RenameClientsToUsers` — Renombrado definitivo
6. `Phase7_AddEmailOtpCodes` — Tabla EmailOtpCodes
7. `Phase8_RemoveCompanyStatus_UniqueCompanyName` — Status y nombre único
8. `Phase9_AddTotpToApplicationUser` — Campos TOTP en AspNetUsers
9. `Phase10_AddCleanupIndexes` — Índices de rendimiento para limpieza
10. `Phase11_AddCompanyContactFields` — Email, teléfono, dirección en empresas
11. `AddTotpBackupCodes` — Campo TotpBackupCodes en AspNetUsers

---

## 5. Backend — capa por capa

### 5.1 Program.cs — el punto de entrada

`Program.cs` es el archivo que arranca toda la aplicación. En .NET 6+ usa el patrón "minimal hosting" donde todo va en un único archivo. Tiene tres grandes secciones:

#### Sección 1: Registro de servicios (builder)

```
builder.Services.AddX() — registra servicios en el contenedor de DI
```

**Contenedor de Inyección de Dependencias (DI)**: Sistema que gestiona la creación y ciclo de vida de objetos. Cuando un controlador necesita `IAuthService`, el contenedor automáticamente crea la instancia correcta e inyecta sus propias dependencias. Hay tres ciclos de vida:
- `Singleton`: una instancia para toda la app
- `Scoped`: una instancia por request HTTP
- `Transient`: una nueva instancia cada vez que se pide

Los servicios de negocio (`AuthService`, `CompanyService`, `UserService`) se registran como `Scoped` — una instancia por request.

**Configuración de Identity**:
```csharp
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options => {
    options.Password.RequireUppercase = true;       // Mínimo una mayúscula
    options.Password.RequireDigit = true;           // Mínimo un número
    options.Password.RequireNonAlphanumeric = true; // Mínimo un especial
    options.Password.RequiredLength = 8;            // 8 caracteres mínimo
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(1); // 1 min bloqueado
    options.Lockout.MaxFailedAccessAttempts = 5;    // 5 intentos antes de bloquear
    options.User.RequireUniqueEmail = true;         // Email único en AspNetUsers
})
```

**Configuración de JWT**:
```csharp
builder.Services.AddAuthentication().AddJwtBearer(options => {
    options.TokenValidationParameters = new TokenValidationParameters {
        ValidateIssuer = true,           // Verifica que el JWT fue emitido por nosotros
        ValidateAudience = true,         // Verifica que el JWT es para nuestra app
        ValidateLifetime = true,         // Verifica que no está caducado
        ValidateIssuerSigningKey = true, // Verifica la firma criptográfica
        ClockSkew = TimeSpan.Zero,       // Sin margen de tiempo — expira exacto
        RoleClaimType = "role"           // El claim que identifica el rol
    };
    
    // Leer el token desde la cookie HttpOnly
    options.Events.OnMessageReceived = ctx => {
        var cookie = ctx.Request.Cookies["accessToken"];
        if (!string.IsNullOrEmpty(cookie)) ctx.Token = cookie;
    };
    
    // Validar el SecurityStamp en cada request
    options.Events.OnTokenValidated = async ctx => {
        var user = await userManager.FindByIdAsync(userId);
        if (tokenStamp != user.SecurityStamp)
            ctx.Fail("Sesión invalidada");
    };
});
```

**Por qué `ClockSkew = TimeSpan.Zero`**: Por defecto JWT tiene 5 minutos de margen para compensar relojes desincronizados entre servidores. Al ponerlo a cero, el token expira exactamente cuando dice. En nuestra app solo hay un servidor, así que no hay problema.

**Rate Limiting**:
```csharp
options.AddPolicy("auth", httpContext =>
    RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString(),
        factory: _ => new FixedWindowRateLimiterOptions {
            PermitLimit = 5,                    // 5 peticiones
            Window = TimeSpan.FromMinutes(1),    // por minuto
        }
    ));
```

La política `"auth"` se aplica a nivel de clase en `AuthController` con `[EnableRateLimiting("auth")]`. Excepto `/auth/me` que tiene `[DisableRateLimiting]` ya que es solo lectura.

**CORS**:
```csharp
policy.WithOrigins(corsOrigins)  // Solo localhost:4200 en desarrollo
      .AllowAnyMethod()
      .AllowAnyHeader()
      .AllowCredentials();       // Imprescindible para que las cookies se envíen
```

`AllowCredentials()` es crítico: sin él, el navegador no envía las cookies HttpOnly en requests cross-origin.

#### Sección 2: Pipeline HTTP (app)

El orden del pipeline importa — cada middleware procesa el request en orden y pasa al siguiente:

```
1. UseExceptionHandler     → captura excepciones no controladas, las convierte en respuestas JSON
2. UseStaticFiles          → sirve archivos de wwwroot/ (logos de empresas)
3. UseHsts (solo prod)     → añade header Strict-Transport-Security
4. UseHttpsRedirection     → redirige HTTP a HTTPS
5. UseCors                 → aplica política CORS
6. UseRateLimiter          → aplica rate limiting
7. UseAuthentication       → verifica JWT, establece HttpContext.User
8. UseAuthorization        → verifica permisos según [Authorize] attributes
9. MapControllers          → enruta requests a controladores
```

**Por qué UseAuthentication antes que UseAuthorization**: Authentication establece quién eres, Authorization decide qué puedes hacer. Deben ir en ese orden.

#### Sección 3: Endpoints de desarrollo

Solo accesibles cuando `ASPNETCORE_ENVIRONMENT = Development`:

- `POST /api/dev/seed-companies?count=N` — Crea N empresas con nombres aleatorios de una lista predefinida
- `POST /api/dev/seed-users?count=N` — Crea N usuarios con sus `ApplicationUser` correspondientes (pass: `Temporal@2026!`)
- `DELETE /api/dev/delete-all-users` — Borra todos los usuarios y sus cuentas de Identity
- `GET /api/dev/last-otp?email=X` — Devuelve el último OTP generado para ese email (lee de `DevOtpStore`)

`DevOtpStore` es un `ConcurrentDictionary<string, string>` estático que guarda en memoria el último OTP generado para cada email. Solo se usa en Development para que el endpoint anterior pueda devolver el código sin necesitar abrir smtp4dev.

### 5.2 Modelos

Los modelos son las clases C# que representan las tablas de la BD.

#### `Company.cs`
```csharp
public class Company {
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string? LogoFileName { get; set; }      // null si no tiene logo
    public CompanyStatus Status { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<User> Users { get; set; }   // navegación — lista de usuarios
}

public enum CompanyStatus { Active, Prospect, Inactive, Churned }
```

#### `User.cs`
```csharp
public class User {
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public int CompanyId { get; set; }
    public Company Company { get; set; }           // navegación a la empresa
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

#### `ApplicationUser.cs`
Hereda de `IdentityUser` (que ya tiene Id, UserName, Email, PasswordHash, etc.):
```csharp
public class ApplicationUser : IdentityUser {
    public int? UserId { get; set; }              // null para SuperAdmin
    public User? User { get; set; }               // navegación
    public DateTime CreatedAt { get; set; }
    public string? TotpSecret { get; set; }       // clave TOTP en Base32
    public bool TotpEnabled { get; set; }
    public string? TotpBackupCodes { get; set; }  // JSON: ["hash1","hash2",...]
}
```

#### `RefreshToken.cs`
```csharp
public class RefreshToken {
    public int Id { get; set; }
    public string Token { get; set; }
    public string UserId { get; set; }
    public ApplicationUser User { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByToken { get; set; }
    public bool IsActive => RevokedAt == null && ExpiresAt > DateTime.UtcNow;
}
```

#### `EmailOtpCode.cs`
```csharp
public class EmailOtpCode {
    public int Id { get; set; }
    public string UserId { get; set; }
    public ApplicationUser User { get; set; }
    public string CodeHash { get; set; }          // SHA256 del código
    public DateTime ExpiresAt { get; set; }       // 30 segundos
    public bool IsUsed { get; set; }
    public int Attempts { get; set; }             // máximo 3
    public DateTime CreatedAt { get; set; }
}
```

### 5.3 DTOs (Data Transfer Objects)

Los DTOs son clases simples que definen la forma de los datos en los requests y responses de la API. Separan el modelo de BD de lo que se expone al exterior.

#### `AuthDtos.cs`

**LoginDto** — lo que envía el frontend al hacer login:
```csharp
{ Email: string, Password: string }
```

**LoginResponseDto** — lo que devuelve el endpoint de login:
```csharp
{
    RequiresMfa: bool,          // true si necesita 2FA
    MfaEmail: string?,          // email al que se mandó el OTP
    MfaType: string?,           // "email" o "totp"
    OtpExpiresAt: DateTime?,    // cuándo expira el OTP (para el timer del frontend)
    // Tokens van en cookies HttpOnly, NO en el body → [JsonIgnore]
    // Identidad (cuando RequiresMfa = false):
    Email: string?,
    Role: string?,
    TotpEnabled: bool
}
```

**TokenResponseDto** — respuesta interna que incluye los tokens (usada en MFA verify, TOTP confirm, refresh):
```csharp
{
    AccessToken: string,        // [JsonIgnore] → va a cookie
    RefreshToken: string,       // [JsonIgnore] → va a cookie
    ExpiresAt: DateTime,
    UserEmail: string,
    Role: string,
    TotpEnabled: bool,
    BackupCodes: List<string>?  // solo cuando se confirma TOTP por primera vez
}
```

**IdentityDto** — devuelto en GET /auth/me:
```csharp
{ Email: string, Role: string, TotpEnabled: bool, UserId: string? }
```

**MfaVerifyDto** — para verificar 2FA:
```csharp
{ Email: string, Code: string }  // Code: 6 dígitos TOTP/OTP o 9 chars backup (xxxx-xxxx)
```

**TotpSetupResponseDto** — resultado de iniciar setup TOTP:
```csharp
{ QrUri: string, Secret: string }  // QrUri para generar QR, Secret para entrada manual
```

#### `CompanyDtos.cs`

**CreateCompanyDto / UpdateCompanyDto**:
```csharp
{ Name, Description, Status?, ContactEmail?, ContactPhone?, Address?, Logo?: IFormFile }
```

**CompanyResponseDto** — lo que devuelve la API:
```csharp
{ Id, Name, Description, LogoUrl, Status, ContactEmail, ContactPhone, Address, CreatedAt, UpdatedAt, UsersCount }
```

**PagedResponseDto<T>** — wrapper para respuestas paginadas:
```csharp
{ Data: IEnumerable<T>, TotalItems: int, TotalPages: int, CurrentPage: int, PageSize: int }
```

#### `UserDtos.cs`

**CreateUserDto**: `{ Name, Email, CompanyId, Password }`
**UpdateUserDto**: `{ Name, Email, CompanyId }` (sin contraseña — hay endpoint separado para cambiarla)
**UserResponseDto**: `{ Id, Name, Email, CompanyId, CompanyName, CreatedAt, UpdatedAt }`

### 5.4 Servicios

Los servicios contienen toda la lógica de negocio. Los controladores son finos — reciben el request, llaman al servicio, devuelven el resultado.

#### `AuthService.cs`

El servicio más complejo. Maneja todo el flujo de autenticación.

**`LoginAsync(LoginDto dto)`**:
1. Busca el usuario por email en Identity (`FindByEmailAsync`)
2. Comprueba si está bloqueado (`IsLockedOutAsync`) → 423
3. Verifica contraseña (`CheckPasswordAsync`) → 401 si falla, incrementa `AccessFailedCount`
4. Si la contraseña es correcta, resetea el contador de fallos
5. Determina el tipo de MFA necesario según el rol:
   - SuperAdmin con TOTP: devuelve `requiresMfa=true, mfaType="totp"`
   - SuperAdmin sin TOTP: emite tokens directamente (para que pueda ir a configurar TOTP)
   - Cliente: genera OTP de 6 dígitos, lo hashea con SHA256, lo guarda en `EmailOtpCodes`, lo envía por email, devuelve `requiresMfa=true, mfaType="email"`

**Generación del OTP**:
```csharp
var bytes = new byte[4];
RandomNumberGenerator.Fill(bytes);  // 4 bytes aleatorios criptográficamente seguros
var code = (Math.Abs(BitConverter.ToInt32(bytes, 0)) % 1_000_000).ToString("D6");
// "D6" garantiza 6 dígitos con ceros a la izquierda (ej: "004521")
```

**`MfaVerifyAsync(MfaVerifyDto dto)`**:

Para SuperAdmin (TOTP o backup code):
1. Si el código tiene 8 caracteres sin guión (o 9 con): es un código de respaldo
   - Hashea el código normalizado (sin guión) con SHA256
   - Busca el hash en el JSON de `TotpBackupCodes`
   - Si coincide, elimina ese hash de la lista (uso único) y guarda
2. Si tiene 6 dígitos: es un código TOTP normal
   - Verifica con `Totp.VerifyTotp(DateTime.UtcNow, code, out _, VerificationWindow.RfcSpecifiedNetworkDelay)`
   - `RfcSpecifiedNetworkDelay` permite ±1 ventana de 30 segundos para compensar relojes

Para Cliente (Email OTP):
1. Busca el OTP más reciente no usado y no expirado para ese usuario
2. Si `Attempts >= 3`: marca como usado, devuelve 401
3. Hashea el código recibido, compara con el hash almacenado
4. Si no coincide: incrementa `Attempts`, devuelve 401 con intentos restantes
5. Si coincide: marca como usado

En ambos casos, si la verificación es correcta:
- Genera access token (JWT 15 min)
- Crea refresh token (32 bytes aleatorios en Base64, 24h)
- Devuelve `TokenResponseDto`

**`GenerateAccessToken(ApplicationUser user, string role, out DateTime expiresAt)`**:
```csharp
var claims = new List<Claim> {
    new(JwtRegisteredClaimNames.Sub, user.Id),      // ID del usuario
    new(JwtRegisteredClaimNames.Email, user.Email), // Email
    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // ID único del token
    new("role", role),                               // Rol del usuario
    new("securityStamp", user.SecurityStamp)         // Para invalidación
};

// Para SuperAdmin: añade totpEnabled
// Para Cliente: añade userId (ID en tabla Users)
```

El token se firma con HMAC-SHA256 usando la `Jwt:SecretKey`. Expira en 15 minutos.

**`RefreshAsync(string refreshToken)`**:
1. Busca el refresh token en BD con el usuario incluido (`Include(r => r.User)`)
2. Verifica que `IsActive` (no revocado y no expirado)
3. Genera nuevos access y refresh tokens
4. Revoca el token antiguo: `stored.RevokedAt = DateTime.UtcNow`, `stored.ReplacedByToken = newToken`
5. Guarda en BD y devuelve los nuevos tokens

**`TotpConfirmAsync(string userId, string code)`**:
1. Verifica el código TOTP contra la semilla guardada
2. Genera 8 códigos de respaldo: `4 bytes aleatorios → hex → "xxxx-xxxx"`
3. Hashea cada código (sin guión) con SHA256
4. Guarda los hashes como JSON en `TotpBackupCodes`
5. Activa `TotpEnabled = true`
6. Devuelve los códigos en texto plano (solo esta vez) en la respuesta

**`ResetPasswordAsync(ResetPasswordDto dto)`**:
1. Verifica el token con `_userManager.ResetPasswordAsync(user, dto.Token, dto.NewPassword)`
2. Identity internamente actualiza el hash de contraseña Y el `SecurityStamp`
3. Como el `SecurityStamp` cambia, todos los JWT en circulación con el stamp antiguo son invalidados inmediatamente en el `OnTokenValidated`
4. Revoca todos los refresh tokens activos del usuario

#### `CompanyService.cs`

**`CreateAsync(CreateCompanyDto dto, IFormFile? logo)`**:
1. Sanitiza el nombre (HtmlDecode + Trim)
2. Verifica unicidad del nombre
3. Si hay email: verifica que no está en uso por otra empresa ni por ningún usuario
4. Si hay logo: valida y guarda el archivo
5. Crea la empresa en BD

**Validación del logo** (`SaveLogoAsync`):
1. Tamaño máximo: 5 MB
2. Extensiones permitidas: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
3. Content-type permitido (validación superficial)
4. **Magic bytes** — los primeros bytes del archivo identifican el tipo real independientemente de la extensión:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47`
   - GIF: `47 49 46 38`
   - WebP: bytes 8-11 son `57 45 42 50`
5. Si pasa todas las validaciones, se guarda con nombre UUID en `wwwroot/uploads/`

Los magic bytes son críticos: sin ellos, un atacante podría renombrar un archivo `.php` como `.jpg` y subirlo. Con magic bytes, el servidor verifica el contenido real del archivo.

**`UpdateAsync`**: igual que crear pero excluye la propia empresa en la validación de nombre único.

**`DeleteAsync`**: elimina el archivo de logo de disco antes de borrar el registro.

#### `UserService.cs`

**`CreateAsync(CreateUserDto dto)`**:
1. Verifica que la empresa existe
2. Normaliza el email (Trim + ToLowerInvariant)
3. Verifica unicidad del email contra Users Y Companies
4. **Abre una transacción**
5. Crea el `User` en la tabla `Users`
6. Crea el `ApplicationUser` en `AspNetUsers` con el mismo email, `UserId = user.Id` recién generado
7. Asigna el rol "Cliente" al `ApplicationUser`
8. **Commit de la transacción**

El uso de transacción garantiza que si falla cualquier paso (ej: el email ya está en Identity aunque pasó la validación por race condition), todo se revierte. No puede existir un `User` sin su `ApplicationUser` correspondiente.

**`UpdateAsync(int id, UpdateUserDto dto)`**:
1. Si el email cambia: verifica unicidad contra Users (excluyendo el actual) y Companies
2. **Abre una transacción**
3. Actualiza el `User` en BD
4. Si el email cambió: busca el `ApplicationUser` por el email antiguo y llama a `SetEmailAsync` + `SetUserNameAsync`
5. **Commit**

`SetEmailAsync` de Identity actualiza `Email`, `NormalizedEmail` y `SecurityStamp`. `SetUserNameAsync` actualiza `UserName` y `NormalizedUserName`.

#### `EmailService.cs`

Envuelve MailKit. Construye un `MimeMessage` y lo envía via SMTP. En desarrollo usa smtp4dev en `localhost:2525` con `SecureSocketOptions.None` (sin TLS, porque smtp4dev es local y no lo necesita). En producción se cambiaría a `SecureSocketOptions.Auto` con un servidor SMTP real.

#### `CleanupHostedService.cs`

Servicio background que implementa `BackgroundService`. Se registra como `Singleton` y arranca automáticamente con la app.

Cada hora:
1. Borra todos los `EmailOtpCodes` con `ExpiresAt < now`
2. Borra todos los `RefreshTokens` con `ExpiresAt < now`
3. Registra cuántos borró en cada operación

Usa `ExecuteDeleteAsync()` de EF Core que genera un `DELETE FROM` directo sin cargar los registros en memoria.

### 5.5 Controladores

Los controladores son la interfaz HTTP de la API. Reciben requests, delegan en servicios y devuelven responses.

**Convención global**: todas las excepciones no controladas pasan por el `UseExceptionHandler` de Program.cs, que las convierte en:
- `ArgumentException` → 400 Bad Request
- `KeyNotFoundException` → 404 Not Found
- `AccountLockedException` → 423 Locked
- `UnauthorizedAccessException` → 401 Unauthorized
- Cualquier otra → 500 Internal Server Error

Esto significa que los servicios pueden lanzar excepciones semánticas y los controladores no necesitan try/catch.

#### `AuthController.cs`

`[EnableRateLimiting("auth")]` en la clase — todos los endpoints limitan a 5 req/min por IP.

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `POST /api/auth/login` | Público | No | Verificar credenciales. Devuelve requiresMfa o tokens directamente |
| `GET /api/auth/me` | `[Authorize]` | Sí | Devuelve la identidad del usuario autenticado. `[DisableRateLimiting]` |
| `POST /api/auth/mfa-verify` | Público | No | Verificar código 2FA (email OTP o TOTP). Emite tokens en cookies |
| `POST /api/auth/refresh` | Público | No | Renovar access token usando refresh token de cookie |
| `POST /api/auth/logout` | `[Authorize]` | Sí | Revocar refresh token y borrar cookies |
| `POST /api/auth/resend-otp` | Público | No | Reenviar OTP por email |
| `POST /api/auth/forgot-password` | Público | No | Enviar email de recuperación |
| `POST /api/auth/reset-password` | Público | No | Cambiar contraseña con token del email |
| `GET /api/auth/totp/status` | `[Authorize(Roles="SuperAdmin")]` | Sí | Estado actual del TOTP |
| `GET /api/auth/totp/setup` | `[Authorize(Roles="SuperAdmin")]` | Sí | Generar QR y semilla TOTP |
| `POST /api/auth/totp/confirm` | `[Authorize(Roles="SuperAdmin")]` | Sí | Confirmar setup con primer código |
| `POST /api/auth/totp/disable` | `[Authorize(Roles="SuperAdmin")]` | Sí | Desactivar TOTP |

**SetAccessTokenCookie y SetRefreshTokenCookie**: helpers privados que añaden los tokens como cookies con:
```
HttpOnly = true      → JavaScript no puede leerlas
Secure = isProduction → Solo HTTPS en producción
SameSite = Strict    → Solo se envían en requests same-site (protege contra CSRF)
```

#### `CompaniesController.cs`

Todos los endpoints requieren `[Authorize(Roles = "SuperAdmin")]`.

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET /api/companies` | Público para auth | Lista paginada. Query: page, pageSize, name, status |
| `GET /api/companies/{id}` | SuperAdmin | Detalle de una empresa |
| `POST /api/companies` | SuperAdmin | Crear empresa. `multipart/form-data` para logo |
| `PUT /api/companies/{id}` | SuperAdmin | Actualizar empresa |
| `DELETE /api/companies/{id}` | SuperAdmin | Eliminar empresa (cascade a usuarios) |

**Paginación**: pageSize se clampea a 100 como máximo. Los parámetros llegan como query strings.

#### `UsersController.cs`

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `GET /api/users` | SuperAdmin | Lista paginada. Query: page, pageSize, name, companyId |
| `GET /api/users/{id}` | SuperAdmin | Detalle de un usuario |
| `POST /api/users` | SuperAdmin | Crear usuario + cuenta Identity |
| `PUT /api/users/{id}` | SuperAdmin | Actualizar usuario. Sincroniza email con Identity |
| `DELETE /api/users/{id}` | SuperAdmin | Eliminar usuario + cuenta Identity |
| `GET /api/users/me` | Cliente | El cliente ve solo su propio perfil |

---

## 6. Frontend — capa por capa

### 6.1 Conceptos Angular 21

**Standalone components**: En Angular 21 no hay NgModules. Cada componente se declara con `standalone: true` e importa directamente lo que necesita.

**Signals**: Sistema de reactividad de Angular. Un `signal()` es un valor reactivo. Cuando cambia, Angular actualiza automáticamente solo las partes del DOM que lo usan. Es más eficiente que Zone.js (el sistema anterior).

```typescript
count = signal(0);
doubled = computed(() => this.count() * 2);  // se recalcula cuando count cambia
// En template: {{ count() }} {{ doubled() }}
```

**inject()**: Forma moderna de obtener servicios. En lugar de declararlos en el constructor, se usan en la definición de la clase:
```typescript
private authService = inject(AuthService);
// Equivalente a: constructor(private authService: AuthService) {}
```

**OnPush change detection**: Por defecto Angular comprueba todos los componentes en cada evento. Con `OnPush`, solo comprueba cuando cambia una `@Input()` o un signal del componente. Mucho más eficiente.

**Control flow nativo**: `@if`, `@for`, `@switch` en lugar de `*ngIf`, `*ngFor`. Más eficiente y mejor ergonomía:
```html
@if (loading()) {
  <spinner />
} @else {
  <content />
}

@for (user of users(); track user.id) {
  <user-card [user]="user" />
}
```

**takeUntilDestroyed**: Operador RxJS que cancela automáticamente una suscripción cuando el componente se destruye, evitando memory leaks:
```typescript
destroyRef = inject(DestroyRef);
// ...
observable$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...)
```

**APP_INITIALIZER**: Token de Angular que ejecuta funciones antes de que la app se muestre al usuario. Se usa para hidratar el estado de autenticación desde la cookie:
```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (auth: AuthService) => () => auth.initializeAuth(),
  deps: [AuthService],
  multi: true
}
```

### 6.2 Estructura de carpetas

```
src/app/
├── app.ts                 → Componente raíz con el layout
├── app.routes.ts          → Definición de rutas
├── app.config.ts          → Configuración bootstrap
├── app.routes.constants.ts → Constantes de rutas para navegación
│
├── services/              → Lógica de acceso a la API
│   ├── auth.service.ts
│   ├── company.service.ts
│   ├── user.service.ts
│   ├── notification.service.ts
│   └── theme.service.ts
│
├── guards/                → Protección de rutas
│   ├── auth.guard.ts
│   ├── admin.guard.ts
│   └── guest.guard.ts
│
├── interceptors/          → Middleware HTTP
│   └── auth.interceptor.ts
│
├── models/                → Interfaces TypeScript
│   ├── company.model.ts
│   └── user.model.ts
│
├── constants/             → Constantes reutilizables
│   ├── password-rules.ts
│   └── roles.ts
│
├── components/            → Componentes reutilizables
│   ├── navbar/
│   ├── sidebar/
│   └── confirm-dialog/
│
└── pages/                 → Páginas completas
    ├── login/
    ├── mfa-verificar/
    ├── recuperar-password/
    ├── reset-password/
    ├── configurar-totp/
    ├── company-list/
    ├── company-detail/
    ├── company-form/
    ├── user-list/
    ├── user-detail/
    ├── user-form/
    ├── perfil/
    └── not-found/
```

### 6.3 Servicios

#### `AuthService`

El servicio central de la app. Mantiene el estado de autenticación en memoria.

**Estado**:
```typescript
private _identity = signal<Identity | null>(null);
isLoggedIn = computed(() => this._identity() !== null);
userEmail = computed(() => this._identity()?.email ?? '');
userRole = computed(() => this._identity()?.role ?? '');
totpEnabled = computed(() => this._identity()?.totpEnabled ?? false);
clientId = computed(() => this._identity()?.userId ?? null);
```

**`initializeAuth()`**: Llamado en `APP_INITIALIZER`. Hace `GET /api/auth/me`. Si devuelve 200, hidrata `_identity`. Si devuelve 401 (no autenticado), deja `_identity` en null. Este mecanismo permite que al recargar la página, Angular sepa inmediatamente si el usuario está autenticado gracias a la cookie HttpOnly que el navegador envía automáticamente.

**`login(dto)`**: Llama a `POST /api/auth/login`. Devuelve `LoginResponse` al componente para que decida qué pantalla mostrar.

**`mfaVerify(email, code, returnUrl?)`**: Llama a `POST /api/auth/mfa-verify`. Si tiene éxito, actualiza `_identity` y navega al destino correcto (returnUrl o /empresas o /perfil según el rol).

**`isSafeReturnUrl(url)`**: Validación de seguridad. Verifica que la URL de retorno es relativa (empieza por /) y no contiene `://` (evita redirecciones a dominios externos).

#### `CompanyService`

Operaciones CRUD para empresas. Convierte `CreateCompany`/`UpdateCompany` (que incluyen opcionalmente un `File`) a `FormData` para multipart upload:

```typescript
toFormData(dto: CreateCompany | UpdateCompany): FormData {
    const fd = new FormData();
    fd.append('name', dto.name);
    fd.append('description', dto.description);
    if (dto.logo) fd.append('logo', dto.logo);
    // ...
    return fd;
}
```

Todos los métodos devuelven `Observable<T>` — el patrón RxJS estándar de Angular.

#### `NotificationService`

Sistema de notificaciones persistentes basado en `localStorage`. Cuando se crea una empresa o un usuario, el componente llama a `notificationService.add()`. Las notificaciones se guardan en localStorage y sobreviven a recargas de página.

```typescript
interface StoredNotif {
    icon: string;      // nombre del icono de Material
    iconColor: string; // color del icono
    text: string;      // título
    sub: string;       // subtítulo
    date: string;      // ISO 8601
}
```

`getUnreadCount()`: compara la última fecha vista (guardada en localStorage) con las fechas de las notificaciones.

#### `ThemeService`

Gestiona el tema visual. Aplica/quita la clase `dark-mode` en `document.body`. Los componentes usan `:host-context(body.dark-mode)` en su SCSS para aplicar estilos dark de forma scoped.

```typescript
setTheme(theme: 'light' | 'dark' | 'system') {
    body.classList.remove('dark-mode', 'light-mode');
    if (theme === 'dark') body.classList.add('dark-mode');
    else if (theme === 'light') body.classList.add('light-mode');
    localStorage.setItem('theme', theme);
}
```

En modo `'system'` no añade ninguna clase — deja que el CSS media query `prefers-color-scheme` del sistema operativo sea el que mande.

### 6.4 Guards

Los guards son funciones que Angular ejecuta antes de activar una ruta. Si devuelven `false` o un `UrlTree`, la navegación se cancela o redirige.

#### `authGuard`
```typescript
() => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.isLoggedIn()) return true;
    return router.createUrlTree([ROUTES.LOGIN], {
        queryParams: { returnUrl: router.url }
    });
}
```
Protege rutas que requieren autenticación. Si no autenticado, redirige a /login con la URL actual como `returnUrl` para volver tras hacer login.

#### `adminGuard`
```typescript
() => {
    const auth = inject(AuthService);
    if (auth.userRole() !== 'SuperAdmin') return router.createUrlTree([ROUTES.PERFIL]);
    if (!auth.totpEnabled()) return router.createUrlTree([ROUTES.CONFIGURAR_TOTP]);
    return true;
}
```
Protege rutas de administración. Si el usuario es Cliente, va a /perfil. Si es SuperAdmin pero no tiene TOTP, va a /configurar-totp. Así se fuerza al SuperAdmin a configurar el 2FA antes de poder usar la app.

#### `guestGuard`
```typescript
() => {
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) return true;
    return router.createUrlTree([
        auth.userRole() === 'SuperAdmin' ? ROUTES.COMPANIES : ROUTES.PERFIL
    ]);
}
```
Para páginas de auth (login, MFA, etc.). Si ya estás autenticado, no tiene sentido ver el login.

### 6.5 Interceptor HTTP

`authInterceptor` es una función que envuelve cada petición HTTP. Se registra en `app.config.ts`:

```typescript
provideHttpClient(withInterceptors([authInterceptor]))
```

**Qué hace**:
1. Añade `withCredentials: true` a todas las peticiones → el navegador envía las cookies HttpOnly
2. Cuando recibe un 401, intenta renovar el token con `POST /api/auth/refresh`
3. Si el refresh tiene éxito, reintenta la petición original con el nuevo token
4. Si el refresh falla (token expirado), redirige al login

**Problema de concurrencia**: Si hay 3 peticiones en paralelo y todas reciben 401, no debe hacer 3 llamadas al refresh. Usa un `BehaviorSubject<boolean | null>` para serializar:
- Primer 401: `isRefreshing = true`, llama al refresh, emite el resultado
- Segundo y tercer 401: esperan al Subject con `filter(r => r !== null), take(1)`

### 6.6 Routing

```typescript
// app.routes.ts
[
    { path: 'login',               component: LoginComponent,     canActivate: [guestGuard] },
    { path: 'mfa-verificar',       component: MfaVerificarComponent, canActivate: [guestGuard] },
    { path: 'recuperar-password',  component: RecuperarPasswordComponent, canActivate: [guestGuard] },
    { path: 'reset-password',      component: ResetPasswordComponent, canActivate: [guestGuard] },
    { path: 'empresas',            component: CompanyListComponent, canActivate: [authGuard, adminGuard] },
    { path: 'empresas/:id',        component: CompanyDetailComponent, canActivate: [authGuard, adminGuard] },
    { path: 'empresas/nueva',      component: CompanyFormComponent, canActivate: [authGuard, adminGuard] },
    { path: 'empresas/:id/editar', component: CompanyFormComponent, canActivate: [authGuard, adminGuard] },
    { path: 'usuarios',            component: UserListComponent, canActivate: [authGuard, adminGuard] },
    // ... más rutas
    { path: 'perfil',              component: PerfilComponent, canActivate: [authGuard] },
    { path: 'configurar-totp',     component: ConfigurarTotpComponent, canActivate: [authGuard] },
    { path: '**',                  component: NotFoundComponent }
]
```

Todos los componentes se cargan con lazy loading: `loadComponent: () => import('./...').then(m => m.ComponentClass)`. Esto significa que el código de cada componente solo se descarga cuando el usuario navega a esa ruta, reduciendo el bundle inicial.

**`onSameUrlNavigation: 'reload'`**: Navegar a la misma URL recarga el componente. Útil después de crear/editar una entidad para refrescar los datos.

### 6.7 Componente raíz (App)

`app.ts` es el layout principal. Determina qué shell mostrar:

```typescript
isFullscreen = computed(() => {
    const fullscreenRoutes = ['/login', '/mfa-verificar', '/recuperar-password', '/reset-password', '/configurar-totp'];
    return fullscreenRoutes.some(r => this.router.url.startsWith(r));
});
isSuperAdmin = computed(() => this.authService.userRole() === 'SuperAdmin');
```

- **Fullscreen** (páginas de auth): solo el contenido, sin navbar ni sidebar
- **SuperAdmin**: sidebar de navegación (Empresas, Usuarios) + navbar con notificaciones
- **Cliente**: navbar simplificada con logout + avatar

### 6.8 Páginas principales

#### Login

Diseño de dos paneles: izquierda con branding animado, derecha con el formulario. En móvil el panel de branding desaparece.

Flujo:
1. Usuario introduce email y contraseña
2. `authService.login()` → si `requiresMfa: false`: ya está dentro → navega
3. Si `requiresMfa: true`: guarda `mfaType` y navega a `/mfa-verificar?email=X&mfaType=Y`
4. Si `mfaType = "email"`: guarda `otpExpiresAt` en `sessionStorage` para sincronizar el timer

Manejo de errores especiales:
- 423: cuenta bloqueada → mensaje específico
- 429: rate limit → mensaje de "demasiados intentos"

#### MFA Verificar

Maneja dos flujos con la misma pantalla:

**Email OTP**:
- Input de 6 dígitos con auto-avance (al escribir un dígito, el foco pasa al siguiente)
- Soporte de pegado: si pegas "123456", se distribuye en los 6 campos
- Timer countdown sincronizado con `otpExpiresAt` de sessionStorage
- Botón "Reenviar" con cooldown de 30 segundos
- Al expirar el timer: muestra "código expirado" y botón para volver al login

**TOTP (Google Authenticator)**:
- Mismos 6 campos
- Sin timer (los códigos se regeneran solos cada 30 segundos en la app)
- Botón "¿Perdiste el acceso? Usa un código de respaldo" que muestra un input de texto para `xxxx-xxxx`

#### Configurar TOTP

Tiene 5 estados:

1. **Loading**: spinner mientras comprueba `GET /api/auth/totp/status`
2. **Inactivo**: muestra botón "Activar autenticación en dos pasos"
3. **Setup**: tras llamar a `GET /api/auth/totp/setup`:
   - Genera QR con la librería `qrcode` (npm) a partir del `qrUri`
   - Muestra la clave secreta en texto para quienes no pueden escanear el QR
   - Botón de copiar la clave
   - Input de 6 dígitos para confirmar
4. **Confirmado**: tras `POST /api/auth/totp/confirm`:
   - Muestra los 8 códigos de respaldo en formato `xxxx-xxxx`
   - Botón "Copiar todos"
   - Aviso de guardarlos en lugar seguro
5. **Activo**: muestra estado activo y botón "Desactivar"

#### Company List

La más compleja del frontend. Lista empresas con un panel lateral deslizante.

- **Paginación**: 5/10/25 items por página
- **Búsqueda**: debounce de 300ms para no llamar a la API en cada tecla
- **Filtro por estado**: dropdown con los 4 estados
- **Panel lateral**: al hacer clic en una fila, se abre un panel con pestañas:
  - **Resumen**: estadísticas (usuarios, actividad reciente, años activa)
  - **Usuarios**: lista de hasta 8 usuarios de esa empresa
  - **Info**: datos de contacto
  - **Configuración**: botones de editar/eliminar

**Métodos de utilidad**:
- `generateDomain(name)`: infiere el dominio probable (ej: "Acme Corp" → "acmecorp.com")
- `yearsActive(createdAt)`: calcula años activa
- `daysSinceUpdate(updatedAt)`: días desde última actualización
- `initials(name)`: primeras letras del nombre para el avatar

#### Company Form

Formulario reactivo con `fb.nonNullable.group`. En modo edición (`/empresas/:id/editar`), carga los datos actuales con `patchValue()`.

El logo usa un input de tipo `file` personalizado — al seleccionar un archivo, se previsualiza con `URL.createObjectURL()`.

Validaciones: name (2-200), description (10-2000), contactEmail (formato email), contactPhone (max 30), address (max 300).

---

## 7. Seguridad completa

### 7.1 Capas de seguridad

La seguridad está en capas. Un atacante tiene que superar todas para causar daño:

```
Capa 1: HTTPS + HSTS (transporte)
Capa 2: CORS (origen del request)
Capa 3: Rate Limiting (frecuencia de requests)
Capa 4: Autenticación (¿quién eres?)
Capa 5: Autorización (¿qué puedes hacer?)
Capa 6: Validación de entrada (¿qué datos envías?)
Capa 7: Validación de archivos (magic bytes)
Capa 8: Sanitización de outputs
```

### 7.2 Autenticación con JWT en cookie HttpOnly

**Problema**: Si el JWT va en localStorage, un script malicioso inyectado (XSS) puede robarlo.

**Solución**: JWT en cookie HttpOnly. El navegador lo envía automáticamente pero JavaScript no puede leerlo.

**Configuración de las cookies**:
```csharp
new CookieOptions {
    HttpOnly = true,    // JavaScript no puede acceder
    Secure = true,      // Solo HTTPS (en producción)
    SameSite = SameSiteMode.Strict,  // Solo same-site
    Expires = DateTimeOffset.UtcNow.AddMinutes(15)
}
```

`SameSite = Strict` significa que la cookie solo se envía en requests que originan desde el mismo sitio. Esto protege contra CSRF (Cross-Site Request Forgery): si alguien en otro dominio intenta hacer una petición a nuestra API, el navegador no adjuntará la cookie.

### 7.3 Security Stamp — invalidación inmediata de sesiones

**Problema**: El JWT dura 15 minutos. Si alguien cambia su contraseña tras un robo de sesión, el atacante podría seguir usando el JWT durante esos 15 minutos.

**Solución**: El `SecurityStamp` de Identity es un GUID que cambia automáticamente al cambiar la contraseña. Se incluye como claim en el JWT y se verifica en cada request:

```csharp
options.Events.OnTokenValidated = async ctx => {
    var tokenStamp = ctx.Principal?.FindFirst("securityStamp")?.Value;
    var user = await userManager.FindByIdAsync(userId);
    if (tokenStamp != user.SecurityStamp)
        ctx.Fail("Sesión invalidada");  // → 401
};
```

Esto convierte el acceso a la BD en cada request (aparente punto negativo) en una garantía de seguridad total.

### 7.4 Refresh Token — rotación y revocación

**Por qué refresh tokens**: El access token (JWT) dura 15 minutos para limitar el daño si es interceptado. Pero obligar al usuario a hacer login cada 15 minutos sería horrible UX. Los refresh tokens (24h) permiten renovar el access token silenciosamente.

**Rotación**: Cada vez que se usa un refresh token, se revoca y se genera uno nuevo. Si un atacante roba un refresh token pero el usuario legítimo lo usa primero, el atacante queda bloqueado. Si el atacante lo usa primero, el usuario legítimo recibirá un 401 al intentar refrescar y sabrá que hay una sesión comprometida.

**El token**: 32 bytes aleatorios de `RandomNumberGenerator.Fill()` codificados en Base64. Esto da `2^256` posibilidades — imposible de forzar bruta.

**Al cambiar contraseña**: Se revocan todos los refresh tokens activos además de invalidar el security stamp.

### 7.5 TOTP (Autenticación en dos factores para SuperAdmin)

**Cómo funciona**:
1. Setup: el servidor genera 20 bytes aleatorios (`KeyGeneration.GenerateRandomKey(20)`), los convierte a Base32 y construye un URI `otpauth://totp/ClientManager:email?secret=X&...`
2. El usuario escanea el QR con Google Authenticator
3. Ahora ambos (servidor y app) pueden generar el mismo código: `HOTP(secret, floor(time/30))`
4. La ventana de validación `RfcSpecifiedNetworkDelay` permite ±1 período (±30 segundos) para compensar diferencias de reloj

**Backup codes**: Al confirmar TOTP, se generan 8 códigos de formato `xxxx-xxxx` (4 bytes aleatorios como hex). Se almacenan hasheados con SHA256. Si el usuario pierde el teléfono, puede usar uno de estos códigos (que se consume al usarse).

### 7.6 Email OTP para clientes

**Flujo**:
1. El servidor genera 4 bytes con `RandomNumberGenerator.Fill()` y los convierte a un número de 6 dígitos
2. Hashea el código con SHA256 y guarda el hash en BD
3. Envía el código en texto plano por email
4. Al verificar: hashea el código recibido y lo compara con el hash almacenado

**Protecciones**:
- Código expira en 30 segundos
- Máximo 3 intentos antes de invalidar
- OTPs anteriores se invalidan al generar uno nuevo
- El código nunca se guarda en texto plano en la BD

**Anti-enumeración**: `/api/auth/forgot-password` siempre devuelve 200 con "Si el email existe, recibirás...". Si devolviera 404 para emails no registrados, un atacante podría saber qué emails están registrados.

### 7.7 Rate Limiting

5 peticiones por minuto por IP en todos los endpoints de `/api/auth/*`. Excepto `/auth/me` que está exento.

Esto hace que:
- Brute force de contraseñas: tomaría años
- Brute force de OTPs (1.000.000 combinaciones): incluso a 5/min tomaría siglos
- DDoS: limitado aunque no eliminado (se necesitaría un WAF para eso)

### 7.8 Lockout de cuentas

Tras 5 intentos fallidos de login, la cuenta se bloquea 1 minuto (`LockoutTimeSpan`). El contador se resetea al hacer login correcto. Esto añade una capa adicional contra brute force incluso si alguien consigue burlar el rate limiting.

### 7.9 CORS

Solo `http://localhost:4200` puede hacer peticiones cross-origin a la API (en desarrollo). En producción se configura el dominio real.

`AllowCredentials()` es obligatorio para que las cookies se envíen en requests cross-origin.

### 7.10 Validación de archivos con magic bytes

```csharp
private static readonly Dictionary<string, byte[][]> MagicBytes = new() {
    { ".jpg",  [new byte[] { 0xFF, 0xD8, 0xFF }] },
    { ".png",  [new byte[] { 0x89, 0x50, 0x4E, 0x47 }] },
    { ".gif",  [new byte[] { 0x47, 0x49, 0x46, 0x38 }] },
    { ".webp", [...] }
};
```

Se leen los primeros bytes del archivo subido y se comparan con las signatures conocidas. Un archivo `.php` renombrado como `.jpg` tendría los magic bytes de PHP, no de JPEG, y sería rechazado.

### 7.11 Unicidad global de emails

Los emails son únicos en toda la aplicación: no puede existir el mismo email en `Users` (contactos) y en `Companies.ContactEmail`. Esto se valida en los servicios antes de crear/actualizar, con consultas a ambas tablas.

### 7.12 Secretos — nunca en el repositorio

La JWT key, contraseña de BD y contraseña del SuperAdmin se almacenan en:
- **Desarrollo**: User Secrets de .NET (`~/.microsoft/usersecrets/{id}/secrets.json`)
- **IIS**: variables de entorno en `web.config`

`appsettings.json` está en el repositorio pero no contiene valores sensibles.

---

## 8. Flujos completos de usuario

### 8.1 Login SuperAdmin con TOTP

```
1. Usuario → POST /api/auth/login { email, password }
2. API: verifica credenciales → RequiresMfa=true, MfaType="totp"
3. Frontend: navega a /mfa-verificar?mfaType=totp&email=X
4. Usuario → introduce código de Google Authenticator
5. Frontend → POST /api/auth/mfa-verify { email, code }
6. API: verifica TOTP → genera tokens → SetCookie(accessToken) + SetCookie(refreshToken)
7. Frontend: actualiza _identity signal → navega a /empresas
```

Si el SuperAdmin no tiene TOTP configurado:
```
2. API: RequiresMfa=false → emite tokens directamente
7. adminGuard: totpEnabled=false → redirige a /configurar-totp
```

### 8.2 Login Cliente con Email OTP

```
1. Usuario → POST /api/auth/login { email, password }
2. API: genera OTP → lo hashea → guarda en BD → envía email → RequiresMfa=true, MfaType="email"
3. Frontend: guarda otpExpiresAt en sessionStorage → navega a /mfa-verificar?mfaType=email
4. Frontend: muestra timer countdown sincronizado con otpExpiresAt
5. Usuario → introduce código del email
6. Frontend → POST /api/auth/mfa-verify { email, code }
7. API: hashea code recibido → compara con hash en BD → ok → genera tokens → SetCookie
8. Frontend: actualiza _identity → navega a /perfil
```

### 8.3 Renovación silenciosa de token

```
1. Usuario hace cualquier acción que genera un request HTTP
2. Si el accessToken (15 min) ha expirado: API devuelve 401
3. authInterceptor detecta 401 → llama a POST /api/auth/refresh
4. API: verifica refreshToken cookie → genera nuevos access y refresh tokens
5. Navegador recibe nuevas cookies → authInterceptor reintenta la petición original
6. El usuario no nota nada — la acción se completa normalmente
```

### 8.4 Cambio de contraseña (reset)

```
1. Usuario → POST /api/auth/forgot-password { email }
2. API: genera token de reset → construye URL → envía email
3. Email contiene: http://localhost:4200/reset-password?email=X&token=Y
4. Usuario hace clic → /reset-password se carga → lee email y token de URL
5. Componente: hace router.navigate para limpiar URL (token desaparece del historial)
6. Usuario introduce nueva contraseña
7. Frontend → POST /api/auth/reset-password { email, token, newPassword }
8. API: Identity.ResetPasswordAsync() → actualiza hash + SecurityStamp
9. Todos los JWT con el stamp antiguo → 401 inmediato en OnTokenValidated
10. Se revocan todos los refresh tokens activos
11. Usuario debe hacer login de nuevo
```

### 8.5 Crear una empresa

```
1. SuperAdmin navega a /empresas/nueva
2. Rellena el formulario (name, description, status, contactEmail, logo)
3. CompanyService.toFormData() convierte el DTO a FormData (necesario para subir archivo)
4. Frontend → POST /api/companies (multipart/form-data)
5. API: sanitiza inputs → verifica nombre único → verifica email único → valida logo (magic bytes) → guarda archivo → crea empresa en BD
6. API devuelve CompanyResponseDto
7. Frontend: crea notificación → navega a /empresas
```

### 8.6 Crear un usuario

```
1. SuperAdmin navega a /usuarios/nuevo
2. Rellena formulario (name, email, companyId, password)
3. Frontend → POST /api/users { name, email, companyId, password }
4. API: verifica empresa existe → normaliza email → verifica email único (Users + Companies)
5. Inicia transacción:
   a. Crea User en tabla Users
   b. Crea ApplicationUser en AspNetUsers con el mismo email
   c. Asigna rol "Cliente"
   d. Commit
6. API devuelve UserResponseDto
7. Frontend: notificación → navega al listado
```

---

## 9. Tests de integración

### 9.1 Qué son y por qué

Los tests de integración arrancan la aplicación real en memoria (sin abrir puertos de red) y hacen peticiones HTTP reales contra ella. Prueban el sistema completo: routing, autenticación, servicios, base de datos.

A diferencia de los tests unitarios (que prueban funciones aisladas), los de integración verifican que todo funciona junto. Un test de unidad puede pasar aunque la integración falle.

### 9.2 Stack de testing

- **xUnit**: framework de tests para .NET. Los tests son métodos marcados con `[Fact]`
- **WebApplicationFactory**: de `Microsoft.AspNetCore.Mvc.Testing`. Arranca la API en memoria
- **Respawn**: resetea la BD a un estado limpio entre tests. Borra todas las filas excepto las que se indique ignorar
- **FluentAssertions**: assertions más legibles: `.Should().Be(HttpStatusCode.OK)`
- **Npgsql**: acceso directo a PostgreSQL para que Respawn pueda limpiar la BD

### 9.3 Arquitectura de tests

**`CustomWebApplicationFactory`**: hereda de `WebApplicationFactory<Program>`. Sobreescribe la configuración para:
- Apuntar a la BD de tests (`clientmanager_tests`), nunca a la de desarrollo
- Usar una JWT key de test (no los User Secrets del proyecto)
- Desactivar rate limiting (en tests, las peticiones comparten IP y llegarían al límite rápido)

**`IntegrationTestBase`**: clase base para todos los tests. Gestiona el `HttpClient` con un `CookieHandler` personalizado que replica el comportamiento del navegador (guarda las cookies del response y las envía en el siguiente request).

`IAsyncLifetime.InitializeAsync()` llama a `ResetDatabaseAsync()` antes de cada test, garantizando un estado limpio.

**Tests actuales** (todos en `AuthTests.cs`):
1. `GetCompanies_WithoutAuth_Returns401` — verifica que endpoints protegidos requieren auth
2. `Login_WithValidCredentials_Returns200` — login correcto funciona
3. `Login_WithWrongPassword_Returns401` — contraseña incorrecta es rechazada
4. `GetCompanies_AfterLogin_Returns200` — usuario autenticado puede acceder
5. `GetMe_AfterLogin_ReturnsCorrectIdentity` — identidad correcta en /auth/me
6. `Refresh_ReturnsNewAccessToken` — refresh rota el token
7. `Logout_RevokesSession_Returns401` — logout invalida la sesión

### 9.4 Ejecutar los tests

```bash
cd AplicacionAPI/ClientManager.Tests
dotnet test --verbosity normal
```

Requiere PostgreSQL corriendo localmente con la BD `clientmanager_tests` accesible.

---

## 10. Despliegue en IIS

### 10.1 Qué es IIS

Internet Information Services es el servidor web de Microsoft, incluido en Windows. En producción real, IIS actuaría como proxy inverso: recibe las peticiones, las pasa al proceso .NET (o sirve los archivos estáticos de Angular directamente).

### 10.2 Componentes del despliegue

**ASP.NET Core Hosting Bundle**: módulo que instala IIS para que pueda hospedar apps .NET. Sin él, IIS no sabe cómo ejecutar un proceso .NET. Se descarga de la página oficial de .NET.

**`AspNetCoreModuleV2`**: el módulo en sí. Se verifica con:
```powershell
Get-WebConfiguration "system.webServer/globalModules/*" | Where-Object { $_.name -like "*AspNetCore*" }
```

### 10.3 Backend en IIS

1. **Publicar**: `dotnet publish -c Release -o D:\...\publish\api`
   - Genera todos los archivos compilados listos para producción
   - Incluye el `web.config` que IIS usa para configurar el módulo ASP.NET Core

2. **Crear sitio en IIS**:
   - Nombre: `ClientManager-API`
   - Ruta física: carpeta `publish\api`
   - Puerto: 5000
   - App Pool: `ClientManager-API` con "Sin código administrado" (IIS no gestiona .NET — lo hace el Hosting Bundle)

3. **Configurar variables de entorno en `web.config`**:
```xml
<aspNetCore processPath="dotnet" arguments=".\ClientManager.API.dll" hostingModel="inprocess">
    <environmentVariables>
        <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        <environmentVariable name="Jwt__SecretKey" value="..." />
        <environmentVariable name="ConnectionStrings__DefaultConnection" value="..." />
        <environmentVariable name="SuperAdmin__Password" value="..." />
    </environmentVariables>
</aspNetCore>
```

`hostingModel="inprocess"`: el proceso .NET corre dentro del proceso de IIS (w3wp.exe). Más eficiente que `outofprocess` donde sería un proceso separado.

Los `:` de los nombres de configuración se convierten en `__` en variables de entorno — así es como .NET los interpreta.

### 10.4 Frontend en IIS

1. **Compilar**: `npm run build -- --configuration production`
   - Genera archivos estáticos en `dist/ClientManagerWeb/browser/`
   - El `environment.prod.ts` usa `apiUrl: '/api'` (relativo) si frontend y backend van en el mismo dominio, o `http://localhost:5000/api` si van en puertos distintos

2. **Crear sitio en IIS**:
   - Nombre: `ClientManager-Web`
   - Ruta física: `dist/ClientManagerWeb/browser`
   - Puerto: 4200

**IMPORTANTE — URL Rewrite para Angular Router**: Angular usa routing del lado del cliente. Si el usuario va directamente a `http://localhost:4200/empresas`, IIS buscará un archivo `empresas/index.html` que no existe. Se necesita una regla que redirija todas las peticiones a `index.html`:

```xml
<rewrite>
    <rules>
        <rule name="Angular" stopProcessing="true">
            <match url=".*" />
            <conditions logicalGrouping="MatchAll">
                <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            </conditions>
            <action type="Rewrite" url="/index.html" />
        </rule>
    </rules>
</rewrite>
```

Esto requiere el módulo **URL Rewrite** de IIS (descarga separada).

### 10.5 smtp4dev en producción local

smtp4dev es el servidor SMTP de desarrollo. En el despliegue local:

**Tarea programada de Windows**: configurada para arrancar `start-smtp4dev.bat` al iniciar sesión. El bat ejecuta:
```batch
smtp4dev --urls "http://localhost:5010" --smtpport 2525
```

- Puerto 5010: interfaz web para ver los emails interceptados
- Puerto 2525: SMTP que usa la API para enviar

En un despliegue real de producción, smtp4dev se reemplazaría por un servicio SMTP real (SendGrid, AWS SES, etc.) y se cambiaría `SecureSocketOptions.None` por `Auto`.

### 10.6 IIS arranca automáticamente

IIS es un servicio de Windows que arranca con el sistema. No es necesario abrir el Administrador de IIS para que los sitios funcionen. El Administrador es solo la herramienta de configuración.

Al reiniciar el PC:
1. Windows arranca IIS automáticamente
2. La tarea programada arranca smtp4dev al iniciar sesión
3. PostgreSQL arranca como servicio de Windows (configurado al instalarlo)
4. La app está disponible sin intervención manual

### 10.7 Actualizar tras cambios

**Backend**:
```bash
dotnet publish -c Release -o D:\...\publish\api
# IIS detecta el cambio automáticamente (file watcher interno)
# O reiniciar el sitio en IIS si hay problemas
```

**Frontend**:
```bash
npm run build -- --configuration production
# Los nuevos archivos en dist/ son servidos inmediatamente
```

---

## 11. CI/CD

### 11.1 GitHub Actions

El pipeline está en `.github/workflows/ci.yml`. Se activa en:
- Push a `master`
- Pull Request hacia `master`

**Job Backend** (ubuntu-latest):
1. Checkout del código
2. Instala .NET 10 SDK
3. `dotnet restore` — descarga dependencias NuGet
4. `dotnet build --configuration Release` — compila para producción
5. `dotnet format --verify-no-changes` — verifica que el formato es correcto

**Job Frontend** (ubuntu-latest):
1. Checkout del código
2. Instala Node 22
3. `npm ci` — instalación limpia de dependencias
4. `npm run build -- --configuration production` — build de producción

**Qué no hace** (gaps conocidos):
- No ejecuta los tests (faltaría `dotnet test` y una BD de PostgreSQL en el CI)
- No despliega en ningún servidor
- No sube artefactos

### 11.2 Estrategia de ramas

- `master`: rama principal, código en producción
- `develop`: integración de features
- `sandbox`: experimentos y pruebas
- `feature/*`: ramas de características

El flujo: feature → develop → sandbox (pruebas) → master.

---

## APÉNDICE: Comandos útiles

```bash
# Desarrollo
dotnet run                                    # Arranca el backend
npm start                                     # Arranca el frontend

# Migraciones
dotnet ef migrations add NombreMigracion     # Crea una nueva migración
dotnet ef database update                     # Aplica migraciones pendientes
dotnet ef migrations remove                   # Elimina la última migración

# Tests
dotnet test --verbosity normal               # Ejecuta los tests

# Publicar
dotnet publish -c Release -o ./publish/api   # Publica el backend
npm run build -- --configuration production  # Compila el frontend

# IIS
iisreset                                      # Reinicia IIS
```

## APÉNDICE: Variables de configuración

| Variable | Dónde se configura | Descripción |
|----------|-------------------|-------------|
| `Jwt:SecretKey` | User Secrets / web.config | Clave de firma JWT (mín. 32 caracteres) |
| `Jwt:Issuer` | appsettings.json | Identificador del emisor del JWT |
| `Jwt:Audience` | appsettings.json | Identificador del receptor del JWT |
| `Jwt:ExpiryInMinutes` | appsettings.json | Duración del access token (15 min) |
| `ConnectionStrings:DefaultConnection` | User Secrets / web.config | Cadena de conexión a PostgreSQL |
| `SuperAdmin:Email` | appsettings.json | Email del administrador |
| `SuperAdmin:Password` | User Secrets / web.config | Contraseña del administrador |
| `Email:Host` | appsettings.json | Servidor SMTP (localhost en dev) |
| `Email:Port` | appsettings.json | Puerto SMTP (2525 para smtp4dev) |
| `Cors:AllowedOrigins` | appsettings.json | Orígenes permitidos para CORS |
| `Frontend:BaseUrl` | appsettings.json | URL del frontend (para links en emails) |
