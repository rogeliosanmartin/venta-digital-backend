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
        entities: [User, Permission, UserPermission, RefreshToken],
        // Solo sincroniza entidades `vd_*`. No toca tablas ajenas de Odoo.
        synchronize: config.get<string>('DB_SYNC') === 'true',
        // Activar solo para depurar: DB_LOGGING=true
        logging: config.get<string>('DB_LOGGING') === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
    SalesModule,
    WhatsappModule,
  ],
})
export class AppModule {}
