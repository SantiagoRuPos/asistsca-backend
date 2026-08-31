import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Rol } from '../../config/entities/usuarios/rol.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { Permiso } from 'src/config/entities/usuarios/permiso.entity';
import { RolPermiso } from 'src/config/entities/usuarios/rol-permiso.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';

@Module({
imports: [TypeOrmModule.forFeature([Usuario, Rol, RolPermiso, Permiso, Estado])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}