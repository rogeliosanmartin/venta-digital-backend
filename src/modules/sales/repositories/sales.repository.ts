import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleStatus } from '../enums/sale-status.enum';

const RELATIONS = {
  holder: true,
  secondContact: true,
  beneficiaries: true,
  documents: true,
};

@Injectable()
export class SalesRepository {
  constructor(
    @InjectRepository(Sale)
    private readonly repo: Repository<Sale>,
  ) {}

  create(): Sale {
    return this.repo.create();
  }

  save(sale: Sale): Promise<Sale> {
    return this.repo.save(sale);
  }

  findById(id: number): Promise<Sale | null> {
    return this.repo.findOne({
      where: { id },
      relations: RELATIONS,
      order: { beneficiaries: { sortOrder: 'ASC' } },
    });
  }

  findBySellerId(sellerId: number): Promise<Sale[]> {
    return this.repo.find({
      where: { sellerId },
      relations: RELATIONS,
      order: { updatedAt: 'DESC', beneficiaries: { sortOrder: 'ASC' } },
    });
  }

  findAll(): Promise<Sale[]> {
    return this.repo.find({
      relations: RELATIONS,
      order: { updatedAt: 'DESC', beneficiaries: { sortOrder: 'ASC' } },
    });
  }

  countActiveDrafts(sellerId: number, now: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('s')
      .where('s.seller_id = :sellerId', { sellerId })
      .andWhere('s.status = :status', { status: SaleStatus.DRAFT })
      .andWhere('(s.draft_expires_at IS NULL OR s.draft_expires_at > :now)', {
        now,
      })
      .getCount();
  }

  async deleteExpiredDrafts(now: Date): Promise<number> {
    const result = await this.repo.delete({
      status: SaleStatus.DRAFT,
      draftExpiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }

  async deleteById(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  findForMonitor(): Promise<Sale[]> {
    return this.repo.find({
      where: {
        status: In([
          SaleStatus.COMPLETED,
          SaleStatus.PENDING_SIGNATURE,
          SaleStatus.PENDING_PAYMENT,
          SaleStatus.REJECTED,
        ]),
      },
      relations: RELATIONS,
      order: { updatedAt: 'DESC' },
    });
  }

  /** Ventas visibles en conciliación Odoo (excluye rechazadas). */
  findForConciliation(): Promise<Sale[]> {
    return this.repo.find({
      where: {
        status: In([
          SaleStatus.COMPLETED,
          SaleStatus.PENDING_SIGNATURE,
          SaleStatus.PENDING_PAYMENT,
        ]),
      },
      relations: RELATIONS,
      order: { updatedAt: 'DESC' },
    });
  }
}
