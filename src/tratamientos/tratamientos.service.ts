import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Tratamiento } from './entities/tratamiento.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';
import { CreateTratamientoDto } from './dto/create-tratamiento.dto.js';
import { UpdateTratamientoDto } from './dto/update-tratamiento.dto.js';

@Injectable()
export class TratamientosService {
  async create(
    tenantId: string,
    createDto: CreateTratamientoDto,
    manager: EntityManager,
  ) {
    // Este era el único módulo que no comprobaba la pertenencia del animal
    // antes de escribir: confiaba solo en la FK y en RLS. Con la comprobación,
    // un animalId ajeno responde 404 en vez de un error de base de datos.
    const animal = await manager.findOne(Animal, {
      where: { id: createDto.animalId, tenantId },
    });
    if (!animal) {
      throw new NotFoundException(
        `Animal con ID '${createDto.animalId}' no encontrado en esta finca.`,
      );
    }

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

  async update(
    id: string,
    tenantId: string,
    updateDto: UpdateTratamientoDto,
    manager: EntityManager,
  ) {
    const tratamiento = await manager.findOne(Tratamiento, {
      where: { id, tenantId },
    });
    if (!tratamiento) {
      throw new NotFoundException(`Tratamiento con ID ${id} no encontrado`);
    }

    manager.merge(Tratamiento, tratamiento, updateDto);
    return manager.save(tratamiento);
  }
}
