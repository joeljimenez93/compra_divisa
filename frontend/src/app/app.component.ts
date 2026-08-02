import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { NuevaOperacionComponent } from './components/nueva-operacion/nueva-operacion.component';
import { HistorialComponent } from './components/historial/historial.component';
import { ConfiguracionComponent } from './components/configuracion/configuracion.component';
import { LoginComponent } from './components/login/login.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { AuthService, Usuario } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, NuevaOperacionComponent, HistorialComponent, ConfiguracionComponent, LoginComponent, AdminPanelComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Compra/Venta USD - BCV → Zinli → Binance';
  activeTab: 'dashboard' | 'nueva' | 'historial' | 'config' | 'admin' = 'dashboard';
  usuario: Usuario | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.usuario$.subscribe(u => this.usuario = u);
    // Verificar token al iniciar - si expiró, redirigir al login
    if (this.auth.isLoggedIn) {
      this.auth.verificarToken().subscribe({
        error: () => {
          console.log('Token expirado o inválido, cerrando sesión');
          this.auth.logout();
        }
      });
    }
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin;
  }

  setTab(tab: 'dashboard' | 'nueva' | 'historial' | 'config' | 'admin') {
    this.activeTab = tab;
  }

  logout() {
    this.auth.logout();
  }
}
