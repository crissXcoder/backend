export interface HitosReproductivos {
  /** Fecha Probable de Parto (YYYY-MM-DD) = fechaServicio + diasGestacion */
  fpp: string;
  /** Fecha recomendada de palpación (YYYY-MM-DD) = fechaServicio + 40 días (ventana 35-45) */
  palpacionFecha: string;
  /** Fecha de secado sugerida (YYYY-MM-DD) = fpp - 60 días */
  secadoFecha: string;
  /** Primer aviso de preparación de parto (YYYY-MM-DD) = fpp - 15 días */
  avisoPartoFecha: string;
  /** Aviso urgente de parto inminente (YYYY-MM-DD) = fpp - 3 días */
  avisoPartoUrgenteFecha: string;
}

export type EstadoReproductivo = 'Vacía' | 'Servida' | 'Preñada' | 'En Secado';

export interface ResumenServicioActivo {
  eventoId: string;
  fechaServicio: string;
  tipoServicio: string;
  toroOPajilla: string;
  responsable?: string | null;
  fpp: string;
  palpacionFecha: string;
  secadoFecha: string;
  avisoPartoFecha: string;
  avisoPartoUrgenteFecha: string;
}

export interface ResumenDiagnosticoActivo {
  eventoId: string;
  fecha: string;
  metodo: string;
  resultado: 'Preñada' | 'Vacía';
  eventoServicioId: string;
}

export interface ResumenPartoActivo {
  eventoId: string;
  fecha: string;
  criaAnimalId?: string | null;
  facilidadParto?: string | null;
}

export interface ResumenSecadoActivo {
  eventoId: string;
  fecha: string;
}

export interface EstadoReproductivoInfo {
  animalId: string;
  areteInterno: string;
  sexo: string;
  razaNombre?: string;
  diasGestacionRaza?: number;
  estadoActual: EstadoReproductivo;
  servicioActivo?: ResumenServicioActivo;
  ultimoDiagnostico?: ResumenDiagnosticoActivo;
  ultimoParto?: ResumenPartoActivo;
  ultimoSecado?: ResumenSecadoActivo;
  proximosHitos?: {
    tipo: 'Palpación' | 'Secado' | 'Aviso Parto' | 'Parto FPP';
    fecha: string;
    diasRestantes: number;
  }[];
}
