import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthUserPayload,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserType } from '../../common/enums/user-type.enum';
import { UpdateSellerDefaultsDto } from './dto/update-seller-defaults.dto';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SellerDefaultsController {
  constructor(private readonly usersService: UsersService) {}

  @Get('defaults')
  @Roles(UserType.VENDEDOR)
  getDefaults(@CurrentUser() user: AuthUserPayload) {
    return this.usersService.getSellerDefaults(user.userId);
  }

  @Patch('defaults')
  @Roles(UserType.VENDEDOR)
  saveDefaults(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateSellerDefaultsDto,
  ) {
    return this.usersService.saveSellerDefaults(user.userId, dto);
  }
}
