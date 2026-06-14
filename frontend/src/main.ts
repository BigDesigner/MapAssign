import { MapEngine } from './mapEngine';
import { exportMapToPNG, LegendItem } from './pdfExport';
import { COUNTRY_NAMES } from './countryNames';

// State Interfaces
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://map-api.akansu.com';

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${path}`;
  init.credentials = 'include';
  return fetch(url, init);
}
interface Representative {
  id: number;
  representative_code: string;
  name: string;
  color_hex: string;
}

class AppController {
  private role: 'admin' | 'representative' | null = null;
  private currentUsernameOrName = '';
  private mapEngine: MapEngine | null = null;
  
  // Cache lists
  private representatives: Representative[] = [];
  private assignments: any[] = [];
  private selectedCountryCode = '';

  // Elements
  private repControls = document.getElementById('rep-controls') as HTMLElement;
  private toggleChangePassBtn = document.getElementById('toggle-change-pass-btn') as HTMLButtonElement;
  private changePassContainer = document.getElementById('change-pass-container') as HTMLElement;
  private changePassForm = document.getElementById('change-pass-form') as HTMLFormElement;

  private repCountriesPanel = document.getElementById('rep-countries-panel') as HTMLElement;
  private repCountriesHeader = document.getElementById('rep-countries-header') as HTMLElement;
  private repCountriesBody = document.getElementById('rep-countries-body') as HTMLElement;
  private repCountriesIcon = document.getElementById('rep-countries-icon') as HTMLElement;
  private repCountriesCount = document.getElementById('rep-countries-count') as HTMLElement;
  private repCountriesList = document.getElementById('rep-countries-list') as HTMLUListElement;

  private loginScreen = document.getElementById('login-screen') as HTMLElement;
  private loginForm = document.getElementById('login-form') as HTMLFormElement;
  private usernameInput = document.getElementById('username') as HTMLInputElement;
  private passwordInput = document.getElementById('password') as HTMLInputElement;
  
  private controlPanel = document.getElementById('control-panel') as HTMLElement;
  private roleTitle = document.getElementById('role-title') as HTMLElement;
  private userDisplay = document.getElementById('user-display') as HTMLElement;
  private adminControls = document.getElementById('admin-controls') as HTMLElement;
  private logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
  
  private assignPanel = document.getElementById('assign-panel') as HTMLElement;
  private countryTitle = document.getElementById('country-title') as HTMLElement;
  private repSelect = document.getElementById('rep-select') as HTMLSelectElement;
  private closeAssignBtn = document.getElementById('close-assign-btn') as HTMLButtonElement;

  private repsCrudPanel = document.getElementById('reps-crud-panel') as HTMLElement;
  private manageRepsBtn = document.getElementById('manage-reps-btn') as HTMLButtonElement;
  private closeRepsBtn = document.getElementById('close-reps-btn') as HTMLButtonElement;
  private createRepForm = document.getElementById('create-rep-form') as HTMLFormElement;
  private adminRepSelect = document.getElementById('admin-rep-select') as HTMLSelectElement;
  private repEditSection = document.getElementById('rep-edit-section') as HTMLElement;
  private repCreateSection = document.getElementById('rep-create-section') as HTMLElement;
  private editRepForm = document.getElementById('edit-rep-form') as HTMLFormElement;
  private editRepCode = document.getElementById('edit-rep-code') as HTMLInputElement;
  private editRepName = document.getElementById('edit-rep-name') as HTMLInputElement;
  private editRepColor = document.getElementById('edit-rep-color') as HTMLInputElement;
  private editRepPass = document.getElementById('edit-rep-pass') as HTMLInputElement;
  private deleteRepBtn = document.getElementById('delete-rep-btn') as HTMLButtonElement;
  private adminAddCountrySelect = document.getElementById('admin-add-country-select') as HTMLSelectElement;
  private adminAddCountryBtn = document.getElementById('admin-add-country-btn') as HTMLButtonElement;
  private repAssignedList = document.getElementById('rep-assigned-list') as HTMLElement;

  private pdfExportBtn = document.getElementById('pdf-export-btn') as HTMLButtonElement;
  private tableViewBtn = document.getElementById('table-view-btn') as HTMLButtonElement;
  private mapLegendContainer = document.getElementById('map-legend-container') as HTMLElement;
  private mapLegendContent = document.getElementById('map-legend-content') as HTMLElement;
  private repName = '';
  private repColor = '';

  constructor() {
    this.initEvents();
  }

  private initEvents(): void {
    // Handle Login
    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameOrCode = this.usernameInput.value.trim();
      const password = this.passwordInput.value;

      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernameOrCode, password })
        });

        const data = await res.json();
        
        if (res.ok) {
          this.role = data.role;
          this.currentUsernameOrName = data.name || usernameOrCode;
          this.bootstrapApp();
        } else {
          alert(data.error || 'Giriş başarısız.');
        }
      } catch (err) {
        console.error('Login error:', err);
        alert('Sunucuya bağlanılamadı.');
      }
    });

    // Handle Logout
    this.logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
      if (this.mapEngine) {
        this.mapEngine.destroy();
        this.mapEngine = null;
      }
      this.role = null;
      this.currentUsernameOrName = '';
      this.loginScreen.style.display = 'flex';
      this.controlPanel.style.display = 'none';
      this.assignPanel.classList.remove('active');
      this.repsCrudPanel.style.display = 'none';
      this.repControls.style.display = 'none';
      this.changePassContainer.style.display = 'none';
      this.repCountriesPanel.style.display = 'none';
      this.changePassForm.reset();
      this.adminRepSelect.value = '0';
      this.repEditSection.style.display = 'none';
      this.repCreateSection.style.display = 'none';
      this.createRepForm.reset();
      this.editRepForm.reset();
      document.getElementById('map-container')?.classList.remove('admin-mode');
      this.mapLegendContainer.style.display = 'none';
    });

    // Toggle Change Password
    this.toggleChangePassBtn.addEventListener('click', () => {
      const isHidden = this.changePassContainer.style.display === 'none';
      this.changePassContainer.style.display = isHidden ? 'block' : 'none';
    });

    // Submit Password Change
    this.changePassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPassword = (document.getElementById('old-pass') as HTMLInputElement).value;
      const newPassword = (document.getElementById('new-pass') as HTMLInputElement).value;

      try {
        const res = await apiFetch('/api/representative/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();
        if (res.ok) {
          alert('Şifre başarıyla güncellendi.');
          this.changePassForm.reset();
          this.changePassContainer.style.display = 'none';
        } else {
          alert(data.error || 'Şifre değiştirilemedi.');
        }
      } catch (err) {
        console.error('Password change error:', err);
        alert('Sunucu bağlantı hatası.');
      }
    });

    // Toggle Assigned Countries Panel
    this.repCountriesHeader.addEventListener('click', () => {
      const isHidden = this.repCountriesBody.style.display === 'none';
      if (isHidden) {
        this.repCountriesBody.style.display = 'block';
        this.repCountriesIcon.style.transform = 'rotate(0deg)';
      } else {
        this.repCountriesBody.style.display = 'none';
        this.repCountriesIcon.style.transform = 'rotate(-90deg)';
      }
    });

    // Handle Close Assign Panel
    this.closeAssignBtn.addEventListener('click', () => {
      this.assignPanel.classList.remove('active');
    });

    // Handle Dropdown Change for Assigning Reps
    this.repSelect.addEventListener('change', async () => {
      if (!this.selectedCountryCode) return;
      
      const repId = parseInt(this.repSelect.value, 10);
      
      try {
        const res = await apiFetch('/api/admin/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_code: this.selectedCountryCode,
            representative_id: repId
          })
        });

        const data = await res.json();
        if (res.ok) {
          // Update local map display color immediately
          const selectedRep = this.representatives.find(r => r.id === repId);
          this.mapEngine?.updateSingleCountryColor(
            this.selectedCountryCode,
            selectedRep ? selectedRep.color_hex : null,
            selectedRep ? selectedRep.name : undefined,
            selectedRep ? selectedRep.id : undefined
          );
        } else {
          alert(data.error || 'Atama kaydedilemedi.');
        }
      } catch (err) {
        console.error('Assignment error:', err);
        alert('Sunucu bağlantı hatası.');
      }
    });

    // Handle PNG Export
    this.pdfExportBtn.addEventListener('click', async () => {
      const svg = document.querySelector('svg');
      if (!svg) {
        alert('Sayfada SVG harita elementi bulunamadı.');
        return;
      }

      this.pdfExportBtn.disabled = true;
      const originalText = this.pdfExportBtn.innerHTML;
      this.pdfExportBtn.innerHTML = '...';

      // Collect current legend items depending on role with counts
      const counts = new Map<string, number>();
      this.assignments.forEach((a: any) => {
        counts.set(a.name, (counts.get(a.name) || 0) + 1);
      });

      let legendItems: LegendItem[] = [];
      if (this.role === 'admin') {
        legendItems = this.representatives.map(r => ({
          name: r.name,
          color_hex: r.color_hex,
          count: counts.get(r.name) || 0
        }));
      } else if (this.role === 'representative' && this.repName) {
        const uniqueRepsMap = new Map<string, { name: string, color_hex: string }>();
        uniqueRepsMap.set(this.repName, { name: this.repName, color_hex: this.repColor });
        
        this.assignments.forEach((a: any) => {
          uniqueRepsMap.set(a.name, { name: a.name, color_hex: a.color_hex });
        });

        legendItems = Array.from(uniqueRepsMap.values()).map(r => ({
          name: r.name,
          color_hex: r.color_hex,
          count: counts.get(r.name) || 0
        }));
      }
      
      // Sort legend items alphabetically to match UI legend
      legendItems.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      try {
        await exportMapToPNG(svg, legendItems);
      } catch (err: any) {
        console.error('PNG Export error:', err);
        alert('PNG resmi oluşturulamadı: ' + err.message);
      } finally {
        this.pdfExportBtn.disabled = false;
        this.pdfExportBtn.innerHTML = originalText;
      }
    });

    // Handle Representatives Panel Toggle
    this.manageRepsBtn.addEventListener('click', () => {
      this.repsCrudPanel.style.display = 'block';
      this.loadRepresentativesList();
    });

    this.closeRepsBtn.addEventListener('click', () => {
      this.repsCrudPanel.style.display = 'none';
    });

    // Handle Create Representative
    this.createRepForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const codeInput = document.getElementById('rep-code') as HTMLInputElement;
      const nameInput = document.getElementById('rep-name') as HTMLInputElement;
      const colorInput = document.getElementById('rep-color') as HTMLInputElement;
      const passInput = document.getElementById('rep-pass') as HTMLInputElement;

      try {
        const res = await apiFetch('/api/admin/representatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            code: codeInput.value,
            name: nameInput.value,
            color: colorInput.value,
            password: passInput.value
          })
        });

        const data = await res.json();
        if (res.ok) {
          codeInput.value = '';
          nameInput.value = '';
          passInput.value = '';
          colorInput.value = '#3b82f6';
          
          await this.loadRepresentativesList();
        } else {
          alert(data.error || 'Temsilci oluşturulamadı.');
        }
      } catch (err) {
        console.error('Create representative error:', err);
        alert('Sunucu bağlantı hatası.');
      }
    });

    // Handle admin rep selection change
    this.adminRepSelect.addEventListener('change', () => {
      const val = this.adminRepSelect.value;
      if (val === '0') {
        this.repEditSection.style.display = 'none';
        this.repCreateSection.style.display = 'none';
      } else if (val === 'new') {
        this.repEditSection.style.display = 'none';
        this.repCreateSection.style.display = 'block';
      } else {
        this.repCreateSection.style.display = 'none';
        this.repEditSection.style.display = 'block';
        this.populateRepresentativeEditForm(parseInt(val, 10));
      }
    });

    // Handle edit representative submit
    this.editRepForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const repId = parseInt(this.adminRepSelect.value, 10);
      if (!repId || isNaN(repId)) return;

      const code = this.editRepCode.value.trim();
      const name = this.editRepName.value.trim();
      const color = this.editRepColor.value;
      const password = this.editRepPass.value;

      try {
        const res = await apiFetch('/api/admin/representatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: repId,
            code,
            name,
            color,
            password: password ? password : undefined
          })
        });

        const data = await res.json();
        if (res.ok) {
          alert('Temsilci başarıyla güncellendi.');
          this.editRepPass.value = '';
          // Reload list and update map colors
          await this.fetchRepresentatives();
          await this.loadMapStateAdmin();
          // Keep selection
          this.adminRepSelect.value = repId.toString();
          this.populateRepresentativeEditForm(repId);
        } else {
          alert(data.error || 'Temsilci güncellenemedi.');
        }
      } catch (err) {
        console.error('Update representative error:', err);
        alert('Sunucu bağlantı hatası.');
      }
    });

    // Handle delete representative click
    this.deleteRepBtn.addEventListener('click', async () => {
      const repId = parseInt(this.adminRepSelect.value, 10);
      if (!repId || isNaN(repId)) return;

      const rep = this.representatives.find(r => r.id === repId);
      if (!rep) return;

      const confirmed = await this.showConfirm(
        'Temsilciyi Sil',
        `${rep.name} isimli temsilciyi silmek istediğinize emin misiniz?`
      );
      if (!confirmed) return;

      try {
        const res = await apiFetch('/api/admin/representatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: repId })
        });

        if (res.ok) {
          alert('Temsilci başarıyla silindi.');
          await this.loadRepresentativesList();
          await this.loadMapStateAdmin(); // Refresh map assignments since Cascade delete removed them
        } else {
          const data = await res.json();
          alert(data.error || 'Temsilci silinemedi.');
        }
      } catch (err) {
        console.error('Delete representative error:', err);
      }
    });

    // Handle assign country to representative
    this.adminAddCountryBtn.addEventListener('click', async () => {
      const repId = parseInt(this.adminRepSelect.value, 10);
      if (!repId || isNaN(repId)) return;

      const countryCode = this.adminAddCountrySelect.value;
      if (!countryCode) {
        alert('Lütfen atanacak bir ülke seçin.');
        return;
      }

      try {
        const res = await apiFetch('/api/admin/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_code: countryCode,
            representative_id: repId
          })
        });

        const data = await res.json();
        if (res.ok) {
          // Update map color immediately
          const rep = this.representatives.find(r => r.id === repId);
          this.mapEngine?.updateSingleCountryColor(
            countryCode,
            rep ? rep.color_hex : null,
            rep ? rep.name : undefined,
            rep ? rep.id : undefined
          );
          // Refresh lists
          this.populateRepresentativeEditForm(repId);
        } else {
          alert(data.error || 'Ülke atanamadı.');
        }
      } catch (err) {
        console.error('Assignment error:', err);
        alert('Sunucu bağlantı hatası.');
      }
    });
  }

  private async bootstrapApp(): Promise<void> {
    // Hide login screen
    this.loginScreen.style.display = 'none';
    this.usernameInput.value = '';
    this.passwordInput.value = '';

    // Initialize map engine
    const svg = document.querySelector('svg');
    const container = document.getElementById('map-container');
    
    if (!svg || !container) {
      alert('Harita sarmalayıcı hatası.');
      return;
    }

    if (this.mapEngine) {
      this.mapEngine.destroy();
      this.mapEngine = null;
    }

    if (this.role === 'admin') {
      container.classList.add('admin-mode');
      this.roleTitle.textContent = 'Yönetici Modu';
      this.userDisplay.textContent = this.currentUsernameOrName;
      this.adminControls.style.display = 'block';
      this.repControls.style.display = 'none';
      this.repCountriesPanel.style.display = 'none';
      
      // Initialize map with admin click callback
      this.mapEngine = new MapEngine(svg, container, 'admin', (code, path) => {
        this.openAssignPanel(code, path);
      });

      this.controlPanel.style.display = 'block';
      if (this.tableViewBtn) this.tableViewBtn.style.display = 'flex';
      
      // Load initial lists
      await this.fetchRepresentatives();
      await this.loadMapStateAdmin();
    } else if (this.role === 'representative') {
      container.classList.remove('admin-mode');
      this.roleTitle.textContent = 'Temsilci';
      this.userDisplay.textContent = this.currentUsernameOrName;
      this.adminControls.style.display = 'none';
      this.repControls.style.display = 'block';
      
      this.mapEngine = new MapEngine(svg, container, 'representative');
      this.controlPanel.style.display = 'block';
      if (this.tableViewBtn) this.tableViewBtn.style.display = 'flex';
      
      await this.loadMapStateRepresentative();
    }
  }

  private async fetchRepresentatives(): Promise<void> {
    try {
      const res = await apiFetch('/api/admin/representatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.representatives = data.representatives;
        
        // Re-populate select dropdowns
        this.repSelect.innerHTML = '<option value="0">Temsilci Atanmamış</option>';
        this.adminRepSelect.innerHTML = `
          <option value="0">-- Temsilci Seçin --</option>
          <option value="new">+ Yeni Temsilci Oluştur</option>
        `;
        this.representatives.forEach(rep => {
          const opt = document.createElement('option');
          opt.value = rep.id.toString();
          opt.textContent = rep.name;
          this.repSelect.appendChild(opt);

          const adminOpt = document.createElement('option');
          adminOpt.value = rep.id.toString();
          adminOpt.textContent = rep.name;
          this.adminRepSelect.appendChild(adminOpt);
        });

        this.updateLegend();
      }
    } catch (err) {
      console.error('Fetch representatives error:', err);
    }
  }

  private async loadMapStateAdmin(): Promise<void> {
    try {
      const res = await apiFetch('/api/map/state');
      const data = await res.json();
      if (res.ok && this.mapEngine) {
        this.assignments = data.assignments || [];
        this.mapEngine.updateColors(this.assignments);
        this.updateLegend();
      }
    } catch (err) {
      console.error('Load admin map state error:', err);
    }
  }

  private async loadMapStateRepresentative(): Promise<void> {
    try {
      // 1. Fetch representative's own state for sidebar
      const repRes = await apiFetch('/api/representative/state');
      const repData = await repRes.json();
      if (!repRes.ok) {
        console.error('Load representative own state failed');
        return;
      }
      this.repName = repData.name;
      this.repColor = repData.colorHex;

      // 2. Fetch all assignments for the map
      const mapRes = await apiFetch('/api/map/state');
      const mapData = await mapRes.json();
      if (mapRes.ok && this.mapEngine) {
        this.assignments = mapData.assignments || [];
        // Render all assignments on the map!
        this.mapEngine.updateColors(this.assignments);
        this.updateLegend();
      }

      // 3. Sort and display assigned countries panel (for representative's own countries)
      if (repData.assignedCountries && repData.assignedCountries.length > 0) {
        this.repCountriesPanel.style.display = 'block';
        this.repCountriesCount.textContent = repData.assignedCountries.length.toString();

        const mappedCountries = repData.assignedCountries.map((code: string) => {
          const lowerCode = code.toLowerCase();
          const fullName = COUNTRY_NAMES[lowerCode] || code.toUpperCase();
          return { code: lowerCode, name: fullName };
        });

        // Sort alphabetically by full name, using Turkish locale collation
        mappedCountries.sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));

        this.repCountriesList.innerHTML = '';
        mappedCountries.forEach((c: any) => {
          const li = document.createElement('li');
          li.style.display = 'flex';
          li.style.justifyContent = 'space-between';
          li.style.alignItems = 'center';
          li.style.padding = '6px 8px';
          li.style.borderRadius = '6px';
          li.style.background = 'rgba(255, 255, 255, 0.02)';
          li.style.border = '1px solid rgba(255, 255, 255, 0.03)';
          li.style.cursor = 'pointer';
          li.style.transition = 'background 0.2s ease, border-color 0.2s ease';

          li.innerHTML = `
            <span style="font-weight: 500;">${c.name}</span>
            <span style="font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px;">${c.code.toUpperCase()}</span>
          `;

          // Hover interactions to highlight path/group
          li.addEventListener('mouseenter', () => {
            li.style.background = 'rgba(255, 255, 255, 0.05)';
            li.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            const el = (document.getElementById(c.code) || document.getElementById(c.code.toUpperCase())) as SVGElement | null;
            if (el) {
              if (el.tagName.toLowerCase() === 'path') {
                (el as SVGPathElement).style.stroke = '#ffffff';
                (el as SVGPathElement).style.strokeWidth = '1.5px';
              } else {
                const subpaths = Array.from(el.querySelectorAll('path')).filter(p => {
                  let parent = p.parentElement;
                  while (parent && (parent as any) !== el) {
                    if (parent.tagName.toLowerCase() === 'g') {
                      const id = parent.id || parent.getAttribute('id') || '';
                      if (id && (id.length === 2 || id.toUpperCase().startsWith('GB-') || id === '_somaliland')) {
                        return false;
                      }
                    }
                    parent = parent.parentElement;
                  }
                  return true;
                });
                subpaths.forEach(p => {
                  p.style.stroke = '#ffffff';
                  p.style.strokeWidth = '1.5px';
                });
              }
            }
          });

          li.addEventListener('mouseleave', () => {
            li.style.background = 'rgba(255, 255, 255, 0.02)';
            li.style.borderColor = 'rgba(255, 255, 255, 0.03)';
            const el = (document.getElementById(c.code) || document.getElementById(c.code.toUpperCase())) as SVGElement | null;
            if (el) {
              if (el.tagName.toLowerCase() === 'path') {
                (el as SVGPathElement).style.stroke = '#334155';
                (el as SVGPathElement).style.strokeWidth = '0.08px';
              } else {
                const subpaths = Array.from(el.querySelectorAll('path')).filter(p => {
                  let parent = p.parentElement;
                  while (parent && (parent as any) !== el) {
                    if (parent.tagName.toLowerCase() === 'g') {
                      const id = parent.id || parent.getAttribute('id') || '';
                      if (id && (id.length === 2 || id.toUpperCase().startsWith('GB-') || id === '_somaliland')) {
                        return false;
                      }
                    }
                    parent = parent.parentElement;
                  }
                  return true;
                });
                subpaths.forEach(p => {
                  p.style.stroke = '#334155';
                  p.style.strokeWidth = '0.08px';
                });
              }
            }
          });

          // Click interaction to pulse path/group
          li.addEventListener('click', () => {
            const el = (document.getElementById(c.code) || document.getElementById(c.code.toUpperCase())) as SVGElement | null;
            if (el && this.mapEngine) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });

              // Pulse effect
              let count = 0;
              const pathsToPulse = el.tagName.toLowerCase() === 'path'
                ? [el as SVGPathElement]
                : Array.from(el.querySelectorAll('path')).filter(p => {
                    let parent = p.parentElement;
                    while (parent && (parent as any) !== el) {
                      if (parent.tagName.toLowerCase() === 'g') {
                        const id = parent.id || parent.getAttribute('id') || '';
                        if (id && (id.length === 2 || id.toUpperCase().startsWith('GB-') || id === '_somaliland')) {
                          return false;
                        }
                      }
                      parent = parent.parentElement;
                    }
                    return true;
                  });
              const originalFills = pathsToPulse.map(p => p.style.fill || '');

              const interval = setInterval(() => {
                pathsToPulse.forEach((p, idx) => {
                  p.style.fill = count % 2 === 0 ? '#ffffff' : originalFills[idx];
                });
                count++;
                if (count > 5) {
                  clearInterval(interval);
                  pathsToPulse.forEach((p, idx) => {
                    p.style.fill = originalFills[idx];
                  });
                }
              }, 200);
            }
          });

          this.repCountriesList.appendChild(li);
        });
      } else {
        this.repCountriesPanel.style.display = 'none';
      }
    } catch (err) {
      console.error('Load rep map state error:', err);
    }
  }

  private async loadRepresentativesList(): Promise<void> {
    await this.fetchRepresentatives();
    this.adminRepSelect.value = '0';
    this.repEditSection.style.display = 'none';
    this.repCreateSection.style.display = 'none';
    this.createRepForm.reset();
    this.editRepForm.reset();
  }

  private async populateRepresentativeEditForm(repId: number): Promise<void> {
    const rep = this.representatives.find(r => r.id === repId);
    if (!rep) return;

    this.editRepCode.value = rep.representative_code;
    this.editRepName.value = rep.name;
    this.editRepColor.value = rep.color_hex;
    this.editRepPass.value = '';

    this.repAssignedList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; margin: 4px 0;">Loading assignments...</p>';

    try {
      const res = await apiFetch('/api/map/state');
      const data = await res.json();
      if (res.ok) {
        this.assignments = data.assignments || [];
        this.updateLegend();
        
        const allAssignments = this.assignments as Array<{
          country_code: string;
          representative_id: number;
          name: string;
          color_hex: string;
        }>;

        const assignedToThisRep = allAssignments.filter(a => a.representative_id === repId);
        
        this.repAssignedList.innerHTML = '';
        if (assignedToThisRep.length === 0) {
          this.repAssignedList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; font-style: italic; margin: 4px 0;">No countries assigned.</p>';
        } else {
          const mapped = assignedToThisRep.map(a => {
            const code = a.country_code.toLowerCase();
            const name = COUNTRY_NAMES[code] || a.name || code.toUpperCase();
            return { code, name };
          });
          mapped.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

          mapped.forEach(c => {
            const item = document.createElement('div');
            item.className = 'assigned-country-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'flex-start';
            item.style.gap = '8px';
            item.style.alignItems = 'center';
            item.style.padding = '6px 0';
            item.style.borderBottom = '1px solid rgba(255, 255, 255, 0.03)';

            const label = document.createElement('span');
            label.style.fontSize = '13px';
            label.textContent = `${c.name} (${c.code})`;

            const unassignBtn = document.createElement('button');
            unassignBtn.textContent = '-';
            unassignBtn.style.width = '20px';
            unassignBtn.style.height = '20px';
            unassignBtn.style.flexShrink = '0';
            unassignBtn.style.padding = '0';
            unassignBtn.style.background = 'rgba(239, 68, 68, 0.1)';
            unassignBtn.style.color = 'var(--danger-color)';
            unassignBtn.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            unassignBtn.style.borderRadius = '50%';
            unassignBtn.style.fontSize = '12px';
            unassignBtn.style.cursor = 'pointer';

            unassignBtn.addEventListener('click', async () => {
              try {
                const assignRes = await apiFetch('/api/admin/assign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    country_code: c.code,
                    representative_id: 0
                  })
                });

                if (assignRes.ok) {
                  this.mapEngine?.updateSingleCountryColor(c.code, null);
                  this.populateRepresentativeEditForm(repId);
                } else {
                  alert('Ülke ataması kaldırılamadı.');
                }
              } catch (err) {
                console.error(err);
              }
            });

            item.appendChild(unassignBtn);
            item.appendChild(label);
            this.repAssignedList.appendChild(item);
          });
        }

        const assignedCodes = new Set(assignedToThisRep.map(a => a.country_code.toLowerCase()));
        this.adminAddCountrySelect.innerHTML = '<option value="">-- Ülke Seçin --</option>';
        
        const allCountries = Object.keys(COUNTRY_NAMES)
          .filter(code => code !== 'gb')
          .map(code => ({
            code,
            name: COUNTRY_NAMES[code]
          }));
        allCountries.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        allCountries.forEach(c => {
          if (!assignedCodes.has(c.code)) {
            const otherAssign = allAssignments.find(a => a.country_code.toLowerCase() === c.code);
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = otherAssign 
              ? `${c.name} (${otherAssign.name} temsilcisine atanmış)`
              : c.name;
            this.adminAddCountrySelect.appendChild(opt);
          }
        });
      }
    } catch (err) {
      console.error('Error populating representative edit form:', err);
    }
  }

  private async openAssignPanel(countryCode: string, path: SVGElement): Promise<void> {
    this.selectedCountryCode = countryCode;
    
    // Get country name/display title from COUNTRY_NAMES mapping
    const countryName = COUNTRY_NAMES[countryCode.toLowerCase()] || countryCode;
    this.countryTitle.textContent = `${countryName} (${countryCode})`;

    // Check currently assigned representative by checking style fill (check group child path if needed)
    let fillHex = '';
    if (path.tagName.toLowerCase() === 'path') {
      fillHex = (path as SVGPathElement).style.fill;
    } else {
      const firstPath = path.querySelector('path');
      if (firstPath) {
        fillHex = firstPath.style.fill;
      }
    }
    
    if (fillHex) {
      // Find representative by color match
      const hex = this.rgbToHex(fillHex) || fillHex;
      const matchedRep = this.representatives.find(r => r.color_hex.toLowerCase() === hex.toLowerCase());
      if (matchedRep) {
        this.repSelect.value = matchedRep.id.toString();
      } else {
        this.repSelect.value = '0';
      }
    } else {
      this.repSelect.value = '0';
    }

    // Position panel near clicked mouse location or floating center
    this.assignPanel.classList.add('active');
    
    // Center alignment or positioned
    this.assignPanel.style.left = '16px';
    this.assignPanel.style.bottom = '16px';
  }

  private rgbToHex(rgbStr: string): string | null {
    if (!rgbStr.startsWith('rgb')) return null;
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return null;
    const r = parseInt(match[0], 10);
    const g = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  private updateLegend(): void {
    if (!this.mapLegendContent) return;
    
    // Group assignments by representative name/id to count countries
    const counts = new Map<string, number>();
    this.assignments.forEach((a: any) => {
      counts.set(a.name, (counts.get(a.name) || 0) + 1);
    });

    let legendItems: { name: string; color_hex: string; count: number }[] = [];

    if (this.role === 'admin') {
      legendItems = this.representatives.map(r => ({
        name: r.name,
        color_hex: r.color_hex,
        count: counts.get(r.name) || 0
      }));
    } else if (this.role === 'representative') {
      const uniqueRepsMap = new Map<string, { name: string, color_hex: string }>();
      // Always include own representative
      if (this.repName) {
        uniqueRepsMap.set(this.repName, { name: this.repName, color_hex: this.repColor });
      }
      
      this.assignments.forEach((a: any) => {
        uniqueRepsMap.set(a.name, { name: a.name, color_hex: a.color_hex });
      });

      legendItems = Array.from(uniqueRepsMap.values()).map(r => ({
        name: r.name,
        color_hex: r.color_hex,
        count: counts.get(r.name) || 0
      }));
    }

    this.updateLegendUI(legendItems);
  }

  private updateLegendUI(items: { name: string; color_hex: string; count?: number }[]): void {
    if (!this.mapLegendContent) return;
    this.mapLegendContent.innerHTML = '';
    
    if (items.length > 0) {
      this.mapLegendContainer.style.display = 'flex';
      
      // Sort items alphabetically by name
      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      sorted.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'legend-item';
        
        const dotSpan = document.createElement('span');
        dotSpan.className = 'legend-dot';
        dotSpan.style.backgroundColor = item.color_hex;
        
        const nameSpan = document.createElement('span');
        const count = item.count !== undefined ? item.count : 0;
        nameSpan.textContent = `${item.name} (${count})`;
        
        itemDiv.appendChild(dotSpan);
        itemDiv.appendChild(nameSpan);
        this.mapLegendContent.appendChild(itemDiv);
      });
    } else {
      this.mapLegendContainer.style.display = 'none';
    }
  }

  private showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal') as HTMLElement;
      const titleEl = document.getElementById('confirm-modal-title') as HTMLElement;
      const msgEl = document.getElementById('confirm-modal-message') as HTMLElement;
      const cancelBtn = document.getElementById('confirm-modal-cancel') as HTMLButtonElement;
      const confirmBtn = document.getElementById('confirm-modal-confirm') as HTMLButtonElement;

      titleEl.textContent = title;
      msgEl.textContent = message;
      modal.style.display = 'flex';
      modal.offsetHeight; // reflow
      modal.classList.add('active');

      const cleanup = (value: boolean) => {
        modal.classList.remove('active');
        setTimeout(() => {
          modal.style.display = 'none';
        }, 200);
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
        resolve(value);
      };

      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);

      cancelBtn.addEventListener('click', onCancel);
      confirmBtn.addEventListener('click', onConfirm);
    });
  }
}

// Start application
window.addEventListener('DOMContentLoaded', async () => {
  // Asenkron olarak SVG haritasını yükle ve map-container'a yerleştir
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    try {
      const res = await fetch('/world-states.svg');
      if (res.ok) {
        mapContainer.innerHTML = await res.text();
      } else {
        console.error('Failed to load world map SVG:', res.statusText);
      }
    } catch (err) {
      console.error('Error loading world map SVG:', err);
    }
  }

  const app = new AppController();
  // Try to restore session from existing cookie
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json() as { role: string; name: string };
      (app as any).role = data.role as 'admin' | 'representative';
      (app as any).currentUsernameOrName = data.name;
      await (app as any).bootstrapApp();
    }
    // If 401 → session expired, stay on login screen
  } catch {
    // Network error → stay on login screen
  }
});
