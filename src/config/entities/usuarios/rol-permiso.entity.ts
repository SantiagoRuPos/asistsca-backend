import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Rol } from './rol.entity';
import { Permiso } from './permiso.entity';

@Entity('rol_permiso')
export class RolPermiso {
  @PrimaryColumn({ name: 'rol_id' })
  rolId!: string;

  @PrimaryColumn({ name: 'permiso_id' })
  permisoId!: string;

  @ManyToOne(() => Rol, (rol) => rol.rolPermisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rol_id' })
  rol!: Rol;

  @ManyToOne(() => Permiso, (permiso) => permiso.rolPermisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permiso_id' })
  permiso!: Permiso;
}