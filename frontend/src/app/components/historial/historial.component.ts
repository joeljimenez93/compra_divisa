import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Operacion, OperacionesResponse } from '../../services/api.service';

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
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar historial';
        this.loading = false;
      }
    });
  }

  toggleExpand(id: number) {
    this.operacionExpandida = this.operacionExpandida === id ? null : id;
  }

  constructor(private api: ApiService) {}

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
