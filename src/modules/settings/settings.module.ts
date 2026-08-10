import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { DiscountsModule } from '../discounts/discounts.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSettings]),
    DiscountsModule,
    AuditModule,
    UsersModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
