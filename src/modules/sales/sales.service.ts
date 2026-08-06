import { Injectable } from '@nestjs/common';
import { SalesRepository } from './repositories/sales.repository';

/**
 * Ventas.
 * - Vendedor: solo las propias.
 * - Monitor/Admin (permiso ventas.ver): todas las de los vendedores.
 *
 * El repository consulta; aquí se arma la respuesta de negocio.
 * Al persistir altas/ediciones, registrar con AuditService (entityType SALE).
 */
@Injectable()
export class SalesService {
  constructor(private readonly salesRepository: SalesRepository) {}

  async listOwnSales(sellerId: number) {
    const items = await this.salesRepository.findBySellerId(sellerId);
    return {
      scope: 'own' as const,
      items,
      total: items.length,
      message:
        items.length === 0
          ? 'Aún no hay ventas registradas para este vendedor'
          : 'Ventas propias del vendedor',
    };
  }

  /**
   * Todas las ventas de todos los vendedores.
   * Pensado para MONITOR y ADMIN con permiso `ventas.ver`.
   */
  async listAllSales() {
    const items = await this.salesRepository.findAll();
    return {
      scope: 'all' as const,
      items,
      total: items.length,
      message:
        items.length === 0
          ? 'Aún no hay ventas registradas de vendedores'
          : 'Ventas de todos los vendedores',
    };
  }
}
