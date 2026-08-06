/**
 * Tipos de usuario del sistema Venta Digital.
 * Cada tipo tiene un flujo de autenticación distinto.
 */
export enum UserType {
  /** Vendedor: inicia sesión con PIN de WhatsApp. Token válido hasta fin del día. */
  VENDEDOR = 'VENDEDOR',
  /** Monitor: usuario/contraseña + refresh token. Menú según permisos. */
  MONITOR = 'MONITOR',
  /** Administrador: gestiona vendedores y monitores. */
  ADMIN = 'ADMIN',
}
