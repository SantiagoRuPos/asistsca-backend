import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LectorNfc } from './lector-nfc.entity';

// Registro de un UID de tarjeta NFC que llegó por /api/registrar_evento pero
// no corresponde a ningún carnet asignado (TarjetaNfc). Se guarda para poder
// mostrarlo en el frontend (pantalla Carnets, formulario "Asignar carnet")
// sin tener que copiar el UID a mano de la tarjeta física — el ESP32 sigue
// recibiendo exactamente la misma respuesta 404 de siempre, no requiere
// ningún cambio de firmware.
@Entity('tarjetas_desconocidas')
export class TarjetaDesconocida {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'uid_tarjeta', type: 'varchar', length: 40 })
  uidTarjeta!: string;

  @Column({ name: 'lector_id', type: 'uuid', nullable: true })
  lectorId!: string | null;

  @ManyToOne(() => LectorNfc, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lector_id' })
  lector!: LectorNfc | null;

  @CreateDateColumn({ name: 'fecha_escaneo' })
  fechaEscaneo!: Date;

  // Se marca en true en cuanto ese UID se usa para asignar o cambiar un
  // carnet real (ver NfcService.asignarTarjeta/cambiarTarjetaEstudiante),
  // así deja de aparecer como "pendiente" en el frontend.
  @Column({ type: 'boolean', default: false })
  resuelta!: boolean;
}
