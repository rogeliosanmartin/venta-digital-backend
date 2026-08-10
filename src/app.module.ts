import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SalesModule } from './modules/sales/sales.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { User } from './modules/users/entities/user.entity';
import { Permission } from './modules/users/entities/permission.entity';
import { UserPermission } from './modules/users/entities/user-permission.entity';
import { RefreshToken } from './modules/users/entities/refresh-token.entity';
import { AuditModule } from './modules/audit/audit.module';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Sale } from './modules/sales/entities/sale.entity';
import { SaleHolder } from './modules/sales/entities/sale-holder.entity';
import { SaleSecondContact } from './modules/sales/entities/sale-second-contact.entity';
import { SaleBeneficiary } from './modules/sales/entities/sale-beneficiary.entity';
import { SaleDocument } from './modules/sales/entities/sale-document.entity';
import { SettingsModule } from './modules/settings/settings.module';
import { AppSettings } from './modules/settings/entities/app-settings.entity';
import { OdooModule } from './modules/odoo/odoo.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { DiscountGrant } from './modules/discounts/entities/discount-grant.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT') ?? 5432),
        username: config.get<string>('DB_USR'),
        password: config.get<string>('DB_PSW'),
        database: config.get<string>('DB_NAME'),
        entities: [
          User,
          Permission,
          UserPermission,
          RefreshToken,
          AuditLog,
          Sale,
          SaleHolder,
          SaleSecondContact,
          SaleBeneficiary,
          SaleDocument,
          AppSettings,
          DiscountGrant,
        ],
        // Solo beta: crea/ajusta esquema de esta BD. No usar en producción.
        synchronize: config.get<string>('DB_SYNC') === 'true',
        // Activar solo para depurar: DB_LOGGING=true
        logging: config.get<string>('DB_LOGGING') === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
    SalesModule,
    WhatsappModule,
    AuditModule,
    SettingsModule,
    OdooModule,
    DiscountsModule,
  ],
})
export class AppModule {}
