import { Injectable } from '@nestjs/common';

export interface SaleListItem {
  id: number;
  sellerId: number;
  sellerName: string;
  amount: number;
  createdAt: string; // UTC ISO
}

/**
 * Ventas.
 * - Vendedor: solo las propias.
 * - Monitor/Admin (permiso ventas.ver): todas las de los vendedores.
 *
 * Por ahora el listado está vacío; la persistencia se agregará después.
 */
@Injectable()
export class SalesService {
  async listOwnSales(sellerId: number) {
    const items = await this.findSales({ sellerId });
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
    const items = await this.findSales({});
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

  /**
   * Punto único de consulta. Cuando exista la entidad/tabla de ventas,
   * aquí se filtra por sellerId (propias) o sin filtro (todas).
   */
  private async findSales(_filter: {
    sellerId?: number;
  }): Promise<SaleListItem[]> {
    return [];
  }
}
