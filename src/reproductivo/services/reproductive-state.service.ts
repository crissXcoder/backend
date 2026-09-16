import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Animal } from '../../animales/entities/animal.entity.js';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { EventoServicio } from '../entities/evento-servicio.entity.js';
import { EventoDiagnostico } from '../entities/evento-diagnostico.entity.js';
import { EventoParto } from '../entities/evento-parto.entity.js';
import { EventoSecado } from '../entities/evento-secado.entity.js';
import type {
  EstadoReproductivo,
  EstadoReproductivoInfo,
  ResumenServicioActivo,
  ResumenDiagnosticoActivo,
  ResumenPartoActivo,
  ResumenSecadoActivo,
} from '../interfaces/reproductive-state.interface.js';

export interface EventoHistoricoReproductivo {
  evento: Evento;
  servicio?: EventoServicio | null;
  diagnostico?: EventoDiagnostico | null;
  parto?: EventoParto | null;
  secado?: EventoSecado | null;
}

@Injectable()
export class ReproductiveStateService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Calcula el estado reproductivo actual de un animal al vuelo a partir de su historial
   * de eventos inmutables (append-only), excluyendo cualquier evento revertido.
   *
   * NUNCA lee ni modifica una columna de estado en la tabla animal.
   */
  async calcularEstado(
    animalId: string,
    tenantId: string,
    customManager?: EntityManager,
  ): Promise<EstadoReproductivoInfo> {
    const manager = customManager ?? this.dataSource.manager;

    // 1. Obtener animal con su raza
    const animal = await manager.findOne(Animal, {
      where: { id: animalId, tenantId },
      relations: { raza: true },
    });

    if (!animal) {
      throw new NotFoundException(`Animal con ID '${animalId}' no encontrado.`);
    }

    // 2. Validar que sea hembra
    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es de sexo '${animal.sexo}' y no posee ciclo reproductivo. Solo las hembras registran eventos reproductivos.`,
      );
    }

    // 3. Consultar eventos reproductivos del animal (no revertidos, en orden cronológico)
    const eventos = await manager.find(Evento, {
      where: {
        animalId,
        tenantId,
        revertido: false,
      },
      order: {
        fechaEvento: 'ASC',
        fechaRegistro: 'ASC',
      },
    });

    // Filtrar solo los eventos del dominio reproductivo
    const tiposReproductivos = new Set([
      'SERVICIO',
      'DIAGNOSTICO',
      'PARTO',
      'SECADO',
    ]);
    const eventosRepro = eventos.filter((e) => tiposReproductivos.has(e.tipo));

    // 4. Cargar detalles de cada evento
    const eventosHistoricos: EventoHistoricoReproductivo[] = await Promise.all(
      eventosRepro.map(async (evento) => {
        let servicio: EventoServicio | null = null;
        let diagnostico: EventoDiagnostico | null = null;
        let parto: EventoParto | null = null;
        let secado: EventoSecado | null = null;

        if (evento.tipo === 'SERVICIO') {
          servicio = await manager.findOne(EventoServicio, {
            where: { eventoId: evento.id },
          });
        } else if (evento.tipo === 'DIAGNOSTICO') {
          diagnostico = await manager.findOne(EventoDiagnostico, {
            where: { eventoId: evento.id },
          });
        } else if (evento.tipo === 'PARTO') {
          parto = await manager.findOne(EventoParto, {
            where: { eventoId: evento.id },
          });
        } else if (evento.tipo === 'SECADO') {
          secado = await manager.findOne(EventoSecado, {
            where: { eventoId: evento.id },
          });
        }

        return { evento, servicio, diagnostico, parto, secado };
      }),
    );

    // 5. Aplicar la máquina de estados pura
    return this.derivarEstadoDesdeEventos(animal, eventosHistoricos);
  }

  /**
   * Máquina de estados pura. Permite evaluar en memoria el estado reproductivo derivado
   * recorriendo la secuencia de eventos, ideal para tests unitarios aislados.
   */
  derivarEstadoDesdeEventos(
    animal: Pick<Animal, 'id' | 'areteInterno' | 'sexo'> & {
      raza?: { nombre?: string; diasGestacion?: number } | null;
    },
    eventosHistoricos: EventoHistoricoReproductivo[],
    fechaReferencia: string = new Date().toISOString().slice(0, 10),
  ): EstadoReproductivoInfo {
    // Validar sexo
    if (animal.sexo?.toLowerCase() !== 'hembra') {
      throw new BadRequestException(
        `El animal con arete '${animal.areteInterno}' es de sexo '${animal.sexo}' y no posee ciclo reproductivo.`,
      );
    }

    let estadoActual: EstadoReproductivo = 'Vacía';
    let servicioActivo: ResumenServicioActivo | undefined = undefined;
    let ultimoDiagnostico: ResumenDiagnosticoActivo | undefined = undefined;
    let ultimoParto: ResumenPartoActivo | undefined = undefined;
    let ultimoSecado: ResumenSecadoActivo | undefined = undefined;

    for (const item of eventosHistoricos) {
      const { evento, servicio, diagnostico, parto, secado } = item;

      // Si el evento fue revertido o corregido por otro, se ignora en la derivación
      if (evento.revertido) {
        continue;
      }

      switch (evento.tipo) {
        case 'SERVICIO': {
          estadoActual = 'Servida';
          ultimoDiagnostico = undefined; // Nuevo servicio resetea diagnóstico anterior
          if (servicio) {
            servicioActivo = {
              eventoId: evento.id,
              fechaServicio: evento.fechaEvento,
              tipoServicio: servicio.tipoServicio,
              toroOPajilla: servicio.toroOPajilla,
              responsable: servicio.responsable,
              fpp: servicio.fpp,
              palpacionFecha: servicio.palpacionFecha,
              secadoFecha: servicio.secadoFecha,
              avisoPartoFecha: servicio.avisoPartoFecha,
              avisoPartoUrgenteFecha: servicio.avisoPartoUrgenteFecha,
            };
          }
          break;
        }

        case 'DIAGNOSTICO': {
          if (diagnostico) {
            ultimoDiagnostico = {
              eventoId: evento.id,
              fecha: evento.fechaEvento,
              metodo: diagnostico.metodo,
              resultado: diagnostico.resultado,
              eventoServicioId: diagnostico.eventoServicioId,
            };

            if (diagnostico.resultado === 'Preñada') {
              estadoActual = 'Preñada';
            } else if (diagnostico.resultado === 'Vacía') {
              // Diagnóstico negativo: la vaca vuelve a estar abierta / vacía
              estadoActual = 'Vacía';
              servicioActivo = undefined;
            }
          }
          break;
        }

        case 'SECADO': {
          if (secado) {
            ultimoSecado = {
              eventoId: evento.id,
              fecha: evento.fechaEvento,
            };
            // Si estaba preñada, entra formalmente al estado "En Secado"
            if (estadoActual === 'Preñada') {
              estadoActual = 'En Secado';
            }
          }
          break;
        }

        case 'PARTO': {
          if (parto) {
            ultimoParto = {
              eventoId: evento.id,
              fecha: evento.fechaEvento,
              criaAnimalId: parto.criaAnimalId,
              facilidadParto: parto.facilidadParto,
            };
            // El parto culmina el ciclo reproductivo: vuelve a "Vacía"
            estadoActual = 'Vacía';
            servicioActivo = undefined;
            ultimoDiagnostico = undefined;
          }
          break;
        }
      }
    }

    // Calcular próximos hitos según el estado y la fecha de referencia
    const proximosHitos: EstadoReproductivoInfo['proximosHitos'] = [];

    if (servicioActivo) {
      if (estadoActual === 'Servida') {
        proximosHitos.push({
          tipo: 'Palpación',
          fecha: servicioActivo.palpacionFecha,
          diasRestantes: this.calcularDiasRestantes(
            fechaReferencia,
            servicioActivo.palpacionFecha,
          ),
        });
      } else if (estadoActual === 'Preñada') {
        proximosHitos.push(
          {
            tipo: 'Secado',
            fecha: servicioActivo.secadoFecha,
            diasRestantes: this.calcularDiasRestantes(
              fechaReferencia,
              servicioActivo.secadoFecha,
            ),
          },
          {
            tipo: 'Aviso Parto',
            fecha: servicioActivo.avisoPartoFecha,
            diasRestantes: this.calcularDiasRestantes(
              fechaReferencia,
              servicioActivo.avisoPartoFecha,
            ),
          },
          {
            tipo: 'Parto FPP',
            fecha: servicioActivo.fpp,
            diasRestantes: this.calcularDiasRestantes(
              fechaReferencia,
              servicioActivo.fpp,
            ),
          },
        );
      } else if (estadoActual === 'En Secado') {
        proximosHitos.push(
          {
            tipo: 'Aviso Parto',
            fecha: servicioActivo.avisoPartoFecha,
            diasRestantes: this.calcularDiasRestantes(
              fechaReferencia,
              servicioActivo.avisoPartoFecha,
            ),
          },
          {
            tipo: 'Parto FPP',
            fecha: servicioActivo.fpp,
            diasRestantes: this.calcularDiasRestantes(
              fechaReferencia,
              servicioActivo.fpp,
            ),
          },
        );
      }
    }

    return {
      animalId: animal.id,
      areteInterno: animal.areteInterno,
      sexo: animal.sexo,
      razaNombre: animal.raza?.nombre,
      diasGestacionRaza: animal.raza?.diasGestacion,
      estadoActual,
      servicioActivo,
      ultimoDiagnostico,
      ultimoParto,
      ultimoSecado,
      proximosHitos,
    };
  }

  private calcularDiasRestantes(fechaDesde: string, fechaHasta: string): number {
    const d1 = new Date(fechaDesde.slice(0, 10)).getTime();
    const d2 = new Date(fechaHasta.slice(0, 10)).getTime();
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }
}
