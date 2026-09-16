import { Module } from '@nestjs/common';
import { SanitaryController } from './sanitary.controller.js';
import { SanitaryService } from './sanitary.service.js';

@Module({
  controllers: [SanitaryController],
  providers: [SanitaryService],
  exports: [SanitaryService],
})
export class SanitaryModule {}
