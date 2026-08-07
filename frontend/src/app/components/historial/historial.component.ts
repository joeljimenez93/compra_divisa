import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService, Operacion, OperacionesResponse } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

interface MesInfo {
  clave: string;       // '2026-08'
  etiqueta: string;    // 'Agosto 2026'
  usd: number;
  invertido: number;
  ganancia: number;
  gananciaUsd: number;
  promedio: number;
  operaciones: number;
}

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css']
})
export class HistorialComponent implements OnInit {
  data: OperacionesResponse | null = null;
  loading = true;
  error = '';
  operacionExpandida: number | null = null;
  editandoId: number | null = null;
  editComisionZinliPct: number = 2.5;
  editComisionZinliBs: number | null = null;
  editTasaBinance: number | null = null;
  editVentaBinanceBs: number | null = null;
  editFotoVenta: string | null = null;
  editFotoVentaNombre: string = '';
  guardandoEdit = false;
  mensajeEdit = '';

  // Filtro por mes
  meses: MesInfo[] = [];
  mesSeleccionado: string = 'todos';  // 'todos' o clave '2026-08'

  // Calculadora
  calcVisible: string = '';  // 'zinli' o 'venta'
  calcExpresion: string = '';
  calcResultado: string = '';

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading = true;
    this.error = '';
    this.api.getOperaciones().subscribe({
      next: (data) => {
        this.data = data;
        this.calcularMeses();
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 401) {
          this.error = '🔐 Sesión expirada. Por favor vuelve a iniciar sesión.';
          // Cerrar sesión tras mostrar el error
          setTimeout(() => this.auth.logout(), 2000);
        } else if (err.status === 0) {
          this.error = '⚠️ No se pudo conectar con el servidor. Verifica tu conexión.';
        } else {
          this.error = '❌ Error al cargar historial (' + (err.error?.error || err.message) + ')';
        }
      }
    });
  }

  calcularMeses() {
    if (!this.data || !this.data.operaciones.length) {
      this.meses = [];
      return;
    }
    const mapa = new Map<string, Operacion[]>();
    for (const op of this.data.operaciones) {
      const fecha = new Date(op.fecha);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(op);
    }
    // Ordenar por clave descendente (más reciente primero)
    const claves = Array.from(mapa.keys()).sort((a, b) => b.localeCompare(a));
    const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    this.meses = claves.map(clave => {
      const ops = mapa.get(clave)!;
      const [anio, mes] = clave.split('-');
      const usd = ops.reduce((s, o) => s + o.monto_usd, 0);
      const invertido = ops.reduce((s, o) => s + (o.detalle.costo_base_bs || o.detalle.costo_bs || 0), 0);
      const ganancia = ops.reduce((s, o) => s + (o.detalle.ganancia_bs || 0), 0);
      const gananciaUsd = ops.reduce((s, o) => s + (o.detalle.ganancia_usd || 0), 0);
      const promedio = invertido > 0 ? (ganancia / invertido) * 100 : 0;
      return {
        clave,
        etiqueta: `${NOMBRES_MESES[parseInt(mes) - 1]} ${anio}`,
        usd,
        invertido,
        ganancia,
        gananciaUsd,
        promedio,
        operaciones: ops.length
      };
    });
  }

  get operacionesFiltradas(): Operacion[] {
    if (!this.data) return [];
    if (this.mesSeleccionado === 'todos') return this.data.operaciones;
    return this.data.operaciones.filter(op => {
      const fecha = new Date(op.fecha);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return clave === this.mesSeleccionado;
    });
  }

  get resumenFiltrado() {
    const ops = this.operacionesFiltradas;
    const usd = ops.reduce((s, o) => s + o.monto_usd, 0);
    const invertido = ops.reduce((s, o) => s + (o.detalle.costo_base_bs || o.detalle.costo_bs || 0), 0);
    const vendido = ops.reduce((s, o) => s + (o.detalle.venta_binance_bs || 0), 0);
    const ganancia = ops.reduce((s, o) => s + (o.detalle.ganancia_bs || 0), 0);
    const gananciaUsd = ops.reduce((s, o) => s + (o.detalle.ganancia_usd || 0), 0);
    const promedio = invertido > 0 ? (ganancia / invertido) * 100 : 0;
    return { usd, invertido, vendido, ganancia, gananciaUsd, promedio, operaciones: ops.length };
  }

  seleccionarMes(clave: string) {
    this.mesSeleccionado = clave;
    this.operacionExpandida = null;
    this.editandoId = null;
  }

  toggleExpand(id: number) {
    this.operacionExpandida = this.operacionExpandida === id ? null : id;
  }

  constructor(private api: ApiService, private auth: AuthService) {}

  abrirEdicion(op: Operacion, event: Event) {
    event.stopPropagation();
    this.editandoId = op.id;
    this.editComisionZinliPct = op.comision_zinli_porcentaje;
    this.editComisionZinliBs = op.detalle.comision_zinli_usd || 0;
    this.editTasaBinance = op.tasa_binance;
    this.editVentaBinanceBs = op.detalle.venta_binance_bs;
    this.editFotoVenta = op.foto_venta || null;
    this.editFotoVentaNombre = op.foto_venta ? 'ver imagen' : '';
    this.operacionExpandida = op.id;
    this.mensajeEdit = '';
  }

  cancelarEdicion() {
    this.editandoId = null;
    this.mensajeEdit = '';
  }

  guardarEdicion() {
    if (!this.editandoId) return;
    this.guardandoEdit = true;
    this.mensajeEdit = '';

    const data: any = {};
    data.comision_zinli_porcentaje = this.editComisionZinliPct;
    if (this.editComisionZinliBs !== null) {
      data.comision_zinli_bs = this.editComisionZinliBs;
    }
    if (this.editTasaBinance !== null && this.editTasaBinance > 0) {
      data.tasa_binance = this.editTasaBinance;
    }
    if (this.editVentaBinanceBs !== null && this.editVentaBinanceBs > 0) {
      data.venta_binance_bs = this.editVentaBinanceBs;
    }
    data.foto_venta = this.editFotoVenta || null;

    this.api.updateOperacion(this.editandoId, data).subscribe({
      next: () => {
        this.guardandoEdit = false;
        this.editandoId = null;
        this.mensajeEdit = '';
        this.cargar();
      },
      error: (err) => {
        this.guardandoEdit = false;
        this.mensajeEdit = 'Error al guardar';
      }
    });
  }

  confirmarOperacion(id: number, event: Event) {
    event.stopPropagation();
    this.api.toggleEstado(id).subscribe({
      next: () => this.cargar(),
      error: () => this.error = 'Error al cambiar estado'
    });
  }

  eliminar(id: number, event: Event) {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta operación?')) return;

    this.api.eliminarOperacion(id).subscribe({
      next: () => this.cargar(),
      error: () => this.error = 'Error al eliminar'
    });
  }

  onFileSelectedHistorial(event: Event, tipo: 'venta') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.mensajeEdit = 'La imagen no puede superar 5MB';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.editFotoVenta = reader.result as string;
        this.editFotoVentaNombre = file.name;
      };
      reader.readAsDataURL(file);
    }
  }

  toggleCalc(campo: string) {
    this.calcVisible = this.calcVisible === campo ? '' : campo;
    this.calcExpresion = '';
    this.calcResultado = '';
  }

  calcBoton(valor: string) {
    if (valor === 'C') {
      this.calcExpresion = '';
      this.calcResultado = '';
    } else if (valor === '=') {
      try {
        const resultado = eval(this.calcExpresion);
        this.calcResultado = parseFloat(resultado.toFixed(4)).toString();
      } catch {
        this.calcResultado = 'Error';
      }
    } else if (valor === '←') {
      this.calcExpresion = this.calcExpresion.slice(0, -1);
    } else {
      this.calcExpresion += valor;
    }
  }

  calcUsarResultado() {
    if (this.calcResultado && this.calcResultado !== 'Error') {
      if (this.calcVisible === 'zinli') {
        this.editComisionZinliBs = parseFloat(this.calcResultado);
      } else if (this.calcVisible === 'venta') {
        this.editVentaBinanceBs = parseFloat(this.calcResultado);
      }
      this.toggleCalc('');
    }
  }

  quitarFotoHistorial() {
    this.editFotoVenta = null;
    this.editFotoVentaNombre = '';
  }

  formatearFecha(iso: string): string {
    const fecha = new Date(iso);
    return fecha.toLocaleDateString('es-VE', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatearFechaCompleta(iso: string): string {
    const fecha = new Date(iso);
    return fecha.toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
