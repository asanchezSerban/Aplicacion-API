# Plan: Sistema de Autenticación para ClientManager

## Context

ClientManager es una app de gestión de clientes multitenant con .NET 10 + PostgreSQL (backend) y Angular 21 + Angular Material (frontend).

**Modelo de negocio:**
- Un único SuperAdmin (la empresa que despliega la app) gestiona todo
- El SuperAdmin crea empresas y crea clientes asignándolos a cada empresa
- Los clientes pueden entrar y ver sus propios datos y a qué empresa pertenecen

```
SuperAdmin
│
├── Crea y gestiona Empresas
│
├── PanaderiaPerez
│   ├── Cliente A  →  ve: nombre, email, empresa a la que pertenece
│   ├── Cliente B  →  ve: nombre, email, empresa a la que pertenece
│   └── Cliente C  →  ve: nombre, email, empresa a la que pertenece
│
└── TallerMecanico SL
    ├── Cliente X  →  ve: nombre, email, empresa a la que pertenece
    └── Cliente Y  →  ve: nombre, email, empresa a la que pertenece
```

---

## 1. Roles

Solo hay **2 roles**:

| Rol | Puede hacer |
|---|---|
| **SuperAdmin** | CRUD de empresas, CRUD de clientes, asignar clientes a empresas, ver todo |
| **Cliente** | Ver su propio perfil (nombre, email, empresa a la que pertenece) |

---

## 2. Esquema de Base de Datos

### Tablas existentes que cambian:
```
Companies  (antes se llamaba Clients — ahora son las empresas)
  Id, Name, Description, LogoFileName, Status, CreatedAt, UpdatedAt
```

### Tablas nuevas propias:
```
Clients              → Los clientes asignados a una empresa
  Id, Name, Email, CompanyId (FK → Companies), CreatedAt, UpdatedAt

RefreshTokens        → Token, UserId, ExpiresAt, CreatedAt, RevokedAt, ReplacedByToken
EmailOtpCodes        → UserId, CodeHash, ExpiresAt, IsUsed, Attempts, CreatedAt
TrustedDevices       → UserId, DeviceToken, DeviceName, ExpiresAt, CreatedAt
```

### Tablas creadas automáticamente por Identity:
```
AspNetUsers          → Usuarios del sistema (SuperAdmin + Clientes)
AspNetRoles          → Roles: SuperAdmin, Cliente
AspNetUserRoles      → Relación usuarios-roles
AspNetUserTokens     → Tokens de Identity
AspNetUserClaims     → Claims por usuario
AspNetRoleClaims     → Claims por rol
```

---

## 3. Estrategia JWT: Access Token + Refresh Token

### Flujo:
```
Login correcto → { accessToken (15min), refreshToken (7 días) }
Cada request HTTP → Header: Authorization: Bearer <accessToken>
Token expirado → POST /api/auth/refresh con refreshToken → nuevos tokens
Refresh expirado → Redirigir a login
```

**Contenido del JWT (claims):**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "SuperAdmin | Cliente",
  "clientId": "123",
  "companyId": "456",
  "iat": 1234567890,
  "exp": 1234568790
}
```

---

## 4. MFA mediante código por email (OTP)

### Flujo de login:
```
1. POST /api/auth/login (email + password)
2. Credenciales válidas → genera código 6 dígitos → envía al email
3. Frontend muestra pantalla de código
4. POST /api/auth/mfa-verify (código)
5. Válido → devuelve { accessToken, refreshToken }
```

### Seguridad:
- Código generado con `RandomNumberGenerator` (criptográficamente seguro)
- Expira en 10 minutos, un solo uso
- Máximo 3 intentos fallidos → invalidar código
- Código hasheado en BD (nunca en texto plano)

### "Recordar este dispositivo" (30 días):
- Checkbox en la pantalla del código
- Si se marca → siguiente login desde ese dispositivo salta el OTP

---

## 5. Recuperación de contraseña

```
1. Introduce email → POST /api/auth/forgot-password
2. Backend siempre responde 200 (no revelar si email existe)
3. Si existe → token de reset (1 hora) → email con enlace
4. POST /api/auth/reset-password (token + nueva contraseña)
5. Invalida todos los refresh tokens del usuario
```

---

## 6. Arquitectura Backend

### Nuevos/modificados archivos:
```
Controllers/
  AuthController.cs       → Login, Register, Refresh, Logout, ForgotPassword, ResetPassword, MfaVerify
  CompaniesController.cs  → CRUD de empresas (antes ClientsController)
  ClientsController.cs    → CRUD de clientes asignados a empresas

Models/
  Company.cs              → Antes Client.cs — ahora representa una empresa
  Client.cs               → Nuevo — cliente asignado a una empresa
  ApplicationUser.cs      → Extiende IdentityUser
  RefreshToken.cs
  EmailOtpCode.cs
  TrustedDevice.cs

DTOs/
  CompanyDtos.cs          → CreateCompanyDto, UpdateCompanyDto, CompanyResponseDto
  ClientDtos.cs           → CreateClientDto, UpdateClientDto, ClientResponseDto (actualizado)
  AuthDtos.cs             → LoginDto, RegisterDto, TokenResponseDto, MfaVerifyDto, etc.

Services/
  ICompanyService.cs / CompanyService.cs   → Lógica de empresas
  IClientService.cs / ClientService.cs     → Lógica de clientes (actualizado)
  IAuthService.cs / AuthService.cs         → Login, JWT, OTP
  IEmailService.cs / EmailService.cs       → Emails con MailKit
```

### Autorización por endpoint:
```
GET/POST/PUT/DELETE /api/companies      → Solo SuperAdmin
GET/POST/PUT/DELETE /api/clients        → Solo SuperAdmin
GET /api/clients/me                     → Cliente (sus propios datos)
POST /api/auth/*                        → Público
```

---

## 7. Arquitectura Frontend

### Vistas por rol:

**SuperAdmin ve:**
- Lista de empresas (con CRUD)
- Lista de clientes (con CRUD, puede filtrar por empresa)
- Formulario para crear/editar empresas
- Formulario para crear/editar clientes y asignarlos a una empresa

**Cliente ve:**
- Su perfil: nombre, email, empresa a la que pertenece

### Nuevos archivos:
```
services/
  auth.service.ts
  company.service.ts      → CRUD empresas
  client.service.ts       → CRUD clientes (actualizado)

guards/
  auth.guard.ts           → Redirige a /login si no autenticado
  admin.guard.ts          → Redirige si no es SuperAdmin

interceptors/
  auth.interceptor.ts     → Bearer token + refresh automático en 401

pages/
  login/
  mfa-verify/
  forgot-password/
  reset-password/
  companies/              → Lista y CRUD de empresas (SuperAdmin)
  clients/                → Lista y CRUD de clientes (SuperAdmin)
  profile/                → Perfil del cliente (Cliente)
```

### Rutas:
```
/login                    → Pública
/mfa-verificar            → Pública (durante login)
/recuperar-password       → Pública
/reset-password           → Pública
/empresas                 → SuperAdmin (lista + CRUD)
/clientes                 → SuperAdmin (lista + CRUD)
/perfil                   → Cliente (sus datos)
```

---

## 8. Seguridad adicional

- Rate limiting en auth endpoints (5 intentos/min por IP)
- Account lockout: 5 intentos fallidos = bloqueo 15 min
- OTP máximo 3 intentos fallidos
- Contraseña: mínimo 8 caracteres, mayúscula, minúscula, número, carácter especial
- HTTPS obligatorio en producción
- JWT signing key en User Secrets/variables de entorno, nunca en appsettings.json

---

## 9. Paquetes a instalar

**Backend (NuGet):**
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore`
- `Microsoft.AspNetCore.Authentication.JwtBearer`
- `MailKit`

**Frontend (npm):**
- Sin paquetes adicionales

---

## 10. Orden de implementación

1. **Renombrar y adaptar lo existente** — `Client` → `Company`, nuevo modelo `Client` vinculado a empresa, migración BD
2. **Identity + JWT básico** — ApplicationUser, DbContext con Identity, registro, login, JWT
3. **Roles SuperAdmin/Cliente** — Seed de roles, asignación, políticas de autorización
4. **Refresh tokens** — Entidad, rotación, endpoint /refresh
5. **Frontend auth** — Login, interceptor, guards, navbar con sesión y rol
6. **Vistas SuperAdmin** — CRUD empresas, CRUD clientes con asignación a empresa
7. **Vista Cliente** — Perfil con datos propios y empresa
8. **MFA por email (OTP)** — EmailService, generación/validación códigos, mfa-verify, recordar dispositivo
9. **Recuperación de contraseña** — Forgot/reset password
10. **Pulido** — Rate limiting, lockout, UX

---

## Verificación

- SuperAdmin crea empresa "PanaderiaPerez"
- SuperAdmin crea cliente "Cliente A" y lo asigna a PanaderiaPerez
- Cliente A recibe email de bienvenida con sus credenciales
- Cliente A hace login → código OTP al email → introduce código → ve su perfil y que pertenece a PanaderiaPerez
- Cliente A NO puede ver otros clientes ni otras empresas
- SuperAdmin ve todas las empresas y todos los clientes
- Token expirado → refresh automático transparente
- 5 intentos fallidos → cuenta bloqueada
- Olvidar contraseña → email → nueva contraseña → login
