import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { AnimalesModule } from './animales/animales.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    CatalogosModule,
    AnimalesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
