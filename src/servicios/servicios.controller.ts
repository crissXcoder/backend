import { Controller, Get, Post, Patch, Body, Param, Request } from '@nestjs/common';
import { ServiciosService } from './servicios.service.js';

@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Post()
  create(@Body() createDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.serviciosService.create(tenantId, createDto);
  }

  @Get('animal/:animalId')
  findAllByAnimal(@Param('animalId') animalId: string, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.serviciosService.findAllByAnimal(tenantId, animalId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.serviciosService.update(tenantId, id, updateDto);
  }
}
