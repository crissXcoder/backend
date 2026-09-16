import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  ReproductiveStateService,
  EventoHistoricoReproductivo,
} from '../services/reproductive-state.service.js';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { EventoServicio } from '../entities/evento-servicio.entity.js';
import { EventoDiagnostico } from '../entities/evento-diagnostico.entity.js';
import { EventoParto } from '../entities/evento-parto.entity.js';
import { EventoSecado } from '../entities/evento-secado.entity.js';
import { DataSource } from 'typeorm';

describe('ReproductiveStateService (Máquina de Estados al Vuelo)', () => {
  let service: ReproductiveStateService;
  const mockDataSource = {} as DataSource;

  const mockVaca = {
    id: 'vaca-uuid-1',
    areteInterno: '104',
    sexo: 'Hembra',
    raza: { nombre: 'Holstein', diasGestacion: 281 },
  };

  const mockToro = {
    id: 'toro-uuid-1',
    areteInterno: '001',
    sexo: 'Macho',
    raza: { nombre: 'Brahman', diasGestacion: 293 },
  };

  beforeEach(() => {
    service = new ReproductiveStateService(mockDataSource);
  });

  it('Estado inicial: Animal hembra sin eventos inicia en "Vacía"', () => {
    const estado = service.derivarEstadoDesdeEventos(mockVaca, []);
    expect(estado.estadoActual).toBe('Vacía');
    expect(estado.servicioActivo).toBeUndefined();
  });

  it('CRITERIO 5: Animal macho NUNCA produce un estado reproductivo válido y arroja BadRequestException', () => {
    expect(() => service.derivarEstadoDesdeEventos(mockToro, [])).toThrow(
      BadRequestException,
    );
    expect(() => service.derivarEstadoDesdeEventos(mockToro, [])).toThrow(
      /no posee ciclo reproductivo/i,
    );
  });

  it('CRITERIO 2 (Corrige Bug B4): Registrar un servicio sin diagnóstico posterior deja el estado en "Servida", NUNCA en "Preñada"', () => {
    const eventoServicio: Evento = {
      id: 'evento-s1',
      tenantId: 'tenant-1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-02-01',
      fechaRegistro: new Date('2026-02-01T10:00:00Z'),
      usuarioId: 'user-1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: null,
      animal: mockVaca as any,
    };

    const detalleServicio: EventoServicio = {
      eventoId: 'evento-s1',
      evento: eventoServicio,
      tipoServicio: 'Inseminación Artificial',
      toroOPajilla: 'Titan (CRC-B-001)',
      responsable: 'Dr. Veterinario',
      palpacionFecha: '2026-03-13',
      secadoFecha: '2026-09-10',
      avisoPartoFecha: '2026-10-25',
      avisoPartoUrgenteFecha: '2026-11-06',
      fpp: '2026-11-09',
    };

    const historia: EventoHistoricoReproductivo[] = [
      { evento: eventoServicio, servicio: detalleServicio },
    ];

    const estado = service.derivarEstadoDesdeEventos(mockVaca, historia);

    expect(estado.estadoActual).toBe('Servida');
    expect(estado.estadoActual).not.toBe('Preñada');
    expect(estado.servicioActivo).toBeDefined();
    expect(estado.servicioActivo?.tipoServicio).toBe('Inseminación Artificial');
    expect(estado.servicioActivo?.fpp).toBe('2026-11-09');
    expect(estado.proximosHitos?.[0]?.tipo).toBe('Palpación');
  });

  it('Transición exitosa a "Preñada" cuando existe diagnóstico confirmatorio positivo', () => {
    const eventoS: Evento = {
      id: 'ev-s1',
      tenantId: 'tenant-1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-01',
      fechaRegistro: new Date('2026-01-01T08:00:00Z'),
      usuarioId: 'u-1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: null,
      animal: mockVaca as any,
    };
    const detS: EventoServicio = {
      eventoId: 'ev-s1',
      evento: eventoS,
      tipoServicio: 'Monta Natural',
      toroOPajilla: 'Toro Campeón',
      responsable: 'Peón',
      palpacionFecha: '2026-02-10',
      secadoFecha: '2026-08-10',
      avisoPartoFecha: '2026-09-24',
      avisoPartoUrgenteFecha: '2026-10-06',
      fpp: '2026-10-09',
    };

    const eventoD: Evento = {
      id: 'ev-d1',
      tenantId: 'tenant-1',
      animalId: mockVaca.id,
      tipo: 'DIAGNOSTICO',
      fechaEvento: '2026-02-10',
      fechaRegistro: new Date('2026-02-10T09:00:00Z'),
      usuarioId: 'u-1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: null,
      animal: mockVaca as any,
    };
    const detD: EventoDiagnostico = {
      eventoId: 'ev-d1',
      evento: eventoD,
      eventoServicioId: 'ev-s1',
      eventoServicio: eventoS,
      metodo: 'Palpación',
      resultado: 'Preñada',
    };

    const historia: EventoHistoricoReproductivo[] = [
      { evento: eventoS, servicio: detS },
      { evento: eventoD, diagnostico: detD },
    ];

    const estado = service.derivarEstadoDesdeEventos(mockVaca, historia);

    expect(estado.estadoActual).toBe('Preñada');
    expect(estado.ultimoDiagnostico?.resultado).toBe('Preñada');
    expect(estado.proximosHitos?.map((h) => h.tipo)).toEqual([
      'Secado',
      'Aviso Parto',
      'Parto FPP',
    ]);
  });

  it('CRITERIO 3: Diagnóstico con resultado = "Vacía" retorna el estado a "Vacía" y no se queda en "Servida"', () => {
    const eventoS: Evento = {
      id: 'ev-s1',
      tenantId: 'tenant-1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-01',
      fechaRegistro: new Date('2026-01-01T08:00:00Z'),
      usuarioId: 'u-1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: null,
      animal: mockVaca as any,
    };
    const detS: EventoServicio = {
      eventoId: 'ev-s1',
      evento: eventoS,
      tipoServicio: 'Inseminación Artificial',
      toroOPajilla: 'Pajilla Holstein',
      responsable: 'Dr. Vet',
      palpacionFecha: '2026-02-10',
      secadoFecha: '2026-08-10',
      avisoPartoFecha: '2026-09-24',
      avisoPartoUrgenteFecha: '2026-10-06',
      fpp: '2026-10-09',
    };

    const eventoD: Evento = {
      id: 'ev-d1',
      tenantId: 'tenant-1',
      animalId: mockVaca.id,
      tipo: 'DIAGNOSTICO',
      fechaEvento: '2026-02-10',
      fechaRegistro: new Date('2026-02-10T09:00:00Z'),
      usuarioId: 'u-1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: 'Palpación negativa',
      animal: mockVaca as any,
    };
    const detD: EventoDiagnostico = {
      eventoId: 'ev-d1',
      evento: eventoD,
      eventoServicioId: 'ev-s1',
      eventoServicio: eventoS,
      metodo: 'Palpación',
      resultado: 'Vacía',
    };

    const historia: EventoHistoricoReproductivo[] = [
      { evento: eventoS, servicio: detS },
      { evento: eventoD, diagnostico: detD },
    ];

    const estado = service.derivarEstadoDesdeEventos(mockVaca, historia);

    expect(estado.estadoActual).toBe('Vacía');
    expect(estado.servicioActivo).toBeUndefined();
    expect(estado.ultimoDiagnostico?.resultado).toBe('Vacía');
    expect(estado.proximosHitos).toEqual([]);
  });

  it('Ciclo completo: Servida -> Preñada -> En Secado -> Parto vuelve a "Vacía"', () => {
    const evS: Evento = { id: 's1', tenantId: 't1', animalId: mockVaca.id, tipo: 'SERVICIO', fechaEvento: '2026-01-01', fechaRegistro: new Date(), usuarioId: 'u1', revertido: false, eventoCorrigeId: null, eventoCorrige: null, notas: null, animal: mockVaca as any };
    const detS: EventoServicio = { eventoId: 's1', evento: evS, tipoServicio: 'Inseminación Artificial', toroOPajilla: 'Pajilla', responsable: 'Vet', palpacionFecha: '2026-02-10', secadoFecha: '2026-08-10', avisoPartoFecha: '2026-09-24', avisoPartoUrgenteFecha: '2026-10-06', fpp: '2026-10-09' };

    const evD: Evento = { id: 'd1', tenantId: 't1', animalId: mockVaca.id, tipo: 'DIAGNOSTICO', fechaEvento: '2026-02-10', fechaRegistro: new Date(), usuarioId: 'u1', revertido: false, eventoCorrigeId: null, eventoCorrige: null, notas: null, animal: mockVaca as any };
    const detD: EventoDiagnostico = { eventoId: 'd1', evento: evD, eventoServicioId: 's1', eventoServicio: evS, metodo: 'Ecografía', resultado: 'Preñada' };

    const evSec: Evento = { id: 'sec1', tenantId: 't1', animalId: mockVaca.id, tipo: 'SECADO', fechaEvento: '2026-08-10', fechaRegistro: new Date(), usuarioId: 'u1', revertido: false, eventoCorrigeId: null, eventoCorrige: null, notas: null, animal: mockVaca as any };
    const detSec: EventoSecado = { eventoId: 'sec1', evento: evSec };

    const evP: Evento = { id: 'p1', tenantId: 't1', animalId: mockVaca.id, tipo: 'PARTO', fechaEvento: '2026-10-10', fechaRegistro: new Date(), usuarioId: 'u1', revertido: false, eventoCorrigeId: null, eventoCorrige: null, notas: null, animal: mockVaca as any };
    const detP: EventoParto = { eventoId: 'p1', evento: evP, eventoServicioId: 's1', eventoServicio: evS, criaAnimalId: null, facilidadParto: 'Normal', observaciones: 'Cría sana' };

    // 1. Estado en secado
    const estadoSecado = service.derivarEstadoDesdeEventos(mockVaca, [
      { evento: evS, servicio: detS },
      { evento: evD, diagnostico: detD },
      { evento: evSec, secado: detSec },
    ]);
    expect(estadoSecado.estadoActual).toBe('En Secado');

    // 2. Estado post-parto
    const estadoPostParto = service.derivarEstadoDesdeEventos(mockVaca, [
      { evento: evS, servicio: detS },
      { evento: evD, diagnostico: detD },
      { evento: evSec, secado: detSec },
      { evento: evP, parto: detP },
    ]);
    expect(estadoPostParto.estadoActual).toBe('Vacía');
    expect(estadoPostParto.ultimoParto?.facilidadParto).toBe('Normal');
    expect(estadoPostParto.servicioActivo).toBeUndefined();
  });

  it('CRITERIO 4: Evento de corrección ignora el evento marcado como revertido = true y recalcula con el nuevo', () => {
    // Evento original erróneo (revertido = true)
    const evOriginalRevertido: Evento = {
      id: 'ev-erroneo',
      tenantId: 't1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-01',
      fechaRegistro: new Date('2026-01-01T08:00:00Z'),
      usuarioId: 'u1',
      revertido: true, // MARCADO REVERTIDO
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: 'Fecha incorrecta reportada por peón',
      animal: mockVaca as any,
    };
    const detOriginal: EventoServicio = {
      eventoId: 'ev-erroneo',
      evento: evOriginalRevertido,
      tipoServicio: 'Monta Natural',
      toroOPajilla: 'Toro Viejo',
      responsable: 'Peon 1',
      palpacionFecha: '2026-02-10',
      secadoFecha: '2026-08-10',
      avisoPartoFecha: '2026-09-24',
      avisoPartoUrgenteFecha: '2026-10-06',
      fpp: '2026-10-09',
    };

    // Evento de corrección activo
    const evCorregido: Evento = {
      id: 'ev-corregido',
      tenantId: 't1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-15', // Fecha real
      fechaRegistro: new Date('2026-01-16T08:00:00Z'),
      usuarioId: 'u1',
      revertido: false,
      eventoCorrigeId: 'ev-erroneo',
      eventoCorrige: evOriginalRevertido,
      notas: 'Corrección: el servicio fue el 15 de enero con pajilla certificada',
      animal: mockVaca as any,
    };
    const detCorregido: EventoServicio = {
      eventoId: 'ev-corregido',
      evento: evCorregido,
      tipoServicio: 'Inseminación Artificial',
      toroOPajilla: 'Titan Certificado',
      responsable: 'Dr. García',
      palpacionFecha: '2026-02-24',
      secadoFecha: '2026-08-24',
      avisoPartoFecha: '2026-10-08',
      avisoPartoUrgenteFecha: '2026-10-20',
      fpp: '2026-10-23',
    };

    const historia: EventoHistoricoReproductivo[] = [
      { evento: evOriginalRevertido, servicio: detOriginal },
      { evento: evCorregido, servicio: detCorregido },
    ];

    const estado = service.derivarEstadoDesdeEventos(mockVaca, historia);

    // El cálculo debe basarse 100% en el evento corregido activo
    expect(estado.estadoActual).toBe('Servida');
    expect(estado.servicioActivo?.eventoId).toBe('ev-corregido');
    expect(estado.servicioActivo?.toroOPajilla).toBe('Titan Certificado');
    expect(estado.servicioActivo?.fechaServicio).toBe('2026-01-15');
    expect(estado.servicioActivo?.fpp).toBe('2026-10-23');
    expect(estado.servicioActivo?.palpacionFecha).toBe('2026-02-24');
  });

  it('Caso Borde: Retorno de celo (segundo servicio sin diagnóstico) actualiza el ciclo activo con la nueva fecha', () => {
    const evS1: Evento = {
      id: 's1',
      tenantId: 't1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-01',
      fechaRegistro: new Date('2026-01-01T08:00:00Z'),
      usuarioId: 'u1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: null,
      animal: mockVaca as any,
    };
    const detS1: EventoServicio = {
      eventoId: 's1',
      evento: evS1,
      tipoServicio: 'Inseminación Artificial',
      toroOPajilla: 'Toro 1',
      responsable: null,
      palpacionFecha: '2026-02-10',
      secadoFecha: '2026-08-10',
      avisoPartoFecha: '2026-09-24',
      avisoPartoUrgenteFecha: '2026-10-06',
      fpp: '2026-10-09',
    };

    // Segundo servicio 21 días después (retorno de celo)
    const evS2: Evento = {
      id: 's2',
      tenantId: 't1',
      animalId: mockVaca.id,
      tipo: 'SERVICIO',
      fechaEvento: '2026-01-22',
      fechaRegistro: new Date('2026-01-22T08:00:00Z'),
      usuarioId: 'u1',
      revertido: false,
      eventoCorrigeId: null,
      eventoCorrige: null,
      notas: 'Retorno de celo regular a los 21 días',
      animal: mockVaca as any,
    };
    const detS2: EventoServicio = {
      eventoId: 's2',
      evento: evS2,
      tipoServicio: 'Inseminación Artificial',
      toroOPajilla: 'Toro 2',
      responsable: null,
      palpacionFecha: '2026-03-03',
      secadoFecha: '2026-08-31',
      avisoPartoFecha: '2026-10-15',
      avisoPartoUrgenteFecha: '2026-10-27',
      fpp: '2026-10-30',
    };

    const historia: EventoHistoricoReproductivo[] = [
      { evento: evS1, servicio: detS1 },
      { evento: evS2, servicio: detS2 },
    ];

    const estado = service.derivarEstadoDesdeEventos(mockVaca, historia);

    expect(estado.estadoActual).toBe('Servida');
    expect(estado.servicioActivo?.eventoId).toBe('s2');
    expect(estado.servicioActivo?.toroOPajilla).toBe('Toro 2');
    expect(estado.servicioActivo?.fpp).toBe('2026-10-30');
    expect(estado.servicioActivo?.palpacionFecha).toBe('2026-03-03');
  });
});
