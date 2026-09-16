import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Animal } from './entities/animal.entity.js';
import { DocumentoAnimal } from './entities/documento-animal.entity.js';

@Injectable()
export class AnimalesService {
  constructor(
    @InjectRepository(Animal)
    private readonly animalRepository: Repository<Animal>,
    @InjectRepository(DocumentoAnimal)
    private readonly documentoRepository: Repository<DocumentoAnimal>,
  ) {}

  async findAll(tenantId: string, query: any) {
    const qb = this.animalRepository.createQueryBuilder('animal')
      .leftJoinAndSelect('animal.raza', 'raza')
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

  async findOne(id: string, tenantId: string) {
    const animal = await this.animalRepository.findOne({
      where: { id, tenantId },
      relations: { raza: true, madre: true, padre: true },
    });

    if (!animal) {
      throw new NotFoundException(`Animal con ID ${id} no encontrado`);
    }

    return animal;
  }

  async create(tenantId: string, createAnimalDto: any) {
    // Sanitizar campos vacíos que causan error en la base de datos
    const payload = { ...createAnimalDto };
    if (payload.madreId === '') payload.madreId = null;
    if (payload.padreId === '') payload.padreId = null;
    if (payload.pesoActualKg === '') payload.pesoActualKg = null;
    if (payload.valorCompraCrc === '') payload.valorCompraCrc = null;
    if (payload.fechaNacimiento === '') payload.fechaNacimiento = null;
    if (payload.fechaCompra === '') payload.fechaCompra = null;

    try {
      const animal = this.animalRepository.create({
        ...payload,
        tenantId,
      });
      return await this.animalRepository.save(animal);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new BadRequestException('Ya existe un animal con ese arete interno.');
      }
      throw error;
    }
  }

  async update(id: string, tenantId: string, updateAnimalDto: any) {
    const payload = { ...updateAnimalDto };
    if (payload.madreId === '') payload.madreId = null;
    if (payload.padreId === '') payload.padreId = null;
    if (payload.pesoActualKg === '') payload.pesoActualKg = null;
    if (payload.valorCompraCrc === '') payload.valorCompraCrc = null;
    if (payload.fechaNacimiento === '') payload.fechaNacimiento = null;
    if (payload.fechaCompra === '') payload.fechaCompra = null;

    const animal = await this.findOne(id, tenantId);
    this.animalRepository.merge(animal, payload);
    
    try {
      return await this.animalRepository.save(animal);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new BadRequestException('Ya existe un animal con ese arete interno.');
      }
      throw error;
    }
  }

  async darDeBaja(id: string, tenantId: string, bajaDto: any) {
    const animal = await this.findOne(id, tenantId);
    
    if (!animal.activo) {
      throw new BadRequestException('El animal ya está de baja.');
    }

    animal.activo = false;
    animal.tipoBaja = bajaDto.tipoBaja;
    animal.motivoBaja = bajaDto.motivoBaja;
    animal.fechaBaja = bajaDto.fechaBaja;
    animal.precioVentaCrc = bajaDto.precioVentaCrc;
    animal.pesoFinalKg = bajaDto.pesoFinalKg;

    return await this.animalRepository.save(animal);
  }

  async getDocumentos(animalId: string, tenantId: string) {
    // Verificar que el animal existe y pertenece al tenant
    await this.findOne(animalId, tenantId);
    
    return this.documentoRepository.find({
      where: { animalId, tenantId },
      order: { createdAt: 'DESC' }
    });
  }

  async createDocumento(animalId: string, tenantId: string, docDto: any) {
    // Verificar que el animal existe y pertenece al tenant
    await this.findOne(animalId, tenantId);

    const doc = this.documentoRepository.create({
      tenantId,
      animalId,
      tipo: docDto.tipo,
      archivoUrl: docDto.archivoUrl,
    });
    
    return this.documentoRepository.save(doc);
  }
}
