import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReproductiveCalculationService } from '../services/reproductive-calculation.service.js';

describe('ReproductiveCalculationService', () => {
  let service: ReproductiveCalculationService;

  beforeEach(() => {
    service = new ReproductiveCalculationService();
  });

  describe('calcularHitos', () => {
    it('CRITERIO 1: Un servicio en Holstein (281d) y en Brahman (293d) producen FPP distintas con diferencia exacta de 12 días', () => {
      const fechaServicio = '2026-01-01';
      const diasHolstein = 281;
      const diasBrahman = 293;

      const hitosHolstein = service.calcularHitos(fechaServicio, diasHolstein);
      const hitosBrahman = service.calcularHitos(fechaServicio, diasBrahman);

      // Verificación de fechas exactas
      expect(hitosHolstein.fpp).toBe('2026-10-09');
      expect(hitosBrahman.fpp).toBe('2026-10-21');

      // Calcular diferencia en días
      const diffMs =
        new Date(hitosBrahman.fpp).getTime() -
        new Date(hitosHolstein.fpp).getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDias).toBe(12);
      expect(hitosHolstein.fpp).not.toBe(hitosBrahman.fpp);
    });

    it('Calcula correctamente los 4 hitos veterinarios oficiales a partir de la fecha de servicio', () => {
      const fechaServicio = '2026-03-01';
      const diasGestacion = 280; // Holstein / Jersey

      const hitos = service.calcularHitos(fechaServicio, diasGestacion);

      // FPP = 2026-03-01 + 280 días = 2026-12-06
      expect(hitos.fpp).toBe('2026-12-06');

      // Palpación = 2026-03-01 + 40 días = 2026-04-10
      expect(hitos.palpacionFecha).toBe('2026-04-10');

      // Secado = FPP (2026-12-06) - 60 días = 2026-10-07
      expect(hitos.secadoFecha).toBe('2026-10-07');

      // Aviso parto = FPP (2026-12-06) - 15 días = 2026-11-21
      expect(hitos.avisoPartoFecha).toBe('2026-11-21');

      // Aviso parto urgente = FPP (2026-12-06) - 3 días = 2026-12-03
      expect(hitos.avisoPartoUrgenteFecha).toBe('2026-12-03');
    });

    it('Acepta objetos Date válidos sin desvío de zona horaria', () => {
      const fechaDate = new Date('2026-05-15T00:00:00.000Z');
      const hitos = service.calcularHitos(fechaDate, 290);

      expect(hitos.palpacionFecha).toBe('2026-06-24'); // +40 días
      expect(hitos.fpp).toBe('2027-03-01'); // +290 días (Mayo 15 + 290 días = Marzo 1)
    });

    it('Rechaza explícitamente con BadRequestException si diasGestacion es nulo, indefinido, <= 0 o NaN (Cero valores por defecto silenciosos)', () => {
      const fecha = '2026-01-01';

      expect(() => service.calcularHitos(fecha, null as unknown as number)).toThrow(
        BadRequestException,
      );
      expect(() => service.calcularHitos(fecha, undefined as unknown as number)).toThrow(
        BadRequestException,
      );
      expect(() => service.calcularHitos(fecha, 0)).toThrow(BadRequestException);
      expect(() => service.calcularHitos(fecha, -10)).toThrow(BadRequestException);
      expect(() => service.calcularHitos(fecha, NaN)).toThrow(BadRequestException);
    });

    it('Rechaza fechas inválidas con BadRequestException', () => {
      expect(() => service.calcularHitos('fecha-invalida', 280)).toThrow(
        BadRequestException,
      );
      expect(() => service.calcularHitos(new Date('fecha-invalida'), 280)).toThrow(
        BadRequestException,
      );
    });
  });
});
