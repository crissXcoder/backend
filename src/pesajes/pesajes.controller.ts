import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { PesajesService } from './pesajes.service.js';
import { EntityManager } from 'typeorm';
import { CurrentEntityManager } from '../auth/decorators/current-entity-manager.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreatePesajeDto } from './dto/create-pesaje.dto.js';

@Controller('pesajes')
export class PesajesController {
  constructor(private readonly pesajesService: PesajesService) {}

  @Post()
  @Roles('propietario', 'administrador')
  create(@Body() createDto: CreatePesajeDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.pesajesService.create(tenantId, createDto, manager);
  }

  @Get('animal/:animalId')
  findAllByAnimal(@Param('animalId') animalId: string, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.pesajesService.findAllByAnimal(tenantId, animalId, manager);
  }
}
