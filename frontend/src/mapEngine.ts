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
  private onCountryClick?: (countryCode: string, targetPath: SVGPathElement) => void;

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

  constructor(
    svg: SVGSVGElement,
    container: HTMLElement,
    role: 'admin' | 'representative',
    onCountryClick?: (countryCode: string, targetPath: SVGPathElement) => void
  ) {
    this.svg = svg;
    this.container = container;
    this.role = role;
    this.onCountryClick = onCountryClick;

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

  private initEvents(): void {
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
        const countryCode = pathElement.id || pathElement.getAttribute('id');
        if (countryCode && !countryCode.startsWith('_') && this.onCountryClick) {
          this.onCountryClick(countryCode.toUpperCase(), pathElement);
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

    // Apply active colors
    assignments.forEach(assign => {
      const code = assign.country_code.toLowerCase();
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

  public updateSingleCountryColor(countryCode: string, colorHex: string | null): void {
    const code = countryCode.toLowerCase();
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
