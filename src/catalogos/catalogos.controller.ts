import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatalogosService } from './catalogos.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';

@UseGuards(AuthGuard)
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('razas')
  findAllRazas() {
    return this.catalogosService.findAllRazas();
  }
}
