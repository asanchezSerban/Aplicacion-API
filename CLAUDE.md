# ClientManager — Especificaciones de Implementación

## ROL Y OBJETIVO

Eres un desarrollador full-stack senior. Tu tarea es implementar la aplicación **ClientManager**
descrita en este documento. Las especificaciones definen QUÉ debe hacer la aplicación y su
contrato de datos. Tienes libertad total para decidir CÓMO implementarlo de la mejor manera posible.

---

## FILOSOFÍA DE IMPLEMENTACIÓN

### Lo que debes respetar (no negociable)
- Stack tecnológico: .NET 10 + PostgreSQL en backend, Angular 21 + Angular Material en frontend
- Contrato de la API: endpoints, verbos HTTP, DTOs, códigos de respuesta
- Esquema de base de datos: tabla Clients con sus campos y el enum ClientStatus
- Funcionalidades: CRUD completo, paginación, filtros, subida de logo, cambio de estado
- Comunicación frontend-backend: mismos modelos de datos y rutas de Angular

### Lo que puedes y debes mejorar libremente

**Backend — Seguridad y robustez:**
- Añadir validaciones adicionales que consideres necesarias
- Mejorar el manejo de errores con más granularidad
- Añadir rate limiting si lo ves conveniente
- Sanitizar inputs (nombre, descripción) contra XSS u otros ataques
- Validar tipos MIME reales de los ficheros subidos (no solo extensión)
- Añadir logging estructurado (ILogger) donde tenga sentido
- Optimizar queries EF Core (AsNoTracking, proyecciones, etc.)
- Configurar correctamente los límites de tamaño de request en Kestrel
- Cualquier mejora de configuración en Program.cs que consideres buena práctica

**Frontend — Visual y UX:**
- Diseño, colores, layout y espaciado: tienes libertad total
- Mejorar la experiencia de usuario más allá de lo especificado
- Añadir animaciones o transiciones si mejoran la UX
- Mejorar los mensajes de error para que sean más descriptivos
- Añadir feedback visual adicional (skeleton loaders, estados vacíos elaborados, etc.)
- Mejorar la responsividad para móvil
- Organizar y estructurar el CSS de la forma que consideres más mantenible

**En ambas partes:**
- Nombrado de variables, métodos y clases: usa el que te parezca más claro
- Organización interna de archivos dentro de cada capa
- Comentarios de código donde aporten valor real
- Cualquier patrón o práctica que mejore la calidad sin romper el contrato

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

AplicacionAPI/
├── ClientManager/
│   └── ClientManager.API/
│       ├── Controllers/ClientsController.cs
│       ├── Models/Client.cs
│       ├── DTOs/ClientDtos.cs
│       ├── Data/ApplicationDbContext.cs
│       ├── Services/IClientService.cs
│       ├── Services/ClientService.cs
│       ├── FileUploadOperationFilter.cs
│       ├── Program.cs
│       └── appsettings.json
└── ClientManagerWeb/
└── src/
├── app/
│   ├── models/client.model.ts
│   ├── services/client.ts
│   ├── components/navbar/
│   ├── pages/
│   │   ├── client-list/
│   │   ├── client-form/
│   │   ├── client-detail/
│   │   └── not-found/
│   ├── app.ts
│   ├── app.routes.ts
│   ├── app.routes.constants.ts
│   └── app.config.ts
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── styles.css
├── material-theme.scss
└── index.html



---

## BASE DE DATOS

### Tabla: Clients
```sql
Id           INTEGER         PRIMARY KEY GENERATED ALWAYS AS IDENTITY
Name         VARCHAR(200)    NOT NULL
Description  VARCHAR(2000)   NOT NULL
LogoFileName VARCHAR(500)    NULL
Status       VARCHAR(50)     NOT NULL   -- Enum almacenado como string
CreatedAt    TIMESTAMPTZ     NOT NULL   DEFAULT NOW()
UpdatedAt    TIMESTAMPTZ     NOT NULL   DEFAULT NOW()

-- Índices:
INDEX ON (Status)
INDEX ON (UpdatedAt)
INDEX ON (Name)
Enum ClientStatus

Active | Inactive | Prospect | Churned
Seed Data inicial
Acme Corp — Status: Active, Description: "Cliente principal del sector industrial"
Tech Startup SL — Status: Prospect, Description: "Startup tecnológica en fase de evaluación"
BACKEND — DETALLE COMPLETO
Model: Client.cs

public class Client
{
    public int Id { get; set; }
    [Required][MaxLength(200)] public string Name { get; set; }
    [Required][MaxLength(2000)] public string Description { get; set; }
    [MaxLength(500)] public string? LogoFileName { get; set; }
    public ClientStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum ClientStatus { Active, Inactive, Prospect, Churned }
DTOs: ClientDtos.cs

// Para crear
public class CreateClientDto
{
    [Required][StringLength(200, MinimumLength = 2)] public string Name { get; set; }
    [Required][StringLength(2000, MinimumLength = 10)] public string Description { get; set; }
    public ClientStatus? Status { get; set; } = ClientStatus.Prospect;
}

// Para actualizar
public class UpdateClientDto
{
    [Required][StringLength(200, MinimumLength = 2)] public string Name { get; set; }
    [Required][StringLength(2000, MinimumLength = 10)] public string Description { get; set; }
    [Required] public ClientStatus Status { get; set; }
}

// Para actualizar solo estado
public class UpdateStatusDto
{
    [Required] public ClientStatus Status { get; set; }
}

// Respuesta
public class ClientResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string? LogoUrl { get; set; }
    public ClientStatus Status { get; set; }
    public string StatusName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Paginación genérica
public class PagedResponseDto<T>
{
    public IEnumerable<T> Data { get; set; }
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
}
ApplicationDbContext.cs
Usa Npgsql con PostgreSQL
Conversión de enum a string en la BD
Índices en Status, UpdatedAt, Name configurados en OnModelCreating
Seed data en OnModelCreating
DbSet<Client> Clients
IClientService / ClientService
Interfaz con estos métodos:


Task<PagedResponseDto<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? name, string? status);
Task<ClientResponseDto> GetByIdAsync(int id);
Task<ClientResponseDto> CreateAsync(CreateClientDto dto, IFormFile? logo);
Task<ClientResponseDto> UpdateAsync(int id, UpdateClientDto dto, IFormFile? logo);
Task<ClientResponseDto> UpdateStatusAsync(int id, UpdateStatusDto dto);
Task DeleteAsync(int id);
Implementación inyecta:

ApplicationDbContext
IWebHostEnvironment
IHttpContextAccessor
IMemoryCache
Lógica de logos:

Carpeta: wwwroot/uploads/
Formatos permitidos: .jpg .jpeg .png .gif .webp
Tamaño máximo: 5 MB (validar y lanzar ArgumentException si supera)
Nombre de fichero: Guid.NewGuid() + extensión original
URL devuelta: {scheme}://{host}/uploads/{fileName}
Al eliminar o reemplazar cliente: borrar fichero físico anterior
Lanzar KeyNotFoundException si cliente no existe (middleware lo convierte en 404)
Lanzar ArgumentException para validaciones (middleware lo convierte en 400)
Lógica de paginación en GetAllAsync:

Filtro nombre: IQueryable con .Contains() case-insensitive
Filtro status: Enum.TryParse + comparación
OrderBy UpdatedAt descending
Skip/Take para paginar
TotalPages = Math.Ceiling(totalItems / pageSize)
ClientsController.cs
Ruta base: /api/clients


GET    /api/clients                → GetAll(page=1, pageSize=10, name?, status?)
GET    /api/clients/{id}           → GetById(id)
POST   /api/clients                → Create([FromForm] CreateClientDto, IFormFile? logo)
PUT    /api/clients/{id}           → Update(id, [FromForm] UpdateClientDto, IFormFile? logo)
PATCH  /api/clients/{id}/status    → UpdateStatus(id, [FromBody] UpdateStatusDto)
DELETE /api/clients/{id}           → Delete(id)
Códigos HTTP:

GET all → 200
GET by id → 200 / 404
POST → 201 Created con Location header
PUT → 200 / 404
PATCH → 200 / 404
DELETE → 204 / 404
Program.cs — Configuración

Servicios registrados:
- AddDbContext con Npgsql (connection string desde appsettings)
- AddMemoryCache
- AddHttpContextAccessor
- AddScoped<IClientService, ClientService>
- AddControllers con JsonStringEnumConverter (enums como strings en JSON)
- AddEndpointsApiExplorer
- AddSwaggerGen con FileUploadOperationFilter y comentarios XML

Pipeline (orden):
1. UseExceptionHandler (lambda global):
   - ArgumentException → 400 Bad Request + JSON {status, error}
   - KeyNotFoundException → 404 Not Found + JSON {status, error}
   - Otros → 500 Internal Server Error + JSON {status, error}
2. UseStaticFiles (sirve wwwroot/uploads/)
3. UseHttpsRedirection
4. UseCors("AllowAngular") — origin: http://localhost:4200, any method, any header
5. UseAuthorization
6. MapControllers

Al arrancar:
- Aplicar migraciones pendientes automáticamente (dbContext.Database.MigrateAsync())
appsettings.json

{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=clientmanager;Username=postgres;Password=yourpassword"
  },
  "Logging": { "LogLevel": { "Default": "Information" } },
  "AllowedHosts": "*"
}
FileUploadOperationFilter.cs
Clase que implementa IOperationFilter de Swashbuckle.

Detecta operaciones POST/PUT con IFormFile
Configura el schema como multipart/form-data en Swagger UI
Muestra campos: name, description, status, logo (file)
FRONTEND — DETALLE COMPLETO
Entornos

// environment.ts
export const environment = { production: false, apiUrl: 'http://localhost:5000/api' };

// environment.prod.ts
export const environment = { production: true, apiUrl: '/api' };
client.model.ts

export enum ClientStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Prospect = 'Prospect',
  Churned = 'Churned'
}

export interface Client {
  id: number;
  name: string;
  description: string;
  logoUrl: string | null;
  status: ClientStatus;
  statusName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClient { name: string; description: string; status: ClientStatus; logo?: File; }
export interface UpdateClient { name: string; description: string; status: ClientStatus; logo?: File; }
export interface UpdateStatus { status: ClientStatus; }

export interface PagedResponse<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
services/client.ts
Injectable singleton. Métodos:


getAll(page, pageSize, name?, status?): Observable<PagedResponse<Client>>
  // GET /clients?page=X&pageSize=X&name=X&status=X

getById(id): Observable<Client>
  // GET /clients/{id}

create(dto: CreateClient): Observable<Client>
  // POST /clients con FormData (name, description, status, logo?)

update(id, dto: UpdateClient): Observable<Client>
  // PUT /clients/{id} con FormData

updateStatus(id, dto: UpdateStatus): Observable<Client>
  // PATCH /clients/{id}/status con JSON

delete(id): Observable<void>
  // DELETE /clients/{id}
Los métodos que suben archivos convierten el DTO a FormData antes de enviar.

app.routes.constants.ts

export const ROUTES = {
  CLIENTS: '/clientes',
  CLIENT_NEW: '/clientes/nuevo',
  clientDetail: (id: number) => `/clientes/${id}`,
  clientEdit: (id: number) => `/clientes/${id}/editar`,
};
app.routes.ts

{ path: '', redirectTo: 'clientes', pathMatch: 'full' },
{ path: 'clientes', component: ClientListComponent },
{ path: 'clientes/nuevo', component: ClientFormComponent },
{ path: 'clientes/:id/editar', component: ClientFormComponent },
{ path: 'clientes/:id', component: ClientDetailComponent },
{ path: '**', component: NotFoundComponent }
app.config.ts

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
  ]
};
app.ts (Root Component)
Standalone. Template: <app-navbar/><router-outlet/>

Componente: Navbar
Standalone. Imports: MatToolbar, MatButton, MatIcon, MatSlideToggle.

Funcionalidad:

Botón "Clientes" que navega a /clientes
Toggle de modo oscuro: añade/quita clase dark-mode en document.body
Layout: barra horizontal Material con título a la izquierda y controles a la derecha
Componente: ClientList
Standalone. Imports: MatTable, MatPaginator, MatProgressSpinner, MatButton, MatIcon,
MatSnackBar, MatDialog, MatMenu, MatSelect, MatInput, MatFormField, MatChip.

Estado del componente:


clients: Client[] = []
totalItems = 0
totalPages = 0
currentPage = 1
pageSize = 10
pageSizeOptions = [5, 10, 25]
isLoading = false
nameFilter = ''
statusFilter = ''
Funcionalidad:

Fila de filtros: input búsqueda por nombre + select de estado + botón limpiar
Tabla con columnas: nombre, descripción (truncada), estado (chip coloreado), acciones
Colores chip: Active=primary(azul), Inactive=warn(rojo), Prospect=accent(morado), Churned=warn(rojo)
Acciones por fila: ver (visibility), editar (edit), cambiar estado (swap_horiz), eliminar (delete)
Menú cambio de estado: lista los 4 estados, deshabilita el actual
Paginador Material al pie con opciones [5, 10, 25]
Spinner durante carga
Mensaje "No se encontraron clientes" si lista vacía
Al cambiar filtros: resetear a página 1 y recargar
Eliminar: abrir ConfirmDialog, si confirma → delete() → recargar
Usar takeUntilDestroyed para cleanup de subscripciones
Notificaciones MatSnackBar (3s): éxito verde, error rojo
Componente: ClientForm
Standalone. Modo dual: crea si no hay :id, edita si hay :id.

Formulario reactivo:


form = fb.group({
  name:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
  description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  status:      [ClientStatus.Prospect, Validators.required],
})
selectedFile: File | null = null
currentLogoUrl: string | null = null
isLoading = false
isEditMode = false
Funcionalidad:

Título dinámico: "Nuevo Cliente" / "Editar Cliente"
Campos con validación y mensajes de error inline
Input file nativo para logo
Preview del logo actual en modo edición
Botón submit deshabilitado si form inválido o isLoading
Botón cancelar → navega a /clientes
ngOnInit: si hay :id, cargar cliente y rellenar form
onSubmit: create() o update() según modo; éxito → /clientes; error → snackbar
Componente: ClientDetail
Standalone.

Funcionalidad:

Spinner durante carga
Imagen del logo si logoUrl existe
Nombre como título principal
Chip de estado con mismo sistema de colores
Descripción completa
Fechas formateadas: "dd/MM/yyyy HH:mm"
Botón "Editar" → /clientes/:id/editar
Botón "Volver" → /clientes
Componente: ConfirmDialog
Dialog de Angular Material.

Recibe: { title: string, message: string }
Botones: Cancelar (false) y Confirmar (true)
Componente: NotFound
Página 404 con botón para volver a /clientes.

index.html

<head>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
  <app-root>
    <div style="display:flex;justify-content:center;align-items:center;height:100vh">
      <div>Cargando...</div>
    </div>
  </app-root>
</body>
Estilos
material-theme.scss: tema Angular Material con paleta primary azul
styles.css: reset básico, font Roboto, soporte dark mode (.dark-mode en body)
FLUJO COMPLETO DE LA APLICACIÓN

1. Usuario abre http://localhost:4200 → redirige a /clientes
2. ClientList carga: GET /api/clients?page=1&pageSize=10
3. Se muestran clientes en tabla paginada

CREAR:
→ Botón "Nuevo" → /clientes/nuevo
→ Formulario vacío (status=Prospect por defecto)
→ Guardar: POST /api/clients (FormData)
→ Éxito → snackbar verde → /clientes

EDITAR:
→ Botón editar → /clientes/:id/editar
→ GET /api/clients/:id → rellena formulario
→ Guardar: PUT /api/clients/:id (FormData)
→ Éxito → snackbar verde → /clientes

VER DETALLE:
→ Botón ver → /clientes/:id
→ GET /api/clients/:id → muestra info completa

CAMBIAR ESTADO:
→ Menú en fila → seleccionar estado
→ PATCH /api/clients/:id/status (JSON)
→ Éxito → snackbar verde → recarga lista

ELIMINAR:
→ Botón eliminar → ConfirmDialog
→ Confirmar: DELETE /api/clients/:id
→ Éxito → snackbar verde → recarga lista

FILTRAR:
→ Escribir nombre O seleccionar estado
→ Resetea a página 1 → recarga
→ GET /api/clients?name=X&status=X&page=1&pageSize=10
COMANDOS PARA ARRANCAR
Backend

cd ClientManager/ClientManager.API
dotnet run
# API: http://localhost:5000
# Swagger: http://localhost:5001/swagger
# Migraciones se aplican automáticamente
Frontend

cd ClientManagerWeb
npm install
npm start
# App: http://localhost:4200
NOTAS IMPORTANTES (no negociables)
CORS: El backend permite exactamente http://localhost:4200 en desarrollo.
Enum en JSON: Los enums se serializan como strings ("Active", no 0).
Multipart: Los endpoints POST/PUT usan [FromForm], no [FromBody].
Logos: Se sirven como estáticos desde /uploads/. La BD guarda solo el nombre de fichero; la URL completa se construye en el servicio.
Paginación: El frontend siempre envía page y pageSize. Al cambiar filtros, resetea a page=1.
Rutas en español: Las rutas del frontend usan /clientes.
Standalone components: No usar NgModules. Todos los componentes son standalone con imports explícitos.
takeUntilDestroyed: Usar en todos los componentes con subscripciones.
Dark mode: Clase CSS dark-mode en document.body gestionada desde Navbar.
Auto-migrate: dbContext.Database.MigrateAsync() en Program.cs antes de app.Run().

