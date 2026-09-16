import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Animal } from '../../animales/entities/animal.entity.js';

@Entity('servicio_reproductivo')
export class Servicio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'animal_id', type: 'uuid' })
  animalId: string;

  @ManyToOne(() => Animal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'animal_id' })
  animal: Animal;

  @Column({ name: 'tipo_servicio', type: 'text' })
  tipoServicio: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'text', nullable: true })
  semental: string;

  @Column({ type: 'text', nullable: true })
  inseminador: string;

  @Column({ type: 'text', nullable: true })
  potrero: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ name: 'fecha_palpacion', type: 'date', nullable: true })
  fechaPalpacion: string;

  @Column({ name: 'estado_palpacion', type: 'text', nullable: true })
  estadoPalpacion: string;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
