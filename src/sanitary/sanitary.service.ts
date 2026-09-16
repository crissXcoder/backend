import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Medicamento } from './entities/medicamento.entity.js';
import { Padecimiento } from './entities/padecimiento.entity.js';

export const MEDICAMENTOS_BASE: Omit<Medicamento, 'id' | 'tenantId'>[] = [
  {
    nombreComercial: 'Cefalexina 200 Intramamaria',
    principioActivo: 'Cefalexina',
    viaAdministracion: 'Intramamaria',
    diasRetiroLecheDefault: 5,
    diasRetiroCarneDefault: 4,
  },
  {
    nombreComercial: 'Oxitetraciclina L.A. 20%',
    principioActivo: 'Oxitetraciclina',
    viaAdministracion: 'Intramuscular',
    diasRetiroLecheDefault: 7,
    diasRetiroCarneDefault: 28,
  },
  {
    nombreComercial: 'Ivermectina 1%',
    principioActivo: 'Ivermectina',
    viaAdministracion: 'Subcutánea',
    diasRetiroLecheDefault: 28,
    diasRetiroCarneDefault: 35,
  },
  {
    nombreComercial: 'Penicilina G Procaínica + Estreptomicina',
    principioActivo: 'Penicilina G + Estreptomicina',
    viaAdministracion: 'Intramuscular',
    diasRetiroLecheDefault: 4,
    diasRetiroCarneDefault: 30,
  },
];

export const PADECIMIENTOS_BASE = [
  {
    nombre: 'Mastitis clínica',
    categoria: 'Ubre',
    medicamentoSugeridoNombre: 'Cefalexina 200 Intramamaria',
  },
  {
    nombre: 'Mastitis subclínica',
    categoria: 'Ubre',
    medicamentoSugeridoNombre: 'Cefalexina 200 Intramamaria',
  },
  {
    nombre: 'Anaplasmosis',
    categoria: 'Hemoparásito',
    medicamentoSugeridoNombre: 'Oxitetraciclina L.A. 20%',
  },
  {
    nombre: 'Parasitosis interna',
    categoria: 'Parasitario',
    medicamentoSugeridoNombre: 'Ivermectina 1%',
  },
  {
    nombre: 'Parasitosis externa (garrapatas/nuche)',
    categoria: 'Parasitario',
    medicamentoSugeridoNombre: 'Ivermectina 1%',
  },
  {
    nombre: 'Neumonía bacteriana',
    categoria: 'Respiratorio',
    medicamentoSugeridoNombre: 'Penicilina G Procaínica + Estreptomicina',
  },
  {
    nombre: 'Infección podal (gabarro)',
    categoria: 'Podal',
    medicamentoSugeridoNombre: 'Penicilina G Procaínica + Estreptomicina',
  },
  {
    nombre: 'Metritis/Endometritis',
    categoria: 'Reproductivo',
    medicamentoSugeridoNombre: null,
  },
  {
    nombre: 'Diarrea neonatal',
    categoria: 'Digestivo',
    medicamentoSugeridoNombre: null,
  },
  {
    nombre: 'Timpanismo (empaste)',
    categoria: 'Digestivo',
    medicamentoSugeridoNombre: null,
  },
];

/**
 * Servicio de lectura para los catálogos sanitarios.
 * Filtra siempre por `tenant_id` del usuario autenticado.
 * Si DataSource no está inicializado, opera en modo catálogo base en memoria (mismo patrón que AuthModule).
 */
@Injectable()
export class SanitaryService {
  private readonly logger = new Logger(SanitaryService.name);

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  /**
   * Devuelve todos los medicamentos del catálogo para el tenant dado.
   */
  async getMedicamentos(tenantId: string): Promise<Medicamento[]> {
    if (this.dataSource?.isInitialized) {
      try {
        const repo = this.dataSource.getRepository(Medicamento);
        return await repo.find({
          where: { tenantId },
          order: { nombreComercial: 'ASC' },
        });
      } catch (err) {
        this.logger.warn(
          `Error consultando catalogo_medicamento en BD: ${(err as Error).message}. Usando catálogo base.`,
        );
      }
    }

    // Modo desacoplado / memoria (catálogo oficial Costa Rica)
    return MEDICAMENTOS_BASE.map((m, index) => ({
      id: `00000000-0000-0000-0000-00000000000${index + 1}`,
      tenantId,
      ...m,
    })) as Medicamento[];
  }

  /**
   * Devuelve todos los padecimientos del catálogo para el tenant dado,
   * incluyendo la relación con el medicamento sugerido.
   */
  async getPadecimientos(tenantId: string): Promise<Padecimiento[]> {
    if (this.dataSource?.isInitialized) {
      try {
        const repo = this.dataSource.getRepository(Padecimiento);
        return await repo.find({
          where: { tenantId },
          relations: { medicamentoSugerido: true },
          order: { nombre: 'ASC' },
        });
      } catch (err) {
        this.logger.warn(
          `Error consultando catalogo_padecimiento en BD: ${(err as Error).message}. Usando catálogo base.`,
        );
      }
    }

    // Modo desacoplado / memoria (catálogo oficial Costa Rica)
    const meds = await this.getMedicamentos(tenantId);
    return PADECIMIENTOS_BASE.map((p, index) => {
      const suggestedMed = p.medicamentoSugeridoNombre
        ? meds.find((m) => m.nombreComercial === p.medicamentoSugeridoNombre) ||
          null
        : null;

      return {
        id: `00000000-0000-0000-0000-00000000010${index}`,
        tenantId,
        nombre: p.nombre,
        categoria: p.categoria,
        medicamentoSugeridoId: suggestedMed?.id || null,
        medicamentoSugerido: suggestedMed,
      };
    }) as Padecimiento[];
  }
}
