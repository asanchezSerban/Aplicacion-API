# ClientManager — Especificaciones de Implementación

## ROL Y OBJETIVO

Eres un desarrollador full-stack senior. Tu tarea es implementar la aplicación **ClientManager**
descrita en este documento. Las especificaciones definen QUÉ debe hacer la aplicación y su
contrato de datos. Tienes libertad total para decidir CÓMO implementarlo de la mejor manera posible.

---

## ⚠️ INSTRUCCIONES DE INICIO DE CONVERSACIÓN (OBLIGATORIO)

Al comenzar cualquier conversación sobre este proyecto, DEBES:

1. **Explorar carpetas ocultas**: revisar `.agents/` en la raíz del proyecto. Contiene skills instaladas y agentes que DEBES usar activamente.
2. **Leer `skills-lock.json`** en la raíz para saber qué skills están instaladas.
3. **Leer cada `SKILL.md`** en `.agents/skills/*/SKILL.md` antes de escribir código.
4. **Leer el estado actual del código** antes de proponer cambios — nunca asumir que el código coincide con lo que dice este documento.

### Skills instaladas (`.agents/skills/`)

| Skill | Aplicar cuando... |
|-------|-------------------|
| **angular-component** | Crear o modificar cualquier componente Angular |
| **postgresql-optimization** | Escribir migraciones EF, queries, índices |
| **frontend-design** | Diseñar UI, layouts, estilos |
| **web-design-guidelines** | Cualquier decisión de diseño web |
| **supabase-postgres-best-practices** | Optimización de BD PostgreSQL |
| **find-skills** | Para descubrir qué skill usar en cada situación |

**Reglas de las skills Angular** (de `angular-component`):
- NO poner `standalone: true` — es el default en Angular v20+, es redundante
- Usar `inject()` en lugar de constructor injection
- Usar signal inputs: `input()`, `input.required()`, `output()`, `computed()`
- Usar `ChangeDetectionStrategy.OnPush` en todos los componentes
- Host bindings en el objeto `host: {}` — NO usar `@HostBinding/@HostListener`
- Control flow nativo: `@if`, `@for`, `@switch` — NO usar `*ngIf`, `*ngFor`, `*ngSwitch`
- NO usar `ngClass` ni `ngStyle` — usar binding directo `[class.x]`, `[style.x]`

---

## ESTADO ACTUAL DEL PROYECTO

### Fase 1 — COMPLETADA ✅
- Modelo `Client` renombrado a `Company` (tabla `Companies`)
- Nuevo modelo `Client` = persona asignada a una empresa (tabla `Clients`)
- Backend: CRUD completo para `/api/companies` y `/api/clients`
- Frontend: páginas en `/empresas` y `/clientes`, navbar con ambas secciones
- Migración EF aplicada: `20260407120958_Phase1_RenameClientsToCompanies_AddClientsTable`

### Fase 2 — COMPLETADA ✅
- `ApplicationUser` extiende `IdentityUser` con `ClientId` y `CreatedAt`
- Identity + JWT configurados en `Program.cs`
- Seed automático: roles "SuperAdmin" y "Cliente", usuario admin al arrancar
- `POST /api/auth/login` → devuelve `accessToken`, `refreshToken`, `role`, `expiresAt`

### Fase 3 — COMPLETADA ✅
- `[Authorize(Roles = "SuperAdmin")]` en `CompaniesController` y `ClientsController`
- `GET /api/clients/me` con `[Authorize(Roles = "Cliente")]`

### Fase 4 — COMPLETADA ✅
- Refresh tokens con rotación almacenados en BD
- `POST /api/auth/refresh` y `POST /api/auth/logout`

### Fase 7 Backend — COMPLETADA ✅
- Email service con MailKit + smtp4dev
- MFA por OTP de 6 dígitos enviado por email
- Recuperación de contraseña (forgot/reset password)
- Rate limiting: 5 req/min por IP en `/api/auth/*`
- Lockout: 5 intentos fallidos → 15 min bloqueado

### Fase 5 — COMPLETADA ✅
- `auth.service.ts` con signals, login, logout, refresh, forgotPassword, resetPassword
- `auth.interceptor.ts` con Bearer header y retry en 401
- `auth.guard.ts`, `admin.guard.ts`, `guest.guard.ts`
- Páginas: `/login`, `/perfil`, `/recuperar-password`, `/reset-password`
- Navbar reactivo según rol

### Fase 6 — COMPLETADA ✅
- Tabla `Clients` renombrada a `Users` (migración `Phase6_RenameClientsToUsers`)
- `UserService.CreateAsync` crea `User` + `ApplicationUser` vinculado con rol "Cliente" en una sola operación atómica
- Rollback automático si falla la creación de la cuenta de acceso

### Pendiente — Lo único que falta
- **Fase 7 Frontend**: página `/mfa-verificar` (el backend MFA ya está implementado)

---

## FILOSOFÍA DE IMPLEMENTACIÓN

### Lo que debes respetar (no negociable)
- Stack tecnológico: .NET 10 + PostgreSQL en backend, Angular 21 + Angular Material en frontend
- Contrato de la API: endpoints, verbos HTTP, DTOs, códigos de respuesta
- Esquema de base de datos actual (ver sección BASE DE DATOS)
- Modelo de negocio multitenant: SuperAdmin gestiona Empresas y Clientes; Cliente ve solo su perfil
- Comunicación frontend-backend: mismos modelos de datos y rutas de Angular

### Lo que puedes y debes mejorar libremente

**Backend:**
- Validaciones adicionales, manejo de errores más granular
- Rate limiting, sanitización de inputs, validación de MIME types
- Logging estructurado con ILogger
- Optimizar queries EF Core (AsNoTracking, proyecciones)
- Cualquier mejora de configuración en Program.cs

**Frontend:**
- Diseño, colores, layout — libertad total (seguir skill `frontend-design`)
- Animaciones, feedback visual, responsividad móvil
- Seguir SIEMPRE las prácticas de la skill `angular-component`

---

## STACK TECNOLÓGICO

### Backend
- Runtime: .NET 10
- Framework: ASP.NET Core Web API
- ORM: Entity Framework Core 9.0.1
- Base de datos: PostgreSQL 15+
- Driver BD: Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4
- Documentación: Swashbuckle.AspNetCore 6.6.2

### Frontend
- Framework: Angular 21.2.0
- Lenguaje: TypeScript 5.9.2
- UI: Angular Material 21.2.2
- Async: RxJS 7.8.0
- Build: Angular CLI 21.2.2

---

## ESTRUCTURA DE CARPETAS

```
d:/PracticasAdrian/ApiAppClaude/
├── .agents/
│   └── skills/                          ← LEER SIEMPRE AL INICIO
│       ├── angular-component/SKILL.md
│       ├── postgresql-optimization/SKILL.md
│       ├── frontend-design/SKILL.md
│       ├── web-design-guidelines/SKILL.md
│       ├── supabase-postgres-best-practices/SKILL.md
│       └── find-skills/SKILL.md
├── skills-lock.json                     ← registro de skills instaladas
├── docs/
│   └── plan-autenticacion.md            ← plan detallado de fases 1-7
├── CLAUDE.md
└── AplicacionAPI/
    ├── ClientManager.API/
    │   ├── Controllers/
    │   │   ├── CompaniesController.cs   ← /api/companies
    │   │   ├── ClientsController.cs     ← /api/clients
    │   │   └── AuthController.cs        ← /api/auth (Fase 2+)
    │   ├── Models/
    │   │   ├── Company.cs               ← entidad empresa
    │   │   ├── Client.cs                ← persona asignada a empresa
    │   │   └── ApplicationUser.cs       ← IdentityUser extendido (Fase 2+)
    │   ├── DTOs/
    │   │   ├── CompanyDtos.cs
    │   │   ├── ClientDtos.cs
    │   │   └── AuthDtos.cs              ← LoginDto, RegisterDto, AuthResponseDto
    │   ├── Data/ApplicationDbContext.cs
    │   ├── Services/
    │   │   ├── ICompanyService.cs / CompanyService.cs
    │   │   ├── IClientService.cs / ClientService.cs
    │   │   └── IAuthService.cs / AuthService.cs (Fase 2+)
    │   ├── Migrations/
    │   ├── FileUploadOperationFilter.cs
    │   ├── Program.cs
    │   └── appsettings.json
    └── ClientManagerWeb/
        └── src/
            ├── app/
            │   ├── models/
            │   │   ├── company.model.ts     ← Company, CompanyStatus, PagedResponse
            │   │   └── client.model.ts      ← Client (Name, Email, CompanyId)
            │   ├── services/
            │   │   ├── company.service.ts   ← /api/companies
            │   │   └── client.ts            ← /api/clients
            │   ├── components/navbar/
            │   ├── pages/
            │   │   ├── company-list/        ← /empresas
            │   │   ├── company-form/        ← /empresas/nueva, /empresas/:id/editar
            │   │   ├── company-detail/      ← /empresas/:id
            │   │   ├── client-list/         ← /clientes
            │   │   ├── client-form/         ← /clientes/nuevo, /clientes/:id/editar
            │   │   ├── client-detail/       ← /clientes/:id
            │   │   └── not-found/
            │   ├── app.ts
            │   ├── app.routes.ts
            │   ├── app.routes.constants.ts
            │   └── app.config.ts
            ├── environments/
            ├── styles.scss
            ├── material-theme.scss
            └── index.html
```

---

## BASE DE DATOS

### Estado actual (post Fase 1)

#### Tabla: Companies (antes Clients)
```sql
Id           INTEGER         PRIMARY KEY GENERATED ALWAYS AS IDENTITY
Name         VARCHAR(200)    NOT NULL
Description  VARCHAR(2000)   NOT NULL
LogoFileName VARCHAR(500)    NULL
Status       VARCHAR(50)     NOT NULL   -- enum CompanyStatus como string
CreatedAt    TIMESTAMPTZ     NOT NULL   DEFAULT NOW()
UpdatedAt    TIMESTAMPTZ     NOT NULL   DEFAULT NOW()

INDEX ON (Status)    → IX_Companies_Status
INDEX ON (UpdatedAt) → IX_Companies_UpdatedAt
INDEX ON (Name)      → IX_Companies_Name
```

Enum `CompanyStatus`: `Active | Inactive | Prospect | Churned`

Seed data: Acme Corp (Active), Tech Startup SL (Prospect)

#### Tabla: Clients (nueva — personas asignadas a empresas)
```sql
Id        INTEGER         PRIMARY KEY GENERATED ALWAYS AS IDENTITY
Name      VARCHAR(200)    NOT NULL
Email     VARCHAR(200)    NOT NULL  UNIQUE
CompanyId INTEGER         NOT NULL  FK → Companies(Id) CASCADE DELETE
CreatedAt TIMESTAMPTZ     NOT NULL  DEFAULT NOW()
UpdatedAt TIMESTAMPTZ     NOT NULL  DEFAULT NOW()

UNIQUE INDEX ON (Email)     → IX_Clients_Email
INDEX ON (CompanyId)        → IX_Clients_CompanyId
INDEX ON (Name)             → IX_Clients_Name
```

### Tablas que se añadirán en Fase 2 (Identity)
```
AspNetUsers, AspNetRoles, AspNetUserRoles, AspNetUserTokens,
AspNetUserClaims, AspNetRoleClaims
```

### Tablas que se añadirán en Fases 4-7
```
RefreshTokens   → Token, UserId, ExpiresAt, CreatedAt, RevokedAt, ReplacedByToken
EmailOtpCodes   → UserId, CodeHash, ExpiresAt, IsUsed, Attempts, CreatedAt
TrustedDevices  → UserId, DeviceToken, DeviceName, ExpiresAt, CreatedAt
```

---

## BACKEND — API ACTUAL

### CompaniesController — `/api/companies`
```
GET    /api/companies              → GetAll(page, pageSize, name?, status?)
GET    /api/companies/{id}         → GetById(id)
POST   /api/companies              → Create([FromForm] CreateCompanyDto, IFormFile? logo)
PUT    /api/companies/{id}         → Update(id, [FromForm] UpdateCompanyDto, IFormFile? logo)
PATCH  /api/companies/{id}/status  → UpdateStatus(id, [FromBody] UpdateCompanyStatusDto)
DELETE /api/companies/{id}         → Delete(id)
```

### ClientsController — `/api/clients`
```
GET    /api/clients         → GetAll(page, pageSize, name?, companyId?)
GET    /api/clients/{id}    → GetById(id)
POST   /api/clients         → Create([FromBody] CreateClientDto)
PUT    /api/clients/{id}    → Update(id, [FromBody] UpdateClientDto)
DELETE /api/clients/{id}    → Delete(id)
```

### AuthController — `/api/auth` (Fase 2+)
```
POST /api/auth/login           → público
POST /api/auth/register        → público (solo para seed inicial)
POST /api/auth/refresh         → público
POST /api/auth/logout          → autenticado
POST /api/auth/mfa-verify      → público (durante login)
POST /api/auth/forgot-password → público
POST /api/auth/reset-password  → público
GET  /api/clients/me           → [Authorize(Role="Cliente")]
```

---

## FRONTEND — RUTAS ACTUALES

```typescript
export const ROUTES = {
  COMPANIES: '/empresas',
  COMPANY_NEW: '/empresas/nueva',
  companyDetail: (id) => `/empresas/${id}`,
  companyEdit: (id) => `/empresas/${id}/editar`,
  CLIENTS: '/clientes',
  CLIENT_NEW: '/clientes/nuevo',
  clientDetail: (id) => `/clientes/${id}`,
  clientEdit: (id) => `/clientes/${id}/editar`,
};
```

### Rutas que se añadirán en Fase 5+
```
/login              → público
/mfa-verificar      → público (durante login)
/recuperar-password → público
/reset-password     → público
/perfil             → [Cliente] — vista de propio perfil
```

---

## MODELO DE NEGOCIO (MULTITENANT)

```
SuperAdmin
│
├── Gestiona Empresas (Companies) — CRUD completo
│   ├── Acme Corp
│   └── Tech Startup SL
│
└── Gestiona Clientes (Clients) — asignados a empresas
    ├── Cliente A → pertenece a Acme Corp → ve: nombre, email, empresa
    └── Cliente X → pertenece a Tech Startup SL → ve: nombre, email, empresa
```

**Roles (Fase 2+):**
- `SuperAdmin` → acceso total a `/api/companies` y `/api/clients`
- `Cliente` → solo `GET /api/clients/me` (sus propios datos)

---

## CONFIGURACIÓN

### Comandos para arrancar
```bash
# Backend
cd AplicacionAPI/ClientManager.API
dotnet run
# API: http://localhost:5000
# Swagger: http://localhost:5000/swagger
# Migraciones se aplican automáticamente al arrancar

# Frontend
cd AplicacionAPI/ClientManagerWeb
npm install
npm start
# App: http://localhost:4200
```

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=clientmanager;Username=postgres;Password=yourpassword"
  },
  "Logging": { "LogLevel": { "Default": "Information" } },
  "AllowedHosts": "*"
}
```

---

## NOTAS IMPORTANTES (no negociables)

- **CORS**: backend permite exactamente `http://localhost:4200` en desarrollo
- **Enums en JSON**: serializados como strings (`"Active"`, no `0`)
- **Logos (Companies)**: multipart/form-data en POST/PUT; guardados en `wwwroot/uploads/`; BD guarda solo nombre de fichero; URL construida en el servicio
- **Clients**: no tienen logo; POST/PUT usan `[FromBody]` JSON, no FormData
- **Paginación**: frontend siempre envía `page` y `pageSize`; al cambiar filtros resetea a `page=1`
- **Rutas en español**: `/empresas` para companies, `/clientes` para clients
- **Standalone components**: NO usar NgModules; seguir prácticas de skill `angular-component`
- **takeUntilDestroyed**: usar en todos los componentes con subscripciones
- **Dark mode**: clase CSS `dark-mode` en `document.body` gestionada desde Navbar
- **Auto-migrate**: `dbContext.Database.MigrateAsync()` en Program.cs al arrancar
- **JWT signing key** (Fase 2+): en User Secrets o variables de entorno, NUNCA en appsettings.json

---

## MEJORAS APLICADAS AL FRONTEND (referencia)

Estas mejoras se aplicaron durante el desarrollo. Son las convenciones que debe seguir todo componente nuevo o modificado.

### 1. Migración a Signals + OnPush

**Qué se hizo:** en todos los componentes de páginas (list, form, detail).

**Patrón:**
```typescript
// Antes
isLoading = false;
companies: Company[] = [];

// Después
isLoading = signal(false);
companies = signal<Company[]>([]);
```

**Regla:** cualquier variable que afecta a la vista y cambia asíncronamente → `signal()`.
Variables que solo se leen en el template de forma síncrona (constantes, opciones de paginación) → pueden quedarse como variables normales.

**En el template:** siempre llamar con `()`:
```html
@if (isLoading()) { ... }
[dataSource]="companies()"
```

**Por qué importa:** con `ChangeDetectionStrategy.OnPush`, Angular solo re-renderiza cuando cambia una referencia de signal. Sin signals, los cambios asíncronos no se reflejan en pantalla.

---

### 2. inject() en lugar de constructor injection

**Qué se hizo:** en todos los componentes.

```typescript
// Antes
constructor(private router: Router, private service: CompanyService) {}

// Después
private router  = inject(Router);
private service = inject(CompanyService);
```

**Por qué:** es el estilo moderno de Angular. Elimina boilerplate del constructor, funciona igual que la inyección por constructor a nivel de DI.

---

### 3. Formularios reactivos con nonNullable + getRawValue() + getters

**Qué se hizo:** en `company-form.ts` y `user-form.ts`.

**a) `fb.nonNullable.group`** en lugar de `fb.group`:
```typescript
// Antes
this.form = this.fb.group({ name: ['', Validators.required] });

// Después
this.form = this.fb.nonNullable.group({ name: ['', Validators.required] });
```
Efecto: al hacer `form.reset()`, los campos vuelven a su valor inicial (ej. `''`) en lugar de `null`. Tipos TypeScript más estrictos: `form.controls.name.value` es `string`, no `string | null`.

**b) `getRawValue()`** en lugar de `form.value`:
```typescript
// Antes
const dto = this.form.value;  // tipo: { name?: string } — campos disabled son undefined

// Después
const dto = this.form.getRawValue();  // tipo: { name: string } — incluye campos disabled
```
Efecto: si un campo está `disabled` (ej. email en modo edición), `form.value` lo omite. `getRawValue()` siempre los incluye.

**c) Getter properties** para acceder a los controles:
```typescript
// Antes (en el template)
form.get('name')?.hasError('required') && form.get('name')?.touched

// Después: getter en el componente
// IMPORTANTE: usar bracket notation — noPropertyAccessFromIndexSignature está activado en tsconfig
get name() { return this.form.controls['name']; }

// Template con getter
name.hasError('required') && name.touched
```
Efecto: sintaxis más corta, con tipos correctos (no requiere `?.`), y Angular puede optimizar mejor las expresiones del template.

**Campos nullables en nonNullable.group:** para selects sin valor inicial (ej. `companyId`), usar `null as unknown as number` para mantener la validación `required` funcionando correctamente (el validador `required` considera `null` inválido, pero no `0`).

---

### 4. Componentes afectados

| Componente | Signals | OnPush | inject() | nonNullable | getRawValue | Getters |
|---|---|---|---|---|---|---|
| `company-list` | ✅ | ✅ | ✅ | n/a | n/a | n/a |
| `company-form` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `company-detail` | ✅ | ✅ | ✅ | n/a | n/a | n/a |
| `user-list` | ✅ | ✅ | ✅ | n/a | n/a | n/a |
| `user-form` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user-detail` | ✅ | ✅ | ✅ | n/a | n/a | n/a |
| `login` | ✅ | ✅ | ✅ | n/a (FormsModule) | n/a | n/a |
