import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Rol } from '../../config/entities/usuarios/rol.entity';
import { Estado,CategoriaEstado  } from '../../config/entities/catalogos/estado.entity';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol) private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
  ) {}

  async crear(dto: CrearUsuarioDto) {
    const yaHayUsuarios = await this.usuarioRepository.count();
    if (yaHayUsuarios > 0) {
      throw new ConflictException(
        'Ya existe al menos un usuario. Los siguientes deben crearse desde el panel autenticado.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const duplicado = await this.usuarioRepository.findOne({ where: { email } });
    if (duplicado) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const rolAdmin = await this.rolRepository.findOne({ where: { nombre: 'admin' } });
    if (!rolAdmin) {
      throw new ConflictException('No existe el rol "admin" en la tabla roles (falta el seed).');
    }

    // OJO: asumo que Estado tiene columnas "categoria" y "codigo" (según el esquema del proyecto).
    // Si tu Estado.entity usa otros nombres, ajusta este where.
const estadoActivo = await this.estadoRepository.findOne({
  where: { categoria: CategoriaEstado.USUARIO, codigo: 'activo' },
});
    if (!estadoActivo) {
      throw new ConflictException('No existe el estado activo de usuario en la tabla estados (falta el seed).');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const usuario = this.usuarioRepository.create({
      email,
      passwordHash,
      nombreCompleto: dto.nombreCompleto.trim(),
      rol: rolAdmin,
      estado: estadoActivo,
      debeCambiarPassword: false,
    });

    const guardado = await this.usuarioRepository.save(usuario);
    const { passwordHash: _omit, ...sinPassword } = guardado;
    return sinPassword;
  }
}