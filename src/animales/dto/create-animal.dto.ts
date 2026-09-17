import { IsString, IsUUID, IsOptional, IsBoolean, IsNumber, IsDateString } from 'class-validator';

export class CreateAnimalDto {
  @IsString()
  nombre: string;

  @IsString()
  areteInterno: string;

  @IsString()
  @IsOptional()
  numeroOficialDiio?: string;

  @IsString()
  sexo: string;

  @IsUUID()
  razaId: string;

  @IsString()
  @IsOptional()
  razaOtra?: string;

  @IsString()
  categoria: string;

  @IsUUID()
  @IsOptional()
  potreroId?: string;

  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @IsNumber()
  @IsOptional()
  pesoActualKg?: number;

  @IsString()
  @IsOptional()
  fotoUrl?: string;

  @IsUUID()
  @IsOptional()
  madreId?: string;

  @IsUUID()
  @IsOptional()
  padreId?: string;

  @IsString()
  @IsOptional()
  padreExternoDescripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  origen?: 'Finca' | 'Externa';

  @IsString()
  @IsOptional()
  compradoA?: string;

  @IsDateString()
  @IsOptional()
  fechaCompra?: string;

  @IsNumber()
  @IsOptional()
  valorCompraCrc?: number;

  @IsString()
  @IsOptional()
  numeroGuia?: string;

  @IsString()
  @IsOptional()
  metodoCompra?: 'Sinpe' | 'Depósito' | 'Efectivo' | 'Combinado';

  @IsString({ each: true })
  @IsOptional()
  metodosCombinados?: string[];

  @IsString()
  @IsOptional()
  referenciaPago?: string;
}
