import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Auditoria } from '../../config/entities/auditoria/auditoria.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaInterceptor } from '../../common/interceptors/auditoria.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Auditoria])],
  providers: [
    AuditoriaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditoriaInterceptor,
    },
  ],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}