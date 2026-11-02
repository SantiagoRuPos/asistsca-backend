import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeederService } from './admin-seeder.service';
import { Usuario } from '../entities/usuarios/usuario.entity';
import { Rol } from '../entities/usuarios/rol.entity';
import { Estado } from '../entities/catalogos/estado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, Estado])],
  providers: [AdminSeederService],
})
export class AdminSeederModule {}
