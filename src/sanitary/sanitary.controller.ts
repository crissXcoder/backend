import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { SanitaryService } from './sanitary.service.js';
import type { Medicamento } from './entities/medicamento.entity.js';
import type { Padecimiento } from './entities/padecimiento.entity.js';

/**
 * Controlador para los catálogos sanitarios.
 * Todas las rutas están protegidas por AuthGuard (global) y filtradas
 * automáticamente por el tenant_id del usuario autenticado.
 */
@ApiTags('Catálogos Sanitarios')
@ApiBearerAuth()
@Controller('catalogos')
export class SanitaryController {
  constructor(private readonly sanitaryService: SanitaryService) {}

  /**
   * GET /catalogos/medicamentos
   * Devuelve el catálogo de medicamentos veterinarios del tenant autenticado.
   */
  @Get('medicamentos')
  @ApiOperation({
    summary: 'Obtener catálogo de medicamentos veterinarios del tenant',
  })
  async getMedicamentos(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Medicamento[]> {
    return this.sanitaryService.getMedicamentos(user.tenantId);
  }

  /**
   * GET /catalogos/padecimientos
   * Devuelve el catálogo de padecimientos/diagnósticos del tenant autenticado,
   * incluyendo el medicamento sugerido cuando aplica.
   */
  @Get('padecimientos')
  @ApiOperation({
    summary: 'Obtener catálogo de padecimientos del tenant con fármaco sugerido',
  })
  async getPadecimientos(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Padecimiento[]> {
    return this.sanitaryService.getPadecimientos(user.tenantId);
  }
}
