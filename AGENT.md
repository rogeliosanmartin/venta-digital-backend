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
- Tablas propias con prefijo **`vd_`** para no chocar con Odoo en la misma BD
- Datetimes en **UTC** (`timestamptz` / `timezone: 'Z'`)
- `DB_SYNC=true` solo en beta para crear tablas `vd_*`. No usar sync a ciegas en producción.

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
- Tipos: `VENDEDOR` | `MONITOR` | `ADMIN`
- Permisos default:
  - MONITOR → `dashboard.ver`, `ventas.ver`, `reportes.ver`
  - ADMIN → los anteriores + `usuarios.gestionar`
  - VENDEDOR → sin permisos de menú; accede a `/sales/mias` por rol
- MONITOR/ADMIN con `ventas.ver` → `GET /api/sales/todas` (todas las ventas de vendedores)

## Arquitectura (SOLID + legible)

```
src/
  common/          # enums, guards, decorators, utils
  modules/
    auth/          # login / tokens
    users/         # entidades + alta/listado
    whatsapp/      # cliente NIP externo
    sales/         # placeholder ventas propias
```

- Controllers delgados; lógica en services.
- Un módulo = un dominio.
- Nombres explícitos; comentarios de negocio donde el “por qué” no sea obvio.

## Historial ANA

- Documentar cada día en `historial-ana/YYYY-MM-DD.md`.
- Leer el ANA reciente antes de extender auth, usuarios o esquema.
- Registrar decisiones (ej. fin de día, prefijo `vd_`, refresh solo monitor).

## Prácticas

1. No loguear NIPs, passwords ni JWT completos.
2. No reutilizar tablas de Odoo; crear entidades `vd_*`.
3. Respuestas de error claras en español.
4. CORS habilitado para el front local.
5. Si cambias el payload JWT, actualiza front (`shared/types` + store) y este AGENT.md.

## Arranque

```bash
npm install
# configurar .env (ver .env.example)
npm run start:dev
```

Admin semilla (si no existe ninguno): variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
