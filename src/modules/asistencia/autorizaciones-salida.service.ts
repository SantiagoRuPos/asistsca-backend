import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { AutorizacionSalida } from '../../config/entities/asistencia/autorizacion-salida.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Acudiente, Parentesco } from '../../config/entities/academico/acudiente.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Colegio } from '../../config/entities/colegio/colegio.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { CrearAutorizacionSalidaDto } from './dto/crear-autorizacion-salida.dto';

interface UsuarioActual {
  sub: string;
  rol: string;
}

@Injectable()
export class AutorizacionesSalidaService {
  constructor(
    @InjectRepository(AutorizacionSalida) private readonly autorizacionRepository: Repository<AutorizacionSalida>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Acudiente) private readonly acudienteRepository: Repository<Acudiente>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    @InjectRepository(Colegio) private readonly colegioRepository: Repository<Colegio>,
  ) {}

  async crear(dto: CrearAutorizacionSalidaDto, usuarioActual: UsuarioActual) {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante no existe.');
    }

    const acudiente = await this.acudienteRepository.findOne({ where: { id: dto.acudienteAutorizaId } });
    if (!acudiente) {
      throw new NotFoundException('El acudiente no existe.');
    }

    await this.validarPermisoParaAutorizar(dto.estudianteId, usuarioActual);

    const estadoAutorizada = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.AUTORIZACION_SALIDA, codigo: 'autorizada' },
    });
    if (!estadoAutorizada) {
      throw new ConflictException('Falta el seed del estado autorizacion_salida/autorizada.');
    }

    const autorizacion = this.autorizacionRepository.create({
      estudianteId: dto.estudianteId,
      fecha: dto.fecha,
      horaAutorizada: dto.horaAutorizada,
      acudienteAutorizaId: dto.acudienteAutorizaId,
      nombrePersonaRecoge: dto.nombrePersonaRecoge,
      motivo: dto.motivo,
      evidenciaUrl: dto.evidenciaUrl ?? null,
      evidenciaNombre: dto.evidenciaNombre ?? null,
      autorizadoPorUsuarioId: usuarioActual.sub,
      estado: estadoAutorizada,
    });

    return this.autorizacionRepository.save(autorizacion);
  }

  async listar(estudianteId?: string, fecha?: string) {
    return this.autorizacionRepository.find({
      where: {
        ...(estudianteId ? { estudianteId } : {}),
        ...(fecha ? { fecha } : {}),
      },
      relations: ['estudiante', 'acudienteAutoriza', 'autorizadoPorUsuario', 'estado'],
      order: { fechaRegistro: 'DESC' },
    });
  }

  async obtener(id: string): Promise<AutorizacionSalida> {
    const autorizacion = await this.autorizacionRepository.findOne({
      where: { id },
      relations: ['estudiante', 'acudienteAutoriza', 'autorizadoPorUsuario', 'autorizadoPorUsuario.rol', 'estado'],
    });
    if (!autorizacion) {
      throw new NotFoundException('La autorización no existe.');
    }
    return autorizacion;
  }

  /**
   * Genera el PDF con el formato de autorización de salida anticipada
   * (2026-09-23, pedido explícito del usuario): "el estudiante de nombre
   * tal tiene permiso del padre o acudiente don nombre tal identificado con
   * tal de salir temprano de la institución hora xxxx con motivo de xxxxxx,
   * yo profesor/coordinador/rector le apruebo su salida xxxxx". Se genera al
   * vuelo con pdfkit (sin dependencias externas de navegador, liviano para
   * el VPS) — no se guarda en disco, solo se transmite como descarga.
   */
  async generarPdf(id: string): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const autorizacion = await this.obtener(id);
    const colegio = await this.obtenerColegio();
    const buffer = await this.construirPdf(autorizacion, colegio);
    const nombreEstudiante = `${autorizacion.estudiante.nombres}_${autorizacion.estudiante.apellidos}`
      .replace(/\s+/g, '_')
      .toLowerCase();
    const nombreArchivo = `autorizacion_salida_${nombreEstudiante}_${autorizacion.fecha}.pdf`;
    return { buffer, nombreArchivo };
  }

  private async obtenerColegio(): Promise<Colegio | null> {
    const colegios = await this.colegioRepository.find({ take: 1 });
    return colegios[0] ?? null;
  }

  private etiquetaParentesco(parentesco: Parentesco): string {
    switch (parentesco) {
      case Parentesco.PADRE:
        return 'el padre';
      case Parentesco.MADRE:
        return 'la madre';
      case Parentesco.TUTOR:
        return 'el acudiente (tutor legal)';
      default:
        return 'el acudiente';
    }
  }

  private etiquetaRolAutoriza(rolNombre: string | undefined): string {
    switch (rolNombre) {
      case 'profesor':
        return 'Profesor(a)';
      case 'coordinador':
        return 'Coordinador(a)';
      case 'rector':
        return 'Rector(a)';
      case 'admin':
        return 'Administrador(a)';
      default:
        return 'Funcionario(a) autorizado(a)';
    }
  }

  private construirPdf(autorizacion: AutorizacionSalida, colegio: Colegio | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'letter', margin: 60 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const estudiante = autorizacion.estudiante;
      const acudiente = autorizacion.acudienteAutoriza;
      const autoriza = autorizacion.autorizadoPorUsuario;

      const fechaEmision = new Date();
      const fechaEmisionTexto = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(fechaEmision);
      const horaEmisionTexto = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(fechaEmision);

      const [anio, mes, dia] = autorizacion.fecha.split('-').map(Number);
      const fechaSalidaTexto = new Intl.DateTimeFormat('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(anio, mes - 1, dia));

      if (colegio?.nombre) {
        doc.fontSize(16).font('Helvetica-Bold').text(colegio.nombre, { align: 'center' });
        if (colegio.nit) {
          doc.fontSize(9).font('Helvetica').text(`NIT: ${colegio.nit}`, { align: 'center' });
        }
        doc.moveDown(0.5);
      }

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('AUTORIZACIÓN DE SALIDA ANTICIPADA', { align: 'center' });
      doc.moveDown(1.5);

      const rolTexto = this.etiquetaRolAutoriza(autoriza?.rol?.nombre);
      const parentescoTexto = this.etiquetaParentesco(acudiente.parentesco);
      const documentoAcudiente = acudiente.numeroDocumento
        ? `identificado(a) con documento No. ${acudiente.numeroDocumento}`
        : 'identificado(a) ante la institución';

      const cuerpo =
        `El estudiante de nombre ${estudiante.nombres} ${estudiante.apellidos} tiene permiso de ${parentescoTexto}, ` +
        `${acudiente.nombres} ${acudiente.apellidos}, ${documentoAcudiente}, de salir temprano de la institución ` +
        `el día ${fechaSalidaTexto} a las ${autorizacion.horaAutorizada} con motivo de: ${autorizacion.motivo}.\n\n` +
        `Persona que recoge al estudiante: ${autorizacion.nombrePersonaRecoge}.\n\n` +
        `Yo, ${autoriza?.nombreCompleto ?? '(sin registrar)'}, ${rolTexto} de la institución, apruebo su salida ` +
        `en los términos aquí descritos.`;

      doc.fontSize(11).font('Helvetica').text(cuerpo, { align: 'justify', lineGap: 4 });
      doc.moveDown(3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('_____________________________________', { align: 'center' });
      doc.text(`${autoriza?.nombreCompleto ?? ''} — ${rolTexto}`, { align: 'center' });

      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(
          `Documento generado por AsistSCA el ${fechaEmisionTexto} a las ${horaEmisionTexto} (hora de Bogotá). ` +
            `Autorización registrada el ${new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' }).format(autorizacion.fechaRegistro)}.`,
          { align: 'center' },
        );

      doc.end();
    });
  }

  async marcarUtilizada(id: string) {
    const autorizacion = await this.autorizacionRepository.findOne({ where: { id }, relations: ['estado'] });
    if (!autorizacion) {
      throw new NotFoundException('La autorización no existe.');
    }

    if (autorizacion.estado.codigo !== 'autorizada') {
      throw new ConflictException(
        `Esta autorización está en estado '${autorizacion.estado.codigo}', no se puede marcar como utilizada.`,
      );
    }

    const estadoUtilizada = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.AUTORIZACION_SALIDA, codigo: 'utilizada' },
    });
    if (!estadoUtilizada) {
      throw new ConflictException('Falta el seed del estado autorizacion_salida/utilizada.');
    }

    autorizacion.estado = estadoUtilizada;
    return this.autorizacionRepository.save(autorizacion);
  }

  private async validarPermisoParaAutorizar(estudianteId: string, usuarioActual: UsuarioActual) {
    if (['admin', 'rector', 'coordinador'].includes(usuarioActual.rol)) {
      return;
    }

    if (usuarioActual.rol !== 'profesor') {
      throw new ForbiddenException('Tu rol no puede autorizar salidas anticipadas.');
    }

    const usuario = await this.usuarioRepository.findOne({ where: { id: usuarioActual.sub } });
    if (!usuario?.profesorId) {
      throw new ForbiddenException('Tu usuario no está vinculado a un profesor.');
    }

    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId },
      order: { anioLectivo: 'DESC' },
      relations: ['curso'],
    });

    if (!matricula || matricula.curso.profesorDirectorId !== usuario.profesorId) {
      throw new ForbiddenException(
        'Solo el director de grupo del curso de este estudiante puede autorizar su salida.',
      );
    }
  }
}