import { IsString, IsUUID, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateTratamientoDto {
  @IsUUID()
  animalId: string;

  @IsString()
  farmaco: string;

  @IsString()
  dosis: string;

  @IsString()
  @IsOptional()
  via?: string;

  @IsDateString()
  fecha: string;

  @IsString()
  diagnostico: string;

  @IsString()
  @IsOptional()
  veterinario?: string;

  @IsNumber()
  @IsOptional()
  diasRetiro?: number;

  @IsString()
  @IsOptional()
  documentoUrl?: string;
}
