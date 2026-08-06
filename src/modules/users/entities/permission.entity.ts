import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserPermission } from './user-permission.entity';

/** Catálogo de permisos del sistema (código estable + nombre legible). */
@Entity({ name: 'permissions' })
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @OneToMany(() => UserPermission, (up) => up.permission)
  userPermissions: UserPermission[];
}
