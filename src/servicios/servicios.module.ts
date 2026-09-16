import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiciosController } from './servicios.controller.js';
import { ServiciosService } from './servicios.service.js';
import { Servicio } from './entities/servicio.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Servicio])],
  controllers: [ServiciosController],
  providers: [ServiciosService]
})
export class ServiciosModule {}
