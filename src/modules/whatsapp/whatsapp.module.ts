import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappConfigService } from './whatsapp-config.service';
import { WhatsappService } from './whatsapp.service';
import { ConfiguracionWhatsapp } from '../../config/entities/comunicaciones/configuracion-whatsapp.entity';
import { NotificacionWhatsapp } from '../../config/entities/comunicaciones/notificacion-whatsapp.entity';
import { EstudianteAcudiente } from '../../config/entities/academico/estudiante-acudiente.entity';
import { Estado } from '../../config/entities/catalogos/estado.entity';
import { Comunicado } from '../../config/entities/comunicaciones/comunicado.entity';
import { Colegio } from '../../config/entities/colegio/colegio.entity';
@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionWhatsapp, NotificacionWhatsapp, EstudianteAcudiente, Estado, Comunicado, Colegio])],
  controllers: [WhatsappController],
  providers: [WhatsappConfigService, WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}