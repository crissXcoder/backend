import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { RolUsuario } from '../interfaces/authenticated-user.interface.js';
import { AuditAuthService } from './audit-auth.service.js';

const ROLES_PERMITIDOS: readonly RolUsuario[] = [
  'propietario',
  'administrador',
  'peon',
  'veterinario',
] as const;

/**
 * RolesService:
 * ÚNICO punto del sistema autorizado para escribir/actualizar el campo 'rol' de usuario.
 * Ningún otro servicio o controlador debe ejecutar UPDATE directo sobre usuario.rol.
 * Mitiga vectores de elevación de privilegios y mass-assignment.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly auditService: AuditAuthService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  /**
   * Asigna un rol a un usuario dentro de un tenant específico.
   * Valida estrictamente el rol y audita el cambio con hash encadenado.
   */
  async assignRole(
    userId: string,
    tenantId: string,
    rol: RolUsuario,
    modifiedBy?: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    // 1. Validación estricta del rol
    if (!ROLES_PERMITIDOS.includes(rol)) {
      throw new BadRequestException(
        `Rol '${rol}' inválido. Los roles permitidos son: ${ROLES_PERMITIDOS.join(', ')}`,
      );
    }

    const manager = entityManager || this.dataSource?.manager;

    if (manager && this.dataSource?.isInitialized) {
      // 2. Ejecutar la mutación segura dentro de la conexión o transacción
      const result = await manager.query<{ id: string }[]>(
        `UPDATE public.usuario
            SET rol = $1
          WHERE id = $2 AND tenant_id = $3
      RETURNING id;`,
        [rol, userId, tenantId],
      );

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Usuario con id '${userId}' no encontrado en la finca '${tenantId}'.`,
        );
      }
    } else {
      this.logger.debug(
        `assignRole ejecutado en modo mock/test: userId=${userId}, tenantId=${tenantId}, rol=${rol}`,
      );
    }

    // 3. Registrar auditoría criptográfica obligatoria (Ley 8968)
    await this.auditService.logEvent(
      tenantId,
      'CAMBIO_ROL',
      {
        userId,
        nuevoRol: rol,
        modificadoPor: modifiedBy || 'SISTEMA',
      },
      modifiedBy,
      entityManager,
    );

    this.logger.log(
      `Rol '${rol}' asignado exitosamente al usuario ${userId} en tenant ${tenantId}`,
    );
  }
}
