import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { DriveController } from './drive.controller';
import { IntegrationsController } from './integrations.controller';
import { SalesService } from './sales.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { SalesRepository } from './repositories/sales.repository';
import { GoogleDriveService } from './google-drive.service';
import { Sale } from './entities/sale.entity';
import { SaleHolder } from './entities/sale-holder.entity';
import { SaleSecondContact } from './entities/sale-second-contact.entity';
import { SaleBeneficiary } from './entities/sale-beneficiary.entity';
import { SaleDocument } from './entities/sale-document.entity';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleHolder,
      SaleSecondContact,
      SaleBeneficiary,
      SaleDocument,
    ]),
    UsersModule,
    AuditModule,
    SettingsModule,
    DiscountsModule,
  ],
  controllers: [SalesController, DriveController, IntegrationsController],
  providers: [SalesService, SalesRepository, GoogleDriveService, ApiKeyGuard],
  exports: [SalesService, GoogleDriveService],
})
export class SalesModule {}
