import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Tratamiento } from './entities/tratamiento.entity.js';
import { CreateTratamientoDto } from './dto/create-tratamiento.dto.js';
import { UpdateTratamientoDto } from './dto/update-tratamiento.dto.js';

@Injectable()
export class TratamientosService {
  create(tenantId: string, createDto: CreateTratamientoDto, manager: EntityManager) {
    const newEntity = manager.create(Tratamiento, {
      ...createDto,
      tenantId,
    });
    return manager.save(newEntity);
  }

  findAllByAnimal(tenantId: string, animalId: string, manager: EntityManager) {
    return manager.find(Tratamiento, {
      where: { tenantId, animalId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(id: string, tenantId: string, updateDto: UpdateTratamientoDto, manager: EntityManager) {
    const tratamiento = await manager.findOne(Tratamiento, { where: { id, tenantId } });
    if (!tratamiento) {
      throw new NotFoundException(`Tratamiento con ID ${id} no encontrado`);
    }
    
    manager.merge(Tratamiento, tratamiento, updateDto);
    return manager.save(tratamiento);
  }
}
