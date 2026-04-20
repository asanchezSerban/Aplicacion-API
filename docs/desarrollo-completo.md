# ClientManager — Historia del desarrollo y referencia técnica

> Documento generado para desarrolladores que quieran entender el proyecto desde cero,
> tanto su evolución como su estado técnico actual.

---

## Tabla de contenidos

### Parte 1 — Historia del desarrollo
1. [Contexto y requerimientos iniciales](#1-contexto-y-requerimientos-iniciales)
2. [Fase 1 — Modelo de datos base y CRUD](#2-fase-1--modelo-de-datos-base-y-crud)
3. [Fase 2 — Autenticación con Identity y JWT](#3-fase-2--autenticación-con-identity-y-jwt)
4. [Fase 3 — Autorización por roles](#4-fase-3--autorización-por-roles)
5. [Fase 4 — Refresh tokens con rotación](#5-fase-4--refresh-tokens-con-rotación)
6. [Fase 6 — Creación atómica de usuarios](#6-fase-6--creación-atómica-de-usuarios)
7. [Fase 5 — Frontend de autenticación](#7-fase-5--frontend-de-autenticación)
8. [Fase 7 — MFA, email y seguridad avanzada](#8-fase-7--mfa-email-y-seguridad-avanzada)
9. [Mejoras transversales aplicadas](#9-mejoras-transversales-aplicadas)
10. [Auditoría y deuda técnica pendiente](#10-auditoría-y-deuda-técnica-pendiente)

### Parte 2 — Referencia técnica
11. [Stack tecnológico](#11-stack-tecnológico)
12. [Arquitectura](#12-arquitectura)
13. [API — Endpoints](#13-api--endpoints)
14. [Base de datos — Esquema](#14-base-de-datos--esquema)
15. [Flujos principales](#15-flujos-principales)
16. [Frontend — Rutas y estructura](#16-frontend--rutas-y-estructura)
17. [Configuración y arranque](#17-configuración-y-arranque)

---

# Parte 1 — Historia del desarrollo

## 1. Contexto y requerimientos iniciales

**ClientManager** nació como una aplicación de gestión multitenant para uso interno. Los requerimientos iniciales eran:

- Una entidad **Empresa** con nombre, descripción y logo opcional
- Una entidad **Usuario** vinculada a una empresa (trabajadores o contactos)
- Rol **SuperAdmin**: acceso total — crea, edita y elimina empresas y usuarios
- Rol **Usuario**: acceso restringido — solo puede ver su propio perfil
- Autenticación segura con doble factor por email
- Recuperación de contraseña por email
- Interfaz web moderna con Angular Material

La metodología elegida fue desarrollo por **fases secuenciales**: cada fase deja la aplicación funcional y testeable antes de pasar a la siguiente. Esto permite detectar problemas pronto y evita grandes bloques de código sin validar.

---

## 2. Fase 1 — Modelo de datos base y CRUD

### Punto de partida

La primera entidad del sistema se llamó `Client`, pero al analizar el dominio quedó claro que representaba a una **empresa**, no a una persona. Se decidió:

- Renombrar `Client` → `Company` (empresa)
- Crear una nueva entidad `Client` (luego renombrada a `User`) = persona vinculada a una empresa

Este renaming se hizo mediante una migración EF que usa `RenameTable` en lugar de drop/create, para no perder datos existentes.

### Lo que se construyó

**Backend:**
- Modelos: `Company` y `Client` con sus propiedades y relación FK
- DTOs separados para request y response (patrón DTO estricto — nunca se exponen entidades directamente)
- Services (`ICompanyService`, `IClientService`) con lógica de negocio
- Controllers RESTful con paginación, filtros por nombre, y soporte multipart/form-data para logos
- Logos almacenados en `wwwroot/uploads/`, la BD guarda solo el nombre de fichero
- Global exception handler: mapea excepciones de negocio a códigos HTTP apropiados

**Frontend:**
- Páginas `/empresas` y `/clientes` (rutas en español para alineación con el dominio)
- Tabla paginada con filtro por nombre, formulario de creación/edición, vista de detalle
- Navbar con ambas secciones

**Migración aplicada:** `Phase1_RenameClientsToCompanies_AddClientsTable`

---

## 3. Fase 2 — Autenticación con Identity y JWT

### Decisiones de diseño

**¿Por qué ASP.NET Core Identity?**
Gestión de contraseñas (hashing bcrypt), lockout automático tras fallos, tokens para reset de contraseña y generación de claims. Implementar todo esto desde cero sería reinventar la rueda con riesgos de seguridad.

**¿Por qué JWT?**
Stateless: el servidor no guarda sesiones. Escalable horizontalmente. El token lleva los claims del usuario (rol, id) y se verifica criptográficamente en cada petición.

**Estructura de tokens:**
- **Access token**: 15 minutos de validez, contiene claims: `sub` (userId), `email`, `role`, `userId`, `jti` (UUID único por token)
- **Refresh token**: 7 días, almacenado en base de datos y en cookie HttpOnly

### Implementación

`ApplicationUser` extiende `IdentityUser` añadiendo:
```csharp
public int? UserId { get; set; }    // FK a la tabla Users (null para SuperAdmin)
public User? User  { get; set; }    // navegación
public DateTime CreatedAt { get; set; }
```

`ApplicationDbContext` pasa a heredar de `IdentityDbContext<ApplicationUser>`. La primera línea de `OnModelCreating` debe ser `base.OnModelCreating(modelBuilder)` — si no, Identity no registra sus 7 tablas.

**Seed automático al arrancar** (en `Program.cs`, después de `MigrateAsync`):
1. Crear rol "SuperAdmin" si no existe
2. Crear rol "Cliente" si no existe
3. Crear usuario SuperAdmin con email y contraseña de configuración si no existe

**Claves sensibles en User Secrets**, nunca en `appsettings.json`:
```
Jwt:SecretKey       → clave HMAC-SHA256 para firmar tokens
SuperAdmin:Password → contraseña del admin inicial
```

**Migración aplicada:** `Phase2_AddIdentityTables`

---

## 4. Fase 3 — Autorización por roles

### Configuración

```csharp
[Authorize(Roles = "SuperAdmin")]   // en CompaniesController y UsersController
[Authorize(Roles = "Cliente")]      // en GET /api/users/me
```

### Problema encontrado: AND lógico entre atributos `[Authorize]`

Al poner `[Authorize(Roles = "SuperAdmin")]` a nivel de clase y `[Authorize(Roles = "Cliente")]` en el método `GetMe`, ASP.NET Core aplica ambas condiciones con **AND** — nadie podía acceder porque ningún usuario tiene los dos roles simultáneamente.

**Solución aplicada:** `[Authorize]` (sin rol) a nivel de clase, y restricciones específicas en cada método individualmente.

```csharp
[Authorize]                         // clase — solo requiere estar autenticado
public class UsersController ...

[Authorize(Roles = "SuperAdmin")]   // métodos de gestión
public async Task<IActionResult> GetAll(...)

[Authorize(Roles = "Cliente")]      // endpoint de perfil propio
public async Task<IActionResult> GetMe()
```

---

## 5. Fase 4 — Refresh tokens con rotación

### ¿Por qué rotación?

Con rotación, cada uso del refresh token genera un par nuevo y revoca el anterior. Si un atacante roba el refresh token y lo usa, el token legítimo del usuario queda inválido y se detecta el intento de reutilización — en ese caso se revocan **todos** los tokens del usuario.

### Tabla RefreshTokens

| Campo           | Tipo      | Descripción                                  |
|-----------------|-----------|----------------------------------------------|
| Token           | string    | UUID único, índice único                     |
| UserId          | string    | FK a AspNetUsers                             |
| ExpiresAt       | DateTime  | 7 días desde creación                        |
| CreatedAt       | DateTime  |                                              |
| RevokedAt       | DateTime? | null si activo                               |
| ReplacedByToken | string?   | token sucesor (para auditoría)               |

### Flujo
1. Login correcto → genera access token + refresh token → almacena refresh en BD + cookie HttpOnly
2. `POST /api/auth/refresh` → lee cookie, valida, genera par nuevo, revoca anterior
3. `POST /api/auth/logout` → revoca refresh token activo, borra cookie

**Migración aplicada:** `Phase4_AddRefreshTokens`

---

## 6. Fase 6 — Creación atómica de usuarios

> *Esta fase se implementó antes que la Fase 5 de frontend, por dependencia de backend.*

### Rename Clients → Users

La tabla `Clients` se renombró a `Users` para reflejar mejor el dominio del negocio. Migración `Phase6_RenameClientsToUsers` usa `RenameTable`, no drop/create.

### Creación atómica con rollback

Al crear un usuario, el sistema debe crear simultáneamente:
1. Registro en `Users` (datos del perfil)
2. `ApplicationUser` en `AspNetUsers` (cuenta de acceso con contraseña)

Si cualquiera de los dos falla, se deshace el otro. Implementado en `UserService.CreateAsync`:

```
1. Crear User en tabla Users → obtener Id
2. Crear ApplicationUser vinculado con UserId
3. Si paso 2 falla → eliminar el User creado en paso 1
4. Asignar rol "Cliente" al ApplicationUser
```

### Consecuencia importante

Los usuarios creados **antes de esta fase** solo existen en `Users`, sin cuenta en `AspNetUsers`. No pueden hacer login ni recuperar contraseña. La solución es borrarlos y recrearlos.

---

## 7. Fase 5 — Frontend de autenticación

### auth.service.ts

Gestiona el estado de autenticación usando signals de Angular:

```typescript
isAuthenticated = computed(() => !!this.accessToken())
role            = computed(() => this.decodeToken()?.role ?? null)
```

El access token se almacena en memoria (signal). El refresh token va en cookie HttpOnly — el navegador lo envía automáticamente en cada petición a `/api/auth/refresh`.

**Fix base64url:** los JWT usan base64url (sin padding `=`). `atob()` de JavaScript requiere base64 estándar con padding. Sin este fix, el decode del token falla silenciosamente:

```typescript
const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
return JSON.parse(atob(padded));
```

### auth.interceptor.ts — Race condition

Si múltiples peticiones fallan con 401 simultáneamente, el interceptor solo debe hacer **un** refresh — las demás peticiones deben esperar el resultado. Sin esto, se lanzan N refreshes en paralelo y todos excepto el primero fallan porque el token ya fue rotado.

Solución: `BehaviorSubject<boolean>` como semáforo:

```
Si refreshing$ === true → esperar hasta que sea false, luego reintentar con nuevo token
Si refreshing$ === false → hacer el refresh, emitir true, al terminar emitir false
```

### Guards

| Guard       | Condición        | Uso                                    |
|-------------|------------------|----------------------------------------|
| `authGuard` | Autenticado      | Rutas que requieren login              |
| `adminGuard`| Rol SuperAdmin   | Rutas de gestión de empresas/usuarios  |
| `guestGuard`| No autenticado   | `/login`, `/mfa-verificar`, etc.       |

---

## 8. Fase 7 — MFA, email y seguridad avanzada

### Email service

Se usa **MailKit** para envío de emails. En desarrollo, **smtp4dev** actúa como servidor SMTP local que captura los emails sin enviarlos realmente — accesible en `http://localhost:5000` (o el puerto configurado).

Configuración SMTP en `appsettings.json`:
```json
"Smtp": {
  "Host": "localhost",
  "Port": 25,
  "From": "noreply@clientmanager.local"
}
```

### MFA por OTP

El flujo de login se divide en dos pasos:

**Paso 1 — `POST /api/auth/login`:**
- Verifica credenciales
- Si son correctas: genera OTP de 6 dígitos con `RandomNumberGenerator` (criptográficamente seguro)
- Hashea el OTP con SHA256 antes de guardarlo en BD (nunca se guarda el código en claro)
- Envía el OTP por email
- Devuelve `{ requiresMfa: true, mfaEmail: "..." }` — NO devuelve tokens aún

**Paso 2 — `POST /api/auth/mfa-verify`:**
- Recibe email + código
- Busca OTP activo para ese usuario (no expirado, no usado, intentos < 3)
- Hashea el código recibido y compara con el hash almacenado
- Si correcto: emite access token + refresh token
- Si incorrecto: incrementa intentos; a los 3 el OTP queda bloqueado

**Tabla EmailOtpCodes:**

| Campo     | Descripción                              |
|-----------|------------------------------------------|
| UserId    | FK a AspNetUsers                         |
| CodeHash  | SHA256 del OTP de 6 dígitos              |
| ExpiresAt | 1 minuto desde generación                |
| IsUsed    | true tras verificación exitosa           |
| Attempts  | contador de intentos fallidos (máx 3)    |

**Contador en frontend:** el componente `/mfa-verificar` guarda el timestamp del envío en `sessionStorage`. Al recargar la página, calcula el tiempo real que queda (`TTL - elapsed`) en lugar de reiniciar desde 60 segundos.

**Migración aplicada:** `Phase7_AddEmailOtpCodes`

### Rate limiting y lockout

- **Rate limiting:** 5 peticiones por minuto por IP en todos los endpoints `/api/auth/*`
- **Lockout:** 5 intentos fallidos de login → cuenta bloqueada 15 minutos (gestionado por ASP.NET Core Identity)
- El backend devuelve HTTP 423 (Locked) cuando la cuenta está bloqueada, distinguible en el frontend

### Recuperación de contraseña

- `POST /api/auth/forgot-password`: **siempre devuelve 200** aunque el email no exista (evita user enumeration). Si el usuario existe en `AspNetUsers`, envía email con enlace de reset.
- El enlace contiene el email y el token generado por `UserManager.GeneratePasswordResetTokenAsync` (con validez de 1 hora)
- `POST /api/auth/reset-password`: valida token, actualiza contraseña, revoca todos los refresh tokens activos del usuario

---

## 9. Mejoras transversales aplicadas

### Angular — modernización completa

Todos los componentes de páginas se migraron a las convenciones modernas de Angular:

| Patrón | Antes | Después |
|--------|-------|---------|
| Estado reactivo | Variables planas | `signal()` + `computed()` |
| Detección de cambios | Default | `ChangeDetectionStrategy.OnPush` |
| Inyección de dependencias | Constructor params | `inject()` |
| Formularios reactivos | `fb.group()` | `fb.nonNullable.group()` |
| Lectura del formulario | `form.value` | `form.getRawValue()` |
| Acceso a controles | `form.get('x')?.` | getter `get x()` con tipo correcto |
| Directivas estructurales | `*ngIf`, `*ngFor` | `@if`, `@for` (control flow nativo) |

### Eliminación de Company.Status

La entidad `Company` heredaba un campo `Status` (Active/Inactive/Prospect/Churned) de cuando representaba a clientes/contactos. En el dominio actual — donde `Company` es una empresa — este campo no tiene sentido. Se eliminó completamente del modelo, DTOs, servicios y toda la UI.

La migración `Phase8_RemoveCompanyStatus_UniqueCompanyName` incluye un paso SQL de deduplicación antes de crear el índice único en `Name`, por si la BD tenía empresas con nombres duplicados.

### Índice único en Company.Name

Se añadió `HasIndex(c => c.Name).IsUnique()` para evitar empresas duplicadas. La validación en `CompanyService` lanza `ArgumentException` (mapeada a HTTP 400) antes de intentar la inserción, con mensaje explicativo.

### Navegación contextual en formulario de usuario

El `UserFormComponent` detecta si llegó desde el detalle de una empresa (query param `?companyId=X`) y, al guardar o cancelar, vuelve al detalle de esa empresa en lugar de a la lista global de usuarios.

---

## 10. Auditoría y deuda técnica pendiente

Un análisis arquitectónico externo identificó los siguientes puntos relevantes:

### Críticos
- **Access token en localStorage:** vulnerable a XSS. La alternativa segura es almacenarlo en memoria (signal) y no persistirlo — el refresh token en cookie HttpOnly garantiza la continuidad de sesión.
- **0% cobertura de tests:** no hay ningún test unitario ni de integración en backend ni frontend.

### Importantes
- **Race condition en interceptor:** implementación actual puede tener ventana de concurrencia; revisar con `switchMap` + `share()` en lugar de `BehaviorSubject` manual.
- **Rate limiting incompleto:** los endpoints `/forgot-password` y `/reset-password` deberían tener su propio límite.
- **Validación de uploads por Content-Type:** el tipo MIME puede ser falsificado; añadir validación por magic bytes (cabecera del fichero).
- **Sin CI/CD:** no hay pipeline de build, lint ni tests automáticos.

### Pendiente de implementar
- Tests unitarios backend con xUnit + Testcontainers-PostgreSQL
- Tests unitarios frontend con Jasmine
- Tests E2E con Playwright
- Pipeline CI/CD (GitHub Actions)
- Dispositivos de confianza (TrustedDevice) para saltar MFA en dispositivos conocidos

---

# Parte 2 — Referencia técnica

## 11. Stack tecnológico

### Backend

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Runtime | .NET | 10.0 |
| Framework | ASP.NET Core Web API | 10.0 |
| ORM | Entity Framework Core | 10.0.0 |
| Driver BD | Npgsql.EF (PostgreSQL) | 10.0.0 |
| Autenticación | ASP.NET Core Identity + JWT Bearer | 10.0.0 |
| Email | MailKit | 4.15.1 |
| Documentación | Swashbuckle (Swagger) | 6.6.2 |
| BD desarrollo | PostgreSQL | 15+ |
| SMTP desarrollo | smtp4dev | — |

### Frontend

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework | Angular | 21.2.x |
| Lenguaje | TypeScript | 5.9.x |
| UI Components | Angular Material | 21.2.x |
| Async | RxJS | 7.8.x |
| Build | Angular CLI | 21.2.x |
| Package manager | npm | 11.9.0 |

---

## 12. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  Angular 21 SPA                     │
│  Components → Services → Interceptor → Guards       │
│              HTTP + JWT Bearer (header)             │
│           Refresh token (cookie HttpOnly)           │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP/REST
┌───────────────────────▼─────────────────────────────┐
│            ASP.NET Core 10 Web API                  │
│  AuthController / CompaniesController / Users...    │
│         ↓                                           │
│  IAuthService / ICompanyService / IUserService      │
│  IEmailService                                      │
│         ↓                                           │
│  ApplicationDbContext (EF Core 10)                  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              PostgreSQL 15                          │
│  Companies · Users · AspNetUsers · RefreshTokens   │
│  EmailOtpCodes · AspNetRoles · ...                  │
└─────────────────────────────────────────────────────┘
```

### Estructura de carpetas backend

```
ClientManager.API/
├── Controllers/
│   ├── AuthController.cs        → /api/auth
│   ├── CompaniesController.cs   → /api/companies
│   └── UsersController.cs       → /api/users
├── Services/
│   ├── IAuthService.cs / AuthService.cs
│   ├── ICompanyService.cs / CompanyService.cs
│   ├── IUserService.cs / UserService.cs
│   └── IEmailService.cs / EmailService.cs
├── Models/
│   ├── ApplicationUser.cs
│   ├── Company.cs
│   ├── User.cs
│   ├── RefreshToken.cs
│   └── EmailOtpCode.cs
├── DTOs/
│   ├── AuthDtos.cs
│   ├── CompanyDtos.cs
│   └── UserDtos.cs
├── Data/
│   └── ApplicationDbContext.cs
├── Migrations/
└── Program.cs
```

---

## 13. API — Endpoints

### Auth — `/api/auth` (rate limit: 5 req/min por IP)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Público | Verifica credenciales, envía OTP por email. Devuelve `{ requiresMfa, mfaEmail }` |
| POST | `/api/auth/mfa-verify` | Público | Verifica OTP. Devuelve `{ accessToken, refreshToken, role, expiresAt }` |
| POST | `/api/auth/refresh` | Cookie | Renueva el par de tokens usando la cookie `refreshToken` |
| POST | `/api/auth/logout` | JWT | Revoca el refresh token activo y borra la cookie |
| POST | `/api/auth/forgot-password` | Público | Envía email de recuperación (siempre 200) |
| POST | `/api/auth/reset-password` | Público | Restablece contraseña con token del email |

### Companies — `/api/companies` (requiere rol: SuperAdmin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/companies` | Lista paginada. Query: `page`, `pageSize`, `name` |
| GET | `/api/companies/{id}` | Detalle de empresa |
| POST | `/api/companies` | Crear empresa. `multipart/form-data`. Campo `logo` opcional |
| PUT | `/api/companies/{id}` | Actualizar empresa. `multipart/form-data`. Campo `logo` opcional |
| DELETE | `/api/companies/{id}` | Eliminar empresa |

### Users — `/api/users`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/users` | SuperAdmin | Lista paginada. Query: `page`, `pageSize`, `name`, `companyId` |
| GET | `/api/users/{id}` | SuperAdmin | Detalle de usuario |
| POST | `/api/users` | SuperAdmin | Crear usuario + cuenta de acceso (atómico) |
| PUT | `/api/users/{id}` | SuperAdmin | Actualizar usuario |
| DELETE | `/api/users/{id}` | SuperAdmin | Eliminar usuario y cuenta de acceso |
| GET | `/api/users/me` | Cliente | Perfil propio del usuario autenticado |

### Respuestas de error estándar

| Código | Causa |
|--------|-------|
| 400 | Validación de DTO fallida o regla de negocio (nombre duplicado, etc.) |
| 401 | Sin token, token expirado o credenciales incorrectas |
| 404 | Recurso no encontrado |
| 423 | Cuenta bloqueada por demasiados intentos fallidos |
| 429 | Rate limit excedido |
| 500 | Error interno inesperado |

---

## 14. Base de datos — Esquema

### Companies

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| Id | integer | PK, IDENTITY ALWAYS |
| Name | varchar(200) | NOT NULL, UNIQUE |
| Description | varchar(2000) | NOT NULL |
| LogoFileName | varchar(500) | NULL |
| CreatedAt | timestamptz | DEFAULT NOW() |
| UpdatedAt | timestamptz | DEFAULT NOW() |

Índices: `IX_Companies_Name` (unique), `IX_Companies_UpdatedAt`

### Users

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| Id | integer | PK, IDENTITY ALWAYS |
| Name | varchar(200) | NOT NULL |
| Email | varchar(200) | NOT NULL, UNIQUE |
| CompanyId | integer | NOT NULL, FK → Companies(Id) CASCADE DELETE |
| CreatedAt | timestamptz | DEFAULT NOW() |
| UpdatedAt | timestamptz | DEFAULT NOW() |

Índices: `IX_Users_Email` (unique), `IX_Users_CompanyId`, `IX_Users_Name`

### AspNetUsers (Identity + extensión)

Extiende la tabla estándar de Identity con:

| Columna extra | Tipo | Descripción |
|---------------|------|-------------|
| UserId | integer? | FK → Users(Id) SET NULL. Null para SuperAdmin |
| CreatedAt | timestamptz | Fecha de creación de la cuenta |

### RefreshTokens

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| Id | integer | PK, IDENTITY ALWAYS |
| Token | varchar(200) | NOT NULL, UNIQUE |
| UserId | varchar | NOT NULL, FK → AspNetUsers(Id) CASCADE DELETE |
| ExpiresAt | timestamptz | NOT NULL |
| CreatedAt | timestamptz | NOT NULL |
| RevokedAt | timestamptz | NULL si activo |
| ReplacedByToken | varchar(200) | NULL |

Índices: `IX_RefreshTokens_Token` (unique), `IX_RefreshTokens_UserId`

### EmailOtpCodes

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| Id | integer | PK, IDENTITY ALWAYS |
| UserId | varchar | NOT NULL, FK → AspNetUsers(Id) CASCADE DELETE |
| CodeHash | varchar(64) | NOT NULL (SHA256 del código) |
| ExpiresAt | timestamptz | NOT NULL (1 minuto desde generación) |
| IsUsed | boolean | NOT NULL, DEFAULT false |
| Attempts | integer | NOT NULL, DEFAULT 0 |
| CreatedAt | timestamptz | NOT NULL |

Índices: `IX_EmailOtpCodes_UserId`

### Tablas de Identity (estándar)

`AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims`

Roles definidos: `SuperAdmin`, `Cliente`

### Historial de migraciones

| Migración | Descripción |
|-----------|-------------|
| `InitialCreate` | Esquema inicial |
| `Phase1_RenameClientsToCompanies_AddClientsTable` | Rename + nueva tabla Users |
| `Phase2_AddIdentityTables` | Identity + ApplicationUser |
| `Phase4_AddRefreshTokens` | Tabla RefreshTokens |
| `Phase6_RenameClientsToUsers` | Rename Clients → Users |
| `Phase7_AddEmailOtpCodes` | Tabla EmailOtpCodes |
| `Phase8_RemoveCompanyStatus_UniqueCompanyName` | Drop Status, unique en Name |

---

## 15. Flujos principales

### Login con MFA

```
Frontend                          Backend                        smtp4dev
   │                                 │                               │
   │  POST /api/auth/login            │                               │
   │  { email, password }            │                               │
   │ ──────────────────────────────► │                               │
   │                                 │  Verifica credenciales        │
   │                                 │  Genera OTP (6 dígitos)       │
   │                                 │  Guarda hash en EmailOtpCodes │
   │                                 │  Envía email ─────────────────►
   │  { requiresMfa: true,           │                               │
   │    mfaEmail: "..." }            │                               │
   │ ◄────────────────────────────── │                               │
   │                                 │                               │
   │  [usuario lee código del email] │                               │
   │                                 │                               │
   │  POST /api/auth/mfa-verify      │                               │
   │  { email, code }                │                               │
   │ ──────────────────────────────► │                               │
   │                                 │  Valida: no expirado,         │
   │                                 │  hash coincide, intentos < 3  │
   │                                 │  Genera access + refresh token│
   │  { accessToken, role, ... }     │                               │
   │  Set-Cookie: refreshToken       │                               │
   │ ◄────────────────────────────── │                               │
   │                                 │                               │
   │  [almacena accessToken en       │                               │
   │   signal de memoria]            │                               │
```

### Refresh de token (con race condition)

```
Petición A ──► 401 ──► interceptor detecta expiración
Petición B ──► 401 ──► interceptor: refreshing$ === true → espera

Petición A: POST /api/auth/refresh (cookie enviada automáticamente)
         ◄── nuevo accessToken + nueva cookie refreshToken
         emite refreshing$.next(false)

Petición B: reinvoca con nuevo accessToken (ya tenía el resultado)
```

### Recuperación de contraseña

```
1. Usuario solicita: POST /api/auth/forgot-password { email }
   → Siempre 200 (aunque el email no exista — anti-enumeración)
   → Si existe en AspNetUsers: genera token Identity (1 hora) y envía email

2. Usuario recibe email con enlace:
   /reset-password?email=...&token=...

3. Usuario envía nueva contraseña: POST /api/auth/reset-password
   { email, token, newPassword }
   → Valida token con UserManager.ResetPasswordAsync
   → Revoca TODOS los refresh tokens activos del usuario
   → Devuelve 200

NOTA: Si el usuario no tiene cuenta en AspNetUsers (creado antes de Fase 6),
el paso 1 no enviará email. Solución: borrar y recrear el usuario.
```

### Crear usuario (atómico)

```
POST /api/users { name, email, companyId, password }

1. Validar que no existe otro usuario con ese email
2. Crear registro en tabla Users → obtener Id
3. Crear ApplicationUser en AspNetUsers con UserId = Id anterior
   - Si falla: eliminar el User del paso 2 (rollback manual)
4. Asignar rol "Cliente" al ApplicationUser
5. Devolver UserResponseDto
```

---

## 16. Frontend — Rutas y estructura

### Rutas

| Ruta | Componente | Guards | Acceso |
|------|-----------|--------|--------|
| `/` | — | — | Redirige a `/empresas` |
| `/empresas` | `CompanyListComponent` | auth + admin | SuperAdmin |
| `/empresas/nueva` | `CompanyFormComponent` | auth + admin | SuperAdmin |
| `/empresas/:id` | `CompanyDetailComponent` | auth + admin | SuperAdmin |
| `/empresas/:id/editar` | `CompanyFormComponent` | auth + admin | SuperAdmin |
| `/usuarios` | `UserListComponent` | auth + admin | SuperAdmin |
| `/usuarios/nuevo` | `UserFormComponent` | auth + admin | SuperAdmin |
| `/usuarios/:id` | `UserDetailComponent` | auth + admin | SuperAdmin |
| `/usuarios/:id/editar` | `UserFormComponent` | auth + admin | SuperAdmin |
| `/login` | `LoginComponent` | guest | Sin sesión |
| `/mfa-verificar` | `MfaVerificarComponent` | guest | Sin sesión |
| `/recuperar-password` | `RecuperarPasswordComponent` | guest | Sin sesión |
| `/reset-password` | `ResetPasswordComponent` | guest | Sin sesión |
| `/perfil` | `PerfilComponent` | auth | Usuario (Cliente) |
| `/**` | `NotFoundComponent` | — | Todos |

### Estructura de carpetas frontend

```
src/app/
├── guards/
│   ├── auth.guard.ts         → requiere login
│   ├── admin.guard.ts        → requiere rol SuperAdmin
│   └── guest.guard.ts        → redirige si ya autenticado
├── interceptors/
│   └── auth.interceptor.ts   → Bearer header + retry en 401
├── models/
│   ├── company.model.ts
│   └── user.model.ts
├── services/
│   ├── auth.service.ts       → login, logout, refresh, estado reactivo
│   ├── company.service.ts    → /api/companies
│   └── user.service.ts       → /api/users
├── components/
│   ├── navbar/               → navegación según rol, dark mode
│   └── confirm-dialog/       → diálogo de confirmación reutilizable
└── pages/
    ├── login/
    ├── mfa-verificar/
    ├── recuperar-password/
    ├── reset-password/
    ├── perfil/
    ├── company-list/
    ├── company-form/
    ├── company-detail/       → incluye lista de usuarios de la empresa
    ├── user-list/
    ├── user-form/            → vuelve al detalle de empresa si viene de ahí
    ├── user-detail/
    └── not-found/
```

### Servicios clave

**`auth.service.ts`**
- `login(dto)` → llama al backend, navega a MFA si `requiresMfa`
- `mfaVerify(email, code)` → completa el login, almacena accessToken en signal
- `logout()` → revoca token en backend, limpia estado local
- `refresh()` → solicita nuevos tokens (lo llama el interceptor automáticamente)
- `isAuthenticated` → `computed(() => !!accessToken())`
- `role` → decodifica el JWT para obtener el rol

**`auth.interceptor.ts`**
- Añade `Authorization: Bearer <token>` a todas las peticiones al backend
- Si recibe 401: intenta refresh una vez, reintenta la petición original
- Previene múltiples refreshes simultáneos con `BehaviorSubject`

---

## 17. Configuración y arranque

### Prerrequisitos

- .NET 10 SDK
- Node.js 22+ y npm 11+
- PostgreSQL 15+
- smtp4dev (para recibir emails en desarrollo): `dotnet tool install -g Rnwood.Smtp4dev`

### User Secrets (backend — una sola vez)

```bash
cd AplicacionAPI/ClientManager.API
dotnet user-secrets set "Jwt:SecretKey" "<clave-de-al-menos-32-caracteres>"
dotnet user-secrets set "SuperAdmin:Password" "<contraseña-del-admin>"
```

### appsettings.json (fragmento relevante)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=clientmanager;Username=postgres;Password=..."
  },
  "Jwt": {
    "Issuer": "ClientManagerAPI",
    "Audience": "ClientManagerApp",
    "ExpiryInMinutes": 15
  },
  "SuperAdmin": {
    "Email": "admin@clientmanager.local"
  },
  "Smtp": {
    "Host": "localhost",
    "Port": 25,
    "From": "noreply@clientmanager.local"
  },
  "Frontend": {
    "BaseUrl": "http://localhost:4200"
  }
}
```

### Arrancar el proyecto

```bash
# 1. Iniciar smtp4dev (recibe emails en http://localhost:5001)
smtp4dev

# 2. Backend (aplica migraciones automáticamente al arrancar)
cd AplicacionAPI/ClientManager.API
dotnet run
# API:     http://localhost:5000
# Swagger: http://localhost:5000/swagger

# 3. Frontend
cd AplicacionAPI/ClientManagerWeb
npm install
npm start
# App: http://localhost:4200
```

### Credenciales iniciales (seed automático)

| Campo | Valor |
|-------|-------|
| Email | `admin@clientmanager.local` |
| Contraseña | La configurada en User Secrets (`SuperAdmin:Password`) |
| Rol | SuperAdmin |
