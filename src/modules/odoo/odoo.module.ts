import { Module } from '@nestjs/common';
import { OdooGsmClient } from './odoo-gsm.client';
import { OdooController } from './odoo.controller';

@Module({
  controllers: [OdooController],
  providers: [OdooGsmClient],
  exports: [OdooGsmClient],
})
export class OdooModule {}
