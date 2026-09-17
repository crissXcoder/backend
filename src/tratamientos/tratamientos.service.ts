import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tratamiento } from './entities/tratamiento.entity.js';

@Injectable()
export class TratamientosService {
  constructor(
    @InjectRepository(Tratamiento)
    private tratamientoRepository: Repository<Tratamiento>,
  ) {}

  create(tenantId: string, createDto: any) {
    const newEntity = this.tratamientoRepository.create({
      ...createDto,
      tenantId,
    });
    return this.tratamientoRepository.save(newEntity);
  }

  findAllByAnimal(tenantId: string, animalId: string) {
    return this.tratamientoRepository.find({
      where: { tenantId, animalId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(id: string, tenantId: string, updateDto: any) {
    const tratamiento = await this.tratamientoRepository.findOne({ where: { id, tenantId } });
    if (!tratamiento) {
      throw new NotFoundException(`Tratamiento con ID ${id} no encontrado`);
    }
    
    this.tratamientoRepository.merge(tratamiento, updateDto);
    return this.tratamientoRepository.save(tratamiento);
  }
}
