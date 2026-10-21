/**
 * colorExtractor.js - Extracts dominant colors from song artwork images.
 */

export function getDominantColor(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    // Request CORS access
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const rd = data[i];
          const gd = data[i + 1];
          const bd = data[i + 2];
          
          // Calculate brightness
          const brightness = (rd * 299 + gd * 587 + bd * 114) / 1000;
          
          // Exclude extremely dark or light pixels to keep it vibrant
          if (brightness > 30 && brightness < 220) {
            r += rd;
            g += gd;
            b += bd;
            count++;
          }
        }
        
        if (count === 0) {
          // Fallback to average pixel if exclusions filtered everything
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        resolve({ r, g, b });
      } catch (e) {
        console.warn('[colorExtractor] Canvas read error (CORS):', e.message);
        resolve(generateColorHash(imageUrl));
      }
    };

    img.onerror = () => {
      resolve(generateColorHash(imageUrl));
    };

    img.src = imageUrl;
  });
}

// Fallback color generator based on image URL string hashing
function generateColorHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate colors in moderate-to-bright HSL range, convert to RGB
  const h = Math.abs(hash % 360);
  const s = 65; // saturated
  const l = 45; // medium brightness
  
  return hslToRgb(h / 360, s / 100, l / 100);
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
