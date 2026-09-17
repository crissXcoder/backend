import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { PotrerosService } from './potreros.service.js';
import { EntityManager } from 'typeorm';
import { CurrentEntityManager } from '../auth/decorators/current-entity-manager.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreatePotreroDto } from './dto/create-potrero.dto.js';
import { UpdatePotreroDto } from './dto/update-potrero.dto.js';
import { AsignarAnimalesDto } from './dto/asignar-animales.dto.js';

@Controller('potreros')
export class PotrerosController {
  constructor(private readonly potrerosService: PotrerosService) {}

  @Post()
  @Roles('propietario', 'administrador')
  create(@Request() req: any, @Body() data: CreatePotreroDto, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.create(tenantId, data, manager);
  }

  @Get()
  findAll(@Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.findAll(tenantId, manager);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.findOne(id, tenantId, manager);
  }

  @Patch(':id')
  @Roles('propietario', 'administrador')
  update(@Request() req: any, @Param('id') id: string, @Body() data: UpdatePotreroDto, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.update(id, tenantId, data, manager);
  }

  @Delete(':id')
  @Roles('propietario', 'administrador')
  remove(@Request() req: any, @Param('id') id: string, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.remove(id, tenantId, manager);
  }

  @Post(':id/asignar')
  @Roles('propietario', 'administrador')
  asignarAnimales(@Request() req: any, @Param('id') id: string, @Body() body: AsignarAnimalesDto, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.asignarAnimales(id, tenantId, body.animalIds, manager);
  }
}
