import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { DataSource, type QueryRunner, type EntityManager } from 'typeorm';
import {
  Observable,
  from,
  switchMap,
  mergeMap,
  catchError,
  finalize,
  throwError,
} from 'rxjs';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';

export interface RequestWithRls extends Request {
  user?: AuthenticatedUser;
  queryRunner?: QueryRunner;
  entityManager?: EntityManager;
}

/**
 * ==============================================================================
 * CONFIRMACIÓN DE SEGURIDAD OBLIGATORIA (Regla de Arquitectura y RLS):
 * ------------------------------------------------------------------------------
 * El rol de base de datos que utiliza la aplicación NestJS para conectarse
 * (ej. el usuario configurado en DB_USER o DATABASE_URL) NUNCA debe poseer el
 * atributo 'BYPASSRLS' ni tener privilegios de 'SUPERUSER' en PostgreSQL.
 *
 * Si el rol tuviera 'BYPASSRLS', PostgreSQL ignoraría todas las políticas de RLS
 * definidas en las tablas, anulando por completo el aislamiento entre fincas.
 * Si durante el despliegue o conexión se detecta que el rol tiene BYPASSRLS o
 * SUPERUSER, debe notificarse inmediatamente al líder técnico para ajustar
 * los privilegios en la base de datos a un rol de aplicación sin bypass.
 * ==============================================================================
 *
 * RlsTransactionInterceptor:
 * Abre una transacción aislada de TypeORM por cada petición autenticada y ejecuta:
 *   1. SELECT set_config('request.jwt.claims', $1, true);
 *   2. SET LOCAL ROLE authenticated;
 *
 * Mantiene la conexión fija durante toda la ejecución del handler del controlador,
 * asegurando que las consultas intermedias no se devuelvan al pool de conexiones
 * antes de que RLS aplique sus filtros.
 */
@Injectable()
export class RlsTransactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsTransactionInterceptor.name);

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithRls>();

    // Si la ruta no está autenticada (ej. ruta @Public), continuar sin transacción RLS
    if (!request.user) {
      return next.handle();
    }

    // Si DataSource no está inicializado (ej. en entornos de pruebas aislados)
    if (!this.dataSource?.isInitialized) {
      this.logger.debug('DataSource no inicializado, omitiendo RlsTransactionInterceptor');
      return next.handle();
    }

    const queryRunner = this.dataSource.createQueryRunner();

    return from(this.setupRlsSession(queryRunner, request.user)).pipe(
      switchMap(() => {
        // Exponer el QueryRunner y EntityManager asociado a la transacción en el request
        request.queryRunner = queryRunner;
        request.entityManager = queryRunner.manager;

        return next.handle();
      }),
      mergeMap(async (response) => {
        // Si el controlador completó con éxito, hacer commit de la transacción
        if (queryRunner.isTransactionActive) {
          await queryRunner.commitTransaction();
        }
        return response;
      }),
      catchError((error) => {
        // En caso de excepción en cualquier etapa del request, hacer rollback inmediato
        if (queryRunner.isTransactionActive) {
          return from(queryRunner.rollbackTransaction()).pipe(
            switchMap(() => throwError(() => error)),
          );
        }
        return throwError(() => error);
      }),
      finalize(async () => {
        // Liberar siempre la conexión al pool al finalizar la petición
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      }),
    );
  }

  private async setupRlsSession(
    queryRunner: QueryRunner,
    user: AuthenticatedUser,
  ): Promise<void> {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Inyectar el JSON de claims completo en la sesión transaccional de PostgreSQL
    const claimsJson = JSON.stringify(user.rawClaims);

    await queryRunner.query('SELECT set_config($1, $2, true);', [
      'request.jwt.claims',
      claimsJson,
    ]);

    // Establecer el rol local a 'authenticated' para que PostgreSQL aplique las políticas RLS
    await queryRunner.query('SET LOCAL ROLE authenticated;');
  }
}
