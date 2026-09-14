import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { RequestWithRls } from './interceptors/rls-transaction.interceptor.js';
import type {
  AuthenticatedUser,
  UserProfileResponse,
} from './interfaces/authenticated-user.interface.js';

interface UsuarioRow {
  nombre_completo: string;
  correo: string;
}

@Controller('auth')
export class AuthController {
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
}
