# ClientManager

Aplicación de gestión de empresas y usuarios. Stack: .NET 10 + Angular 21 + PostgreSQL 15.

## Requisitos

- .NET 10 SDK
- Node.js 22+
- PostgreSQL 15+
- [smtp4dev](https://github.com/rnwood/smtp4dev) (para emails en desarrollo)

## Arrancar en desarrollo

### Backend

```bash
cd AplicacionAPI/ClientManager.API

# Configurar secretos (solo la primera vez)
dotnet user-secrets set "Jwt:SecretKey" "tu-clave-secreta-de-al-menos-32-caracteres"
dotnet user-secrets set "SuperAdmin:Password" "Admin1234!"

# Arrancar (aplica migraciones automáticamente y crea el SuperAdmin)
dotnet run
```

API disponible en `http://localhost:5000`  
Swagger en `http://localhost:5000/swagger`

### Frontend

```bash
cd AplicacionAPI/ClientManagerWeb
npm install
npm start
```

App disponible en `http://localhost:4200`

## Variables de configuración

### `appsettings.json` (valores ya incluidos)

```json
{
  "Jwt": {
    "Issuer": "ClientManagerAPI",
    "Audience": "ClientManagerWeb"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:4200"]
  },
  "Frontend": {
    "BaseUrl": "http://localhost:4200"
  },
  "Email": {
    "Host": "localhost",
    "Port": 2525,
    "From": "noreply@clientmanager.local"
  }
}
```

### User Secrets (obligatorios, nunca en control de versiones)

| Clave | Descripción |
|-------|-------------|
| `Jwt:SecretKey` | Clave de firma JWT (≥ 32 caracteres) |
| `SuperAdmin:Password` | Contraseña del superadministrador inicial |

## Credenciales por defecto (desarrollo)

| Campo | Valor |
|-------|-------|
| Email | `admin@clientmanager.local` (o el configurado en `SuperAdmin:Email`) |
| Contraseña | El configurado en `SuperAdmin:Password` (User Secrets) |

## Roles

- **SuperAdmin**: acceso total — gestiona empresas y usuarios, configura TOTP con Google Authenticator
- **Cliente**: solo puede ver su propio perfil (`/perfil`)

## CI

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) ejecuta:
- `dotnet build` + `dotnet format --verify-no-changes`
- `ng build --configuration production`
