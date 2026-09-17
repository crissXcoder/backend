import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { EntityManager } from 'typeorm';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentEntityManager } from '../auth/decorators/current-entity-manager.decorator.js';
import { RlsTransactionInterceptor } from '../auth/interceptors/rls-transaction.interceptor.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import {
  ReproductiveService,
  type ProximoEventoReproductivo,
} from './services/reproductive.service.js';
import { RegistrarServicioDto } from './dto/registrar-servicio.dto.js';
import { RegistrarDiagnosticoDto } from './dto/registrar-diagnostico.dto.js';
import { RegistrarPartoDto } from './dto/registrar-parto.dto.js';
import { RegistrarSecadoDto } from './dto/registrar-secado.dto.js';
import type { EstadoReproductivoInfo } from './interfaces/reproductive-state.interface.js';

@ApiTags('Reproductivo')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(RlsTransactionInterceptor)
@Controller()
export class ReproductiveController {
  constructor(private readonly reproductiveService: ReproductiveService) {}

  /**
   * POST /animales/:id/servicios
   * Registra un servicio de Inseminación Artificial o Monta Natural.
   * Calcula hitos reproductivos al vuelo según raza y persiste transaccionalmente.
   */
  @Post(['animales/:id/servicios', 'reproductivo/animales/:id/servicios'])
  @Roles('propietario', 'administrador', 'veterinario')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar servicio reproductivo para un animal hembra',
    description:
      'Registra un servicio (Inseminación Artificial o Monta Natural), calcula los 5 hitos según la raza y persiste evento + detalle en transacción RLS.',
  })
  @ApiParam({ name: 'id', description: 'ID del animal hembra' })
  @ApiResponse({ status: 201, description: 'Servicio registrado con éxito' })
  @ApiResponse({
    status: 400,
    description: 'Animal macho, raza sin días de gestación o datos inválidos',
  })
  @ApiResponse({ status: 403, description: 'Rol peón no autorizado para mutaciones' })
  @ApiResponse({ status: 404, description: 'Animal no encontrado en este tenant' })
  async registrarServicio(
    @Param('id') id: string,
    @Body() dto: RegistrarServicioDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
  ) {
    return this.reproductiveService.registrarServicio(
      id,
      user.tenantId,
      user.userId,
      dto,
      manager,
    );
  }

  /**
   * POST /animales/:id/diagnosticos
   * Registra el resultado de un diagnóstico de preñez (Palpación, Ecografía, PAG).
   */
  @Post(['animales/:id/diagnosticos', 'reproductivo/animales/:id/diagnosticos'])
  @Roles('propietario', 'administrador', 'veterinario')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar diagnóstico de preñez',
    description:
      'Registra el resultado de diagnóstico (Preñada o Vacía) asociado a un evento de servicio previo.',
  })
  @ApiParam({ name: 'id', description: 'ID del animal hembra' })
  @ApiResponse({ status: 201, description: 'Diagnóstico registrado con éxito' })
  @ApiResponse({
    status: 400,
    description: 'Animal macho o método/resultado inválido',
  })
  @ApiResponse({ status: 403, description: 'Rol peón no autorizado para mutaciones' })
  @ApiResponse({
    status: 404,
    description: 'Animal o servicio previo no encontrado en este tenant',
  })
  async registrarDiagnostico(
    @Param('id') id: string,
    @Body() dto: RegistrarDiagnosticoDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
  ) {
    return this.reproductiveService.registrarDiagnostico(
      id,
      user.tenantId,
      user.userId,
      dto,
      manager,
    );
  }

  /**
   * POST /animales/:id/partos
   * Registra la culminación del ciclo reproductivo por parto.
   */
  @Post(['animales/:id/partos', 'reproductivo/animales/:id/partos'])
  @Roles('propietario', 'administrador', 'veterinario')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar parto',
    description:
      'Registra un parto para el animal hembra, retornando su estado a Vacía para el nuevo ciclo.',
  })
  @ApiParam({ name: 'id', description: 'ID de la madre' })
  @ApiResponse({ status: 201, description: 'Parto registrado con éxito' })
  @ApiResponse({ status: 400, description: 'Animal macho o datos inválidos' })
  @ApiResponse({ status: 403, description: 'Rol peón no autorizado para mutaciones' })
  @ApiResponse({ status: 404, description: 'Madre o cría no encontrada en este tenant' })
  async registrarParto(
    @Param('id') id: string,
    @Body() dto: RegistrarPartoDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
  ) {
    return this.reproductiveService.registrarParto(
      id,
      user.tenantId,
      user.userId,
      dto,
      manager,
    );
  }

  /**
   * POST /animales/:id/secados
   * Registra la suspensión real del ordeño.
   */
  @Post(['animales/:id/secados', 'reproductivo/animales/:id/secados'])
  @Roles('propietario', 'administrador', 'veterinario')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar secado',
    description:
      'Registra la suspensión de ordeño (secado real) para preparar a la vaca hacia el parto.',
  })
  @ApiParam({ name: 'id', description: 'ID del animal hembra' })
  @ApiResponse({ status: 201, description: 'Secado registrado con éxito' })
  @ApiResponse({ status: 400, description: 'Animal macho o datos inválidos' })
  @ApiResponse({ status: 403, description: 'Rol peón no autorizado para mutaciones' })
  @ApiResponse({ status: 404, description: 'Animal no encontrado en este tenant' })
  async registrarSecado(
    @Param('id') id: string,
    @Body() dto: RegistrarSecadoDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
  ) {
    return this.reproductiveService.registrarSecado(
      id,
      user.tenantId,
      user.userId,
      dto,
      manager,
    );
  }

  /**
   * GET /animales/:id/estado-reproductivo
   * Obtiene el estado reproductivo derivado al vuelo y los hitos del ciclo activo.
   * Accesible para todos los roles autenticados (incluyendo peón).
   */
  @Get(['animales/:id/estado-reproductivo', 'reproductivo/animales/:id/estado-reproductivo'])
  @ApiOperation({
    summary: 'Consultar estado reproductivo e hitos calculados',
    description:
      'Calcula al vuelo el estado (Vacía, Servida, Preñada, En Secado) y devuelve los hitos del servicio activo.',
  })
  @ApiParam({ name: 'id', description: 'ID del animal' })
  @ApiResponse({ status: 200, description: 'Estado reproductivo derivado con éxito' })
  @ApiResponse({ status: 400, description: 'Animal es macho' })
  @ApiResponse({ status: 404, description: 'Animal no encontrado en este tenant' })
  async obtenerEstadoReproductivo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
  ): Promise<EstadoReproductivoInfo> {
    return this.reproductiveService.obtenerEstadoReproductivo(
      id,
      user.tenantId,
      manager,
    );
  }

  /**
   * GET /reproductivo/proximos-eventos
   * Feed de próximos hitos (palpaciones y partos) para el Dashboard de Karla.
   * Aislado por tenant vía RLS.
   */
  @Get('reproductivo/proximos-eventos')
  @ApiOperation({
    summary: 'Consultar próximos eventos reproductivos del hato para el Dashboard',
    description:
      'Retorna lista ordenada de palpaciones, secados y partos próximos en la ventana temporal especificada para todo el tenant.',
  })
  @ApiQuery({
    name: 'diasVentana',
    required: false,
    description: 'Días hacia el futuro a proyectar (default: 60)',
    example: 60,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de próximos eventos reproductivos ordenada por urgencia',
  })
  async obtenerProximosEventos(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentEntityManager() manager: EntityManager,
    @Query('diasVentana') diasVentana?: string,
  ): Promise<ProximoEventoReproductivo[]> {
    const ventana = diasVentana ? parseInt(diasVentana, 10) : 60;
    return this.reproductiveService.obtenerProximosEventos(
      user.tenantId,
      manager,
      Number.isNaN(ventana) ? 60 : ventana,
    );
  }
}
