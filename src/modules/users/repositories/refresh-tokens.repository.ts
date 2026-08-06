import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

/** Consultas a `vd_refresh_tokens`. Sin lógica de negocio. */
@Injectable()
export class RefreshTokensRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  findByHashWithUser(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({
      where: { tokenHash },
      relations: {
        user: { userPermissions: { permission: true } },
      },
    });
  }

  createAndSave(data: {
    user: User;
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  }): Promise<RefreshToken> {
    return this.repo.save(
      this.repo.create({
        user: data.user,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revokedAt: data.revokedAt ?? null,
      }),
    );
  }

  save(token: RefreshToken): Promise<RefreshToken> {
    return this.repo.save(token);
  }
}
