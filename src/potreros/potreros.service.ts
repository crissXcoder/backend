import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Potrero } from './entities/potrero.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';

@Injectable()
export class PotrerosService {
  constructor(
    @InjectRepository(Potrero)
    private readonly potreroRepository: Repository<Potrero>,
    @InjectRepository(Animal)
    private readonly animalRepository: Repository<Animal>
  ) {}

  async findAll(tenantId: string) {
    const potreros = await this.potreroRepository.find({
      where: { tenantId },
      relations: { animales: true },
      order: { nombre: 'ASC' }
    });

    return potreros.map(potrero => this.calcularEstadoPotrero(potrero));
  }

  async findOne(id: string, tenantId: string) {
    const potrero = await this.potreroRepository.findOne({
      where: { id, tenantId },
      relations: { animales: true }
    });

    if (!potrero) {
      throw new NotFoundException(`Potrero con ID ${id} no encontrado`);
    }

    return this.calcularEstadoPotrero(potrero);
  }

  async create(tenantId: string, data: any) {
    const potrero = this.potreroRepository.create({
      ...data,
      tenantId,
    });
    return this.potreroRepository.save(potrero);
  }

  async update(id: string, tenantId: string, data: any) {
    const potrero = await this.potreroRepository.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    
    this.potreroRepository.merge(potrero, data);
    return this.potreroRepository.save(potrero);
  }

  async remove(id: string, tenantId: string) {
    const potrero = await this.potreroRepository.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    return this.potreroRepository.remove(potrero);
  }

  async asignarAnimales(id: string, tenantId: string, animalIds: string[]) {
    const potrero = await this.potreroRepository.findOne({ where: { id, tenantId }});
    if (!potrero) throw new NotFoundException('Potrero no encontrado');
    
    if (animalIds && animalIds.length > 0) {
      await this.animalRepository.createQueryBuilder()
        .update(Animal)
        .set({ potreroId: id })
        .where("id IN (:...ids) AND tenant_id = :tenantId", { ids: animalIds, tenantId })
        .execute();
    }
      
    // Update fechaUltimoIngreso if it's a new group of animals coming in
    potrero.fechaUltimoIngreso = new Date().toISOString().split('T')[0];
    await this.potreroRepository.save(potrero);

    return this.findOne(id, tenantId);
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
