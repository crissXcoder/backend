import {
  Injectable,
  BadRequestException,
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
import { ReproductiveStateService } from './reproductive-state.service.js';
import type {
  EstadoReproductivoInfo,
  HitosReproductivos,
} from '../interfaces/reproductive-state.interface.js';
import type { RegistrarServicioDto } from '../dto/registrar-servicio.dto.js';
import type { RegistrarDiagnosticoDto } from '../dto/registrar-diagnostico.dto.js';
import type { RegistrarPartoDto } from '../dto/registrar-parto.dto.js';
import type { RegistrarSecadoDto } from '../dto/registrar-secado.dto.js';

export interface ProximoEventoReproductivo {
  animalId: string;
  arete: string;
  nombre: string;
  tipo: 'Palpación' | 'Parto' | 'Secado';
  fecha: string;
  diasRestantes: number;
}

@Injectable()
export class ReproductiveService {
  constructor(
    private readonly calculationService: ReproductiveCalculationService,
    private readonly stateService: ReproductiveStateService,
  ) {}

  /**
   * Registra un servicio reproductivo (Inseminación Artificial o Monta Natural).
   * Valida raza y días de gestación, calcula los 5 hitos veterinarios y persiste
   * en una sola transacción dentro de request.entityManager.
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

    // Cálculo puro de los 5 hitos según la raza
    const hitos = this.calculationService.calcularHitos(
      dto.fechaEvento,
      diasGestacion,
    );

    // Si es una corrección, marcar el evento previo como revertido
    if (dto.eventoCorrigeId) {
      const eventoPrevio = await manager.findOne(Evento, {
        where: { id: dto.eventoCorrigeId, tenantId, animalId },
      });
      if (!eventoPrevio) {
        throw new NotFoundException(
          `El evento con ID '${dto.eventoCorrigeId}' a corregir no existe o no pertenece a este animal.`,
        );
      }
      eventoPrevio.revertido = true;
      await manager.save(Evento, eventoPrevio);
    }

    // Insertar evento base inmutable
    const evento = manager.create(Evento, {
      tenantId,
      animalId,
      tipo: 'SERVICIO',
      fechaEvento: dto.fechaEvento,
      usuarioId,
      revertido: false,
      eventoCorrigeId: dto.eventoCorrigeId ?? null,
      notas: dto.notas ?? null,
    });
    const savedEvento = await manager.save(Evento, evento);

    // Insertar tabla de detalle
    const eventoServicio = manager.create(EventoServicio, {
      eventoId: savedEvento.id,
      tipoServicio: dto.tipoServicio,
      toroOPajilla: dto.toroOPajilla,
      responsable: dto.responsable ?? null,
      palpacionFecha: hitos.palpacionFecha,
      secadoFecha: hitos.secadoFecha,
      avisoPartoFecha: hitos.avisoPartoFecha,
      avisoPartoUrgenteFecha: hitos.avisoPartoUrgenteFecha,
      fpp: hitos.fpp,
    });
    const savedServicio = await manager.save(EventoServicio, eventoServicio);

    return {
      evento: savedEvento,
      servicio: savedServicio,
      hitos,
    };
  }

  /**
   * Registra el resultado de un diagnóstico de preñez (Palpación, Ecografía, PAG).
   * Confirma preñez ('Preñada') o diagnostica retorno a vacío ('Vacía').
   */
  async registrarDiagnostico(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarDiagnosticoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; diagnostico: EventoDiagnostico }> {
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }

    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es macho y no registra diagnósticos reproductivos.`,
      );
    }

    // Validar que el servicio al que apunta exista y pertenezca al animal
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

    // Manejar corrección si aplica
    if (dto.eventoCorrigeId) {
      const previo = await manager.findOne(Evento, {
        where: { id: dto.eventoCorrigeId, tenantId, animalId },
      });
      if (!previo) {
        throw new NotFoundException(
          `El diagnóstico a corregir no existe o no corresponde a este animal.`,
        );
      }
      previo.revertido = true;
      await manager.save(Evento, previo);
    }

    // Insertar evento base
    const evento = manager.create(Evento, {
      tenantId,
      animalId,
      tipo: 'DIAGNOSTICO',
      fechaEvento: dto.fechaEvento,
      usuarioId,
      revertido: false,
      eventoCorrigeId: dto.eventoCorrigeId ?? null,
      notas: dto.notas ?? null,
    });
    const savedEvento = await manager.save(Evento, evento);

    // Insertar detalle de diagnóstico
    const diagnostico = manager.create(EventoDiagnostico, {
      eventoId: savedEvento.id,
      eventoServicioId: dto.eventoServicioId,
      metodo: dto.metodo,
      resultado: dto.resultado,
    });
    const savedDiagnostico = await manager.save(EventoDiagnostico, diagnostico);

    return { evento: savedEvento, diagnostico: savedDiagnostico };
  }

  /**
   * Registra un parto. Culmina el ciclo reproductivo y devuelve la vaca a 'Vacía'.
   */
  async registrarParto(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarPartoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; parto: EventoParto }> {
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }

    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es macho y no puede parir.`,
      );
    }

    // Si indica cría, validar que exista
    if (dto.criaAnimalId) {
      const cria = await manager.findOne(Animal, {
        where: { id: dto.criaAnimalId, tenantId },
      });
      if (!cria) {
        throw new NotFoundException(
          `La cría con ID '${dto.criaAnimalId}' no fue encontrada en este tenant.`,
        );
      }
    }

    if (dto.eventoCorrigeId) {
      const previo = await manager.findOne(Evento, {
        where: { id: dto.eventoCorrigeId, tenantId, animalId },
      });
      if (previo) {
        previo.revertido = true;
        await manager.save(Evento, previo);
      }
    }

    const evento = manager.create(Evento, {
      tenantId,
      animalId,
      tipo: 'PARTO',
      fechaEvento: dto.fechaEvento,
      usuarioId,
      revertido: false,
      eventoCorrigeId: dto.eventoCorrigeId ?? null,
      notas: dto.observaciones ?? null,
    });
    const savedEvento = await manager.save(Evento, evento);

    const parto = manager.create(EventoParto, {
      eventoId: savedEvento.id,
      eventoServicioId: dto.eventoServicioId ?? null,
      criaAnimalId: dto.criaAnimalId ?? null,
      facilidadParto: dto.facilidadParto ?? null,
      observaciones: dto.observaciones ?? null,
    });
    const savedParto = await manager.save(EventoParto, parto);

    return { evento: savedEvento, parto: savedParto };
  }

  /**
   * Registra un secado real (suspensión del ordeño).
   */
  async registrarSecado(
    animalId: string,
    tenantId: string,
    usuarioId: string,
    dto: RegistrarSecadoDto,
    manager: EntityManager,
  ): Promise<{ evento: Evento; secado: EventoSecado }> {
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }

    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es macho y no pasa por periodo de secado.`,
      );
    }

    if (dto.eventoCorrigeId) {
      const previo = await manager.findOne(Evento, {
        where: { id: dto.eventoCorrigeId, tenantId, animalId },
      });
      if (previo) {
        previo.revertido = true;
        await manager.save(Evento, previo);
      }
    }

    const evento = manager.create(Evento, {
      tenantId,
      animalId,
      tipo: 'SECADO',
      fechaEvento: dto.fechaEvento,
      usuarioId,
      revertido: false,
      eventoCorrigeId: dto.eventoCorrigeId ?? null,
      notas: dto.notas ?? null,
    });
    const savedEvento = await manager.save(Evento, evento);

    const secado = manager.create(EventoSecado, {
      eventoId: savedEvento.id,
    });
    const savedSecado = await manager.save(EventoSecado, secado);

    return { evento: savedEvento, secado: savedSecado };
  }

  /**
   * Obtiene el estado reproductivo derivado al vuelo para un animal.
   */
  async obtenerEstadoReproductivo(
    animalId: string,
    tenantId: string,
    manager: EntityManager,
  ): Promise<EstadoReproductivoInfo> {
    return this.stateService.calcularEstado(animalId, tenantId, manager);
  }

  /**
   * Agrupa los próximos eventos reproductivos (palpaciones pendientes y partos cercanos)
   * para todo el tenant. Alimenta el Calendario Reproductivo del Dashboard de Karla.
   */
  async obtenerProximosEventos(
    tenantId: string,
    manager: EntityManager,
    diasVentana: number = 60,
  ): Promise<ProximoEventoReproductivo[]> {
    // 1. Obtener todas las hembras activas del tenant
    const hembras = await manager.find(Animal, {
      where: { tenantId, activo: true },
      relations: { raza: true },
    });

    const hembrasSolo = hembras.filter(
      (a) => a.sexo?.toLowerCase() === 'hembra',
    );

    const resultados: ProximoEventoReproductivo[] = [];
    const fechaHoy = new Date().toISOString().slice(0, 10);

    // 2. Calcular estado derivado para cada una
    for (const hembra of hembrasSolo) {
      try {
        const estadoInfo = await this.stateService.calcularEstado(
          hembra.id,
          tenantId,
          manager,
        );

        if (estadoInfo.proximosHitos) {
          for (const hito of estadoInfo.proximosHitos) {
            // Incluir eventos desde 7 días pasados hasta diasVentana en el futuro
            if (hito.diasRestantes >= -7 && hito.diasRestantes <= diasVentana) {
              resultados.push({
                animalId: hembra.id,
                arete: hembra.areteInterno,
                nombre: hembra.nombre || `Animal #${hembra.areteInterno}`,
                tipo: hito.tipo === 'Parto FPP' ? 'Parto' : (hito.tipo as any),
                fecha: hito.fecha,
                diasRestantes: hito.diasRestantes,
              });
            }
          }
        }
      } catch {
        // Omitir si ocurre error en animal individual
      }
    }

    // Ordenar por urgencia (menor cantidad de días restantes primero)
    return resultados.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }
}
