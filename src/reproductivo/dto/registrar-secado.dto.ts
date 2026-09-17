import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistrarSecadoDto {
  @ApiProperty({
    description: 'Fecha en que se realizó la suspensión real del ordeño (YYYY-MM-DD)',
    example: '2026-08-10',
  })
  @IsDateString(
    {},
    { message: 'La fecha del secado debe tener formato válido (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'La fecha del secado es requerida' })
  fechaEvento: string;

  @ApiPropertyOptional({
    description: 'Observaciones o tratamiento de sellado/terapia de secado intramamaria aplicada',
    example: 'Aplicada infusión de secado en los 4 cuartos + sellador de pezones',
  })
  @IsString({ message: 'Las notas deben ser texto' })
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({
    description: 'ID de evento anterior si este secado es una corrección',
  })
  @IsUUID('4', { message: 'El eventoCorrigeId debe ser un UUID válido' })
  @IsOptional()
  eventoCorrigeId?: string;
}
