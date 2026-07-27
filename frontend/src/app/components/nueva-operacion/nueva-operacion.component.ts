import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Operacion, TasasResponse } from '../../services/api.service';

@Component({
  selector: 'app-nueva-operacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nueva-operacion.component.html',
  styleUrls: ['./nueva-operacion.component.css']
})
export class NuevaOperacionComponent implements OnInit {
  montoUSD: number = 100;
  tasaBcv: number | null = null;
  tasaBinance: number | null = null;
  fechaOperacion: string = new Date().toISOString().split('T')[0];
  usarTasasAuto = true;
  fotoCompra: string | null = null;
  fotoCompraNombre: string = '';

  tasasActuales: TasasResponse | null = null;
  resultado: Operacion | null = null;
  loading = false;
  error = '';

  montosSugeridos = [10, 25, 50, 100, 200, 500, 1000];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarTasasAuto();
  }

  cargarTasasAuto() {
    this.api.getTasas().subscribe({
      next: (data) => {
        this.tasasActuales = data;
        if (this.usarTasasAuto) {
          this.tasaBcv = data.tasas.bcv.tasa;
          this.tasaBinance = data.tasas.binance_p2p.tasa;
        }
      },
      error: () => {}
    });
  }

  setTasasAutomaticas() {
    this.usarTasasAuto = true;
    if (this.tasasActuales) {
      this.tasaBcv = this.tasasActuales.tasas.bcv.tasa;
      this.tasaBinance = this.tasasActuales.tasas.binance_p2p.tasa;
    } else {
      this.cargarTasasAuto();
    }
  }

  setTasasManuales() {
    this.usarTasasAuto = false;
  }

  onFileSelected(event: Event, tipo: 'compra' | 'venta') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Validar tamaño máximo 5MB
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'La imagen no puede superar 5MB';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (tipo === 'compra') {
          this.fotoCompra = reader.result as string;
          this.fotoCompraNombre = file.name;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  quitarFoto(tipo: 'compra' | 'venta') {
    if (tipo === 'compra') {
      this.fotoCompra = null;
      this.fotoCompraNombre = '';
    }
  }

  setMonto(monto: number) {
    this.montoUSD = monto;
  }

  calcular() {
    if (!this.montoUSD || this.montoUSD <= 0) {
      this.error = 'Ingresa un monto válido en USD';
      return;
    }
    if (!this.tasaBcv || this.tasaBcv <= 0) {
      this.error = 'Ingresa la tasa BCV';
      return;
    }
    if (!this.tasaBinance || this.tasaBinance <= 0) {
      this.error = 'Ingresa la tasa Binance';
      return;
    }

    this.loading = true;
    this.error = '';
    this.resultado = null;

    const bcvManual = this.usarTasasAuto ? undefined : this.tasaBcv;
    const binanceManual = this.usarTasasAuto ? undefined : this.tasaBinance;

    this.api.crearOperacion(
      this.montoUSD,
      bcvManual ?? undefined,
      binanceManual ?? undefined,
      this.fechaOperacion,
      this.fotoCompra ?? undefined
    ).subscribe({
      next: (res) => {
        this.resultado = res.operacion;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Error al crear la operación';
        this.loading = false;
      }
    });
  }

  nuevaOperacion() {
    this.resultado = null;
    this.error = '';
  }
}
