import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  AuthUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UserType } from '../../common/enums/user-type.enum';
import { PermissionCode } from '../../common/constants/permissions.constants';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    return this.usersService.createUser(dto, { userId: actor.userId });
  }

  @Patch(':id')
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    return this.usersService.updateUser(id, dto, { userId: actor.userId });
  }

  @Patch(':id/active')
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    return this.usersService.setUserActive(id, dto.active, actor.userId);
  }

  @Get()
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  list(@Query('type') type?: UserType) {
    return this.usersService.listUsers(type);
  }

  @Get('permissions/catalog')
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  permissions() {
    return this.usersService.listPermissions();
  }

  @Get(':id')
  @Roles(UserType.ADMIN)
  @RequirePermissions(PermissionCode.USUARIOS_GESTIONAR)
  one(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }
}
