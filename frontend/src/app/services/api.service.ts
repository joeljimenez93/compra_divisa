import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TasasResponse {
  ok: boolean;
  tasas: {
    bcv: { tasa: number; fuente: string; fecha: string; simbolo: string };
    bcv_efectiva: { tasa: number; simbolo: string; descripcion: string };
    binance_p2p: { tasa: number; fuente: string; fecha: string; simbolo: string };
  };
  comisiones: {
    divisas: { porcentaje: number; descripcion: string };
    zinli: { porcentaje: number; descripcion: string };
  };
  ejemplo_100usd: {
    monto_usd: number;
    tasa_bcv: number;
    tasa_bcv_efectiva: number;
    costo_divisas_bs: number;
    costo_base_bs: number;
    costo_total_bs: number;
    comision_zinli_usd: number;
    usd_disponible: number;
    venta_binance_bs: number;
    ganancia_bs: number;
    ganancia_porcentaje: number;
    spread: number;
  };
}

export interface Operacion {
  id: number;
  fecha: string;
  fecha_registro?: string;
  monto_usd: number;
  tasa_bcv: number;
  tasa_bcv_efectiva?: number;
  fuente_bcv?: string;
  tasa_binance: number;
  fuente_binance?: string;
  comision_divisas_porcentaje?: number;
  comision_zinli_porcentaje: number;
  foto_compra?: string | null;
  foto_venta?: string | null;
  detalle: {
    costo_base_bs?: number;
    comision_divisas_bs?: number;
    costo_bs: number;
    comision_zinli_usd?: number;
    usd_disponible?: number;
    venta_binance_bs: number;
    ganancia_bs: number;
    ganancia_porcentaje: number;
    spread: number;
  };
  flujo: Array<{ paso: number; descripcion: string; [key: string]: any }>;
}

export interface OperacionesResponse {
  ok: boolean;
  total_operaciones: number;
  resumen: {
    total_usd_comprados: number;
    total_bs_invertidos: number;
    total_bs_vendidos: number;
    total_ganancia_bs: number;
    ganancia_promedio_porcentaje: number;
  };
  operaciones: Operacion[];
}

export interface Config {
  comision_zinli_porcentaje: number;
  comision_divisas_porcentaje?: number;
  tasa_bcv_manual: number | null;
  tasa_binance_manual: number | null;
  margen_minimo_ganancia: number;
  fecha_actualizacion: string | null;
}

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getTasas(): Observable<TasasResponse> {
    return this.http.get<TasasResponse>(`${API}/tasas`);
  }

  crearOperacion(monto_usd: number, tasa_bcv_manual?: number, tasa_binance_manual?: number, fecha_operacion?: string, foto_compra?: string): Observable<{ ok: boolean; operacion: Operacion }> {
    return this.http.post<{ ok: boolean; operacion: Operacion }>(`${API}/operaciones`, {
      monto_usd,
      tasa_bcv_manual: tasa_bcv_manual || undefined,
      tasa_binance_manual: tasa_binance_manual || undefined,
      fecha_operacion: fecha_operacion || undefined,
      foto_compra: foto_compra || undefined
    });
  }

  getOperaciones(): Observable<OperacionesResponse> {
    return this.http.get<OperacionesResponse>(`${API}/operaciones`);
  }

  getOperacion(id: number): Observable<{ ok: boolean; operacion: Operacion }> {
    return this.http.get<{ ok: boolean; operacion: Operacion }>(`${API}/operaciones/${id}`);
  }

  eliminarOperacion(id: number): Observable<any> {
    return this.http.delete(`${API}/operaciones/${id}`);
  }

  updateOperacion(id: number, data: { comision_zinli_porcentaje?: number; comision_zinli_bs?: number; venta_binance_bs?: number }): Observable<{ ok: boolean; operacion: Operacion }> {
    return this.http.put<{ ok: boolean; operacion: Operacion }>(`${API}/operaciones/${id}`, data);
  }

  getConfig(): Observable<{ ok: boolean; config: Config }> {
    return this.http.get<{ ok: boolean; config: Config }>(`${API}/config`);
  }

  updateConfig(config: Partial<Config>): Observable<{ ok: boolean; config: Config }> {
    return this.http.put<{ ok: boolean; config: Config }>(`${API}/config`, config);
  }
}
