import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserType } from '../enums/user-type.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // ADMIN siempre pasa (tiene todos los permisos por diseño).
    if (user?.type === UserType.ADMIN) {
      return true;
    }

    const owned: string[] = user?.permissions ?? [];
    const ok = required.every((code) => owned.includes(code));

    if (!ok) {
      throw new ForbiddenException('No tiene permisos suficientes');
    }

    return true;
  }
}
