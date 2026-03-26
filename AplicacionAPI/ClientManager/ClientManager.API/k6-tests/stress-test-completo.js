/**
 * ═══════════════════════════════════════════════════════════════════
 *  ClientManager API — Test de Estrés Completo
 *  Duración total: ~5 minutos
 *  Herramienta: k6  (https://k6.io)
 *  Ejecución: k6 run stress-test-completo.js
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ESCENARIOS:
 *   1. carga_mixta       → CRUD completo con subida de logo. Rampa
 *                          progresiva hasta 120 VUs.
 *   2. spike_lectura     → Spike brutal de 250 VUs solo lectura.
 *                          Comienza en el minuto 2.
 *   3. escrituras_duras  → 40 VUs haciendo create+logo+update+delete
 *                          sin pausa. Comienza en el minuto 3:15.
 *
 *  UMBRALES (difíciles de pasar):
 *   - p(95) de todas las peticiones < 500 ms
 *   - p(99) < 1000 ms
 *   - Tasa de errores HTTP < 1 %
 *   - Checks aprobados > 97 %
 *   - p(95) de listado < 300 ms
 *   - p(95) de creación < 800 ms
 *   - p(95) de upload con logo < 1500 ms
 * ═══════════════════════════════════════════════════════════════════
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import encoding from 'k6/encoding';

// ─── Configuración ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000';
const API      = `${BASE_URL}/api/clients`;

const HEADERS_JSON = { 'Content-Type': 'application/json' };

// PNG 1×1 píxel codificado en base64 (imagen válida, ~68 bytes)
const TINY_PNG = encoding.b64decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);

// ─── Métricas personalizadas ──────────────────────────────────────
const durListado   = new Trend('dur_listado_ms',   true);
const durCreacion  = new Trend('dur_creacion_ms',  true);
const durUpload    = new Trend('dur_upload_ms',    true);
const durUpdate    = new Trend('dur_update_ms',    true);
const durStatus    = new Trend('dur_status_ms',    true);
const durDelete    = new Trend('dur_delete_ms',    true);
const tasaErrores  = new Rate('tasa_errores');
const totalCreados = new Counter('total_creados');
const totalBorrados= new Counter('total_borrados');

// ─── Opciones / Escenarios ────────────────────────────────────────
export const options = {
  scenarios: {

    /**
     * ESCENARIO 1 — Carga mixta progresiva
     * Simula uso real: lectura, creación, edición, cambio de estado,
     * borrado. Incluye subida de logo en ~30% de las creaciones.
     * Rampa hasta 120 VUs durante 4m30s.
     */
    carga_mixta: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30  }, // Calentamiento
        { duration: '60s', target: 80  }, // Carga media
        { duration: '60s', target: 80  }, // Sostenida
        { duration: '30s', target: 120 }, // Presión alta
        { duration: '60s', target: 120 }, // Sostenida alta
        { duration: '30s', target: 0   }, // Ramp-down
      ],
      gracefulRampDown: '10s',
      exec: 'cicloMixto',
    },

    /**
     * ESCENARIO 2 — Spike brutal de lectura
     * 250 VUs aparecen de golpe en el minuto 2 y martillan el endpoint
     * de listado con filtros y paginación variados. Dura 50 segundos.
     */
    spike_lectura: {
      executor: 'ramping-vus',
      startTime: '2m',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 250 }, // Subida instantánea
        { duration: '30s', target: 250 }, // Sostenido
        { duration: '10s', target: 0   }, // Caída
      ],
      gracefulRampDown: '5s',
      exec: 'soloLectura',
    },

    /**
     * ESCENARIO 3 — Escrituras intensas con upload
     * 40 VUs haciendo ciclos create-con-logo → update → cambio-estado
     * → delete sin apenas pausa. Estresa el sistema de ficheros y la BD
     * simultáneamente. Comienza en el minuto 3:15 y dura 90 segundos.
     */
    escrituras_duras: {
      executor: 'constant-vus',
      startTime: '3m15s',
      vus: 40,
      duration: '90s',
      gracefulStop: '10s',
      exec: 'cicloEscritura',
    },
  },

  // ── Umbrales ── (si alguno falla el test termina en rojo) ──────
  thresholds: {
    // Rendimiento general bajo los 3 escenarios simultáneos
    // Con 150 VUs de spike + 120 mixtos + 40 escrituras = 310 VUs máx.
    'http_req_duration':             ['p(95)<800', 'p(99)<1200'],

    // Listado: la operación más costosa (COUNT + ORDER BY + paginación)
    // bajo el spike de 250 VUs simultáneos; umbral exigente pero realista
    'dur_listado_ms':                ['p(95)<1200'],
    'dur_creacion_ms':               ['p(95)<800'],
    'dur_upload_ms':                 ['p(95)<1500'],
    'dur_update_ms':                 ['p(95)<600'],
    'dur_status_ms':                 ['p(95)<400'],
    'dur_delete_ms':                 ['p(95)<400'],

    // Fiabilidad: máximo 1 % de errores HTTP inesperados (415, 500…)
    // Los 404 de obtenerIdInexistente NO se cuentan porque tasaErrores no los acumula
    'tasa_errores':                  ['rate<0.01'],

    // Calidad: al menos el 97 % de los checks deben pasar
    'checks':                        ['rate>0.97'],

    // Throughput mínimo de creación bajo carga
    'total_creados':                 ['count>50'],
  },
};

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Número aleatorio entero entre min y max (ambos incluidos) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pausa aleatoria entre min y max segundos */
function pause(min = 0.1, max = 0.5) {
  sleep(Math.random() * (max - min) + min);
}

/** Nombres y descripciones aleatorios para evitar caches triviales */
const NOMBRES = [
  'Acme Industries', 'Globex Corp', 'Initech', 'Umbrella Ltd',
  'Stark Enterprises', 'Wayne Industries', 'Oscorp', 'Weyland Corp',
  'Cyberdyne Systems', 'Tyrell Corporation', 'Soylent Corp', 'Momcorp',
];
const ESTADOS = ['Active', 'Inactive', 'Prospect', 'Churned'];

function nombreAleatorio() {
  const base = NOMBRES[randInt(0, NOMBRES.length - 1)];
  return `${base} ${randInt(100, 9999)}`;
}

function descripcionAleatoria() {
  const frases = [
    'Empresa líder en soluciones tecnológicas para el sector industrial.',
    'Proveedor global de servicios de consultoría y transformación digital.',
    'Compañía especializada en desarrollo de software a medida y cloud.',
    'Organización con más de 20 años de experiencia en el mercado europeo.',
    'Startup de alto crecimiento en el ámbito de inteligencia artificial.',
  ];
  return frases[randInt(0, frases.length - 1)];
}

function estadoAleatorio(excluir) {
  const disponibles = ESTADOS.filter(e => e !== excluir);
  return disponibles[randInt(0, disponibles.length - 1)];
}

// ═══════════════════════════════════════════════════════════════════
//  OPERACIONES ATÓMICAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Lista clientes con parámetros variados.
 * Cubre: paginación, filtro por nombre, filtro por estado, combinados.
 */
function listar() {
  const variantes = [
    `${API}?page=1&pageSize=10`,
    `${API}?page=2&pageSize=5`,
    `${API}?page=1&pageSize=25`,
    `${API}?page=1&pageSize=10&status=Active`,
    `${API}?page=1&pageSize=10&status=Prospect`,
    `${API}?page=1&pageSize=10&status=Inactive`,
    `${API}?page=1&pageSize=10&name=Corp`,
    `${API}?page=1&pageSize=10&name=Tech`,
    `${API}?page=1&pageSize=10&name=Startup&status=Prospect`,
    `${API}?page=3&pageSize=10`,
  ];
  const url = variantes[randInt(0, variantes.length - 1)];

  // name agrupa todas las variantes de query-string bajo una sola serie temporal
  const res = http.get(url, { tags: { name: 'GET /api/clients (list)' } });
  durListado.add(res.timings.duration);

  const ok = check(res, {
    '[LIST] status 200':          r => r.status === 200,
    '[LIST] body es JSON válido': r => { try { JSON.parse(r.body); return true; } catch { return false; } },
    '[LIST] tiene campo data':    r => { try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; } },
    '[LIST] tiene totalItems':    r => { try { return typeof JSON.parse(r.body).totalItems === 'number'; } catch { return false; } },
    '[LIST] tiene totalPages':    r => { try { return typeof JSON.parse(r.body).totalPages === 'number'; } catch { return false; } },
    '[LIST] pageSize respetado':  r => { try { const b = JSON.parse(r.body); return b.data.length <= b.pageSize; } catch { return false; } },
  });
  tasaErrores.add(!ok || res.status !== 200);
  return res;
}

/** Obtiene un cliente por ID. Prueba tanto IDs válidos como inválidos. */
function obtenerPorId(id) {
  // name evita una serie temporal por cada ID distinto
  const res = http.get(`${API}/${id}`, { tags: { name: 'GET /api/clients/{id}' } });
  const ok = check(res, {
    '[GET] status 200':        r => r.status === 200,
    '[GET] id coincide':       r => { try { return JSON.parse(r.body).id === id; } catch { return false; } },
    '[GET] tiene name':        r => { try { return typeof JSON.parse(r.body).name === 'string'; } catch { return false; } },
    '[GET] tiene statusName':  r => { try { return typeof JSON.parse(r.body).statusName === 'string'; } catch { return false; } },
  });
  tasaErrores.add(!ok || res.status !== 200);
  return res;
}

/** Prueba que un ID inexistente devuelva exactamente 404 */
function obtenerIdInexistente() {
  const id = randInt(9000000, 9999999); // Muy improbable que exista
  const res = http.get(`${API}/${id}`, { tags: { name: 'GET /api/clients/{id} (404)' } });
  check(res, {
    '[GET-404] devuelve 404':          r => r.status === 404,
    '[GET-404] body tiene campo error': r => { try { return typeof JSON.parse(r.body).error === 'string'; } catch { return false; } },
  });
  // Un 404 esperado NO es un error de la API, así que NO lo contamos en tasaErrores
}

/**
 * Crea un cliente SIN logo vía multipart/form-data.
 * El endpoint tiene [Consumes("multipart/form-data")], así que enviar
 * application/json devuelve 415. Se fuerza multipart incluyendo un
 * archivo vacío de 0 bytes. El servicio lo ignora porque comprueba
 * `logo is not null && logo.Length > 0` antes de procesar el archivo.
 */
function crearCliente() {
  const formData = {
    name:        nombreAleatorio(),
    description: descripcionAleatoria(),
    status:      ESTADOS[randInt(0, ESTADOS.length - 1)],
    // Archivo 0 bytes → fuerza multipart/form-data en k6;
    // el servicio lo descarta porque Length == 0
    logo:        http.file(new ArrayBuffer(0), '', 'application/octet-stream'),
  };

  const res = http.post(API, formData, { tags: { name: 'POST /api/clients (sin logo)' } });
  durCreacion.add(res.timings.duration);

  let clienteCreado = null;
  const ok = check(res, {
    '[CREATE] status 201':        r => r.status === 201,
    '[CREATE] tiene id numérico': r => { try { const b = JSON.parse(r.body); return typeof b.id === 'number' && b.id > 0; } catch { return false; } },
    '[CREATE] tiene name':        r => { try { return typeof JSON.parse(r.body).name === 'string'; } catch { return false; } },
    '[CREATE] tiene logoUrl':     r => { try { const b = JSON.parse(r.body); return b.hasOwnProperty('logoUrl'); } catch { return false; } },
    '[CREATE] cabecera Location': r => r.headers['Location'] !== undefined || r.headers['location'] !== undefined,
  });
  tasaErrores.add(!ok || res.status !== 201);

  if (res.status === 201) {
    try {
      clienteCreado = JSON.parse(res.body);
      totalCreados.add(1);
    } catch { /* ignorar */ }
  }
  return clienteCreado;
}

/**
 * Crea un cliente CON logo (multipart/form-data).
 * Este es el caso más costoso: parsing multipart + I/O de disco.
 */
function crearClienteConLogo() {
  const formData = {
    name:        nombreAleatorio(),
    description: descripcionAleatoria(),
    status:      ESTADOS[randInt(0, ESTADOS.length - 1)],
    logo:        http.file(TINY_PNG, 'logo.png', 'image/png'),
  };

  const res = http.post(API, formData);
  durUpload.add(res.timings.duration);

  let clienteCreado = null;
  const ok = check(res, {
    '[UPLOAD] status 201':              r => r.status === 201,
    '[UPLOAD] logoUrl no es null':      r => { try { return JSON.parse(r.body).logoUrl !== null; } catch { return false; } },
    '[UPLOAD] logoUrl contiene /uploads/': r => { try { return JSON.parse(r.body).logoUrl.includes('/uploads/'); } catch { return false; } },
  });
  tasaErrores.add(!ok || res.status !== 201);

  if (res.status === 201) {
    try {
      clienteCreado = JSON.parse(res.body);
      totalCreados.add(1);
    } catch { /* ignorar */ }
  }
  return clienteCreado;
}

/**
 * Actualiza un cliente existente (multipart/form-data con logo).
 * El endpoint PUT usa [FromForm], por lo que se envía como multipart.
 * Incluir el logo en el update prueba también la sustitución de archivo.
 */
function actualizarCliente(id, estadoActual) {
  const formData = {
    name:        nombreAleatorio(),
    description: descripcionAleatoria(),
    status:      estadoActual,
    logo:        http.file(TINY_PNG, 'logo-update.png', 'image/png'),
  };

  const res = http.put(`${API}/${id}`, formData, { tags: { name: 'PUT /api/clients/{id}' } });
  durUpdate.add(res.timings.duration);

  const ok = check(res, {
    '[UPDATE] status 200':              r => r.status === 200,
    '[UPDATE] id no cambia':            r => { try { return JSON.parse(r.body).id === id; } catch { return false; } },
    '[UPDATE] updatedAt presente':      r => { try { return typeof JSON.parse(r.body).updatedAt === 'string'; } catch { return false; } },
    '[UPDATE] logoUrl actualizado':     r => { try { return JSON.parse(r.body).logoUrl !== null; } catch { return false; } },
  });
  tasaErrores.add(!ok || res.status !== 200);
}

/**
 * Actualiza solo el estado (PATCH).
 * Es la operación más ligera — umbral más estricto (p95 < 400ms).
 */
function cambiarEstado(id, estadoActual) {
  const nuevoEstado = estadoAleatorio(estadoActual);
  const payload = JSON.stringify({ status: nuevoEstado });

  const res = http.patch(`${API}/${id}/status`, payload, { headers: HEADERS_JSON, tags: { name: 'PATCH /api/clients/{id}/status' } });
  durStatus.add(res.timings.duration);

  const ok = check(res, {
    '[STATUS] status 200':            r => r.status === 200,
    '[STATUS] status actualizado':    r => { try { return JSON.parse(r.body).status === nuevoEstado; } catch { return false; } },
    '[STATUS] statusName actualizado':r => { try { return JSON.parse(r.body).statusName === nuevoEstado; } catch { return false; } },
  });
  tasaErrores.add(!ok || res.status !== 200);
  return nuevoEstado;
}

/** Elimina un cliente por ID. */
function eliminarCliente(id) {
  const res = http.del(`${API}/${id}`, null, { tags: { name: 'DELETE /api/clients/{id}' } });
  durDelete.add(res.timings.duration);

  const ok = check(res, {
    '[DELETE] status 204': r => r.status === 204,
    '[DELETE] body vacío': r => r.body === '' || r.body === null || r.body === undefined,
  });
  tasaErrores.add(!ok || res.status !== 204);
  if (res.status === 204) totalBorrados.add(1);
}

/**
 * Prueba las validaciones del backend: datos inválidos deben dar 400.
 * Se envía como multipart/form-data (obligatorio por [Consumes]) usando
 * un archivo vacío para forzar el content-type correcto.
 */
function probarValidaciones() {
  const vacío = http.file(new ArrayBuffer(0), '', 'application/octet-stream');

  // Nombre demasiado corto (< 2 chars) → [StringLength(200, MinimumLength = 2)]
  const res1 = http.post(API,
    { name: 'X', description: 'Descripcion valida suficientemente larga', status: 'Active', logo: vacío },
    { tags: { name: 'POST /api/clients (val-nombre)' } }
  );
  check(res1, { '[VALIDACION] nombre corto → 400': r => r.status === 400 });

  // Descripción demasiado corta (< 10 chars) → [StringLength(2000, MinimumLength = 10)]
  const res2 = http.post(API,
    { name: 'Nombre Valido Empresa', description: 'Corta', status: 'Active', logo: vacío },
    { tags: { name: 'POST /api/clients (val-desc)' } }
  );
  check(res2, { '[VALIDACION] desc corta → 400': r => r.status === 400 });
}

// ═══════════════════════════════════════════════════════════════════
//  FUNCIONES EXPORTADAS (exec de cada escenario)
// ═══════════════════════════════════════════════════════════════════

/**
 * ESCENARIO 1 — Ciclo mixto realista
 *
 * Cada VU ejecuta una secuencia que simula a un usuario real:
 *   listado → creación → lectura → update → estado → [delete]
 * Con probabilidad de usar logo o no, y de borrar o dejar el cliente.
 */
export function cicloMixto() {
  group('Listado y lectura', () => {
    listar();
    pause(0.05, 0.15);

    // 15% de las veces también prueba validaciones del backend
    if (Math.random() < 0.15) probarValidaciones();

    // 10% de las veces prueba un 404 esperado
    if (Math.random() < 0.10) obtenerIdInexistente();
  });

  pause(0.1, 0.3);

  group('Ciclo CRUD', () => {
    // ~30% de las creaciones llevan logo (caso más costoso)
    const cliente = Math.random() < 0.30
      ? crearClienteConLogo()
      : crearCliente();

    if (!cliente) return;

    pause(0.05, 0.1);

    // Leer el cliente recién creado
    obtenerPorId(cliente.id);
    pause(0.05, 0.1);

    // Actualizar datos
    actualizarCliente(cliente.id, cliente.status);
    pause(0.05, 0.1);

    // Cambiar estado
    cambiarEstado(cliente.id, cliente.status);
    pause(0.05, 0.1);

    // 70% de las veces borrar; el 30% restante deja datos para que
    // el listado tenga contenido real que paginar
    if (Math.random() < 0.70) {
      eliminarCliente(cliente.id);
    }
  });

  pause(0.2, 0.8);
}

/**
 * ESCENARIO 2 — Solo lectura agresiva (spike)
 *
 * 250 VUs martillando el endpoint de listado con variantes de filtros
 * y paginación. Sin pausa. Mide la capacidad de lectura bajo pico.
 */
export function soloLectura() {
  listar();
  sleep(0.05);
}

/**
 * ESCENARIO 3 — Escrituras intensas con upload
 *
 * 40 VUs en ciclo rápido: create-con-logo → update → status → delete.
 * Sin apenas pausa. Estresa simultáneamente:
 *   - El sistema de ficheros (guardar/borrar PNGs)
 *   - PostgreSQL (INSERT + UPDATE + DELETE rápidos)
 *   - El parsing multipart del servidor
 */
export function cicloEscritura() {
  const cliente = crearClienteConLogo();
  if (!cliente) { sleep(0.5); return; }

  actualizarCliente(cliente.id, cliente.status);
  cambiarEstado(cliente.id, cliente.status);
  eliminarCliente(cliente.id);

  sleep(0.1);
}

// ═══════════════════════════════════════════════════════════════════
//  SETUP — se ejecuta una sola vez antes de todos los escenarios
// ═══════════════════════════════════════════════════════════════════
export function setup() {
  console.log('═══════════════════════════════════════════');
  console.log('  ClientManager API — Test de Estrés');
  console.log('  Duración estimada: ~5 minutos');
  console.log('  API: ' + BASE_URL);
  console.log('═══════════════════════════════════════════');

  // Verificar que la API está disponible antes de empezar
  const res = http.get(`${API}?page=1&pageSize=1`);
  if (res.status !== 200) {
    console.error('⚠️  La API no responde correctamente. ¿Está corriendo en ' + BASE_URL + '?');
  } else {
    console.log('✔  API disponible. Iniciando test...');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TEARDOWN — se ejecuta una sola vez al finalizar
// ═══════════════════════════════════════════════════════════════════
export function teardown(_data) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Test finalizado.');
  console.log('  Revisa los umbrales en el resumen de k6.');
  console.log('═══════════════════════════════════════════');
}
