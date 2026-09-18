import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Animal } from './entities/animal.entity.js';
import { DocumentoAnimal } from './entities/documento-animal.entity.js';

@Injectable()
export class AnimalesService {
  async findAll(tenantId: string, query: any, manager: EntityManager) {
    const qb = manager.createQueryBuilder(Animal, 'animal')
      .leftJoinAndSelect('animal.raza', 'raza')
      .leftJoinAndSelect('animal.potrero', 'potrero')
      .where('animal.tenant_id = :tenantId', { tenantId });

    if (query.activo !== undefined) {
      qb.andWhere('animal.activo = :activo', { activo: query.activo === 'true' });
    }
    
    if (query.categoria) {
      qb.andWhere('animal.categoria = :categoria', { categoria: query.categoria });
    }

    if (query.arete) {
      qb.andWhere('animal.arete_interno ILIKE :arete', { arete: `%${query.arete}%` });
    }

    qb.orderBy('animal.arete_interno', 'ASC');

    return qb.getMany();
  }

  async findOne(id: string, tenantId: string, manager: EntityManager) {
    const animal = await manager.findOne(Animal, {
      where: { id, tenantId },
      relations: { raza: true, madre: true, padre: true, potrero: true },
    });

    if (!animal) {
      throw new NotFoundException(`Animal con ID ${id} no encontrado`);
    }

    return animal;
  }

  async create(tenantId: string, createAnimalDto: any, manager: EntityManager) {
    // Sanitizar campos vacíos que causan error en la base de datos
    const payload = { ...createAnimalDto };
    if (payload.madreId === '') payload.madreId = null;
    if (payload.padreId === '') payload.padreId = null;
    if (payload.pesoActualKg === '') payload.pesoActualKg = null;
    if (payload.valorCompraCrc === '') payload.valorCompraCrc = null;
    if (payload.fechaNacimiento === '') payload.fechaNacimiento = null;
    if (payload.fechaCompra === '') payload.fechaCompra = null;
    if (payload.potreroId === '') payload.potreroId = null;

    try {
      const animal = manager.create(Animal, {
        ...payload,
        tenantId,
      });
      return await manager.save(animal);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new BadRequestException('Ya existe un animal con ese arete interno.');
      }
      throw error;
    }
  }

  async update(id: string, tenantId: string, updateAnimalDto: any, manager: EntityManager) {
    const payload = { ...updateAnimalDto };
    if (payload.madreId === '') payload.madreId = null;
    if (payload.padreId === '') payload.padreId = null;
    if (payload.pesoActualKg === '') payload.pesoActualKg = null;
    if (payload.valorCompraCrc === '') payload.valorCompraCrc = null;
    if (payload.fechaNacimiento === '') payload.fechaNacimiento = null;
    if (payload.fechaCompra === '') payload.fechaCompra = null;
    if (payload.potreroId === '') payload.potreroId = null;

    const animal = await this.findOne(id, tenantId, manager);
    manager.merge(Animal, animal, payload);
    
    try {
      return await manager.save(animal);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new BadRequestException('Ya existe un animal con ese arete interno.');
      }
      throw error;
    }
  }

  async darDeBaja(id: string, tenantId: string, bajaDto: any, manager: EntityManager) {
    const animal = await this.findOne(id, tenantId, manager);
    
    if (!animal.activo) {
      throw new BadRequestException('El animal ya está de baja.');
    }

    animal.activo = false;
    animal.tipoBaja = bajaDto.tipoBaja;
    animal.motivoBaja = bajaDto.motivoBaja;
    animal.fechaBaja = bajaDto.fechaBaja;
    animal.precioVentaCrc = bajaDto.precioVentaCrc;
    animal.pesoFinalKg = bajaDto.pesoFinalKg;

    return await manager.save(animal);
  }

  async getDocumentos(animalId: string, tenantId: string, manager: EntityManager) {
    // Verificar que el animal existe y pertenece al tenant
    await this.findOne(animalId, tenantId, manager);
    
    return manager.find(DocumentoAnimal, {
      where: { animalId, tenantId },
      order: { createdAt: 'DESC' }
    });
  }

  async createDocumento(animalId: string, tenantId: string, docDto: any, manager: EntityManager) {
    // Verificar que el animal existe y pertenece al tenant
    await this.findOne(animalId, tenantId, manager);

    const doc = manager.create(DocumentoAnimal, {
      tenantId,
      animalId,
      tipo: docDto.tipo,
      archivoUrl: docDto.archivoUrl,
    });
    
    return manager.save(doc);
  }
}
