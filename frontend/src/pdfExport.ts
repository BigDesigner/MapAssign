import { jsPDF } from 'jspdf';

export function sanitizeSVG(svgClone: SVGSVGElement): void {
  // 1. Remove any script tags
  const scripts = svgClone.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // 2. Remove foreignObject tags
  const foreignObjects = svgClone.querySelectorAll('foreignObject');
  foreignObjects.forEach(fo => fo.remove());

  // 3. Remove image tags
  const images = svgClone.querySelectorAll('image');
  images.forEach(img => img.remove());

  // 4. Strip potentially malicious attributes from all elements
  const allElements = svgClone.querySelectorAll('*');
  allElements.forEach(el => {
    // Strip inline event handlers
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      if (attr.name === 'href' || attr.name === 'xlink:href') {
        const val = attr.value.trim().toLowerCase();
        if (val.startsWith('javascript:') || val.startsWith('data:')) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });
}

export function exportMapToPDF(svgElement: SVGSVGElement): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Clone the SVG element so we don't modify the active DOM
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Sanitize the cloned SVG
      sanitizeSVG(svgClone);

      // Serialize the clean SVG DOM
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      
      // Convert SVG to Blob and create a temporary URL
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      
      // Get the bounding dimensions of the SVG viewbox or current width/height
      const viewBoxStr = svgElement.getAttribute('viewBox') || '0 0 800 600';
      const [, , w, h] = viewBoxStr.split(/\s+/).map(Number);
      
      const width = w || svgElement.clientWidth || 800;
      const height = h || svgElement.clientHeight || 600;

      img.onload = () => {
        try {
          // Render SVG on a canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Could not get 2D context for canvas PDF rendering.'));
            return;
          }
          
          // Draw a dark background matching index.html aesthetics (optional but recommended for visual fidelity)
          ctx.fillStyle = '#0b0f19';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Generate PDF using jsPDF
          // Landscape orientation, pts, sizes
          const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [width, height]
          });
          
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 0, 0, width, height);
          pdf.save('map_snapshot.pdf');
          
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG into image element for PDF conversion.'));
      };
      
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}
