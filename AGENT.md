# AGENT.md — Venta Digital (Backend)

Reglas obligatorias para cualquier IA o desarrollador que trabaje este repositorio.

## Stack

- NestJS 10 + TypeORM + PostgreSQL
- Auth: `@nestjs/jwt` + Passport JWT
- Validación: `class-validator`
- Puerto: **`PORT` del `.env` → 3022**
- Prefijo global: `/api`

## Base de datos

- Credenciales en `.env` (`DB_HOST`, `DB_USR`, `DB_PORT`, `DB_PSW`, `DB_NAME`)
- BD propia (`venta_digital`); tablas sin prefijo (`users`, `sales`, `audit_logs`, …)
- Datetimes en **UTC** (`timestamptz` / `timezone: 'Z'`)
- `DB_SYNC=true` solo en beta. No usar sync a ciegas en producción.

## Auth (contratos)

### Vendedor (basado en sesión de api-recibodigital-nest)

1. `POST /api/auth/vendedor/solicitar-pin` `{ cellphone }`
2. `POST /api/auth/vendedor/verificar-pin` `{ nipId, nip, cellphone }`
3. JWT access con `expiresIn = segundos hasta fin del día` en `BUSINESS_TIMEZONE` (default `America/Mexico_City`)
4. **Sin refresh token**

WhatsApp NIP: `API_WHATS` + endpoints `nip` / `nip/validate/:id` (mismo servicio externo).

### Monitor / Admin

1. `POST /api/auth/monitor/login` `{ username, password }`
2. Devuelve `accessToken` + `refreshToken`
3. `POST /api/auth/refresh` rota el refresh
4. Passwords con **bcrypt** (no MD5)

### Admin usuarios

- `POST /api/users` (solo ADMIN + permiso `usuarios.gestionar`)
- `PATCH /api/users/:id` — editar nombre / celular o username / password opcional
- `PATCH /api/users/:id/active` `{ active }` — habilitar/deshabilitar (no auto-desactivarse ni dejar sin admin activo)
- Tipos: `VENDEDOR` | `MONITOR` | `ADMIN`
- Celular WhatsApp de vendedor: **único** (no se repite entre vendedores, aunque estén inactivos)
- Permisos default:
  - MONITOR → `dashboard.ver`, `ventas.ver`, `reportes.ver`
  - ADMIN → los anteriores + `usuarios.gestionar`
  - VENDEDOR → sin permisos de menú; accede a `GET /sales` por rol
- MONITOR/ADMIN con `ventas.ver` → `GET /api/sales` (ventas enviadas)
- Ventas vendedor (`sales` + tablas relacionadas):
  - `GET /sales` — listado (propias si vendedor; global si mesa)
  - `GET /sales/reuse` — para reutilizar datos de captura
  - `POST /sales/drafts` · `PATCH /sales/:id/draft` — borrador (máx. 3, caduca 24 h)
  - `POST /sales/finalize` · `POST /sales/:id/finalize` — captura lista (docs)
  - `PATCH /sales/:id/payment` · `POST /sales/:id/sign` — pago y firma desde lista
  - `GET /sales/:id` · `DELETE /sales/:id` (solo borrador)
  - Campos tipados (titular, domicilio, beneficiarios, plan, pago, docs); sin JSON de negocio

## Arquitectura (SOLID + legible)

```
src/
  common/          # enums, guards, decorators, utils
  modules/
    auth/          # login / tokens (service procesa)
    users/         # entidades + repositories + service
      entities/
      repositories/  # SOLO consultas a BD
    audit/         # bitácora de transacciones (audit_logs)
    whatsapp/      # cliente NIP externo
    sales/
      repositories/  # consultas de ventas
```

Capas por dominio:

1. **Controller** — HTTP, delgado
2. **Service** — reglas de negocio y transformación de datos consultados
3. **Repository** (`*.repository.ts`) — **únicas** consultas/persistencia TypeORM

- Un módulo = un dominio.
- Services **no** inyectan `Repository<T>` de TypeORM; usan la capa `*.repository`.
- Nombres explícitos; comentarios de negocio donde el “por qué” no sea obvio.

## Auditoría / log de transacciones

Tabla `audit_logs`. Cada operación relevante deja:

- Quién (`actorUserId`, `actorName`, `actorType`)
- Qué (`action`: CREATE | UPDATE | ACTIVATE | DEACTIVATE | DELETE)
- Sobre qué (`entityType`: USER | SALE, `entityId`)
- Resumen en español (`summary`)
- Detalle JSON (`details`: `after` o `changes: { campo: { from, to } }`)
- Fecha UTC (`createdAt`)

- Alta/edición/activar usuarios ya registran log.
- Ventas: borrador y envío registran `entityType: SALE`.
- Consulta solo ADMIN: `GET /api/audit-logs`
  - `dateFrom` / `dateTo` — YYYY-MM-DD (zona `America/Mexico_City`); front default = hoy
  - `q` — palabra clave (summary, actor, acción, tipo, details JSON)
  - `actorUserId` — usuario que realizó la acción
  - `action` — CREATE | UPDATE | ACTIVATE | DEACTIVATE | DELETE
  - `entityType`, `entityId`, `limit`, `offset`
- Front: `/admin/bitacora` (menú Bitácora, solo ADMIN)
- PDF: se genera en el **front** (`jspdf`) con los mismos filtros; pide listado con `limit` hasta 2000
- No guardar passwords ni hashes en `details`.

## Historial ANA

- Documentar cada día en `historial-ana/YYYY-MM-DD.md`.
- Leer el ANA reciente antes de extender auth, usuarios o esquema.
- Registrar decisiones (ej. fin de día, refresh solo monitor).

## Prácticas

1. No loguear NIPs, passwords ni JWT completos.
2. Esquema en BD propia; no mezclar con Odoo.
3. Respuestas de error claras en español.
4. CORS habilitado para el front local.
5. Si cambias el payload JWT, actualiza front (`shared/types` + store) y este AGENT.md.

## Google Drive (documentos de venta)

- Preferir **OAuth de usuario Workspace** (tiene cuota). Service Account falla en Drive personal por `storageQuotaExceeded`.
- Env: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_OAUTH_TOKEN_PATH`.
- Autorizar una vez: abrir `http://localhost:3022/api/drive/oauth/start` con el usuario dueño de la carpeta.
- Callback: `/api/drive/oauth/callback` → guarda refresh token en `secrets/google-oauth-token.json` (gitignored).
- Status: `GET /api/drive/oauth/status`

## Arranque

```bash
npm install
# configurar .env (ver .env.example)
npm run start:dev
```

Admin semilla (si no existe ninguno): variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
