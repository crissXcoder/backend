import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Animal } from '../../animales/entities/animal.entity.js';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { EventoServicio } from '../entities/evento-servicio.entity.js';
import { EventoDiagnostico } from '../entities/evento-diagnostico.entity.js';
import { EventoParto } from '../entities/evento-parto.entity.js';
import { EventoSecado } from '../entities/evento-secado.entity.js';
import { ReproductiveCalculationService } from './reproductive-calculation.service.js';
import {
  ReproductiveStateService,
  type EventoHistoricoReproductivo,
} from './reproductive-state.service.js';
import type {
  EstadoReproductivo,
  EstadoReproductivoInfo,
  HitosReproductivos,
  TipoHitoReproductivo,
} from '../interfaces/reproductive-state.interface.js';
import type { RegistrarServicioDto } from '../dto/registrar-servicio.dto.js';
import type { RegistrarDiagnosticoDto } from '../dto/registrar-diagnostico.dto.js';
import type { RegistrarPartoDto } from '../dto/registrar-parto.dto.js';
import type { RegistrarSecadoDto } from '../dto/registrar-secado.dto.js';

/** Ventana por defecto del calendario reproductivo del Dashboard, en días. */
export const DIAS_VENTANA_DEFAULT = 60;

/**
 * Días hacia atrás que el feed sigue mostrando un hito ya vencido.
 *
 * Una palpación que venció anteayer sigue siendo accionable: el productor
 * todavía tiene que hacerla. Desaparecer el hito el mismo día en que vence haría
 * que se pierdan tareas atrasadas.
 */
const DIAS_RETROACTIVOS_FEED = 7;

/**
 * Estados desde los que un parto tiene sentido.
 *
 * MOD-03-Reproductivo.md define el parto como cierre del ciclo `Preñada → ... →
 * Vacía`. Registrar un parto sobre una vaca 'Vacía' o 'Servida' significa que
 * falta el diagnóstico de preñez, o que alguien se equivocó de animal.
 */
const ESTADOS_QUE_PERMITEN_PARTO: readonly EstadoReproductivo[] = [
  'Preñada',
  'En Secado',
];

export interface ProximoEventoReproductivo {
  animalId: string;
  arete: string;
  nombre: string;
  /**
   * Los 5 tipos que la máquina de estados puede emitir, con `Parto FPP`
   * renombrado a `Parto` para el consumo del Dashboard.
   *
   * Antes este tipo declaraba solo 3 valores mientras el código emitía además
   * 'Aviso Parto', escondido tras un `as any`: el contrato publicado no
   * coincidía con lo que el endpoint devolvía en runtime.
   */
  tipo: Exclude<TipoHitoReproductivo, 'Parto FPP'> | 'Parto';
  fecha: string;
  diasRestantes: number;
  /** true solo en el aviso de FPP - 3 días. */
  urgente: boolean;
}

@Injectable()
export class ReproductiveService {
  private readonly logger = new Logger(ReproductiveService.name);

  constructor(
    private readonly calculationService: ReproductiveCalculationService,
    private readonly stateService: ReproductiveStateService,
  ) {}

  /**
   * Registra un servicio reproductivo (Inseminación Artificial o Monta Natural)
   * y calcula los 5 hitos veterinarios según la raza del animal.
   */
  async registrarServicio(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarServicioDto,
    manager: EntityManager,
  ): Promise<{
    evento: Evento;
    servicio: EventoServicio;
    hitos: HitosReproductivos;
  }> {
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
      relations: { raza: true },
    });

    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }

    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es de sexo '${animal.sexo}' y no puede registrar servicios reproductivos.`,
      );
    }

    const diasGestacion = animal.raza?.diasGestacion;
    if (!diasGestacion || diasGestacion <= 0) {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' no tiene asignada una raza con días de gestación válidos. Configure el catálogo de razas antes de registrar servicios.`,
      );
    }

    // FPP siempre por raza, nunca una constante. Ver Reglas-de-Negocio-Ganaderas.md.
    const hitos = this.calculationService.calcularHitos(
      dto.fechaEvento,
      diasGestacion,
    );

    // Toda la escritura va en una transacción: marcar el evento anterior como
    // revertido y crear el nuevo tienen que pasar juntos o no pasar. Antes el
    // `revertido = true` ocurría fuera del bloque protegido, así que un fallo
    // posterior dejaba el evento original revertido y sin reemplazo: la vaca
    // perdía su ciclo.
    return manager.transaction(async (trx) => {
      await this.revertirEventoCorregido(
        dto.eventoCorrigeId,
        animalId,
        tenantId,
        trx,
      );

      const evento = await trx.save(
        Evento,
        trx.create(Evento, {
          tenantId,
          animalId,
          tipo: 'SERVICIO',
          fechaEvento: dto.fechaEvento,
          usuarioId,
          revertido: false,
          eventoCorrigeId: dto.eventoCorrigeId ?? null,
          notas: dto.notas ?? null,
        }),
      );

      const servicio = await trx.save(
        EventoServicio,
        trx.create(EventoServicio, {
          eventoId: evento.id,
          tipoServicio: dto.tipoServicio,
          toroOPajilla: dto.toroOPajilla,
          responsable: dto.responsable ?? null,
          palpacionFecha: hitos.palpacionFecha,
          secadoFecha: hitos.secadoFecha,
          avisoPartoFecha: hitos.avisoPartoFecha,
          avisoPartoUrgenteFecha: hitos.avisoPartoUrgenteFecha,
          fpp: hitos.fpp,
        }),
      );

      return { evento, servicio, hitos };
    });
  }

  /**
   * Registra el resultado de un diagnóstico de preñez (Palpación, Ecografía, PAG).
   * Es lo único que confirma una preñez: un servicio por sí solo no cuenta.
   */
  async registrarDiagnostico(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarDiagnosticoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; diagnostico: EventoDiagnostico }> {
    await this.obtenerHembra(
      animalId,
      tenantId,
      manager,
      'diagnósticos reproductivos',
    );

    // El servicio al que apunta tiene que existir, ser de este animal, de esta
    // finca, y ser efectivamente un SERVICIO.
    const servicioEvento = await manager.findOne(Evento, {
      where: {
        id: dto.eventoServicioId,
        animalId,
        tenantId,
        tipo: 'SERVICIO',
        revertido: false,
      },
    });
    if (!servicioEvento) {
      throw new NotFoundException(
        `El evento de servicio con ID '${dto.eventoServicioId}' no existe o no corresponde a este animal.`,
      );
    }

    return manager.transaction(async (trx) => {
      await this.revertirEventoCorregido(
        dto.eventoCorrigeId,
        animalId,
        tenantId,
        trx,
      );

      const evento = await trx.save(
        Evento,
        trx.create(Evento, {
          tenantId,
          animalId,
          tipo: 'DIAGNOSTICO',
          fechaEvento: dto.fechaEvento,
          usuarioId,
          revertido: false,
          eventoCorrigeId: dto.eventoCorrigeId ?? null,
          notas: dto.notas ?? null,
        }),
      );

      const diagnostico = await trx.save(
        EventoDiagnostico,
        trx.create(EventoDiagnostico, {
          eventoId: evento.id,
          eventoServicioId: dto.eventoServicioId,
          metodo: dto.metodo,
          resultado: dto.resultado,
        }),
      );

      return { evento, diagnostico };
    });
  }

  /**
   * Registra un parto (o un aborto, vía `facilidadParto`). Cierra el ciclo
   * reproductivo y devuelve el animal a 'Vacía'.
   */
  async registrarParto(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarPartoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; parto: EventoParto }> {
    await this.obtenerHembra(animalId, tenantId, manager, 'partos');

    // El servicio al que se asocia el parto se valida igual que en el
    // diagnóstico. Antes se guardaba el id tal cual, sin comprobar nada.
    //
    // Por qué importa: la FK de `evento_parto.evento_servicio_id` apunta a
    // `evento(id)`, y en PostgreSQL las comprobaciones de integridad
    // referencial se ejecutan con los privilegios del dueño de la tabla y NO
    // aplican RLS. Es decir, un id de OTRA finca pasaba la FK sin problema y
    // quedaba persistido, creando un enlace cruzado entre tenants.
    if (dto.eventoServicioId) {
      const servicioEvento = await manager.findOne(Evento, {
        where: {
          id: dto.eventoServicioId,
          animalId,
          tenantId,
          tipo: 'SERVICIO',
          revertido: false,
        },
      });
      if (!servicioEvento) {
        throw new NotFoundException(
          `El evento de servicio con ID '${dto.eventoServicioId}' no existe o no corresponde a este animal.`,
        );
      }
    }

    if (dto.criaAnimalId) {
      if (dto.criaAnimalId === animalId) {
        throw new BadRequestException(
          'La cría no puede ser el mismo animal que parió.',
        );
      }
      const cria = await manager.findOne(Animal, {
        where: { id: dto.criaAnimalId, tenantId },
      });
      if (!cria) {
        throw new NotFoundException(
          `La cría con ID '${dto.criaAnimalId}' no fue encontrada en este tenant.`,
        );
      }
    }

    return manager.transaction(async (trx) => {
      // El orden importa: primero se revierte el evento que esta corrección
      // reemplaza, y recién después se calcula el estado. Si se calculara antes,
      // una corrección chocaría contra el propio estado que viene a corregir.
      await this.revertirEventoCorregido(
        dto.eventoCorrigeId,
        animalId,
        tenantId,
        trx,
      );

      const estado = await this.stateService.calcularEstado(
        animalId,
        tenantId,
        trx,
      );
      if (!ESTADOS_QUE_PERMITEN_PARTO.includes(estado.estadoActual)) {
        throw new BadRequestException(
          `No se puede registrar un parto: el animal está en estado '${estado.estadoActual}'. ` +
            `Un parto se registra sobre una preñez confirmada (estado 'Preñada' o 'En Secado'). ` +
            `Si la preñez existe pero no está registrada, primero anotá el diagnóstico de gestación.`,
        );
      }

      const evento = await trx.save(
        Evento,
        trx.create(Evento, {
          tenantId,
          animalId,
          tipo: 'PARTO',
          fechaEvento: dto.fechaEvento,
          usuarioId,
          revertido: false,
          eventoCorrigeId: dto.eventoCorrigeId ?? null,
          notas: dto.observaciones ?? null,
        }),
      );

      const parto = await trx.save(
        EventoParto,
        trx.create(EventoParto, {
          eventoId: evento.id,
          eventoServicioId: dto.eventoServicioId ?? null,
          criaAnimalId: dto.criaAnimalId ?? null,
          facilidadParto: dto.facilidadParto ?? null,
          observaciones: dto.observaciones ?? null,
        }),
      );

      return { evento, parto };
    });
  }

  /**
   * Registra el secado real (suspensión del ordeño), que puede diferir de la
   * fecha calculada.
   */
  async registrarSecado(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarSecadoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; secado: EventoSecado }> {
    await this.obtenerHembra(animalId, tenantId, manager, 'periodo de secado');

    return manager.transaction(async (trx) => {
      await this.revertirEventoCorregido(
        dto.eventoCorrigeId,
        animalId,
        tenantId,
        trx,
      );

      const evento = await trx.save(
        Evento,
        trx.create(Evento, {
          tenantId,
          animalId,
          tipo: 'SECADO',
          fechaEvento: dto.fechaEvento,
          usuarioId,
          revertido: false,
          eventoCorrigeId: dto.eventoCorrigeId ?? null,
          notas: dto.notas ?? null,
        }),
      );

      const secado = await trx.save(
        EventoSecado,
        trx.create(EventoSecado, { eventoId: evento.id }),
      );

      return { evento, secado };
    });
  }

  /** Estado reproductivo derivado al vuelo para un animal. */
  async obtenerEstadoReproductivo(
    animalId: string,
    tenantId: string,
    manager: EntityManager,
  ): Promise<EstadoReproductivoInfo> {
    return this.stateService.calcularEstado(animalId, tenantId, manager);
  }

  /** Historial reproductivo completo del animal, en orden cronológico. */
  async obtenerHistorialReproductivo(
    animalId: string,
    tenantId: string,
    manager: EntityManager,
  ): Promise<EventoHistoricoReproductivo[]> {
    return this.stateService.obtenerHistorial(animalId, tenantId, manager);
  }

  /**
   * Próximos eventos reproductivos de toda la finca, ordenados por urgencia.
   * Alimenta el Calendario Reproductivo del Dashboard.
   */
  async obtenerProximosEventos(
    tenantId: string,
    manager: EntityManager,
    diasVentana: number = DIAS_VENTANA_DEFAULT,
  ): Promise<ProximoEventoReproductivo[]> {
    const animales = await manager.find(Animal, {
      where: { tenantId, activo: true },
      relations: { raza: true },
    });

    const hembras = animales.filter((a) => a.sexo?.toLowerCase() === 'hembra');
    if (hembras.length === 0) return [];

    // Cálculo al vuelo en lote: mismo resultado que animal por animal, pero con
    // un número fijo de consultas. Ver ReproductiveStateService.calcularEstadosBatch.
    const estados = await this.stateService.calcularEstadosBatch(
      hembras,
      tenantId,
      manager,
    );

    const resultados: ProximoEventoReproductivo[] = [];

    for (const hembra of hembras) {
      const estadoInfo = estados.get(hembra.id);
      if (!estadoInfo) {
        // Antes esto era un `catch {}` vacío y el animal simplemente
        // desaparecía del calendario. Una vaca preñada que no aparece en las
        // alertas de parto es peor que un error visible: nadie nota que falta.
        this.logger.warn(
          `No se pudo derivar el estado reproductivo del animal ${hembra.id} (arete ${hembra.areteInterno}); queda fuera del calendario.`,
        );
        continue;
      }

      if (estadoInfo.advertencias?.length) {
        this.logger.warn(
          `Animal ${hembra.id} (arete ${hembra.areteInterno}): ${estadoInfo.advertencias.join(' | ')}`,
        );
      }

      for (const hito of estadoInfo.proximosHitos ?? []) {
        if (
          hito.diasRestantes < -DIAS_RETROACTIVOS_FEED ||
          hito.diasRestantes > diasVentana
        ) {
          continue;
        }

        resultados.push({
          animalId: hembra.id,
          arete: hembra.areteInterno,
          nombre: hembra.nombre || `Animal #${hembra.areteInterno}`,
          tipo: hito.tipo === 'Parto FPP' ? 'Parto' : hito.tipo,
          fecha: hito.fecha,
          diasRestantes: hito.diasRestantes,
          urgente: hito.urgente,
        });
      }
    }

    return resultados.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }

  /** Busca el animal y confirma que sea hembra. */
  private async obtenerHembra(
    animalId: string,
    tenantId: string,
    manager: EntityManager,
    accion: string,
  ): Promise<Animal> {
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }
    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es de sexo '${animal.sexo}' y no registra ${accion}.`,
      );
    }
    return animal;
  }

  /**
   * Marca como revertido el evento que una corrección reemplaza.
   *
   * Los eventos son inmutables: corregir nunca es editar ni borrar, sino
   * insertar uno nuevo que apunta al anterior. Ver Patron-Evento-Estado-Alerta.md.
   *
   * Si el evento a corregir no existe se lanza 404. Antes servicio y diagnóstico
   * lo hacían, pero parto y secado lo ignoraban en silencio y devolvían 201: el
   * cliente creía haber corregido un evento que en realidad seguía vigente.
   */
  private async revertirEventoCorregido(
    eventoCorrigeId: string | undefined,
    animalId: string,
    tenantId: string,
    manager: EntityManager,
  ): Promise<void> {
    if (!eventoCorrigeId) return;

    const previo = await manager.findOne(Evento, {
      where: { id: eventoCorrigeId, tenantId, animalId },
    });

    if (!previo) {
      throw new NotFoundException(
        `El evento con ID '${eventoCorrigeId}' a corregir no existe o no pertenece a este animal.`,
      );
    }

    previo.revertido = true;
    await manager.save(Evento, previo);
  }
}
