import { Controller, Get, Post, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { AnimalesService } from './animales.service.js';
import { EntityManager } from 'typeorm';
import { CurrentEntityManager } from '../auth/decorators/current-entity-manager.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateAnimalDto } from './dto/create-animal.dto.js';
import { UpdateAnimalDto } from './dto/update-animal.dto.js';
import { BajaAnimalDto } from './dto/baja-animal.dto.js';
import { CreateDocumentoDto } from './dto/create-documento.dto.js';
import { QueryAnimalDto } from './dto/query-animal.dto.js';

@Controller('animales')
export class AnimalesController {
  constructor(private readonly animalesService: AnimalesService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: QueryAnimalDto, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.findAll(tenantId, query, manager);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.findOne(id, tenantId, manager);
  }

  @Post()
  @Roles('propietario', 'administrador')
  create(@Body() createAnimalDto: CreateAnimalDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.create(tenantId, createAnimalDto, manager);
  }

  @Patch(':id')
  @Roles('propietario', 'administrador')
  update(@Param('id') id: string, @Body() updateAnimalDto: UpdateAnimalDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.update(id, tenantId, updateAnimalDto, manager);
  }

  @Post(':id/baja')
  @Roles('propietario', 'administrador')
  darDeBaja(@Param('id') id: string, @Body() bajaDto: BajaAnimalDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.darDeBaja(id, tenantId, bajaDto, manager);
  }

  @Get(':id/documentos')
  getDocumentos(@Param('id') id: string, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.getDocumentos(id, tenantId, manager);
  }

  @Post(':id/documentos')
  @Roles('propietario', 'administrador')
  createDocumento(@Param('id') id: string, @Body() docDto: CreateDocumentoDto, @Request() req: any, @CurrentEntityManager() manager: EntityManager) {
    const tenantId = req.user.tenantId;
    return this.animalesService.createDocumento(id, tenantId, docDto, manager);
  }
}
