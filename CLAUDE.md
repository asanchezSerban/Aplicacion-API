# ClientManager — Estado actual del proyecto

## Stack
- **Backend**: .NET 10 · ASP.NET Core · EF Core 9 · PostgreSQL · Identity + JWT (cookie HttpOnly)
- **Frontend**: Angular 21 · Angular Material · TypeScript · RxJS
- **Arrancar**: `dotnet run` en `AplicacionAPI/ClientManager.API` · `npm start` en `AplicacionAPI/ClientManagerWeb`

## Roles
- `SuperAdmin` — acceso total al panel de gestión
- `Cliente` — solo ve su propio perfil (`GET /api/users/me`)

## Autenticación
- Login → JWT en cookie HttpOnly (`accessToken`)
- SuperAdmin: TOTP (Google Authenticator) tras login
- Clientes: Email OTP tras login
- `provideAppInitializer` hidrata identidad desde `/auth/me` al arrancar

## Modelos principales

### Company
`Id, Name, Description, LogoFileName, Status (enum), ContactEmail, ContactPhone, Address, CreatedAt, UpdatedAt`
- Status: `Active | Prospect | Inactive | Churned` (serializado como string)

### User (contacto de empresa)
`Id, Name, Email, CompanyId, CreatedAt, UpdatedAt`
- Al crear: también se crea `ApplicationUser` con rol "Cliente" (operación atómica)

## Convenciones frontend (obligatorio)
- `signal()` para estado reactivo · `inject()` en lugar de constructor · `ChangeDetectionStrategy.OnPush`
- Control flow nativo: `@if`, `@for` · NO `*ngIf`, `*ngFor`
- `takeUntilDestroyed(this.destroyRef)` en todas las subscripciones
- Formularios: `fb.nonNullable.group` · `getRawValue()` · getters para controles

## Skills instaladas
| Skill | Cuándo usarla |
|-------|---------------|
| `angular-component` | Cualquier componente Angular |
| `frontend-design` | UI, layouts, estilos |
| `web-design-guidelines` | Decisiones de diseño |
| `ui-animation` | Animaciones y transiciones |
| `kpi-dashboard-design` | Dashboards y métricas |
| `postgresql-optimization` | Migraciones EF, queries |

## Endpoints de desarrollo (solo Development)
- `POST /api/dev/seed-companies?count=N` — crea N empresas aleatorias
- `POST /api/dev/seed-users?count=N` — crea N usuarios con cuenta funcional (pass: `Temporal@2026!`)
- `DELETE /api/dev/delete-all-users` — elimina todos los usuarios e Identity accounts
- `GET /api/dev/last-otp?email=X` — devuelve el último OTP generado

## Notas importantes
- Logos: multipart/form-data; guardados en `wwwroot/uploads/`
- Enums en JSON: strings (`"Active"`, no `0`)
- Migraciones: `dotnet ef migrations add NombreMigracion` → se auto-aplican al arrancar
- CORS: solo `http://localhost:4200` en desarrollo
- JWT key y SuperAdmin password: en User Secrets, nunca en appsettings.json
- Dark mode: clase `dark-mode` en `document.body`
- `onSameUrlNavigation: 'reload'` activo — navegar a la misma ruta recarga el componente
