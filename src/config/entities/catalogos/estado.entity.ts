import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';


export enum CategoriaEstado {
  ESTUDIANTE = 'estudiante',
  PROFESOR = 'profesor',
  TARJETA = 'tarjeta',
  MATRICULA = 'matricula',
  EXCUSA = 'excusa',
  NOTIFICACION = 'notificacion',
  LECTOR = 'lector',
  USUARIO = 'usuario',
  ASISTENCIA_DIARIA = 'asistencia_diaria',
  ASISTENCIA_PROFESOR = 'asistencia_profesor',
  AUTORIZACION_SALIDA = 'autorizacion_salida',
}

@Entity('estados')
export class Estado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'categoria', type: 'enum', enum: CategoriaEstado })
  categoria!: CategoriaEstado;

  @Column({ name: 'codigo', length: 60 })
  codigo!: string;

  @Column({ name: 'nombre', length: 120 })
  nombre!: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion!: string | null;
}