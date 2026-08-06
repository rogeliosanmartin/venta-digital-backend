import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserType } from '../../common/enums/user-type.enum';

/** Bitácora: solo ADMIN. El PDF se genera en el front. */
@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserType.ADMIN)
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
