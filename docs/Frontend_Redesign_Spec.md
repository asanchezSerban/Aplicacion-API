# Frontend Redesign — Especificación

Rama: `feature/frontend-redesing`

Documento de referencia para mantener coherencia visual al rediseñar el resto de páginas. Vista piloto validada: **`/login`** — aprobada por el usuario el 2026-04-21.

---

## 1. Filosofía visual

**Referencias estéticas:** Linear, Attio, Vercel.

- Oscuro + neutral cálido con un acento vibrante (indigo + cyan).
- Tipografía con tracking negativo en titulares, peso medio (600) en lugar de bold (700).
- Radios afilados (10–12px), no redondeos excesivos.
- Animaciones cortas, con propósito — nunca decorativas.
- Espacio generoso, densidad baja en dashboards, media en tablas.
- Contraste alto en botones primarios (negro puro sobre blanco / blanco puro sobre negro en dark).

**NO hacer:**
- Glassmorphism excesivo, gradientes saturados por todas partes.
- Sombras muy marcadas (estilo Material 2009).
- Iconos animados decorativos sin justificación.
- Radios >14px (estética "app de consumo" infantilizada).
- `ease-in` en entradas (se siente lento).

---

## 2. Sistema de diseño

### 2.1. Tipografía

- **Font family:** `Inter` (variable, cargado desde Google Fonts en `index.html`).
  Fallback: `system-ui, sans-serif`. Roboto queda solo para compatibilidad con componentes Material que no estén tocados aún.
- **Scale:**

  | Rol              | Size       | Weight | Letter-spacing |
  | ---------------- | ---------- | ------ | -------------- |
  | Display          | 2.25rem    | 600    | -0.02em        |
  | H1 (page title)  | 1.75rem    | 600    | -0.02em        |
  | H2 (section)     | 1.25rem    | 600    | -0.015em       |
  | Body             | 0.9375rem  | 400    | normal         |
  | Small / meta     | 0.8125rem  | 500    | normal         |
  | Micro (label)    | 0.75rem    | 500    | 0.02em (upper) |

- **Números en tablas:** `font-variant-numeric: tabular-nums`.

### 2.2. Paleta (variables CSS)

Definidas como `:host` vars en componentes, o globales más adelante en `styles.scss`.

```css
/* Neutrales (ink) */
--ink-900: #0B0F1A;  /* backgrounds oscuros, text principal en light */
--ink-700: #1E2638;
--ink-500: #4B5468;  /* text secundario */
--ink-300: #8A93A6;  /* text terciario, placeholders */
--ink-200: #C3C9D6;  /* borders */
--ink-100: #E6E9F0;  /* dividers */
--ink-50:  #F5F6FA;  /* surfaces muy sutiles */

/* Acento */
--accent:       #4F46E5;  /* indigo — links, focus, primary accents */
--accent-soft:  #EEF0FF;  /* fondos tintados */
--accent-hover: #4338CA;

/* Highlight secundario (para dots, badges, glows) */
--cyan: #22D3EE;

/* Semánticos */
--ok:    #10B981;
--warn:  #F59E0B;
--error: #DC2626;
--info:  #3B82F6;
```

**Dark mode** (invertir la escala ink, mantener accent):

```css
:host-context(body.dark-mode) {
  --ink-900: #F5F6FA;
  --ink-700: #C3C9D6;
  --ink-500: #8A93A6;
  --ink-300: #4B5468;
  --ink-200: #1E2638;
  --ink-100: #131826;
  --ink-50:  #0B0F1A;
}
```

### 2.3. Spacing & radios

- Base: múltiplo de 4px (0.25rem). Usar `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 2.5 / 3rem`.
- Radios:
  - Inputs, small chips: `8px`
  - Cards, buttons, panels: `10–12px`
  - Modales grandes: `16px`
  - Nunca `20px+` en UI.
- Stroke/borders: `1px solid var(--ink-200)` (light) / `var(--ink-200)` dark.

### 2.4. Elevación

Minimal — preferir borders a sombras.

```css
--shadow-sm: 0 1px 2px rgba(11, 15, 26, 0.04);
--shadow-md: 0 4px 12px rgba(11, 15, 26, 0.08);
--shadow-lg: 0 12px 32px rgba(11, 15, 26, 0.12);  /* solo modales */
```

---

## 3. Patrón de panel split (hero lateral)

Aplicar a todas las páginas de autenticación: `login`, `recuperar-password`, `reset-password`, `mfa-verificar`, `configurar-totp`.

### 3.1. Estructura

```
.auth-shell (grid 1.05fr / 1fr, min-height: 100vh)
├── .brand-panel  (izquierda, oscura con gradient)
│   ├── .brand-glow--one, .brand-glow--two  (glows animados)
│   ├── .brand-top     (logo SVG + nombre)
│   ├── .brand-copy    (h2 + p + features)
│   └── .brand-footer  (© texto pequeño)
└── .form-panel  (derecha, blanca / ink-900 en dark)
    └── .form-container (max-width 380px)
        ├── .form-header  (h1 + p descriptivo)
        └── <form>
```

### 3.2. Fondo del brand-panel

```css
background:
  radial-gradient(120% 90% at 0% 0%, #3730A3 0%, transparent 55%),
  radial-gradient(100% 70% at 100% 100%, #1E1B4B 0%, transparent 60%),
  #0B0F1A;
```

Dos glows absolutos con `filter: blur(80px)` y animación `float-one`/`float-two` (14–18s ease-in-out infinite, translate de 30–40px).

### 3.3. Copy por página

Cada página de auth tiene su propio `h2` + `p` en el brand-panel — NO reutilizar el mismo texto:

| Ruta                    | Titular                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `/login`                | "Gestiona tus empresas y usuarios en un solo lugar."         |
| `/recuperar-password`   | "¿Olvidaste tu contraseña? Te enviamos un enlace al email."  |
| `/reset-password`       | "Casi listo. Elige una nueva contraseña segura."             |
| `/mfa-verificar`        | "Un paso más. Confirma tu identidad."                        |
| `/configurar-totp`      | "Activa la autenticación en dos pasos para tu cuenta."       |

### 3.4. Responsive

```css
@media (max-width: 900px) {
  .auth-shell { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
}
```

---

## 4. Componentes clave (patrones)

### 4.1. Botón primario (CTA)

- Negro puro en light (`var(--ink-900)`), blanco en dark.
- Height: 48px en forms principales, 40px en acciones secundarias.
- Border-radius: 10px.
- Font: Inter 600, 0.9375rem.
- Hover: pasar a `#000` / `#E6E9F0` dark.
- Active: `transform: scale(0.98)` (120ms).
- Icono `arrow_forward` con `translateX(3px)` al hover (200ms enter curve).

### 4.2. Botón secundario (ghost)

- Fondo `transparent`, border `1px solid var(--ink-200)`.
- Mismo height/radius.
- Hover: `background: var(--ink-50)`.

### 4.3. Inputs (Angular Material `appearance="outline"`)

- Mantener `appearance="outline"` — ya encaja bien con el estilo.
- Prefix icon en gris (`var(--ink-300)`).
- Focus: el outline azure default de Material funciona; si se quiere forzar al accent indigo, override `--mdc-outlined-text-field-focus-outline-color`.

### 4.4. Tarjeta de error inline

```css
.error-box {
  padding: 0.75rem 0.875rem;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #991B1B;
  border-radius: 10px;
  font-size: 0.8125rem;
}
/* dark: */
background: rgba(220, 38, 38, 0.1);
border-color: rgba(220, 38, 38, 0.3);
color: #FCA5A5;
```

### 4.5. Links

Color `var(--accent)`, sin underline, peso 500. Hover: `var(--accent-hover)`, transición color 150ms.

---

## 5. Animación

### 5.1. Reglas básicas

- Solo `transform` y `opacity` — nunca `width/height/top/left`.
- Nunca `transition: all`.
- Curva enter: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Curva move: `cubic-bezier(0.25, 1, 0.5, 1)`.
- Entradas: 500–600ms. Feedback/hover: 120–200ms. Exit: 150–200ms.
- Siempre envolver en `@media (prefers-reduced-motion: reduce)` y desactivar `animation: none`.

### 5.2. Keyframe `rise` (entrada de elementos)

```css
@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 5.3. Stagger

- Elementos hermanos: delay incremental de **60ms**.
- Total stagger < 300ms (máx 5 elementos).
- Ejemplo: h2 (0ms) → p (80ms) → li1 (160ms) → li2 (220ms) → li3 (280ms).

### 5.4. Glows de fondo

```css
@keyframes float-one {
  0%,100% { transform: translate(0, 0); }
  50%     { transform: translate(40px, 30px); }
}
```
Duración 14–18s, ease-in-out, infinite. Opacity 0.22–0.45. NO usar en mobile (desactivar con `@media (max-width: 600px) { animation: none; }` si causa jank).

### 5.5. Feedback de botones

- Press: `scale(0.98)` 120ms enter curve.
- Hover icon shift: `translateX(3px)` 200ms.

### 5.6. NO animar

- Teclado (tab, arrows, shortcuts).
- Cambios de tema (añadir `[data-theme-switching] * { transition: none !important }`).
- Listas >10 items al cargar (skeleton en su lugar).

---

## 6. Roadmap de páginas (orden sugerido)

### Fase 1 — Auth (mismo patrón split) ✅ completada
- [x] `/login` ✅ completado (piloto)
- [x] `/recuperar-password` ✅
- [x] `/reset-password` ✅
- [x] `/mfa-verificar` ✅ (adaptado según `mfaType`: email con timer + reenvío, totp con copy distinto)
- [x] `/configurar-totp` ✅ (QR + clave manual con botón copiar + 6 dígitos de confirmación)

### Fase 2 — Shell de la app autenticada ✅ completada
- [x] **Sidebar** para SuperAdmin: 64px colapsado / 240px expandido, curva `cubic-bezier(0.32, 0.72, 0, 1)` 250ms, avatar con iniciales, dark mode toggle, logout
- [x] **Topbar fino** (48px) para rol `Cliente`: logo + email + dark mode + logout
- [x] `app.ts` con layout condicional: fullscreen (auth routes) / admin-shell (SuperAdmin) / topbar (Cliente)

### Fase 3 — Listas
- [ ] `/empresas` (company-list):
  - Header con h1 + botón "Nueva empresa" (primary dark)
  - Filtros en barra horizontal sticky
  - Tabla con logo thumb 36px, nombre en `ink-900` 500, descripción en `ink-500` truncada
  - Acciones: iconos ghost, hover con `ink-50` bg
  - Empty state: ilustración SVG simple + CTA
  - Skeleton loader en lugar de spinner centrado
  - Stagger rise en filas (desactivable si >10)
- [ ] `/usuarios` (user-list): mismo patrón

### Fase 4 — Detalles
- [ ] `/empresas/:id` (company-detail):
  - Hero con logo grande (80px) + gradient de fondo sutil derivado
  - Tabs: Resumen / Usuarios
  - Stats row: nº usuarios, fecha creación, última actualización (chips)
  - Botón "Editar" primary sticky arriba-derecha
- [ ] `/usuarios/:id` (user-detail): card centrada, info estructurada

### Fase 5 — Formularios
- [ ] `/empresas/nueva`, `/empresas/:id/editar` (company-form):
  - Header sticky con título + botón "Cancelar"
  - Secciones agrupadas (datos básicos / logo)
  - Upload de logo con drag&drop real (no solo `input[type=file]`)
  - Actions bar sticky abajo
- [ ] User form: mismo patrón, sin upload

### Fase 6 — Páginas simples
- [ ] `/perfil` (rol Cliente): card centrada con patrón actual mejorado, avatar más grande, acciones secundarias (cambiar contraseña — si existe)
- [ ] `/not-found`: ilustración 404 con personalidad + CTA "Volver al inicio"

### Fase 7 — Componentes globales
- [ ] `confirm-dialog`: rediseño con patrón de modal moderno (no MatDialog default)
- [ ] Snackbar: rediseño con borders en lugar de fondo sólido
- [ ] `styles.scss` global: promover las vars CSS a nivel global, configurar tema Material con los colores custom, font-family Inter como default

---

## 7. Ficheros tocados en el piloto

- `AplicacionAPI/ClientManagerWeb/src/index.html` — añadido `<link>` a Inter de Google Fonts.
- `AplicacionAPI/ClientManagerWeb/src/app/pages/login/login.ts` — reescrito completo (template inline + styles inline).

**Nota importante:** el piloto mantiene todo inline en el `.ts` (como ya estaba el login original). Para páginas más complejas (listas, detalles, formularios) seguir el patrón existente del proyecto: `.html` + `.scss` + `.ts` separados.

---

## 8. Checklist antes de marcar una página como terminada

- [ ] Tipografía Inter aplicada (heredada de `:host` o declarada).
- [ ] Paleta ink/accent usada, NO colores Material azure default.
- [ ] Radios 10–12px en cards/botones, 8px en inputs.
- [ ] Animaciones solo `transform`/`opacity`, respeto a `prefers-reduced-motion`.
- [ ] Dark mode verificado (usar `:host-context(body.dark-mode)`).
- [ ] Responsive <900px sin romper.
- [ ] `ChangeDetectionStrategy.OnPush` + signals (según skill `angular-component`).
- [ ] Control flow nativo (`@if`, `@for`, `@switch`), nada de `*ngIf`/`*ngFor`.
- [ ] `inject()` en lugar de constructor injection.
- [ ] Botones icon con `aria-label` o `matTooltip`.
- [ ] No `transition: all`, no animación en layout props (width/height/top/left).
- [ ] Stagger ≤300ms total, max 5 elementos escalonados.
- [ ] Probado en light + dark + mobile.

---

## 9. Decisiones deliberadas (por si surge duda)

- **Por qué Inter y no Roboto:** Inter tiene tracking más apretado y pesos más consistentes — es la fuente estándar de herramientas SaaS modernas (Linear, Vercel, GitHub). Roboto se queda para compatibilidad con componentes Material aún no tocados.
- **Por qué negro puro en botones primarios y no el accent indigo:** contraste máximo, asociación inmediata con "acción principal", estética Linear/Vercel. El indigo queda para links y elementos secundarios.
- **Por qué border en vez de sombra:** las sombras marcadas envejecen mal y añaden ruido visual. Borders finos dan estructura sin "peso".
- **Por qué sidebar y no topbar para SuperAdmin:** más espacio vertical para contenido, más escalable si se añaden secciones, estética más profesional.
- **Por qué mantener Material:** ya está integrado en todo el proyecto, re-implementar componentes desde cero sería mucho trabajo. Override con CSS vars y patrones custom es suficiente.
- **Panel split en auth:** aprovecha el espacio horizontal en desktop para comunicar producto y reforzar marca, no solo "login anónimo en una card flotante".

---

## 10. Si se corta la sesión

Pasos para retomar:

1. Confirmar rama: `git branch --show-current` → debe ser `feature/frontend-redesing`.
2. Abrir este doc: `docs/Frontend_Redesign_Spec.md`.
3. Revisar el piloto aprobado como referencia: `AplicacionAPI/ClientManagerWeb/src/app/pages/login/login.ts`.
4. Continuar por el Roadmap (sección 6) — siguiente pendiente: `/recuperar-password`.
5. Validar cada página contra la checklist (sección 8) antes de pasar a la siguiente.
