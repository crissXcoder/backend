import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { TratamientosService } from './tratamientos.service.js';

@Controller('tratamientos')
export class TratamientosController {
  constructor(private readonly tratamientosService: TratamientosService) {}

  @Post()
  create(@Body() createDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.tratamientosService.create(tenantId, createDto);
  }

  @Get('animal/:animalId')
  findAllByAnimal(@Param('animalId') animalId: string, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.tratamientosService.findAllByAnimal(tenantId, animalId);
  }
}
