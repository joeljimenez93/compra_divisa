import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, TasasResponse } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  tasas: TasasResponse | null = null;
  loading = true;
  error = '';
  montoSimulacion = 100;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarTasas();
  }

  cargarTasas() {
    this.loading = true;
    this.error = '';
    this.api.getTasas().subscribe({
      next: (data) => {
        this.tasas = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al conectar con el backend. Asegúrate de que esté corriendo en puerto 3000.';
        this.loading = false;
      }
    });
  }

  get gananciaClass(): string {
    if (!this.tasas) return '';
    return this.tasas.ejemplo_100usd.ganancia_bs > 0 ? 'positivo' : 'negativo';
  }
}
