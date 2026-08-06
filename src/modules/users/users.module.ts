import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersRepository } from './repositories/users.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { UserPermissionsRepository } from './repositories/user-permissions.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuditModule } from '../audit/audit.module';

const repositories = [
  UsersRepository,
  PermissionsRepository,
  UserPermissionsRepository,
  RefreshTokensRepository,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Permission,
      UserPermission,
      RefreshToken,
    ]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ...repositories],
  exports: [UsersService, ...repositories],
})
export class UsersModule {}
