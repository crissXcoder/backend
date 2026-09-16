import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evento } from '../eventos/entities/evento.entity.js';
import { EventoServicio } from './entities/evento-servicio.entity.js';
import { EventoDiagnostico } from './entities/evento-diagnostico.entity.js';
import { EventoParto } from './entities/evento-parto.entity.js';
import { EventoSecado } from './entities/evento-secado.entity.js';
import { Animal } from '../animales/entities/animal.entity.js';
import { ReproductiveCalculationService } from './services/reproductive-calculation.service.js';
import { ReproductiveStateService } from './services/reproductive-state.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evento,
      EventoServicio,
      EventoDiagnostico,
      EventoParto,
      EventoSecado,
      Animal,
    ]),
  ],
  providers: [ReproductiveCalculationService, ReproductiveStateService],
  exports: [ReproductiveCalculationService, ReproductiveStateService],
})
export class ReproductivoModule {}
