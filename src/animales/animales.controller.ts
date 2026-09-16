import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AnimalesService } from './animales.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';

@UseGuards(AuthGuard)
@Controller('animales')
export class AnimalesController {
  constructor(private readonly animalesService: AnimalesService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: any) {
    const tenantId = req.user.tenant_id;
    return this.animalesService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.tenant_id;
    return this.animalesService.findOne(id, tenantId);
  }

  @Post()
  create(@Body() createAnimalDto: any, @Request() req: any) {
    const tenantId = req.user.tenant_id;
    return this.animalesService.create(tenantId, createAnimalDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAnimalDto: any, @Request() req: any) {
    const tenantId = req.user.tenant_id;
    return this.animalesService.update(id, tenantId, updateAnimalDto);
  }

  @Post(':id/baja')
  darDeBaja(@Param('id') id: string, @Body() bajaDto: any, @Request() req: any) {
    const tenantId = req.user.tenant_id;
    return this.animalesService.darDeBaja(id, tenantId, bajaDto);
  }
}
