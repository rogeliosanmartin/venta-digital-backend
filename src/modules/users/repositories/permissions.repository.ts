import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';

/** Consultas a `vd_permissions`. Sin lógica de negocio. */
@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly repo: Repository<Permission>,
  ) {}

  findByCode(code: string): Promise<Permission | null> {
    return this.repo.findOne({ where: { code } });
  }

  findByCodes(codes: string[]): Promise<Permission[]> {
    if (!codes.length) {
      return Promise.resolve([]);
    }
    return this.repo.find({ where: { code: In(codes) } });
  }

  listAll(): Promise<Permission[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  createAndSave(data: Partial<Permission>): Promise<Permission> {
    return this.repo.save(this.repo.create(data));
  }
}
