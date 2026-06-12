import { MapEngine, CountryAssignment } from './mapEngine';
import { exportMapToPDF } from './pdfExport';

// State Interfaces
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
  private selectedCountryCode = '';

  // Elements
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
  private repsList = document.getElementById('reps-list') as HTMLElement;

  private pdfExportBtn = document.getElementById('pdf-export-btn') as HTMLButtonElement;

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
        const res = await fetch('/api/auth/login', {
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
          alert(data.error || 'Login failed.');
        }
      } catch (err) {
        console.error('Login error:', err);
        alert('Could not connect to backend server.');
      }
    });

    // Handle Logout
    this.logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
      this.role = null;
      this.currentUsernameOrName = '';
      this.loginScreen.style.display = 'flex';
      this.controlPanel.style.display = 'none';
      this.assignPanel.classList.remove('active');
      this.repsCrudPanel.style.display = 'none';
      document.getElementById('map-container')?.classList.remove('admin-mode');
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
        const res = await fetch('/api/admin/assign', {
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
            selectedRep ? selectedRep.color_hex : null
          );
        } else {
          alert(data.error || 'Could not save assignment.');
        }
      } catch (err) {
        console.error('Assignment error:', err);
        alert('Server connection error.');
      }
    });

    // Handle PDF Export
    this.pdfExportBtn.addEventListener('click', async () => {
      const svg = document.querySelector('svg');
      if (!svg) {
        alert('SVG element not found on page.');
        return;
      }

      this.pdfExportBtn.disabled = true;
      const originalText = this.pdfExportBtn.innerHTML;
      this.pdfExportBtn.innerHTML = '...';

      try {
        await exportMapToPDF(svg);
      } catch (err: any) {
        console.error('PDF Export error:', err);
        alert('Failed to generate PDF: ' + err.message);
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
        const res = await fetch('/api/admin/representatives', {
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
          
          this.loadRepresentativesList();
          // Reload dropdown options
          this.fetchRepresentatives();
        } else {
          alert(data.error || 'Failed to create representative.');
        }
      } catch (err) {
        console.error('Create representative error:', err);
        alert('Server connection error.');
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
      alert('Map container error.');
      return;
    }

    if (this.role === 'admin') {
      container.classList.add('admin-mode');
      this.roleTitle.textContent = 'Admin Mode';
      this.userDisplay.textContent = this.currentUsernameOrName;
      this.adminControls.style.display = 'block';
      
      // Initialize map with admin click callback
      this.mapEngine = new MapEngine(svg, container, 'admin', (code, path) => {
        this.openAssignPanel(code, path);
      });

      this.controlPanel.style.display = 'block';
      
      // Load initial lists
      await this.fetchRepresentatives();
      await this.loadMapStateAdmin();
    } else if (this.role === 'representative') {
      container.classList.remove('admin-mode');
      this.roleTitle.textContent = 'Representative';
      this.userDisplay.textContent = this.currentUsernameOrName;
      this.adminControls.style.display = 'none';
      
      this.mapEngine = new MapEngine(svg, container, 'representative');
      this.controlPanel.style.display = 'block';
      
      await this.loadMapStateRepresentative();
    }
  }

  private async fetchRepresentatives(): Promise<void> {
    try {
      const res = await fetch('/api/admin/representatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.representatives = data.representatives;
        
        // Re-populate select dropdown
        this.repSelect.innerHTML = '<option value="0">Unassigned</option>';
        this.representatives.forEach(rep => {
          const opt = document.createElement('option');
          opt.value = rep.id.toString();
          opt.textContent = rep.name;
          this.repSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Fetch representatives error:', err);
    }
  }

  private async loadMapStateAdmin(): Promise<void> {
    try {
      const res = await fetch('/api/map/state');
      const data = await res.json();
      if (res.ok && this.mapEngine) {
        this.mapEngine.updateColors(data.assignments);
      }
    } catch (err) {
      console.error('Load admin map state error:', err);
    }
  }

  private async loadMapStateRepresentative(): Promise<void> {
    try {
      const res = await fetch('/api/representative/state');
      const data = await res.json();
      if (res.ok && this.mapEngine) {
        // Construct standard assignments structure for rendering
        const assignments: CountryAssignment[] = data.assignedCountries.map((code: string) => ({
          country_code: code,
          color_hex: data.colorHex,
          name: data.name
        }));
        this.mapEngine.updateColors(assignments);
      }
    } catch (err) {
      console.error('Load rep map state error:', err);
    }
  }

  private async loadRepresentativesList(): Promise<void> {
    this.repsList.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Loading...</p>';
    await this.fetchRepresentatives();
    
    if (this.representatives.length === 0) {
      this.repsList.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No representatives created.</p>';
      return;
    }

    this.repsList.innerHTML = '';
    this.representatives.forEach(rep => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '8px 0';
      item.style.borderBottom = '1px solid var(--panel-border)';
      
      const details = document.createElement('div');
      details.innerHTML = `<span class="color-swatch" style="background-color: ${rep.color_hex}"></span><strong style="font-size: 14px;">${rep.name}</strong> <span style="font-size: 12px; color: var(--text-muted);">(${rep.representative_code})</span>`;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.width = 'auto';
      deleteBtn.style.padding = '4px 8px';
      deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
      deleteBtn.style.color = 'var(--danger-color)';
      deleteBtn.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      deleteBtn.style.fontSize = '12px';
      deleteBtn.style.borderRadius = '6px';
      
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to delete ${rep.name}?`)) return;
        
        try {
          const res = await fetch('/api/admin/representatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: rep.id })
          });
          
          if (res.ok) {
            this.loadRepresentativesList();
            this.fetchRepresentatives();
            this.loadMapStateAdmin(); // Refresh map assignments since Cascade delete removed them
          } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete representative.');
          }
        } catch (err) {
          console.error('Delete representative error:', err);
        }
      });

      item.appendChild(details);
      item.appendChild(deleteBtn);
      this.repsList.appendChild(item);
    });
  }

  private async openAssignPanel(countryCode: string, path: SVGPathElement): Promise<void> {
    this.selectedCountryCode = countryCode;
    
    // Get country name/display title
    const countryName = path.getAttribute('name') || path.getAttribute('title') || countryCode;
    this.countryTitle.textContent = `${countryName} (${countryCode})`;

    // Check currently assigned representative by checking style fill
    const fillHex = path.style.fill;
    
    if (fillHex) {
      // Find representative by color match (fallback to DB query in production is safer, but quick visual match works)
      // Convert fill color (rgb or hex) to hex for matching
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
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
