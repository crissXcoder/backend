import { Entity, PrimaryColumn, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { Animal } from '../../animales/entities/animal.entity.js';

@Entity('evento_parto')
export class EventoParto {
  @PrimaryColumn('uuid', { name: 'evento_id' })
  eventoId: string;

  @OneToOne(() => Evento, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'evento_id' })
  evento: Evento;

  @Column({ name: 'evento_servicio_id', type: 'uuid', nullable: true })
  eventoServicioId: string | null;

  @ManyToOne(() => Evento, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'evento_servicio_id' })
  eventoServicio: Evento | null;

  @Column({ name: 'cria_animal_id', type: 'uuid', nullable: true })
  criaAnimalId: string | null;

  @ManyToOne(() => Animal, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cria_animal_id' })
  criaAnimal: Animal | null;

  @Column({ name: 'facilidad_parto', type: 'text', nullable: true })
  facilidadParto: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;
}
