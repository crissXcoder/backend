import { Controller, Get } from '@nestjs/common';
import { CatalogosService } from './catalogos.service.js';

@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('razas')
  findAllRazas() {
    return this.catalogosService.findAllRazas();
  }
}
