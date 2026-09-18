import { Controller, Get, Post, Put, Body, Param, Request } from '@nestjs/common';
import { TratamientosService } from './tratamientos.service.js';
import { EntityManager } from 'typeorm';
import { CurrentEntityManager } from '../auth/decorators/current-entity-manager.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateTratamientoDto } from './dto/create-tratamiento.dto.js';
import { UpdateTratamientoDto } from './dto/update-tratamiento.dto.js';

@Controller('tratamientos')
export class TratamientosController {
  constructor(private readonly tratamientosService: TratamientosService) {}

  @Post()
  @Roles('propietario', 'administrador', 'veterinario')
  create(@Body() createDto: CreateTratamientoDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.tratamientosService.create(tenantId, createDto, manager);
  }

  @Get('animal/:animalId')
  findAllByAnimal(@Param('animalId') animalId: string, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.tratamientosService.findAllByAnimal(tenantId, animalId, manager);
  }

  @Put(':id')
  @Roles('propietario', 'administrador', 'veterinario')
  update(@Param('id') id: string, @Body() updateDto: UpdateTratamientoDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.tratamientosService.update(id, tenantId, updateDto, manager);
  }
}
