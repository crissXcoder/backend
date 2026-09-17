import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistrarPartoDto {
  @ApiProperty({
    description: 'Fecha en que ocurrió el parto (YYYY-MM-DD)',
    example: '2026-10-10',
  })
  @IsDateString(
    {},
    { message: 'La fecha del parto debe tener formato válido (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'La fecha del parto es requerida' })
  fechaEvento: string;

  @ApiPropertyOptional({
    description: 'ID del evento de servicio del cual se originó esta preñez',
    example: 'a0b9432d-cf48-4be7-a2f0-1a76c66cfcb1',
  })
  @IsUUID('4', { message: 'El eventoServicioId debe ser un UUID válido' })
  @IsOptional()
  eventoServicioId?: string;

  @ApiPropertyOptional({
    description:
      'ID del animal registrado como cría recién nacida (si ya fue registrado en el hato)',
    example: 'e1d67412-21d9-482f-870d-f55da282b810',
  })
  @IsUUID('4', { message: 'El criaAnimalId debe ser un UUID válido' })
  @IsOptional()
  criaAnimalId?: string;

  @ApiPropertyOptional({
    description: 'Facilidad del parto (ej. Eutócico/Normal, Distócico/Con Asistencia, Cesárea)',
    example: 'Normal (Eutócico)',
  })
  @IsString({ message: 'La facilidad del parto debe ser texto' })
  @IsOptional()
  facilidadParto?: string;

  @ApiPropertyOptional({
    description: 'Observaciones del parto y estado de la cría y la madre',
    example: 'Cría hembra nacida vigorosa, 38 kg de peso al nacer',
  })
  @IsString({ message: 'Las observaciones deben ser texto' })
  @IsOptional()
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'ID de evento anterior si este registro es una corrección',
  })
  @IsUUID('4', { message: 'El eventoCorrigeId debe ser un UUID válido' })
  @IsOptional()
  eventoCorrigeId?: string;
}
