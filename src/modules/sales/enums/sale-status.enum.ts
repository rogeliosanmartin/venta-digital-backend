export enum SaleStatus {
  /** Captura en edición (máx. 3, 24 h). */
  DRAFT = 'DRAFT',
  /** Captura lista; falta registrar pago. */
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  /** Pago registrado; falta firma del titular. */
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  /** Venta completa (firmada). */
  COMPLETED = 'COMPLETED',
}
