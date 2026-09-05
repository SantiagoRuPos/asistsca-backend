import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicoController } from './academico.controller';
import { AcademicoService } from './academico.service';

import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Acudiente } from '../../config/entities/academico/acudiente.entity';
import { EstudianteAcudiente } from '../../config/entities/academico/estudiante-acudiente.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Rol } from '../../config/entities/usuarios/rol.entity';
import { Estado } from '../../config/entities/catalogos/estado.entity';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profesor,
      Curso,
      Matricula,
      HorarioCurso,
      Estudiante,
      Acudiente,
      EstudianteAcudiente,
      Usuario,
      Rol,
      Estado,
    ]),
    MailerModule,
  ],
  controllers: [AcademicoController],
  providers: [AcademicoService],
  // AcademicoService se exporta para que el bot de Telegram (TelegramBotModule)
  // pueda reutilizar obtenerResumenEstudiantes() sin duplicar la consulta.
  exports: [AcademicoService],
})
export class AcademicoModule {}