import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  SanitaryService,
  MEDICAMENTOS_BASE,
  PADECIMIENTOS_BASE,
} from './sanitary.service.js';
import { Medicamento } from './entities/medicamento.entity.js';
import { Padecimiento } from './entities/padecimiento.entity.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockDbMedicamentos: Partial<Medicamento>[] = [
  {
    id: 'db-med-1',
    tenantId: TENANT_ID,
    nombreComercial: 'Cefalexina 200 Intramamaria',
    principioActivo: 'Cefalexina',
    viaAdministracion: 'Intramamaria',
    diasRetiroLecheDefault: 5,
    diasRetiroCarneDefault: 4,
  },
];

const mockDbPadecimientos: Partial<Padecimiento>[] = [
  {
    id: 'db-pad-1',
    tenantId: TENANT_ID,
    nombre: 'Mastitis clínica',
    categoria: 'Ubre',
    medicamentoSugeridoId: 'db-med-1',
    medicamentoSugerido: mockDbMedicamentos[0] as Medicamento,
  },
];

describe('SanitaryService', () => {
  describe('Modo desacoplado / Memoria (sin DataSource)', () => {
    let service: SanitaryService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [SanitaryService],
      }).compile();

      service = module.get<SanitaryService>(SanitaryService);
    });

    it('devuelve los 4 medicamentos base oficiales con los días de retiro correctos', async () => {
      const result = await service.getMedicamentos(TENANT_ID);

      expect(result).toHaveLength(4);
      expect(result.map((m) => m.nombreComercial)).toEqual(
        MEDICAMENTOS_BASE.map((m) => m.nombreComercial),
      );
      expect(result[0].tenantId).toBe(TENANT_ID);
      expect(result[0].diasRetiroLecheDefault).toBe(5);
      expect(result[0].diasRetiroCarneDefault).toBe(4);
    });

    it('devuelve los 10 padecimientos base con relaciones a medicamentos sugeridos', async () => {
      const result = await service.getPadecimientos(TENANT_ID);

      expect(result).toHaveLength(10);
      expect(result.map((p) => p.nombre)).toEqual(
        PADECIMIENTOS_BASE.map((p) => p.nombre),
      );

      // Verificar que mastitis sugiere Cefalexina
      const mastitis = result.find((p) => p.nombre === 'Mastitis clínica');
      expect(mastitis?.medicamentoSugerido?.nombreComercial).toBe(
        'Cefalexina 200 Intramamaria',
      );
    });
  });

  describe('Modo conectado a Base de Datos (con DataSource inicializado)', () => {
    let service: SanitaryService;
    const mockFindMed = vi.fn();
    const mockFindPad = vi.fn();

    const mockDataSource = {
      isInitialized: true,
      getRepository: vi.fn((entity) => {
        if (entity === Medicamento) {
          return { find: mockFindMed };
        }
        if (entity === Padecimiento) {
          return { find: mockFindPad };
        }
        return {};
      }),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SanitaryService,
          {
            provide: DataSource,
            useValue: mockDataSource,
          },
        ],
      }).compile();

      service = module.get<SanitaryService>(SanitaryService);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('consulta catalogo_medicamento en BD filtrado por tenantId', async () => {
      mockFindMed.mockResolvedValue(mockDbMedicamentos);

      const result = await service.getMedicamentos(TENANT_ID);

      expect(result).toEqual(mockDbMedicamentos);
      expect(mockFindMed).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        order: { nombreComercial: 'ASC' },
      });
    });

    it('consulta catalogo_padecimiento en BD filtrado por tenantId con relación eager', async () => {
      mockFindPad.mockResolvedValue(mockDbPadecimientos);

      const result = await service.getPadecimientos(TENANT_ID);

      expect(result).toEqual(mockDbPadecimientos);
      expect(mockFindPad).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        relations: { medicamentoSugerido: true },
        order: { nombre: 'ASC' },
      });
    });
  });
});
