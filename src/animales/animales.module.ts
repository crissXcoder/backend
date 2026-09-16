import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Animal } from './entities/animal.entity.js';
import { DocumentoAnimal } from './entities/documento-animal.entity.js';
import { AnimalesController } from './animales.controller.js';
import { AnimalesService } from './animales.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Animal, DocumentoAnimal])],
  controllers: [AnimalesController],
  providers: [AnimalesService],
  exports: [TypeOrmModule, AnimalesService],
})
export class AnimalesModule {}
