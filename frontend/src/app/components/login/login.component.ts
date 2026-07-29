import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  modo: 'login' | 'registro' = 'login';
  nombre = '';
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(private auth: AuthService) {}

  toggleModo() {
    this.modo = this.modo === 'login' ? 'registro' : 'login';
    this.error = '';
  }

  submit() {
    if (!this.email || !this.password) {
      this.error = 'Completa todos los campos';
      return;
    }

    this.loading = true;
    this.error = '';

    const req = this.modo === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.registro(this.nombre, this.email, this.password);

    req.subscribe({
      next: () => {
        this.loading = false;
        window.location.reload();
      },
      error: (err) => {
        this.loading = false;
        console.error('Login error:', err);
        if (err.status === 0 || !err.status) {
          this.error = '❌ Error de conexión. Verifica tu internet.';
        } else if (err.status === 401) {
          this.error = '❌ Credenciales inválidas';
        } else if (err.status === 409) {
          this.error = '❌ El email ya está registrado';
        } else {
          this.error = err.error?.error || '❌ Error al iniciar sesión';
        }
      }
    });
  }
}
