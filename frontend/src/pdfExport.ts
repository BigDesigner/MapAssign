export interface LegendItem {
  name: string;
  color_hex: string;
}

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

  // 5. Harita üzerindeki beyaz dikdörtgen arka planı ve okyanus dolgusunu şeffaf yap
  const worldRect = svgClone.getElementById('World');
  if (worldRect) {
    worldRect.setAttribute('fill', 'transparent');
  }
  const oceanPath = svgClone.getElementById('Ocean');
  if (oceanPath) {
    oceanPath.setAttribute('fill', 'transparent');
    oceanPath.setAttribute('stroke', 'none');
  }
}

export function exportMapToPNG(svgElement: SVGSVGElement, legendItems: LegendItem[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Clone the SVG element so we don't modify the active DOM
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Sanitize the cloned SVG
      sanitizeSVG(svgClone);

      // Get the bounding dimensions of the SVG viewbox or current width/height
      const viewBoxStr = svgElement.getAttribute('viewBox') || '0 0 800 600';
      const [, , w, h] = viewBoxStr.split(/\s+/).map(Number);
      
      const width = w || svgElement.clientWidth || 800;
      const height = h || svgElement.clientHeight || 600;

      // Define 4x scale for high resolution
      const scale = 4;
      const exportWidth = width * scale;
      const exportHeight = height * scale;

      // Force explicit high-res dimensions on the SVG clone so it rasterizes crisply
      svgClone.setAttribute('width', exportWidth.toString());
      svgClone.setAttribute('height', exportHeight.toString());

      // Serialize the clean SVG DOM
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      
      // Convert SVG to Blob and create a temporary URL
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();

      img.onload = () => {
        try {
          // Render SVG on a canvas
          const canvas = document.createElement('canvas');
          canvas.width = exportWidth;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Could not get 2D context for canvas PNG rendering.'));
            return;
          }

          // Measure legend layout to determine dynamic canvas height
          let legendAreaHeight = 0;
          const startX = 30 * scale;
          const itemGap = 20 * scale;
          const dotToTextGap = 8 * scale;
          const dotRadius = 5 * scale;
          const rowHeight = 22 * scale;

          if (legendItems && legendItems.length > 0) {
            ctx.font = `bold ${12 * scale}px sans-serif`;
            let currentX = startX;
            let currentY = 25 * scale; // Relative to legend start

            legendItems.forEach(item => {
              const textWidth = ctx.measureText(item.name).width;
              const itemWidth = (dotRadius * 2) + dotToTextGap + textWidth;

              if (currentX + itemWidth > exportWidth - startX && currentX > startX) {
                currentX = startX;
                currentY += rowHeight;
              }
              currentX += itemWidth + itemGap;
            });
            legendAreaHeight = currentY + rowHeight + 15 * scale; // include padding and safety margin
          }
          
          // Set final canvas height incorporating the legend space
          canvas.height = exportHeight + legendAreaHeight;
          
          // Draw a dark background matching index.html aesthetics
          ctx.fillStyle = '#0b0f19';
          ctx.fillRect(0, 0, exportWidth, exportHeight + legendAreaHeight);
          
          ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

          // Draw legend if we have items
          if (legendAreaHeight > 0) {
            // Draw a separator line between map and legend
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1 * scale;
            ctx.beginPath();
            ctx.moveTo(30 * scale, exportHeight + 5 * scale);
            ctx.lineTo(exportWidth - 30 * scale, exportHeight + 5 * scale);
            ctx.stroke();

            // Draw items
            ctx.font = `bold ${12 * scale}px sans-serif`;
            let currentX = startX;
            let currentY = exportHeight + 25 * scale;

            legendItems.forEach(item => {
              const textWidth = ctx.measureText(item.name).width;
              const itemWidth = (dotRadius * 2) + dotToTextGap + textWidth;

              if (currentX + itemWidth > exportWidth - startX && currentX > startX) {
                currentX = startX;
                currentY += rowHeight;
              }

              // Draw color dot (circle)
              ctx.fillStyle = item.color_hex;
              ctx.beginPath();
              ctx.arc(currentX + dotRadius, currentY, dotRadius, 0, Math.PI * 2);
              ctx.fill();

              // Draw dot border for visibility against dark bg
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
              ctx.lineWidth = 1 * scale;
              ctx.stroke();

              // Draw representative name text next to dot
              ctx.fillStyle = '#f8fafc';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.name, currentX + (dotRadius * 2) + dotToTextGap, currentY);

              currentX += itemWidth + itemGap;
            });
          }
          
          const imgData = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = 'map_snapshot.png';
          link.href = imgData;
          link.click();
          
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG into image element for PNG conversion.'));
      };
      
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}
