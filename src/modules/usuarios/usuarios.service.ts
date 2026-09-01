import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Rol } from '../../config/entities/usuarios/rol.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { generarPasswordTemporal } from '../../common/utils/password.util';

const ROLES_RESUMEN = ['admin', 'rector', 'coordinador', 'profesor'] as const;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol) private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AppConfig, true>,
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

  async listarFiltrados(filtros: FiltrarUsuariosDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;

    const consulta = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('usuario.estado', 'estado')
      .orderBy('usuario.fechaCreacion', 'DESC');

    if (filtros.q) {
      consulta.andWhere('(usuario.nombreCompleto ILIKE :q OR usuario.email ILIKE :q)', {
        q: `%${filtros.q}%`,
      });
    }
    if (filtros.rol) {
      consulta.andWhere('rol.nombre = :rol', { rol: filtros.rol });
    }
    if (filtros.estado) {
      consulta.andWhere('estado.codigo = :estado', { estado: filtros.estado });
    }

    const [usuarios, total] = await consulta
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    return {
      datos: usuarios.map((usuario) => ({
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: { nombre: usuario.rol.nombre },
        estado: { codigo: usuario.estado.codigo, nombre: usuario.estado.nombre },
        debeCambiarPassword: usuario.debeCambiarPassword,
        ultimoLogin: usuario.ultimoLogin,
        fechaCreacion: usuario.fechaCreacion,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(Math.ceil(total / limite), 1),
    };
  }

  async obtenerResumen() {
    const conteos = await Promise.all(
      ROLES_RESUMEN.map((rol) =>
        this.usuarioRepository
          .createQueryBuilder('usuario')
          .innerJoin('usuario.rol', 'rol')
          .where('rol.nombre = :rol', { rol })
          .getCount(),
      ),
    );

    return {
      administradores: conteos[0],
      rectores: conteos[1],
      coordinadores: conteos[2],
      profesores: conteos[3],
    };
  }

  /**
   * Registra un usuario administrativo (admin / rector / coordinador) desde
   * el panel. Genera una contraseña temporal aleatoria (nunca la elige el
   * administrador que lo crea) e intenta enviarla por correo al nuevo
   * usuario. Si el correo no se pudo enviar (SMTP sin configurar o error de
   * red), la creación NO falla: se devuelve la contraseña una sola vez en la
   * respuesta para que el administrador pueda comunicarla manualmente, igual
   * que ocurre con la API key de los lectores NFC.
   */
  async registrar(dto: RegistrarUsuarioDto) {
    const email = dto.email.toLowerCase().trim();

    const duplicado = await this.usuarioRepository.findOne({ where: { email } });
    if (duplicado) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const rol = await this.rolRepository.findOne({ where: { nombre: dto.rol } });
    if (!rol) {
      throw new ConflictException(`No existe el rol "${dto.rol}" en la tabla roles (falta el seed).`);
    }

    const estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.USUARIO, codigo: 'activo' },
    });
    if (!estadoActivo) {
      throw new ConflictException('No existe el estado activo de usuario en la tabla estados (falta el seed).');
    }

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, this.configService.get('security.bcryptSaltRounds', { infer: true }));

    const usuario = this.usuarioRepository.create({
      email,
      passwordHash,
      nombreCompleto: dto.nombreCompleto.trim(),
      telefono: dto.telefono?.trim() ?? null,
      rol,
      estado: estadoActivo,
      debeCambiarPassword: true,
    });

    const guardado = await this.usuarioRepository.save(usuario);
    const { passwordHash: _omit, ...usuarioSinPassword } = guardado;

    const brand = this.configService.get('brand', { infer: true });
    const resultadoEnvio = await this.mailerService.enviarCorreo({
      para: email,
      asunto: `Tu acceso a ${brand.name}`,
      html: `
        <p>Hola ${dto.nombreCompleto.trim()},</p>
        <p>Se creó una cuenta para ti en <strong>${brand.name}</strong> con el rol <strong>${dto.rol}</strong>.</p>
        <p>Correo: ${email}<br/>Contraseña temporal: <strong>${passwordTemporal}</strong></p>
        <p>Por seguridad, el sistema te pedirá cambiarla la primera vez que inicies sesión.</p>
      `,
    });

    return {
      usuario: { ...usuarioSinPassword, rol: { nombre: rol.nombre } },
      correoEnviado: resultadoEnvio.enviado,
      // Solo se incluye la contraseña en la respuesta cuando el correo NO se
      // pudo enviar: es la única forma que le queda al administrador de
      // conocerla, porque aquí tampoco se guarda en texto plano.
      passwordTemporal: resultadoEnvio.enviado ? undefined : passwordTemporal,
      motivoFalloEnvio: resultadoEnvio.motivo,
    };
  }

  async activar(id: string) {
    return this.cambiarEstado(id, 'activo');
  }

  async desactivar(id: string, solicitanteId: string) {
    if (id === solicitanteId) {
      throw new ConflictException('No puedes desactivar tu propia cuenta.');
    }
    return this.cambiarEstado(id, 'inactivo');
  }

  private async cambiarEstado(id: string, codigoEstado: 'activo' | 'inactivo') {
    const usuario = await this.usuarioRepository.findOne({ where: { id }, relations: ['rol', 'estado'] });
    if (!usuario) {
      throw new NotFoundException('El usuario indicado no existe.');
    }

    const estado = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.USUARIO, codigo: codigoEstado },
    });
    if (!estado) {
      throw new ConflictException(`No existe el estado "${codigoEstado}" de usuario en la tabla estados (falta el seed).`);
    }

    usuario.estado = estado;
    const guardado = await this.usuarioRepository.save(usuario);
    const { passwordHash: _omit, ...sinPassword } = guardado;
    return sinPassword;
  }
}
