import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Pesaje } from './entities/pesaje.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';
import { CreatePesajeDto } from './dto/create-pesaje.dto.js';

@Injectable()
export class PesajesService {
  async create(tenantId: string, createDto: CreatePesajeDto, manager: EntityManager) {
    const newPesaje = manager.create(Pesaje, {
      ...createDto,
      tenantId,
    });
    const savedPesaje = await manager.save(newPesaje);

    // Sincronizar el peso actual del animal
    if (createDto.pesoActualKg) {
      const animal = await manager.findOne(Animal, { where: { id: createDto.animalId, tenantId } });
      if (animal) {
        animal.pesoActualKg = createDto.pesoActualKg;
        await manager.save(animal);
      }
    }

    return savedPesaje;
  }

  findAllByAnimal(tenantId: string, animalId: string, manager: EntityManager) {
    return manager.find(Pesaje, {
      where: { tenantId, animalId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }
}
