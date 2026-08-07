import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistorialComponent } from './historial.component';
import { ApiService, Operacion } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';

// ── Helpers para crear datos de prueba ──────────────────

function crearOperacion(override: Partial<Operacion> = {}): Operacion {
  return {
    id: override.id ?? Date.now(),
    fecha: override.fecha ?? '2026-07-15T00:00:00.000Z',
    fecha_registro: '2026-07-15T12:00:00.000Z',
    monto_usd: override.monto_usd ?? 100,
    tasa_bcv: override.tasa_bcv ?? 740,
    tasa_bcv_efectiva: override.tasa_bcv_efectiva ?? 743.7,
    fuente_bcv: override.fuente_bcv ?? 'Manual',
    tasa_binance: override.tasa_binance ?? 855,
    fuente_binance: override.fuente_binance ?? 'Manual',
    comision_divisas_porcentaje: override.comision_divisas_porcentaje ?? 0.5,
    comision_zinli_porcentaje: override.comision_zinli_porcentaje ?? 2.2,
    foto_compra: override.foto_compra ?? null,
    foto_venta: override.foto_venta ?? null,
    estado: override.estado ?? 'confirmada',
    detalle: {
      costo_base_bs: override.detalle?.costo_base_bs ?? 74000,
      comision_divisas_bs: override.detalle?.comision_divisas_bs ?? 370,
      costo_bs: override.detalle?.costo_bs ?? 74370,
      comision_zinli_usd: override.detalle?.comision_zinli_usd ?? 2.2,
      usd_disponible: override.detalle?.usd_disponible ?? 97.8,
      venta_binance_bs: override.detalle?.venta_binance_bs ?? 83594,
      ganancia_bs: override.detalle?.ganancia_bs ?? 9224,
      ganancia_usd: override.detalle?.ganancia_usd ?? 12.46,
      ganancia_porcentaje: override.detalle?.ganancia_porcentaje ?? 12.40,
      spread: override.detalle?.spread ?? 115
    },
    flujo: override.flujo ?? []
  };
}

// ── Mock de ApiService y AuthService ────────────────────

const apiServiceMock = {
  getOperaciones: () => of({
    ok: true,
    total_operaciones: 0,
    resumen: {
      total_usd_comprados: 0,
      total_bs_invertidos: 0,
      total_bs_vendidos: 0,
      total_ganancia_bs: 0,
      total_ganancia_usd: 0,
      ganancia_promedio_porcentaje: 0
    },
    operaciones: [] as Operacion[]
  }),
  updateOperacion: () => of({ ok: true }),
  toggleEstado: () => of({ ok: true, estado: 'confirmada' }),
  eliminarOperacion: () => of({ ok: true })
};

const authServiceMock = {
  isLoggedIn: true,
  isAdmin: true,
  usuario$: of(null),
  logout: () => {}
};

// ── Tests ───────────────────────────────────────────────

describe('HistorialComponent - Filtro por Meses', () => {

  let component: HistorialComponent;
  let fixture: ComponentFixture<HistorialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialComponent],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialComponent);
    component = fixture.componentInstance;
  });

  // ──────────────────────────────────────────────────────
  // 1. calcularMeses()
  // ──────────────────────────────────────────────────────

  describe('calcularMeses()', () => {

    it('debe retornar array vacío si no hay data', () => {
      component.data = null;
      component.calcularMeses();
      expect(component.meses).toEqual([]);
    });

    it('debe retornar array vacío si no hay operaciones', () => {
      component.data = {
        ok: true, total_operaciones: 0,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: []
      };
      component.calcularMeses();
      expect(component.meses).toEqual([]);
    });

    it('debe agrupar una operación en un solo mes', () => {
      component.data = {
        ok: true, total_operaciones: 1,
        resumen: { total_usd_comprados: 100, total_bs_invertidos: 74000, total_bs_vendidos: 83594, total_ganancia_bs: 9224, total_ganancia_usd: 12.46, ganancia_promedio_porcentaje: 12.40 },
        operaciones: [
          crearOperacion({ id: 1, fecha: '2026-07-15T00:00:00.000Z', monto_usd: 100 })
        ]
      };
      component.calcularMeses();

      expect(component.meses.length).toBe(1);
      expect(component.meses[0].clave).toBe('2026-07');
      expect(component.meses[0].etiqueta).toBe('Julio 2026');
      expect(component.meses[0].operaciones).toBe(1);
    });

    it('debe agrupar múltiples operaciones del mismo mes', () => {
      component.data = {
        ok: true, total_operaciones: 3,
        resumen: { total_usd_comprados: 520, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({ id: 1, fecha: '2026-08-05T00:00:00.000Z', monto_usd: 200 }),
          crearOperacion({ id: 2, fecha: '2026-08-12T00:00:00.000Z', monto_usd: 150 }),
          crearOperacion({ id: 3, fecha: '2026-08-28T00:00:00.000Z', monto_usd: 170 })
        ]
      };
      component.calcularMeses();

      expect(component.meses.length).toBe(1);
      expect(component.meses[0].clave).toBe('2026-08');
      expect(component.meses[0].etiqueta).toBe('Agosto 2026');
      expect(component.meses[0].operaciones).toBe(3);
    });

    it('debe separar operaciones en distintos meses', () => {
      component.data = {
        ok: true, total_operaciones: 3,
        resumen: { total_usd_comprados: 400, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({ id: 1, fecha: '2026-07-10T00:00:00.000Z', monto_usd: 100 }),
          crearOperacion({ id: 2, fecha: '2026-08-15T00:00:00.000Z', monto_usd: 150 }),
          crearOperacion({ id: 3, fecha: '2026-09-20T00:00:00.000Z', monto_usd: 150 })
        ]
      };
      component.calcularMeses();

      expect(component.meses.length).toBe(3);
      // Orden descendente
      expect(component.meses[0].clave).toBe('2026-09');
      expect(component.meses[1].clave).toBe('2026-08');
      expect(component.meses[2].clave).toBe('2026-07');
    });

    it('debe calcular correctamente USD, invertido, ganancia y promedio por mes', () => {
      component.data = {
        ok: true, total_operaciones: 2,
        resumen: { total_usd_comprados: 250, total_bs_invertidos: 185000, total_bs_vendidos: 0, total_ganancia_bs: 20000, total_ganancia_usd: 27, ganancia_promedio_porcentaje: 10.81 },
        operaciones: [
          crearOperacion({
            id: 1, fecha: '2026-08-10T00:00:00.000Z', monto_usd: 100,
            detalle: { costo_base_bs: 74000, costo_bs: 74370, venta_binance_bs: 83594, ganancia_bs: 9224, ganancia_usd: 12.46, ganancia_porcentaje: 12.40, spread: 115, comision_zinli_usd: 2.2, usd_disponible: 97.8, comision_divisas_bs: 370 }
          }),
          crearOperacion({
            id: 2, fecha: '2026-08-20T00:00:00.000Z', monto_usd: 150,
            detalle: { costo_base_bs: 111000, costo_bs: 111555, venta_binance_bs: 125500, ganancia_bs: 13945, ganancia_usd: 18.84, ganancia_porcentaje: 12.50, spread: 115, comision_zinli_usd: 3.3, usd_disponible: 146.7, comision_divisas_bs: 555 }
          })
        ]
      };
      component.calcularMeses();

      expect(component.meses.length).toBe(1);
      const agosto = component.meses[0];
      expect(agosto.clave).toBe('2026-08');
      expect(agosto.usd).toBe(250);                          // 100 + 150
      expect(agosto.invertido).toBe(185000);                 // 74000 + 111000
      expect(agosto.ganancia).toBe(23169);                   // 9224 + 13945
      expect(agosto.gananciaUsd).toBeCloseTo(31.30, 1);      // 12.46 + 18.84
      expect(agosto.promedio).toBeCloseTo(12.52, 1);         // (23169/185000)*100
      expect(agosto.operaciones).toBe(2);
    });

    it('debe manejar correctamente años diferentes', () => {
      component.data = {
        ok: true, total_operaciones: 2,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({ id: 1, fecha: '2025-12-20T00:00:00.000Z', monto_usd: 80 }),
          crearOperacion({ id: 2, fecha: '2026-01-05T00:00:00.000Z', monto_usd: 120 })
        ]
      };
      component.calcularMeses();

      expect(component.meses.length).toBe(2);
      expect(component.meses[0].clave).toBe('2026-01');
      expect(component.meses[0].etiqueta).toBe('Enero 2026');
      expect(component.meses[1].clave).toBe('2025-12');
      expect(component.meses[1].etiqueta).toBe('Diciembre 2025');
    });

    it('debe manejar ganancia negativa (pérdida)', () => {
      component.data = {
        ok: true, total_operaciones: 1,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({
            id: 1, fecha: '2026-08-01T00:00:00.000Z', monto_usd: 100,
            detalle: { costo_base_bs: 80000, costo_bs: 80400, venta_binance_bs: 75000, ganancia_bs: -5400, ganancia_usd: -6.75, ganancia_porcentaje: -6.72, spread: 0, comision_zinli_usd: 0, usd_disponible: 100, comision_divisas_bs: 400 }
          })
        ]
      };
      component.calcularMeses();

      expect(component.meses[0].ganancia).toBe(-5400);
      expect(component.meses[0].gananciaUsd).toBeCloseTo(-6.75, 2);
      expect(component.meses[0].promedio).toBeCloseTo(-6.75, 1);
    });
  });

  // ──────────────────────────────────────────────────────
  // 2. operacionesFiltradas
  // ──────────────────────────────────────────────────────

  describe('operacionesFiltradas', () => {

    beforeEach(() => {
      component.data = {
        ok: true, total_operaciones: 3,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({ id: 1, fecha: '2026-07-10T00:00:00.000Z' }),
          crearOperacion({ id: 2, fecha: '2026-08-15T00:00:00.000Z' }),
          crearOperacion({ id: 3, fecha: '2026-08-28T00:00:00.000Z' })
        ]
      };
      component.calcularMeses();
    });

    it('debe retornar todas las operaciones cuando mesSeleccionado es "todos"', () => {
      component.mesSeleccionado = 'todos';
      expect(component.operacionesFiltradas.length).toBe(3);
    });

    it('debe retornar solo operaciones del mes seleccionado', () => {
      component.mesSeleccionado = '2026-08';
      const filtradas = component.operacionesFiltradas;
      expect(filtradas.length).toBe(2);
      expect(filtradas[0].id).toBe(2);
      expect(filtradas[1].id).toBe(3);
    });

    it('debe retornar array vacío si el mes seleccionado no tiene operaciones', () => {
      component.mesSeleccionado = '2026-09';
      expect(component.operacionesFiltradas.length).toBe(0);
    });

    it('debe retornar array vacío si data es null', () => {
      component.data = null;
      component.mesSeleccionado = 'todos';
      expect(component.operacionesFiltradas).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────
  // 3. resumenFiltrado
  // ──────────────────────────────────────────────────────

  describe('resumenFiltrado', () => {

    beforeEach(() => {
      component.data = {
        ok: true, total_operaciones: 2,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({
            id: 1, fecha: '2026-08-05T00:00:00.000Z', monto_usd: 200,
            detalle: { costo_base_bs: 148000, costo_bs: 148740, venta_binance_bs: 167000, ganancia_bs: 18260, ganancia_usd: 24.66, ganancia_porcentaje: 12.28, spread: 115, comision_zinli_usd: 4.4, usd_disponible: 195.6, comision_divisas_bs: 740 }
          }),
          crearOperacion({
            id: 2, fecha: '2026-09-10T00:00:00.000Z', monto_usd: 300,
            detalle: { costo_base_bs: 222000, costo_bs: 223110, venta_binance_bs: 251000, ganancia_bs: 27890, ganancia_usd: 37.67, ganancia_porcentaje: 12.50, spread: 115, comision_zinli_usd: 6.6, usd_disponible: 293.4, comision_divisas_bs: 1110 }
          })
        ]
      };
      component.calcularMeses();
    });

    it('debe calcular resumen total con mesSeleccionado = "todos"', () => {
      component.mesSeleccionado = 'todos';
      const resumen = component.resumenFiltrado;

      expect(resumen.operaciones).toBe(2);
      expect(resumen.usd).toBe(500);                          // 200 + 300
      expect(resumen.invertido).toBe(370000);                 // 148000 + 222000
      expect(resumen.ganancia).toBe(46150);                   // 18260 + 27890
      expect(resumen.gananciaUsd).toBeCloseTo(62.33, 1);      // 24.66 + 37.67
      expect(resumen.promedio).toBeCloseTo(12.47, 1);         // (46150/370000)*100
    });

    it('debe calcular resumen solo del mes seleccionado', () => {
      component.mesSeleccionado = '2026-08';
      const resumen = component.resumenFiltrado;

      expect(resumen.operaciones).toBe(1);
      expect(resumen.usd).toBe(200);
      expect(resumen.invertido).toBe(148000);
      expect(resumen.ganancia).toBe(18260);
    });

    it('debe retornar ceros si no hay operaciones en el mes', () => {
      component.mesSeleccionado = '2026-10';
      const resumen = component.resumenFiltrado;

      expect(resumen.operaciones).toBe(0);
      expect(resumen.usd).toBe(0);
      expect(resumen.invertido).toBe(0);
      expect(resumen.ganancia).toBe(0);
      expect(resumen.gananciaUsd).toBe(0);
      expect(resumen.promedio).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────
  // 4. seleccionarMes()
  // ──────────────────────────────────────────────────────

  describe('seleccionarMes()', () => {

    it('debe actualizar mesSeleccionado', () => {
      component.seleccionarMes('2026-08');
      expect(component.mesSeleccionado).toBe('2026-08');
    });

    it('debe permitir volver a "todos"', () => {
      component.mesSeleccionado = '2026-08';
      component.seleccionarMes('todos');
      expect(component.mesSeleccionado).toBe('todos');
    });

    it('debe resetear operacionExpandida al cambiar de mes', () => {
      component.operacionExpandida = 1;
      component.editandoId = 2;
      component.seleccionarMes('2026-08');
      expect(component.operacionExpandida).toBeNull();
      expect(component.editandoId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────
  // 5. Integración: flujo completo de filtrado
  // ──────────────────────────────────────────────────────

  describe('Flujo completo', () => {

    it('debe actualizar resumen al cambiar de mes', () => {
      // Setup: 3 operaciones en 2 meses
      component.data = {
        ok: true, total_operaciones: 3,
        resumen: { total_usd_comprados: 0, total_bs_invertidos: 0, total_bs_vendidos: 0, total_ganancia_bs: 0, total_ganancia_usd: 0, ganancia_promedio_porcentaje: 0 },
        operaciones: [
          crearOperacion({
            id: 1, fecha: '2026-07-10T00:00:00.000Z', monto_usd: 100,
            detalle: { costo_base_bs: 74000, costo_bs: 74370, venta_binance_bs: 83000, ganancia_bs: 8630, ganancia_usd: 11.66, ganancia_porcentaje: 11.60, spread: 110, comision_zinli_usd: 2.2, usd_disponible: 97.8, comision_divisas_bs: 370 }
          }),
          crearOperacion({
            id: 2, fecha: '2026-08-05T00:00:00.000Z', monto_usd: 200,
            detalle: { costo_base_bs: 148000, costo_bs: 148740, venta_binance_bs: 167000, ganancia_bs: 18260, ganancia_usd: 24.66, ganancia_porcentaje: 12.28, spread: 115, comision_zinli_usd: 4.4, usd_disponible: 195.6, comision_divisas_bs: 740 }
          }),
          crearOperacion({
            id: 3, fecha: '2026-08-20T00:00:00.000Z', monto_usd: 150,
            detalle: { costo_base_bs: 111000, costo_bs: 111555, venta_binance_bs: 125500, ganancia_bs: 13945, ganancia_usd: 18.84, ganancia_porcentaje: 12.50, spread: 115, comision_zinli_usd: 3.3, usd_disponible: 146.7, comision_divisas_bs: 555 }
          })
        ]
      };
      component.calcularMeses();

      // Todos
      component.seleccionarMes('todos');
      expect(component.resumenFiltrado.operaciones).toBe(3);
      expect(component.resumenFiltrado.usd).toBe(450);
      expect(component.resumenFiltrado.ganancia).toBe(40835);

      // Julio
      component.seleccionarMes('2026-07');
      expect(component.resumenFiltrado.operaciones).toBe(1);
      expect(component.resumenFiltrado.usd).toBe(100);
      expect(component.resumenFiltrado.ganancia).toBe(8630);

      // Agosto
      component.seleccionarMes('2026-08');
      expect(component.resumenFiltrado.operaciones).toBe(2);
      expect(component.resumenFiltrado.usd).toBe(350);
      expect(component.resumenFiltrado.ganancia).toBe(32205);

      // Volver a todos
      component.seleccionarMes('todos');
      expect(component.resumenFiltrado.operaciones).toBe(3);
    });
  });
});
