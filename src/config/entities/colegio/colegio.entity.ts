import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('colegio')
export class Colegio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 200,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nit!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  direccion!: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono!: string | null;

  @Column({
    name: 'año_lectivo_activo',
    type: 'int',
  })
  anioLectivoActivo!: number;

  @Column({
    name: 'logo_url',
    type: 'text',
    nullable: true,
  })
  logoUrl!: string | null;
}