import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import type { RequestWithRls } from './interceptors/rls-transaction.interceptor.js';
import type {
  AuthenticatedUser,
  UserProfileResponse,
} from './interfaces/authenticated-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { ConfirmInvitationDto } from './dto/confirm-invitation.dto.js';
import { InvitationsService } from './services/invitations.service.js';

interface UsuarioRow {
  nombre_completo: string;
  correo: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * GET /auth/perfil
   * Devuelve los datos de identidad y pertenencia a la finca del usuario autenticado.
   * Utiliza la conexión transaccional con RLS protegida para consultar el nombre completo.
   */
  @Get('perfil')
  async getPerfil(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithRls,
  ): Promise<UserProfileResponse> {
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    let nombreCompleto =
      (user.rawClaims['nombre_completo'] as string) ||
      (user.rawClaims['user_metadata'] as Record<string, unknown> | undefined)?.[
        'nombre_completo'
      ] as string ||
      '';
    let correo = user.email;

    // Si la conexión transaccional con RLS está activa, consultar directamente la tabla usuario
    if (req.entityManager) {
      try {
        const rows = await req.entityManager.query<UsuarioRow[]>(
          'SELECT nombre_completo, correo FROM public.usuario WHERE id = $1 LIMIT 1;',
          [user.userId],
        );

        if (rows && rows.length > 0) {
          nombreCompleto = rows[0].nombre_completo || nombreCompleto;
          correo = rows[0].correo || correo;
        }
      } catch {
        // En caso de fallo en BD o tabla no migrada, mantener los datos extraídos del JWT
      }
    }

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      rol: user.rol,
      nombreCompleto: nombreCompleto || user.email.split('@')[0],
      correo,
    };
  }

  /**
   * POST /auth/invitar
   * Solo accesible por Propietario o Administrador de la finca.
   * Envía invitación por correo fijando el rol predefinido.
   */
  @Post('invitar')
  @Roles('propietario', 'administrador')
  async invitarUsuario(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteUserDto,
    @Req() req: RequestWithRls,
  ): Promise<{ success: boolean; invitacionId: string; rolAsignado: string }> {
    return this.invitationsService.inviteUser(user, dto, req.entityManager);
  }

  /**
   * POST /auth/confirmar-invitacion
   * Confirma la invitación para un usuario autenticado recién registrado.
   * Aplica el rol predefinido por el propietario desestimando cualquier rol inyectado.
   */
  @Post('confirmar-invitacion')
  async confirmarInvitacion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmInvitationDto,
    @Req() req: RequestWithRls,
  ): Promise<{ success: boolean; userId: string; rolFinal: string }> {
    return this.invitationsService.confirmInvitation(
      user.userId,
      user.tenantId,
      user.email,
      dto as unknown as Record<string, unknown>,
      req.entityManager,
    );
  }
}

