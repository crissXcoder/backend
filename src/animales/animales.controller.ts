import { Controller, Get, Post, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { AnimalesService } from './animales.service.js';

@Controller('animales')
export class AnimalesController {
  constructor(private readonly animalesService: AnimalesService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.findOne(id, tenantId);
  }

  @Post()
  create(@Body() createAnimalDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.create(tenantId, createAnimalDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAnimalDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.update(id, tenantId, updateAnimalDto);
  }

  @Post(':id/baja')
  darDeBaja(@Param('id') id: string, @Body() bajaDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.darDeBaja(id, tenantId, bajaDto);
  }

  @Get(':id/documentos')
  getDocumentos(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.getDocumentos(id, tenantId);
  }

  @Post(':id/documentos')
  createDocumento(@Param('id') id: string, @Body() docDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.animalesService.createDocumento(id, tenantId, docDto);
  }
}
