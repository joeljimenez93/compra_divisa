import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService, Config } from '../../services/api.service';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css']
})
export class ConfiguracionComponent implements OnInit {
  config: Config | null = null;
  loading = true;
  guardando = false;
  mensaje = '';
  error = '';

  // Form values
  comisionZinli: number = 2.5;
  comisionDivisas: number = 0.5;
  tasaBcvManual: number | null = null;
  tasaBinanceManual: number | null = null;

  // Password change
  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';
  cambiandoPassword = false;
  mensajePass = '';
  errorPass = '';

  constructor(private api: ApiService, private http: HttpClient) {}

  ngOnInit() {
    this.cargarConfig();
  }

  cargarConfig() {
    this.loading = true;
    this.api.getConfig().subscribe({
      next: (res) => {
        this.config = res.config;
        this.comisionZinli = res.config.comision_zinli_porcentaje;
        this.comisionDivisas = res.config.comision_divisas_porcentaje || 0.5;
        this.tasaBcvManual = res.config.tasa_bcv_manual;
        this.tasaBinanceManual = res.config.tasa_binance_manual;
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar configuración';
        this.loading = false;
      }
    });
  }

  guardar() {
    this.guardando = true;
    this.mensaje = '';
    this.error = '';

    this.api.updateConfig({
      comision_zinli_porcentaje: this.comisionZinli,
      comision_divisas_porcentaje: this.comisionDivisas,
      tasa_bcv_manual: this.tasaBcvManual,
      tasa_binance_manual: this.tasaBinanceManual
    }).subscribe({
      next: (res) => {
        this.config = res.config;
        this.guardando = false;
        this.mensaje = '✅ Configuración guardada correctamente';
        setTimeout(() => this.mensaje = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Error al guardar';
        this.guardando = false;
      }
    });
  }

  limpiarTasasManuales() {
    this.tasaBcvManual = null;
    this.tasaBinanceManual = null;
  }

  cambiarPassword() {
    this.mensajePass = '';
    this.errorPass = '';

    if (!this.passwordActual || !this.passwordNueva || !this.passwordConfirmar) {
      this.errorPass = 'Completa todos los campos';
      return;
    }
    if (this.passwordNueva.length < 4) {
      this.errorPass = 'La nueva contraseña debe tener al menos 4 caracteres';
      return;
    }
    if (this.passwordNueva !== this.passwordConfirmar) {
      this.errorPass = 'Las contraseñas no coinciden';
      return;
    }

    this.cambiandoPassword = true;
    this.http.put('http://localhost:3000/api/auth/password', {
      password_actual: this.passwordActual,
      password_nueva: this.passwordNueva
    }).subscribe({
      next: () => {
        this.mensajePass = '✅ Contraseña actualizada correctamente';
        this.passwordActual = '';
        this.passwordNueva = '';
        this.passwordConfirmar = '';
        this.cambiandoPassword = false;
        setTimeout(() => this.mensajePass = '', 3000);
      },
      error: (err) => {
        this.errorPass = err.error?.error || 'Error al cambiar contraseña';
        this.cambiandoPassword = false;
      }
    });
  }
}
