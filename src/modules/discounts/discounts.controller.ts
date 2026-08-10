import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DiscountsService } from './discounts.service';
import { CreateDiscountGrantDto } from './dto/create-discount-grant.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserType } from '../../common/enums/user-type.enum';
import {
  AuthUserPayload,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('discounts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @Roles(UserType.ADMIN)
  list() {
    return this.discountsService.list();
  }

  @Post()
  @Roles(UserType.ADMIN)
  create(
    @Body() dto: CreateDiscountGrantDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.discountsService.create(dto, user);
  }

  @Patch(':id/cancel')
  @Roles(UserType.ADMIN)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.discountsService.cancel(id, user);
  }
}
