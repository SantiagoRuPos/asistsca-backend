import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../configuration';
import { Usuario } from '../entities/usuarios/usuario.entity';
import { Rol } from '../entities/usuarios/rol.entity';
import { Estado, CategoriaEstado } from '../entities/catalogos/estado.entity';

/**
 * Crea el primer usuario administrador en un despliegue nuevo, a partir de
 * ADMIN_EMAIL/ADMIN_PASSWORD en el .env -- sin esto, una base de datos recien
 * creada no tiene ninguna forma de iniciar sesion (crear usuarios ya exige
 * estar logueado, ver UsuariosController/RolesGuard). Corre una vez en cada
 * arranque (onApplicationBootstrap, despues de que TypeORM ya sincronizo el
 * esquema) y es deliberadamente idempotente y de bajo riesgo:
 *
 * - Si ADMIN_EMAIL o ADMIN_PASSWORD no estan configurados, no hace nada y
 *   solo deja una nota en el log (deja el camino manual, ver
 *   scripts/crear-admin.sh, como respaldo).
 * - Si ya existe un usuario con ese email, no lo toca -- nunca pisa una
 *   contraseña que el cliente ya cambio despues del primer arranque.
 * - Crea el rol "admin" y el estado categoria=usuario/codigo=activo si
 *   todavia no existen (antes esto se hacia a mano por SQL).
 */
@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol) private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
  ) {}

  async onApplicationBootstrap() {
    const email = this.configService.get('adminBootstrap.email', { infer: true });
    const password = this.configService.get('adminBootstrap.password', { infer: true });

    if (!email || !password) {
      this.logger.log(
        'ADMIN_EMAIL/ADMIN_PASSWORD no configurados -- no se crea ningun admin automaticamente (ver scripts/crear-admin.sh si hace falta crear uno a mano).',
      );
      return;
    }

    const emailNormalizado = email.toLowerCase().trim();

    const existente = await this.usuarioRepository.findOne({ where: { email: emailNormalizado } });
    if (existente) {
      this.logger.log(
        `El usuario ${emailNormalizado} ya existe -- no se vuelve a crear ni se cambia su contraseña.`,
      );
      return;
    }

    let rolAdmin = await this.rolRepository.findOne({ where: { nombre: 'admin' } });
    if (!rolAdmin) {
      rolAdmin = await this.rolRepository.save(
        this.rolRepository.create({ nombre: 'admin', descripcion: 'Administrador del sistema' }),
      );
      this.logger.log('Rol "admin" creado (no existia).');
    }

    let estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.USUARIO, codigo: 'activo' },
    });
    if (!estadoActivo) {
      estadoActivo = await this.estadoRepository.save(
        this.estadoRepository.create({
          categoria: CategoriaEstado.USUARIO,
          codigo: 'activo',
          nombre: 'Activo',
          descripcion: 'Usuario activo',
        }),
      );
      this.logger.log('Estado "usuario/activo" creado (no existia).');
    }

    const saltRounds = this.configService.get('security.bcryptSaltRounds', { infer: true });
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await this.usuarioRepository.save(
      this.usuarioRepository.create({
        email: emailNormalizado,
        passwordHash,
        nombreCompleto: 'Administrador',
        rolId: rolAdmin.id,
        estadoId: estadoActivo.id,
        // true, igual que cualquier usuario creado por un admin (ver
        // usuarios.service.ts) -- buena practica pedir cambiarla en el
        // primer login real, en vez de dejar la contraseña del .env vigente
        // indefinidamente.
        debeCambiarPassword: true,
      }),
    );

    this.logger.log(
      `Usuario admin "${emailNormalizado}" creado automaticamente a partir de ADMIN_EMAIL/ADMIN_PASSWORD.`,
    );
  }
}
