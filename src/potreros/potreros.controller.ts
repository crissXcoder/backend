import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { PotrerosService } from './potreros.service.js';

@Controller('potreros')
export class PotrerosController {
  constructor(private readonly potrerosService: PotrerosService) {}

  @Post()
  create(@Request() req: any, @Body() data: any) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.create(tenantId, data);
  }

  @Get()
  findAll(@Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.update(id, tenantId, data);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.remove(id, tenantId);
  }

  @Post(':id/asignar')
  asignarAnimales(@Request() req: any, @Param('id') id: string, @Body() body: { animalIds: string[] }) {
    const tenantId = req.user.tenantId;
    return this.potrerosService.asignarAnimales(id, tenantId, body.animalIds);
  }
}
