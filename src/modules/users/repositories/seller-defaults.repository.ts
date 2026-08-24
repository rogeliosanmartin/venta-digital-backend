import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerDefault } from '../entities/seller-default.entity';
import { SellerDefaultPlan } from '../entities/seller-default-plan.entity';

@Injectable()
export class SellerDefaultsRepository {
  constructor(
    @InjectRepository(SellerDefault)
    private readonly defaultsRepo: Repository<SellerDefault>,
    @InjectRepository(SellerDefaultPlan)
    private readonly plansRepo: Repository<SellerDefaultPlan>,
  ) {}

  findBySellerId(sellerId: number): Promise<SellerDefault | null> {
    return this.defaultsRepo.findOne({
      where: { sellerId },
      relations: { plans: true },
    });
  }

  createForSeller(sellerId: number): Promise<SellerDefault> {
    return this.defaultsRepo.save(
      this.defaultsRepo.create({
        sellerId,
        branchId: null,
        branchName: null,
        plans: [],
      }),
    );
  }

  save(defaults: SellerDefault): Promise<SellerDefault> {
    return this.defaultsRepo.save(defaults);
  }

  replacePlans(
    sellerDefaultId: number,
    plans: Array<Partial<SellerDefaultPlan>>,
  ): Promise<SellerDefaultPlan[]> {
    return this.defaultsRepo.manager.transaction(async (manager) => {
      await manager.delete(SellerDefaultPlan, { sellerDefaultId });
      if (!plans.length) return [];
      return manager.save(
        SellerDefaultPlan,
        plans.map((plan) =>
          manager.create(SellerDefaultPlan, {
            ...plan,
            sellerDefaultId,
          }),
        ),
      );
    });
  }

  async deletePlansByKind(
    sellerDefaultId: number,
    planKind: SellerDefaultPlan['planKind'],
  ) {
    await this.plansRepo.delete({ sellerDefaultId, planKind });
  }
}
