import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { AnimalesModule } from './animales/animales.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PesajesModule } from './pesajes/pesajes.module.js';
import { ServiciosModule } from './servicios/servicios.module.js';
import { TratamientosModule } from './tratamientos/tratamientos.module.js';
import { SanitaryModule } from './sanitary/sanitary.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    AuthModule,
    CatalogosModule,
    AnimalesModule,
    PesajesModule,
    ServiciosModule,
    TratamientosModule,
    SanitaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
