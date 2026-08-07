import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  creado: string;
}

const API = '/api';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit {
  usuarios: UsuarioAdmin[] = [];
  loading = true;
  error = '';
  mensaje = '';
  editandoId: number | null = null;
  editRol: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading = true;
    this.http.get<{ ok: boolean; usuarios: UsuarioAdmin[] }>(`${API}/admin/usuarios`).subscribe({
      next: (res) => {
        this.usuarios = res.usuarios;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Error al cargar usuarios';
        this.loading = false;
      }
    });
  }

  editarUsuario(u: UsuarioAdmin) {
    this.editandoId = u.id;
    this.editRol = u.rol;
    this.mensaje = '';
  }

  cancelarEdicion() {
    this.editandoId = null;
  }

  guardarRol(u: UsuarioAdmin) {
    const nuevoRol = this.editRol === 'admin' ? 'user' : 'admin';
    this.http.put(`${API}/admin/usuarios/${u.id}`, { rol: nuevoRol }).subscribe({
      next: () => {
        this.editandoId = null;
        this.mensaje = `✅ Rol de ${u.nombre} actualizado a ${nuevoRol}`;
        this.cargar();
        setTimeout(() => this.mensaje = '', 3000);
      },
      error: (err) => {
        this.mensaje = '❌ ' + (err.error?.error || 'Error');
        setTimeout(() => this.mensaje = '', 3000);
      }
    });
  }

  getRolBadge(rol: string): string {
    return rol === 'admin' ? '🔑 Admin' : '👤 Usuario';
  }

  getRolClass(rol: string): string {
    return rol === 'admin' ? 'admin' : 'user';
  }

  descargarDatos() {
    this.http.get(`${API}/admin/export`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compra-dolares-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.mensaje = '📥 Datos descargados correctamente';
        setTimeout(() => this.mensaje = '', 3000);
      },
      error: (err) => {
        this.mensaje = '❌ Error al descargar: ' + (err.error?.error || err.message);
        setTimeout(() => this.mensaje = '', 3000);
      }
    });
  }

  importando = false;

  importarDatos(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    if (!file.name.endsWith('.json')) {
      this.mensaje = '❌ Solo se permiten archivos .json';
      setTimeout(() => this.mensaje = '', 3000);
      return;
    }

    if (!confirm(`¿Restaurar datos desde "${file.name}"?\n\n⚠️ Esto REEMPLAZARÁ todas las operaciones y configuración actuales.`)) {
      input.value = '';
      return;
    }

    this.importando = true;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const datos = JSON.parse(reader.result as string);
        this.http.post(`${API}/admin/import`, datos).subscribe({
          next: (res: any) => {
            this.importando = false;
            this.mensaje = res.mensaje || '✅ Datos restaurados correctamente';
            this.cargar();
            setTimeout(() => this.mensaje = '', 5000);
            input.value = '';
          },
          error: (err) => {
            this.importando = false;
            this.mensaje = '❌ ' + (err.error?.error || 'Error al importar');
            setTimeout(() => this.mensaje = '', 5000);
            input.value = '';
          }
        });
      } catch {
        this.importando = false;
        this.mensaje = '❌ El archivo no es un JSON válido';
        setTimeout(() => this.mensaje = '', 3000);
        input.value = '';
      }
    };
    reader.readAsText(file);
  }
}
