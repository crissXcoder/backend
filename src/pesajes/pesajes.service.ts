import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pesaje } from './entities/pesaje.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';

@Injectable()
export class PesajesService {
  constructor(
    @InjectRepository(Pesaje)
    private pesajeRepository: Repository<Pesaje>,
    @InjectRepository(Animal)
    private animalRepository: Repository<Animal>,
  ) {}

  async create(tenantId: string, createDto: any) {
    const newPesaje = this.pesajeRepository.create({
      ...createDto,
      tenantId,
    });
    const savedPesaje = await this.pesajeRepository.save(newPesaje);

    // Sincronizar el peso actual del animal
    if (createDto.pesoActualKg) {
      const animal = await this.animalRepository.findOne({ where: { id: createDto.animalId, tenantId } });
      if (animal) {
        animal.pesoActualKg = createDto.pesoActualKg;
        await this.animalRepository.save(animal);
      }
    }

    return savedPesaje;
  }

  findAllByAnimal(tenantId: string, animalId: string) {
    return this.pesajeRepository.find({
      where: { tenantId, animalId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }
}
