import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Usuario } from '../usuarios/usuario.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'usuario_id',
    type: 'uuid',
  })
  usuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({
    name: 'token_hash',
    type: 'text',
  })
  tokenHash!: string;

  @Column({
    name: 'fecha_expiracion',
    type: 'timestamptz',
  })
  fechaExpiracion!: Date;

  @Column({
    type: 'boolean',
    default: false,
  })
  revocado!: boolean;

  @Column({
    name: 'reemplazado_por_token_id',
    type: 'uuid',
    nullable: true,
  })
  reemplazadoPorTokenId!: string | null;

  @Column({
    name: 'user_agent',
    type: 'text',
    nullable: true,
  })
  userAgent!: string | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ip!: string | null;

  @CreateDateColumn({
    name: 'fecha_creacion',
    type: 'timestamptz',
  })
  fechaCreacion!: Date;
}