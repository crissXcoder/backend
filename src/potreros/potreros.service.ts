import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Potrero } from './entities/potrero.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';
import { CreatePotreroDto } from './dto/create-potrero.dto.js';
import { UpdatePotreroDto } from './dto/update-potrero.dto.js';

@Injectable()
export class PotrerosService {
  constructor() {}

  async findAll(tenantId: string, manager: EntityManager) {
    const potreros = await manager.getRepository(Potrero).find({
      where: { tenantId },
      relations: { animales: true },
      order: { nombre: 'ASC' }
    });

    return potreros.map(potrero => this.calcularEstadoPotrero(potrero));
  }

  async findOne(id: string, tenantId: string, manager: EntityManager) {
    const potrero = await manager.getRepository(Potrero).findOne({
      where: { id, tenantId },
      relations: { animales: true }
    });

    if (!potrero) {
      throw new NotFoundException(`Potrero con ID ${id} no encontrado`);
    }

    return this.calcularEstadoPotrero(potrero);
  }

  async create(tenantId: string, data: CreatePotreroDto, manager: EntityManager) {
    const repo = manager.getRepository(Potrero);
    const potrero = repo.create({
      ...data,
      tenantId,
    });
    return repo.save(potrero);
  }

  async update(id: string, tenantId: string, data: UpdatePotreroDto, manager: EntityManager) {
    const repo = manager.getRepository(Potrero);
    const potrero = await repo.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    
    repo.merge(potrero, data);
    return repo.save(potrero);
  }

  async remove(id: string, tenantId: string, manager: EntityManager) {
    const repo = manager.getRepository(Potrero);
    const potrero = await repo.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    return repo.remove(potrero);
  }

  async asignarAnimales(id: string, tenantId: string, animalIds: string[], manager: EntityManager) {
    const repoPotrero = manager.getRepository(Potrero);
    const repoAnimal = manager.getRepository(Animal);

    const potrero = await repoPotrero.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    
    if (animalIds && animalIds.length > 0) {
      // Usamos QueryBuilder desde el manager para respetar la transacción RLS
      const result = await repoAnimal.createQueryBuilder()
        .update(Animal)
        .set({ potreroId: id })
        .where("id IN (:...ids) AND tenant_id = :tenantId", { ids: animalIds, tenantId })
        .execute();
        
      if (result.affected !== animalIds.length) {
        throw new BadRequestException('Uno o más animales proporcionados no existen o no pertenecen al tenant actual.');
      }
    }
      
    // Update fechaUltimoIngreso if it's a new group of animals coming in
    potrero.fechaUltimoIngreso = new Date().toISOString().split('T')[0];
    await repoPotrero.save(potrero);

    return this.findOne(id, tenantId, manager);
  }

  private calcularEstadoPotrero(potrero: Potrero) {
    let uaTotal = 0;
    potrero.animales?.forEach(a => {
      if (['Vaca', 'Toro', 'Novillo mayor'].includes(a.categoria)) {
        uaTotal += 1.0;
      } else {
        uaTotal += 0.5;
      }
    });

    const cargaActualUaHa = potrero.areaHa > 0 ? (uaTotal / potrero.areaHa) : 0;
    let estadoCalculado = 'DISPONIBLE';
    
    if (potrero.estadoManual) {
      estadoCalculado = potrero.estadoManual;
    } else {
      if (cargaActualUaHa > potrero.capacidadRecomendadaUaHa) {
        estadoCalculado = 'SOBRECARGADO';
      } else if (potrero.animales?.length === 0) {
        if (potrero.fechaUltimoIngreso) {
           const daysSince = Math.floor((new Date().getTime() - new Date(potrero.fechaUltimoIngreso).getTime()) / (1000 * 3600 * 24));
           if (daysSince < potrero.diasDescansoRecomendados) {
             estadoCalculado = 'EN RECUPERACIÓN';
           }
        }
      }
    }

    return {
      ...potrero,
      cargaActualUaHa: Number(cargaActualUaHa.toFixed(2)),
      uaTotal,
      estadoCalculado,
      animalesAsignadosCount: potrero.animales?.length || 0
    };
  }
}
