import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SupabaseJwtService } from '../services/supabase-jwt.service.js';
import type {
  AuthenticatedUser,
  RolUsuario,
} from '../interfaces/authenticated-user.interface.js';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

const ROLES_VALIDOS: readonly RolUsuario[] = [
  'propietario',
  'administrador',
  'peon',
  'veterinario',
] as const;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: SupabaseJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Verificar si la ruta o controlador está marcado como público
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Extraer el token Bearer del encabezado Authorization
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Encabezado Authorization con Bearer token requerido',
      );
    }

    // 3. Verificar el JWT contra el JWKS de Supabase
    let payload: Record<string, unknown>;
    try {
      payload = (await this.jwtService.verifyToken(token)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      throw new UnauthorizedException(
        `Token de autenticación inválido o expirado: ${(error as Error).message}`,
      );
    }

    // 4. Extraer y validar claims inyectadas por el Custom Access Token Hook
    const tenantId = payload['tenant_id'] as string | undefined;
    const rol = payload['rol'] as RolUsuario | undefined;

    if (!tenantId || !rol) {
      throw new UnauthorizedException(
        'El token no contiene claims de tenant_id o rol. Verifique que el Custom Access Token Hook esté activo en Supabase.',
      );
    }

    if (!ROLES_VALIDOS.includes(rol)) {
      throw new UnauthorizedException(
        `El rol '${rol}' presente en el token no es válido en el sistema.`,
      );
    }

    const userId = (payload['sub'] || payload['user_id']) as string;
    const email = (payload['email'] || '') as string;

    if (!userId) {
      throw new UnauthorizedException('El token no contiene identificador de usuario (sub).');
    }

    // 5. Adjuntar usuario tipado a la petición
    request.user = {
      userId,
      tenantId,
      rol,
      email,
      rawClaims: payload,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
