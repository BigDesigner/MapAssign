import { COUNTRY_NAMES } from './countryNames';

export interface CountryAssignment {
  country_code: string;
  representative_id: number;
  name: string;
  color_hex: string;
}

export class MapEngine {
  private svg: SVGSVGElement;
  private container: HTMLElement;
  private role: 'admin' | 'representative';
  private onCountryClick?: (countryCode: string, targetPath: SVGElement) => void;

  // ViewBox State
  private vbX = 30.767;
  private vbY = 241.591;
  private vbW = 784.077;
  private vbH = 458.627;

  // Interaction State
  private isPointerDown = false;
  private pointerOrigin = { x: 0, y: 0 };
  private viewBoxOrigin = { x: 0, y: 0 };
  private activePointers: Map<number, PointerEvent> = new Map();
  private lastPinchDistance = 0;

  // Tooltip & Cache
  private tooltip!: HTMLElement;
  private assignmentsMap: Map<string, CountryAssignment> = new Map();

  constructor(
    svg: SVGSVGElement,
    container: HTMLElement,
    role: 'admin' | 'representative',
    onCountryClick?: (countryCode: string, targetPath: SVGElement) => void
  ) {
    this.svg = svg;
    this.container = container;
    this.role = role;
    this.onCountryClick = onCountryClick;

    // Clear browser default title tooltip
    this.svg.querySelector('title')?.remove();

    // Create custom floating tooltip
    this.initTooltip();

    // Read initial viewBox if present
    const vb = this.svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.split(/\s+/).map(Number);
      if (parts.length === 4) {
        [this.vbX, this.vbY, this.vbW, this.vbH] = parts;
      }
    }

    this.initEvents();
  }

  private getCountryInfo(pathElement: SVGPathElement): { code: string; element: SVGElement } | null {
    let code = pathElement.id || pathElement.getAttribute('id') || '';
    let element: SVGElement = pathElement;

    // Check parent group if path doesn't have ID
    if (!code && pathElement.parentElement) {
      const parent = pathElement.parentElement;
      if (parent.tagName.toLowerCase() === 'g') {
        code = parent.id || parent.getAttribute('id') || '';
        element = parent as unknown as SVGElement;
      }
    }

    if (code && (!code.startsWith('_') || code === '_somaliland')) {
      return { code: code.toUpperCase(), element };
    }
    return null;
  }

  private initTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'map-tooltip';
    this.tooltip.style.position = 'fixed';
    this.tooltip.style.display = 'none';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
    this.tooltip.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    this.tooltip.style.borderRadius = '8px';
    this.tooltip.style.padding = '8px 12px';
    this.tooltip.style.fontSize = '13px';
    this.tooltip.style.color = '#f8fafc';
    this.tooltip.style.zIndex = '10000';
    this.tooltip.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.5)';
    this.tooltip.style.backdropFilter = 'blur(8px)';
    this.tooltip.style.transition = 'opacity 0.1s ease';
    this.tooltip.style.opacity = '0';
    document.body.appendChild(this.tooltip);
  }

  private initEvents(): void {
    // Hover Tooltips on country paths
    this.svg.addEventListener('pointerover', (e) => {
      const target = e.target as SVGElement;
      const pathElement = target.closest('path');
      if (pathElement) {
        const countryInfo = this.getCountryInfo(pathElement);
        if (countryInfo) {
          const { code } = countryInfo;
          const countryName = COUNTRY_NAMES[code.toLowerCase()] || code;
          const assignment = this.assignmentsMap.get(code);
          
          let content = `<div style="font-weight: 700; font-size: 14px;">${countryName}</div>`;
          if (assignment) {
            content += `<div style="margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8;">
              <span class="color-swatch" style="background-color: ${assignment.color_hex}; width: 10px; height: 10px; border-radius: 2px; display: inline-block; border: 1px solid rgba(255,255,255,0.2); margin-right: 0;"></span>
              <span>${assignment.name}</span>
            </div>`;
          } else {
            content += `<div style="margin-top: 4px; font-size: 12px; color: #64748b;">Unassigned</div>`;
          }
          
          this.tooltip.innerHTML = content;
          this.tooltip.style.display = 'block';
          this.tooltip.offsetHeight; // force reflow
          this.tooltip.style.opacity = '1';
        }
      }
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (this.tooltip.style.display === 'block') {
        const tooltipWidth = this.tooltip.clientWidth;
        const tooltipHeight = this.tooltip.clientHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = e.clientX + 15;
        let top = e.clientY + 15;

        // Prevent tooltip from going off the right side
        if (left + tooltipWidth > viewportWidth) {
          left = e.clientX - tooltipWidth - 15;
        }

        // Prevent tooltip from going off the bottom
        if (top + tooltipHeight > viewportHeight) {
          top = e.clientY - tooltipHeight - 15;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
      }
    });

    this.svg.addEventListener('pointerout', (e) => {
      const target = e.target as SVGElement;
      const pathElement = target.closest('path');
      if (pathElement) {
        this.tooltip.style.opacity = '0';
        this.tooltip.style.display = 'none';
      }
    });

    // Pointer Down (Mouse, Touch, Pen)
    this.container.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, e);
      
      if (this.activePointers.size === 1) {
        this.isPointerDown = true;
        this.pointerOrigin.x = e.clientX;
        this.pointerOrigin.y = e.clientY;
        this.viewBoxOrigin.x = this.vbX;
        this.viewBoxOrigin.y = this.vbY;
      } else if (this.activePointers.size === 2) {
        // Prepare pinch-to-zoom
        const pointers = Array.from(this.activePointers.values());
        this.lastPinchDistance = this.getDistance(pointers[0], pointers[1]);
      }
      this.container.setPointerCapture(e.pointerId);
    });

    // Pointer Move
    this.container.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, e);

      if (this.activePointers.size === 1 && this.isPointerDown) {
        // Pan
        const dx = e.clientX - this.pointerOrigin.x;
        const dy = e.clientY - this.pointerOrigin.y;
        
        // Scale panning speed based on ratio between SVG viewBox width and container element width
        const scaleX = this.vbW / this.container.clientWidth;
        const scaleY = this.vbH / this.container.clientHeight;

        this.vbX = this.viewBoxOrigin.x - dx * scaleX;
        this.vbY = this.viewBoxOrigin.y - dy * scaleY;
        this.updateViewBox();
      } else if (this.activePointers.size === 2) {
        // Pinch Zoom
        const pointers = Array.from(this.activePointers.values());
        const distance = this.getDistance(pointers[0], pointers[1]);
        
        if (this.lastPinchDistance > 0) {
          const factor = this.lastPinchDistance / distance;
          // Calculate pinch center point
          const midX = (pointers[0].clientX + pointers[1].clientX) / 2;
          const midY = (pointers[0].clientY + pointers[1].clientY) / 2;
          
          this.zoomAt(midX, midY, factor);
        }
        this.lastPinchDistance = distance;
      }
    });

    // Pointer Up / Cancel
    const endPointer = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.lastPinchDistance = 0;
      }
      if (this.activePointers.size === 0) {
        this.isPointerDown = false;
      }
    };
    
    this.container.addEventListener('pointerup', endPointer);
    this.container.addEventListener('pointercancel', endPointer);

    // Mouse Wheel Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
      this.zoomAt(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });

    // Country Path Click Event (Only in Admin Mode)
    this.svg.addEventListener('click', (e) => {
      if (this.role !== 'admin') return;

      const target = e.target as SVGElement;
      const pathElement = target.closest('path');
      
      if (pathElement) {
        const countryInfo = this.getCountryInfo(pathElement);
        if (countryInfo && this.onCountryClick) {
          this.onCountryClick(countryInfo.code, countryInfo.element);
        }
      }
    });
  }

  private getDistance(p1: PointerEvent, p2: PointerEvent): number {
    return Math.sqrt(Math.pow(p1.clientX - p2.clientX, 2) + Math.pow(p1.clientY - p2.clientY, 2));
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    // Constraints on zoom bounds
    const minWidth = 100;
    const maxWidth = 3000;
    
    const newW = this.vbW * factor;
    const newH = this.vbH * factor;
    
    if (newW < minWidth || newW > maxWidth) return;

    const rect = this.container.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Convert screen coordinates to current SVG coordinates
    const svgX = this.vbX + (relativeX / rect.width) * this.vbW;
    const svgY = this.vbY + (relativeY / rect.height) * this.vbH;

    // Recalculate new viewBox top-left so that client point stays in place
    this.vbX = svgX - (relativeX / rect.width) * newW;
    this.vbY = svgY - (relativeY / rect.height) * newH;
    this.vbW = newW;
    this.vbH = newH;

    this.updateViewBox();
  }

  private updateViewBox(): void {
    this.svg.setAttribute('viewBox', `${this.vbX} ${this.vbY} ${this.vbW} ${this.vbH}`);
  }

  public updateColors(assignments: CountryAssignment[]): void {
    // First clear all existing non-default colors
    const paths = this.svg.querySelectorAll('path');
    paths.forEach(path => {
      path.style.fill = '';
    });

    // Populate assignments cache
    this.assignmentsMap.clear();

    // Apply active colors
    assignments.forEach(assign => {
      const code = assign.country_code.toLowerCase();
      this.assignmentsMap.set(assign.country_code.toUpperCase(), assign);
      
      // SVG might group paths or have singular paths
      const element = this.svg.getElementById(code);
      if (element) {
        if (element.tagName.toLowerCase() === 'path') {
          (element as SVGPathElement).style.fill = assign.color_hex;
        } else {
          // It's a group <g id="us">
          const subpaths = element.querySelectorAll('path');
          subpaths.forEach(p => {
            p.style.fill = assign.color_hex;
          });
        }
      }
    });
  }

  public updateSingleCountryColor(
    countryCode: string,
    colorHex: string | null,
    repName?: string,
    repId?: number
  ): void {
    const code = countryCode.toLowerCase();
    const uCode = countryCode.toUpperCase();
    
    if (colorHex) {
      this.assignmentsMap.set(uCode, {
        country_code: countryCode,
        representative_id: repId || 0,
        name: repName || 'Representative',
        color_hex: colorHex
      });
    } else {
      this.assignmentsMap.delete(uCode);
    }

    const element = this.svg.getElementById(code);
    if (element) {
      const fillVal = colorHex || '';
      if (element.tagName.toLowerCase() === 'path') {
        (element as SVGPathElement).style.fill = fillVal;
      } else {
        const subpaths = element.querySelectorAll('path');
        subpaths.forEach(p => {
          p.style.fill = fillVal;
        });
      }
    }
  }
}
