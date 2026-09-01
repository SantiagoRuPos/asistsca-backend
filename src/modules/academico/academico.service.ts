import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Curso, Jornada } from '../../config/entities/academico/curso.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Acudiente } from '../../config/entities/academico/acudiente.entity';
import { EstudianteAcudiente } from '../../config/entities/academico/estudiante-acudiente.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Rol } from '../../config/entities/usuarios/rol.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';

import { CrearProfesorDto } from './dto/crear-profesor.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { CambiarDirectorCursoDto } from './dto/cambiar-director-curso.dto';
import { CrearHorarioCursoDto } from './dto/crear-horario-curso.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { CrearAcudienteDto } from './dto/crear-acudiente.dto';
import { MatricularEstudianteDto } from './dto/matricular-estudiante.dto';
import { EstudianteMasivoItemDto } from './dto/estudiante-masivo-item.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarEstudianteCompletoDto } from './dto/registrar-estudiante-completo.dto';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { MailerService } from '../mailer/mailer.service';
import { generarPasswordTemporal } from '../../common/utils/password.util';

@Injectable()
export class AcademicoService {
  constructor(
    @InjectRepository(Profesor) private readonly profesorRepository: Repository<Profesor>,
    @InjectRepository(Curso) private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(HorarioCurso) private readonly horarioCursoRepository: Repository<HorarioCurso>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Acudiente) private readonly acudienteRepository: Repository<Acudiente>,
    @InjectRepository(EstudianteAcudiente)
    private readonly estudianteAcudienteRepository: Repository<EstudianteAcudiente>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol) private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  // ---------- Profesores ----------

  async crearProfesor(dto: CrearProfesorDto) {
    const email = dto.email.toLowerCase().trim();

    const profesorDuplicado = await this.profesorRepository.findOne({
      where: [{ email }, { numeroDocumento: dto.numeroDocumento.trim() }],
    });
    if (profesorDuplicado) {
      throw new ConflictException('Ya existe un profesor con ese email o número de documento.');
    }

    const usuarioDuplicado = await this.usuarioRepository.findOne({ where: { email } });
    if (usuarioDuplicado) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const rolProfesor = await this.rolRepository.findOne({ where: { nombre: 'profesor' } });
    if (!rolProfesor) {
      throw new ConflictException('No existe el rol "profesor" en la tabla roles (falta el seed).');
    }

    const estadoProfesorActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.PROFESOR, codigo: 'activo' },
    });
    if (!estadoProfesorActivo) {
      throw new ConflictException('No existe el estado activo de profesor en la tabla estados (falta el seed).');
    }

    const estadoUsuarioActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.USUARIO, codigo: 'activo' },
    });
    if (!estadoUsuarioActivo) {
      throw new ConflictException('No existe el estado activo de usuario en la tabla estados (falta el seed).');
    }

    // La contraseña temporal ya no la escribe quien registra al profesor (el
    // DTO ya no tiene ese campo): se genera aquí y se envía por correo, con el
    // mismo patrón que UsuariosService.registrar() para las cuentas admin/rector/coordinador.
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(
      passwordTemporal,
      this.configService.get('security.bcryptSaltRounds', { infer: true }),
    );

    const { profesorGuardado, usuarioSinPassword } = await this.dataSource.transaction(async (manager) => {
      const profesor = manager.create(Profesor, {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        numeroDocumento: dto.numeroDocumento.trim(),
        email,
        telefono: dto.telefono?.trim() ?? null,
        estado: estadoProfesorActivo,
      });
      const profesorGuardado = await manager.save(profesor);

      const usuario = manager.create(Usuario, {
        email,
        passwordHash,
        nombreCompleto: `${dto.nombres.trim()} ${dto.apellidos.trim()}`,
        rol: rolProfesor,
        profesorId: profesorGuardado.id,
        estado: estadoUsuarioActivo,
        debeCambiarPassword: true,
      });
      const usuarioGuardado = await manager.save(usuario);

      const { passwordHash: _omit, ...usuarioSinPassword } = usuarioGuardado;
      return { profesorGuardado, usuarioSinPassword };
    });

    // El correo se envía después de confirmada la transacción — si el envío
    // falla no se revierte la creación del profesor/usuario (igual que en
    // UsuariosService.registrar()): la contraseña se devuelve una sola vez en
    // la respuesta para que quien lo creó la entregue manualmente.
    const brand = this.configService.get('brand', { infer: true });
    const resultadoEnvio = await this.mailerService.enviarCorreo({
      para: email,
      asunto: `Tu acceso a ${brand.name}`,
      html: `
        <p>Hola ${dto.nombres.trim()},</p>
        <p>Se creó una cuenta de profesor para ti en <strong>${brand.name}</strong>.</p>
        <p>Correo: ${email}<br/>Contraseña temporal: <strong>${passwordTemporal}</strong></p>
        <p>Por seguridad, el sistema te pedirá cambiarla la primera vez que inicies sesión.</p>
      `,
    });

    return {
      profesor: profesorGuardado,
      usuario: { ...usuarioSinPassword, rol: { nombre: rolProfesor.nombre } },
      correoEnviado: resultadoEnvio.enviado,
      passwordTemporal: resultadoEnvio.enviado ? undefined : passwordTemporal,
      motivoFalloEnvio: resultadoEnvio.motivo,
    };
  }

  // ---------- Cursos ----------

  async crearCurso(dto: CrearCursoDto) {
    const profesor = await this.profesorRepository.findOne({ where: { id: dto.profesorDirectorId } });
    if (!profesor) {
      throw new ConflictException('El profesor indicado no existe.');
    }

    const yaDirigeOtroCurso = await this.cursoRepository.findOne({
      where: { profesorDirectorId: profesor.id },
    });
    if (yaDirigeOtroCurso) {
      throw new ConflictException('Este profesor ya es director de otro curso; un profesor solo puede dirigir un curso.');
    }

    const anioLectivo = dto.anioLectivo ?? new Date().getFullYear();

    const duplicado = await this.cursoRepository.findOne({
      where: { nombre: dto.nombre.trim(), anioLectivo },
    });
    if (duplicado) {
      throw new ConflictException('Ya existe un curso con ese nombre para ese año lectivo.');
    }

    const curso = this.cursoRepository.create({
      nombre: dto.nombre.trim(),
      anioLectivo,
      profesorDirector: profesor,
      jornada: dto.jornada ?? Jornada.UNICA,
    });

    return this.cursoRepository.save(curso);
  }

  async listarCursos() {
    const cursos = await this.cursoRepository.find({
      relations: ['profesorDirector', 'matriculas', 'horarios'],
      order: { anioLectivo: 'DESC', nombre: 'ASC' },
    });

    return cursos.map((curso) => ({
      id: curso.id,
      nombre: curso.nombre,
      anioLectivo: curso.anioLectivo,
      jornada: curso.jornada,
      director: {
        id: curso.profesorDirector.id,
        nombres: curso.profesorDirector.nombres,
        apellidos: curso.profesorDirector.apellidos,
      },
      tieneEstudiantes: curso.matriculas.length > 0,
      cantidadEstudiantes: curso.matriculas.length,
      horarios: curso.horarios
        .sort((a, b) => a.diaSemana - b.diaSemana)
        .map((h) => ({
          diaSemana: h.diaSemana,
          horaEntrada: h.horaEntrada,
          horaSalida: h.horaSalida,
          minutosToleranciaTardanza: h.minutosToleranciaTardanza,
        })),
    }));
  }

  async cambiarDirectorCurso(cursoId: string, dto: CambiarDirectorCursoDto) {
    const curso = await this.cursoRepository.findOne({ where: { id: cursoId } });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const nuevoProfesor = await this.profesorRepository.findOne({ where: { id: dto.profesorDirectorId } });
    if (!nuevoProfesor) {
      throw new ConflictException('El profesor indicado no existe.');
    }

    const yaDirigeOtroCurso = await this.cursoRepository.findOne({
      where: { profesorDirectorId: nuevoProfesor.id },
    });
    if (yaDirigeOtroCurso && yaDirigeOtroCurso.id !== curso.id) {
      throw new ConflictException('Este profesor ya es director de otro curso; un profesor solo puede dirigir un curso.');
    }

    curso.profesorDirector = nuevoProfesor;
    return this.cursoRepository.save(curso);
  }

  // ---------- Horarios ----------

  async crearHorarioCurso(cursoId: string, dto: CrearHorarioCursoDto) {
    const curso = await this.cursoRepository.findOne({ where: { id: cursoId } });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const existentes = await this.horarioCursoRepository.find({ where: { cursoId: curso.id } });
    const diasYaConfigurados = new Set(existentes.map((h) => h.diaSemana));

    const diasNuevos = dto.diasSemana.filter((dia) => !diasYaConfigurados.has(dia));
    const diasOmitidos = dto.diasSemana.filter((dia) => diasYaConfigurados.has(dia));

    const horarios = diasNuevos.map((dia) =>
      this.horarioCursoRepository.create({
        curso,
        diaSemana: dia,
        horaEntrada: dto.horaEntrada,
        minutosToleranciaTardanza: dto.minutosToleranciaTardanza ?? 0,
        horaSalida: dto.horaSalida,
      }),
    );

    const guardados = await this.horarioCursoRepository.save(horarios);

    return {
      creados: guardados,
      omitidos: diasOmitidos.length
        ? `Los días ${diasOmitidos.join(', ')} ya tenían horario configurado, no se tocaron.`
        : undefined,
    };
  }

  async listarHorariosCurso(cursoId: string) {
    const curso = await this.cursoRepository.findOne({ where: { id: cursoId } });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    return this.horarioCursoRepository.find({
      where: { cursoId: curso.id },
      order: { diaSemana: 'ASC' },
    });
  }

  // ---------- Estudiantes ----------

  async crearEstudiante(dto: CrearEstudianteDto) {
    const duplicado = await this.estudianteRepository.findOne({
      where: { numeroDocumento: dto.numeroDocumento.trim() },
    });
    if (duplicado) {
      throw new ConflictException('Ya existe un estudiante con ese número de documento.');
    }

    const estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ESTUDIANTE, codigo: 'activo' },
    });
    if (!estadoActivo) {
      throw new ConflictException('No existe el estado activo de estudiante en la tabla estados (falta el seed).');
    }

    const estudiante = this.estudianteRepository.create({
      nombres: dto.nombres.trim(),
      apellidos: dto.apellidos.trim(),
      tipoDocumento: dto.tipoDocumento.trim(),
      numeroDocumento: dto.numeroDocumento.trim(),
      fechaNacimiento: dto.fechaNacimiento,
      estado: estadoActivo,
    });

    return this.estudianteRepository.save(estudiante);
  }

  async registrarEstudianteCompleto(dto: RegistrarEstudianteCompletoDto) {
    const numeroDocumento = dto.estudiante.numeroDocumento.trim();

    const duplicado = await this.estudianteRepository.findOne({ where: { numeroDocumento } });
    if (duplicado) {
      throw new ConflictException('Ya existe un estudiante con ese número de documento.');
    }

    const curso = await this.cursoRepository.findOne({ where: { id: dto.matricula.cursoId } });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const estadoEstudianteActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ESTUDIANTE, codigo: 'activo' },
    });
    if (!estadoEstudianteActivo) {
      throw new ConflictException('No existe el estado activo de estudiante en la tabla estados (falta el seed).');
    }

    const estadoMatriculaActiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.MATRICULA, codigo: 'activa' },
    });
    if (!estadoMatriculaActiva) {
      throw new ConflictException('No existe el estado "activa" de matrícula en la tabla estados (falta el seed).');
    }

    const anioLectivo = dto.matricula.anioLectivo ?? new Date().getFullYear();

    return this.dataSource.transaction(async (manager) => {
      const estudiante = manager.create(Estudiante, {
        nombres: dto.estudiante.nombres.trim(),
        apellidos: dto.estudiante.apellidos.trim(),
        tipoDocumento: dto.estudiante.tipoDocumento.trim(),
        numeroDocumento,
        fechaNacimiento: dto.estudiante.fechaNacimiento,
        estado: estadoEstudianteActivo,
      });
      const estudianteGuardado = await manager.save(estudiante);

      const matricula = manager.create(Matricula, {
        estudiante: estudianteGuardado,
        curso,
        anioLectivo,
        estado: estadoMatriculaActiva,
      });
      const matriculaGuardada = await manager.save(matricula);

      const acudiente = manager.create(Acudiente, {
        nombres: dto.acudiente.nombres.trim(),
        apellidos: dto.acudiente.apellidos.trim(),
        parentesco: dto.acudiente.parentesco,
        telefonoWhatsapp: dto.acudiente.telefonoWhatsapp.trim(),
        email: dto.acudiente.email?.trim() ?? null,
        numeroDocumento: dto.acudiente.numeroDocumento?.trim() ?? null,
      });
      const acudienteGuardado = await manager.save(acudiente);

      const vinculo = manager.create(EstudianteAcudiente, {
        estudianteId: estudianteGuardado.id,
        acudienteId: acudienteGuardado.id,
        esContactoNotificacion: true,
      });
      await manager.save(vinculo);

      return {
        estudiante: estudianteGuardado,
        matricula: { id: matriculaGuardada.id, cursoId: curso.id, curso: curso.nombre, anioLectivo },
        acudiente: acudienteGuardado,
      };
    });
  }

  async crearAcudiente(dto: CrearAcudienteDto) {
    const acudiente = this.acudienteRepository.create({
      nombres: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      parentesco: dto.parentesco,
      telefonoWhatsapp: dto.telefonoWhatsapp.trim(),
      email: dto.email?.trim() ?? null,
      numeroDocumento: dto.numeroDocumento?.trim() ?? null,
    });
    const acudienteGuardado = await this.acudienteRepository.save(acudiente);

    if (dto.estudianteId) {
      const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
      if (!estudiante) {
        throw new ConflictException('El estudiante indicado no existe (el acudiente sí se creó, pero sin vincular).');
      }

      const vinculo = this.estudianteAcudienteRepository.create({
        estudianteId: estudiante.id,
        acudienteId: acudienteGuardado.id,
        esContactoNotificacion: true,
      });
      await this.estudianteAcudienteRepository.save(vinculo);
    }

    return acudienteGuardado;
  }

  async matricularEstudiante(dto: MatricularEstudianteDto) {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante indicado no existe.');
    }

    const curso = await this.cursoRepository.findOne({ where: { id: dto.cursoId } });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const anioLectivo = dto.anioLectivo ?? new Date().getFullYear();

    const yaMatriculado = await this.matriculaRepository.findOne({
      where: { estudianteId: estudiante.id, anioLectivo },
    });
    if (yaMatriculado) {
      throw new ConflictException('Este estudiante ya está matriculado en un curso para ese año lectivo.');
    }

    const estadoMatriculaActiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.MATRICULA, codigo: 'activa' },
    });
    if (!estadoMatriculaActiva) {
      throw new ConflictException('No existe el estado "activa" de matrícula en la tabla estados (falta el seed).');
    }

    const matricula = this.matriculaRepository.create({
      estudiante,
      curso,
      anioLectivo,
      estado: estadoMatriculaActiva,
    });

    return this.matriculaRepository.save(matricula);
  }

  async obtenerResumenEstudiantes() {
    const totalCursos = await this.cursoRepository.count();
    const totalEstudiantes = await this.estudianteRepository.count();

    const estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ESTUDIANTE, codigo: 'activo' },
    });
    const activos = estadoActivo
      ? await this.estudianteRepository.count({ where: { estadoId: estadoActivo.id } })
      : 0;
    const inactivos = totalEstudiantes - activos;

    const porcentaje = (valor: number) => (totalEstudiantes > 0 ? Math.round((valor / totalEstudiantes) * 100) : 0);

    return {
      totalEstudiantes,
      totalCursos,
      activos: { valor: activos, porcentaje: porcentaje(activos) },
      inactivos: { valor: inactivos, porcentaje: porcentaje(inactivos) },
    };
  }

  async listarEstudiantes(filtros: FiltrarEstudiantesDto) {
    const anioLectivo = new Date().getFullYear();
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;

    const qb = this.estudianteRepository
      .createQueryBuilder('estudiante')
      .leftJoinAndSelect('estudiante.estado', 'estado')
      .leftJoinAndSelect('estudiante.matriculas', 'matricula', 'matricula.anioLectivo = :anioLectivo', { anioLectivo })
      .leftJoinAndSelect('matricula.curso', 'curso')
      .leftJoinAndSelect('estudiante.acudientes', 'estudianteAcudiente')
      .leftJoinAndSelect('estudianteAcudiente.acudiente', 'acudiente');

    if (filtros.q) {
      qb.andWhere(
        '(estudiante.nombres ILIKE :q OR estudiante.apellidos ILIKE :q OR estudiante.numeroDocumento ILIKE :q)',
        { q: `%${filtros.q}%` },
      );
    }

    if (filtros.cursoId) {
      qb.andWhere('curso.id = :cursoId', { cursoId: filtros.cursoId });
    }

    if (filtros.estado) {
      qb.andWhere('estado.codigo = :estadoCodigo', { estadoCodigo: filtros.estado });
    }

    qb.orderBy('estudiante.apellidos', 'ASC').addOrderBy('estudiante.nombres', 'ASC');
    qb.skip((pagina - 1) * limite).take(limite);

    const [estudiantes, total] = await qb.getManyAndCount();

    const datos = estudiantes.map((estudiante) => {
      const curso = estudiante.matriculas?.[0]?.curso ?? null;
      const vinculoAcudiente =
        estudiante.acudientes?.find((ea) => ea.esContactoNotificacion) ?? estudiante.acudientes?.[0] ?? null;

      return {
        id: estudiante.id,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        tipoDocumento: estudiante.tipoDocumento,
        numeroDocumento: estudiante.numeroDocumento,
        fechaNacimiento: estudiante.fechaNacimiento,
        estado: { codigo: estudiante.estado.codigo, nombre: estudiante.estado.nombre },
        curso: curso ? { id: curso.id, nombre: curso.nombre } : null,
        acudiente: vinculoAcudiente
          ? {
              nombres: vinculoAcudiente.acudiente.nombres,
              apellidos: vinculoAcudiente.acudiente.apellidos,
              telefonoWhatsapp: vinculoAcudiente.acudiente.telefonoWhatsapp,
            }
          : null,
      };
    });

    return {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  }

  async listarEstudiantesActivos() {
    const estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ESTUDIANTE, codigo: 'activo' },
    });
    if (!estadoActivo) {
      return [];
    }

    return this.estudianteRepository.find({
      where: { estadoId: estadoActivo.id },
      relations: ['estado'],
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });
  }

  async listarEstudiantesMatriculados() {
    const estudiantes = await this.estudianteRepository.find({
      relations: ['matriculas', 'matriculas.curso', 'estado'],
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });

    return estudiantes
      .filter((estudiante) => estudiante.matriculas.length > 0)
      .map((estudiante) => ({
        id: estudiante.id,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        numeroDocumento: estudiante.numeroDocumento,
        matriculas: estudiante.matriculas.map((matricula) => ({
          cursoId: matricula.curso.id,
          curso: matricula.curso.nombre,
          anioLectivo: matricula.anioLectivo,
        })),
      }));
  }

  async crearEstudiantesMasivo(filas: unknown[]) {
    const resultados: Array<{ fila: number; ok: boolean; id?: string; error?: string[] }> = [];

    for (let i = 0; i < filas.length; i++) {
      const dto = plainToInstance(EstudianteMasivoItemDto, filas[i]);
      const errores = await validate(dto);

      if (errores.length > 0) {
        resultados.push({
          fila: i,
          ok: false,
          error: errores.flatMap((e) => Object.values(e.constraints ?? {})),
        });
        continue;
      }

      try {
        const duplicado = await this.estudianteRepository.findOne({
          where: { numeroDocumento: dto.numeroDocumento.trim() },
        });
        if (duplicado) {
          resultados.push({ fila: i, ok: false, error: ['Ya existe un estudiante con ese número de documento.'] });
          continue;
        }

        const estadoActivo = await this.estadoRepository.findOne({
          where: { categoria: CategoriaEstado.ESTUDIANTE, codigo: 'activo' },
        });
        if (!estadoActivo) {
          resultados.push({ fila: i, ok: false, error: ['Falta el seed del estado activo de estudiante.'] });
          continue;
        }

        const estudiante = this.estudianteRepository.create({
          nombres: dto.nombres.trim(),
          apellidos: dto.apellidos.trim(),
          tipoDocumento: dto.tipoDocumento.trim(),
          numeroDocumento: dto.numeroDocumento.trim(),
          fechaNacimiento: dto.fechaNacimiento,
          estado: estadoActivo,
        });
        const estudianteGuardado = await this.estudianteRepository.save(estudiante);

        if (dto.cursoId) {
          const curso = await this.cursoRepository.findOne({ where: { id: dto.cursoId } });
          if (!curso) {
            resultados.push({
              fila: i,
              ok: true,
              id: estudianteGuardado.id,
              error: ['Estudiante creado, pero el cursoId indicado no existe: no quedó matriculado.'],
            });
            continue;
          }

          const estadoMatriculaActiva = await this.estadoRepository.findOne({
            where: { categoria: CategoriaEstado.MATRICULA, codigo: 'activa' },
          });

          if (estadoMatriculaActiva) {
            const matricula = this.matriculaRepository.create({
              estudiante: estudianteGuardado,
              curso,
              anioLectivo: dto.anioLectivo ?? new Date().getFullYear(),
              estado: estadoMatriculaActiva,
            });
            await this.matriculaRepository.save(matricula);
          }
        }

        resultados.push({ fila: i, ok: true, id: estudianteGuardado.id });
      } catch (error) {
        resultados.push({
          fila: i,
          ok: false,
          error: [error instanceof Error ? error.message : 'Error desconocido'],
        });
      }
    }

    return {
      total: filas.length,
      creados: resultados.filter((r) => r.ok).length,
      fallidos: resultados.filter((r) => !r.ok).length,
      detalle: resultados,
    };
  }
}