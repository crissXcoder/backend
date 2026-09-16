import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoRaza } from './entities/catalogo-raza.entity.js';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(CatalogoRaza)
    private readonly razaRepository: Repository<CatalogoRaza>,
  ) {}

  async findAllRazas(): Promise<CatalogoRaza[]> {
    return this.razaRepository.find({
      order: { nombre: 'ASC' },
    });
  }
}
