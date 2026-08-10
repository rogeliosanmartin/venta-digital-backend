import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountGrant } from './entities/discount-grant.entity';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscountGrant]),
    UsersModule,
    AuditModule,
  ],
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
