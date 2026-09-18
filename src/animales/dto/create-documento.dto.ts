import { IsString, IsUrl } from 'class-validator';

export class CreateDocumentoDto {
  @IsString()
  tipo: string;

  @IsString()
  archivoUrl: string;
}
