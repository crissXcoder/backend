import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servicio } from './entities/servicio.entity.js';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio)
    private servicioRepository: Repository<Servicio>,
  ) {}

  create(tenantId: string, createDto: any) {
    const newEntity = this.servicioRepository.create({
      ...createDto,
      tenantId,
    });
    return this.servicioRepository.save(newEntity);
  }

  async findAllByAnimal(tenantId: string, animalId: string): Promise<Servicio[]> {
    return this.servicioRepository.find({
      where: { tenantId, animalId },
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(tenantId: string, id: string, updateData: any): Promise<Servicio> {
    const servicio = await this.servicioRepository.findOne({ where: { id, tenantId } });
    if (!servicio) {
      throw new Error('Servicio no encontrado');
    }
    Object.assign(servicio, updateData);
    return this.servicioRepository.save(servicio);
  }
}
