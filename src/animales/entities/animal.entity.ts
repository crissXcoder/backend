import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { CatalogoRaza } from '../../catalogos/entities/catalogo-raza.entity.js';

@Entity('animal')
@Unique(['tenantId', 'areteInterno'])
export class Animal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ name: 'arete_interno', type: 'text' })
  areteInterno: string;

  @Column({ name: 'numero_oficial_diio', type: 'text', nullable: true })
  numeroOficialDiio: string | null;

  @Column({ type: 'text' }) // 'Hembra' | 'Macho'
  sexo: string;

  @Column({ name: 'raza_id', type: 'uuid' })
  razaId: string;

  @ManyToOne(() => CatalogoRaza)
  @JoinColumn({ name: 'raza_id' })
  raza: CatalogoRaza;

  @Column({ name: 'raza_otra', type: 'text', nullable: true })
  razaOtra: string | null;

  @Column({ type: 'text' })
  categoria: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: string | null; // Date as string 'YYYY-MM-DD'

  @Column({ name: 'peso_actual_kg', type: 'numeric', precision: 6, scale: 1, nullable: true })
  pesoActualKg: number | null;
  
  @Column({ name: 'foto_url', type: 'text', nullable: true })
  fotoUrl: string | null;

  @Column({ name: 'madre_id', type: 'uuid', nullable: true })
  madreId: string | null;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'madre_id' })
  madre: Animal | null;

  @Column({ name: 'padre_id', type: 'uuid', nullable: true })
  padreId: string | null;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'padre_id' })
  padre: Animal | null;

  @Column({ name: 'padre_externo_descripcion', type: 'text', nullable: true })
  padreExternoDescripcion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'fecha_baja', type: 'date', nullable: true })
  fechaBaja: string | null;

  @Column({ name: 'tipo_baja', type: 'text', nullable: true })
  tipoBaja: string | null;

  @Column({ name: 'motivo_baja', type: 'text', nullable: true })
  motivoBaja: string | null;

  @Column({ name: 'precio_venta_crc', type: 'numeric', precision: 12, scale: 2, nullable: true })
  precioVentaCrc: number | null;

  @Column({ name: 'peso_final_kg', type: 'numeric', precision: 6, scale: 1, nullable: true })
  pesoFinalKg: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
