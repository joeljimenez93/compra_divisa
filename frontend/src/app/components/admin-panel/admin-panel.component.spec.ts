import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPanelComponent } from './admin-panel.component';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';

describe('AdminPanelComponent', () => {

  let component: AdminPanelComponent;
  let fixture: ComponentFixture<AdminPanelComponent>;
  let httpTesting: HttpTestingController;

  const usuariosMock = [
    { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin', creado: '2026-01-01T00:00:00Z' },
    { id: 2, nombre: 'User', email: 'user@test.com', rol: 'user', creado: '2026-02-01T00:00:00Z' },
    { id: 3, nombre: 'Other', email: 'other@test.com', rol: 'user', creado: '2026-03-01T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPanelComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  // ──────────────────────────────────────────────────────
  // 1. Inicialización y carga de usuarios
  // ──────────────────────────────────────────────────────

  describe('cargar()', () => {

    it('debe cargar usuarios al iniciar', () => {
      expect(component.loading).toBeTrue();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/admin/usuarios');
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, usuarios: usuariosMock });

      expect(component.loading).toBeFalse();
      expect(component.usuarios.length).toBe(3);
      expect(component.usuarios[0].email).toBe('admin@test.com');
    });

    it('debe manejar error al cargar usuarios', () => {
      fixture.detectChanges();
      const req = httpTesting.expectOne('/api/admin/usuarios');
      req.flush({ error: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });

      expect(component.error).toContain('Token inválido');
      expect(component.loading).toBeFalse();
    });
  });

  // ──────────────────────────────────────────────────────
  // 2. getRolBadge()
  // ──────────────────────────────────────────────────────

  describe('getRolBadge()', () => {

    it('debe retornar badge de admin', () => {
      expect(component.getRolBadge('admin')).toBe('🔑 Admin');
    });

    it('debe retornar badge de usuario', () => {
      expect(component.getRolBadge('user')).toBe('👤 Usuario');
    });
  });

  // ──────────────────────────────────────────────────────
  // 3. getRolClass()
  // ──────────────────────────────────────────────────────

  describe('getRolClass()', () => {

    it('debe retornar "admin" para rol admin', () => {
      expect(component.getRolClass('admin')).toBe('admin');
    });

    it('debe retornar "user" para rol usuario', () => {
      expect(component.getRolClass('user')).toBe('user');
    });
  });

  // ──────────────────────────────────────────────────────
  // 4. editarUsuario() y cancelarEdicion()
  // ──────────────────────────────────────────────────────

  describe('editarUsuario() / cancelarEdicion()', () => {

    it('debe activar modo edición para un usuario', () => {
      const u = usuariosMock[1];
      component.editarUsuario(u);
      expect(component.editandoId).toBe(2);
      expect(component.editRol).toBe('user');
      expect(component.mensaje).toBe('');
    });

    it('debe cancelar edición', () => {
      component.editandoId = 2;
      component.editRol = 'admin';
      component.cancelarEdicion();
      expect(component.editandoId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────
  // 5. guardarRol()
  // ──────────────────────────────────────────────────────

  describe('guardarRol()', () => {

    beforeEach(() => {
      fixture.detectChanges();
      const req = httpTesting.expectOne('/api/admin/usuarios');
      req.flush({ ok: true, usuarios: usuariosMock });
    });

    it('debe cambiar rol de user a admin', () => {
      const u = { ...usuariosMock[1] };
      component.editRol = 'user'; // rol actual es user → cambiará a admin
      component.guardarRol(u);

      const req = httpTesting.expectOne('/api/admin/usuarios/2');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.rol).toBe('admin');
      req.flush({ ok: true, mensaje: 'Rol actualizado a admin' });

      // guardarRol llama a cargar() después del éxito
      const reqCarga = httpTesting.expectOne('/api/admin/usuarios');
      reqCarga.flush({ ok: true, usuarios: usuariosMock });

      expect(component.editandoId).toBeNull();
      expect(component.mensaje).toContain('actualizado');
    });

    it('debe cambiar rol de admin a user', () => {
      const u = { ...usuariosMock[0], rol: 'admin' };
      component.editRol = 'admin'; // rol actual → cambiará a user
      component.guardarRol(u);

      const req = httpTesting.expectOne('/api/admin/usuarios/1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.rol).toBe('user');
      req.flush({ ok: true, mensaje: 'Rol actualizado a user' });

      // guardarRol llama a cargar() después del éxito
      const reqCarga = httpTesting.expectOne('/api/admin/usuarios');
      reqCarga.flush({ ok: true, usuarios: usuariosMock });

      expect(component.editandoId).toBeNull();
    });

    it('debe manejar error al guardar rol', () => {
      const u = { ...usuariosMock[1] };
      component.guardarRol(u);

      const req = httpTesting.expectOne('/api/admin/usuarios/2');
      req.flush({ error: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });

      // Al fallar NO se llama a cargar()
      expect(component.mensaje).toContain('No autorizado');
    });
  });

  // ──────────────────────────────────────────────────────
  // 6. descargarDatos()
  // ──────────────────────────────────────────────────────

  describe('descargarDatos()', () => {

    beforeEach(() => {
      fixture.detectChanges();
      const req = httpTesting.expectOne('/api/admin/usuarios');
      req.flush({ ok: true, usuarios: usuariosMock });
    });

    it('debe llamar al endpoint de export con responseType blob', () => {
      // Espiar createObjectURL y el click
      const createObjectURLSpy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:test');
      const revokeObjectURLSpy = spyOn(window.URL, 'revokeObjectURL');
      const clickSpy = jasmine.createSpy('click');
      const appendChildSpy = spyOn(document.body, 'appendChild').and.callFake((el: any) => {
        el.click = clickSpy;
        return el;
      });
      const removeChildSpy = spyOn(document.body, 'removeChild');

      component.descargarDatos();

      const req = httpTesting.expectOne('/api/admin/export');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');

      const blob = new Blob([JSON.stringify({ test: true })], { type: 'application/json' });
      req.flush(blob);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(component.mensaje).toContain('descargados');
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
    });

    it('debe manejar error en la descarga', () => {
      component.descargarDatos();

      const req = httpTesting.expectOne('/api/admin/export');
      // Para responseType: 'blob', el error se pasa como objeto de error de red
      req.error(new ProgressEvent('error', { lengthComputable: false }));

      expect(component.mensaje).toContain('Error');
    });
  });

  // ──────────────────────────────────────────────────────
  // 7. Integración: flujo completo
  // ──────────────────────────────────────────────────────

  describe('Flujo completo', () => {

    it('debe cargar usuarios, editar rol y descargar datos', () => {
      // Cargar usuarios
      fixture.detectChanges();
      let req = httpTesting.expectOne('/api/admin/usuarios');
      req.flush({ ok: true, usuarios: usuariosMock });
      expect(component.usuarios.length).toBe(3);

      // Editar usuario
      component.editarUsuario(usuariosMock[2]);
      expect(component.editandoId).toBe(3);

      // Cancelar
      component.cancelarEdicion();
      expect(component.editandoId).toBeNull();

      // Descargar
      const spy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:xyz');
      const clickSpy = jasmine.createSpy('click');
      spyOn(document.body, 'appendChild').and.callFake((el: any) => {
        el.click = clickSpy;
        return el;
      });
      spyOn(document.body, 'removeChild');
      spyOn(window.URL, 'revokeObjectURL');

      component.descargarDatos();
      req = httpTesting.expectOne('/api/admin/export');
      req.flush(new Blob(['{"ok":true}'], { type: 'application/json' }));

      expect(clickSpy).toHaveBeenCalled();
      expect(component.mensaje).toContain('descargados');
    });
  });
});
