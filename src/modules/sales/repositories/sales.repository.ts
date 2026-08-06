import { Injectable } from '@nestjs/common';

export interface SaleRow {
  id: number;
  sellerId: number;
  sellerName: string;
  amount: number;
  createdAt: string; // UTC ISO
}

/**
 * Consultas de ventas.
 * Placeholder: cuando exista la entidad/tabla `vd_sales`, aquí irán los finds.
 */
@Injectable()
export class SalesRepository {
  async findBySellerId(_sellerId: number): Promise<SaleRow[]> {
    return [];
  }

  async findAll(): Promise<SaleRow[]> {
    return [];
  }
}
