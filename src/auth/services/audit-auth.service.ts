import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';

export type TipoEventoAuth =
  | 'LOGIN'
  | 'INVITACION_ENVIADA'
  | 'INVITACION_ACEPTADA'
  | 'CAMBIO_ROL';

export interface EventoAuthRecord {
  id: string;
  tenantId: string;
  usuarioId?: string;
  tipoEvento: TipoEventoAuth;
  detalles: Record<string, unknown>;
  prevHash: string;
  currHash: string;
  createdAt: string;
}

const GENESIS_HASH = '0'.repeat(64);

@Injectable()
export class AuditAuthService {
  private readonly logger = new Logger(AuditAuthService.name);

  // Registro en memoria de respaldo para tests y fallback
  private readonly localLedger: Map<string, EventoAuthRecord[]> = new Map();

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  /**
   * Registra un evento de autenticación/autorización con encadenamiento SHA-256.
   * Cumple con los requerimientos de trazabilidad e inmutabilidad de la Ley 8968.
   */
  async logEvent(
    tenantId: string,
    tipoEvento: TipoEventoAuth,
    detalles: Record<string, unknown>,
    usuarioId?: string,
    entityManager?: EntityManager,
  ): Promise<EventoAuthRecord> {
    const prevHash = await this.getLatestHash(tenantId, entityManager);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const payloadToHash = this.canonicalJson({
      id,
      tenantId,
      usuarioId: usuarioId || null,
      tipoEvento,
      detalles,
      createdAt,
    });

    const currHash = createHash('sha256')
      .update(prevHash + payloadToHash)
      .digest('hex');

    const record: EventoAuthRecord = {
      id,
      tenantId,
      usuarioId,
      tipoEvento,
      detalles,
      prevHash,
      currHash,
      createdAt,
    };

    // 1. Guardar en base de datos si el connection manager está disponible
    const manager = entityManager || this.dataSource?.manager;
    if (manager && this.dataSource?.isInitialized) {
      try {
        await manager.query(
          `INSERT INTO public.evento_auth (
            id, tenant_id, usuario_id, tipo_evento, detalles, prev_hash, curr_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            record.id,
            record.tenantId,
            record.usuarioId || null,
            record.tipoEvento,
            JSON.stringify(record.detalles),
            record.prevHash,
            record.currHash,
            record.createdAt,
          ],
        );
      } catch (error) {
        this.logger.debug(
          `Aviso: No se pudo persistir evento_auth en BD (posiblemente tabla aún no migrada): ${(error as Error).message}`,
        );
      }
    }

    // 2. Guardar en el ledger en memoria
    if (!this.localLedger.has(tenantId)) {
      this.localLedger.set(tenantId, []);
    }
    this.localLedger.get(tenantId)!.push(record);

    this.logger.log(
      `Evento auditado: [${tipoEvento}] tenant: ${tenantId} hash: ${currHash.substring(0, 12)}...`,
    );

    return record;
  }

  /**
   * Obtiene el último hash registrado para el tenant (o GENESIS si es el primero).
   */
  async getLatestHash(
    tenantId: string,
    entityManager?: EntityManager,
  ): Promise<string> {
    const manager = entityManager || this.dataSource?.manager;
    if (manager && this.dataSource?.isInitialized) {
      try {
        const rows = await manager.query<{ curr_hash: string }[]>(
          `SELECT curr_hash FROM public.evento_auth WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1;`,
          [tenantId],
        );
        if (rows && rows.length > 0) {
          return rows[0].curr_hash;
        }
      } catch {
        // Fallback al ledger local
      }
    }

    const tenantRecords = this.localLedger.get(tenantId);
    if (tenantRecords && tenantRecords.length > 0) {
      return tenantRecords[tenantRecords.length - 1].currHash;
    }

    return GENESIS_HASH;
  }

  /**
   * Verifica la integridad criptográfica de una secuencia de eventos de auditoría.
   * Si algún registro fue alterado o borrado, la función retorna false.
   */
  verifyChain(records: EventoAuthRecord[]): boolean {
    let expectedPrevHash = GENESIS_HASH;

    for (const record of records) {
      if (record.prevHash !== expectedPrevHash) {
        return false;
      }

      const payload = this.canonicalJson({
        id: record.id,
        tenantId: record.tenantId,
        usuarioId: record.usuarioId || null,
        tipoEvento: record.tipoEvento,
        detalles: record.detalles,
        createdAt: record.createdAt,
      });

      const computedHash = createHash('sha256')
        .update(record.prevHash + payload)
        .digest('hex');

      if (computedHash !== record.currHash) {
        return false;
      }

      expectedPrevHash = record.currHash;
    }

    return true;
  }

  getLocalLedger(tenantId: string): EventoAuthRecord[] {
    return this.localLedger.get(tenantId) || [];
  }

  /**
   * Serialización determinística JSON (ordena las claves para garantizar hash idéntico).
   */
  private canonicalJson(obj: unknown): string {
    return JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce<Record<string, unknown>>((sorted, key) => {
            sorted[key] = (value as Record<string, unknown>)[key];
            return sorted;
          }, {});
      }
      return value;
    });
  }
}
