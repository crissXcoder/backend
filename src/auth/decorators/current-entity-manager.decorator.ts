import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export const CurrentEntityManager = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): EntityManager => {
    const request = ctx.switchToHttp().getRequest();
    return request.entityManager;
  },
);
