import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { PesajesService } from './pesajes.service.js';

@Controller('pesajes')
export class PesajesController {
  constructor(private readonly pesajesService: PesajesService) {}

  @Post()
  create(@Body() createDto: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.pesajesService.create(tenantId, createDto);
  }

  @Get('animal/:animalId')
  findAllByAnimal(@Param('animalId') animalId: string, @Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.pesajesService.findAllByAnimal(tenantId, animalId);
  }
}
