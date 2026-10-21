import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';

export default function LyricRainCanvas({ song, activeLine, lyrics, isSynced, onCapture }) {
  const { analyser } = usePlayer();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const splashParticlesRef = useRef([]);
  const raindropsRef = useRef([]);
  const lastLineRef = useRef(-1);

  // Spawns words from a lyrics line
  const spawnWords = (lineText, canvasWidth) => {
    if (!lineText) return;
    const words = lineText.split(/\s+/).filter(w => w.trim().length > 0);
    const newParticles = words.map((word, idx) => {
      const spacing = canvasWidth / (words.length + 1);
      return {
        id: `${Date.now()}_${idx}_${Math.random()}`,
        text: word,
        x: spacing * (idx + 1) + (Math.random() - 0.5) * 15,
        y: -30 - (idx * 25), // stagger start heights slightly
        dx: (Math.random() - 0.5) * 0.8,
        dy: 1.2 + Math.random() * 1.6,
        size: 16 + Math.floor(Math.random() * 8), // 16px to 24px
        color: idx % 2 === 0 ? 'rgba(0, 212, 255, 0.95)' : 'rgba(192, 38, 211, 0.95)',
        settled: false,
        angle: (Math.random() - 0.5) * 0.1,
        spin: (Math.random() - 0.5) * 0.01
      };
    });

    particlesRef.current = [...particlesRef.current, ...newParticles];
    // Keep max 60 words to prevent slow down
    if (particlesRef.current.length > 60) {
      particlesRef.current = particlesRef.current.slice(particlesRef.current.length - 60);
    }
  };

  // Trigger spawn when the active line changes (synced lyrics)
  useEffect(() => {
    if (!isSynced) return;
    if (activeLine !== lastLineRef.current && lyrics && activeLine >= 0) {
      const lineObj = lyrics[activeLine];
      const text = isSynced ? lineObj?.text : lineObj;
      const canvas = canvasRef.current;
      if (canvas && text) {
        spawnWords(text, canvas.width / window.devicePixelRatio);
      }
      lastLineRef.current = activeLine;
    }
  }, [activeLine, lyrics, isSynced]);

  // Periodic cycling for plain unsynced text lyrics
  useEffect(() => {
    if (isSynced) return;
    if (!lyrics || lyrics.length === 0) return;

    let lineIdx = 0;
    
    const triggerNextLine = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const lineText = lyrics[lineIdx];
      if (typeof lineText === 'string') {
        spawnWords(lineText, canvas.width / window.devicePixelRatio);
      } else if (lineText && lineText.text) {
        spawnWords(lineText.text, canvas.width / window.devicePixelRatio);
      }
      lineIdx = (lineIdx + 1) % lyrics.length;
    };

    const interval = setInterval(triggerNextLine, 4500);
    
    // Spawn first line after canvas bounds are ready
    setTimeout(triggerNextLine, 100);

    return () => clearInterval(interval);
  }, [lyrics, isSynced]);

  // Click detection
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clickedIdx = -1;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      // Check collision within text bounding circle
      const dist = Math.hypot(p.x - clickX, p.y - clickY);
      if (dist < 40) {
        clickedIdx = i;
        break;
      }
    }

    if (clickedIdx !== -1) {
      const captured = particlesRef.current[clickedIdx];
      // Remove captured particle
      particlesRef.current = particlesRef.current.filter((_, idx) => idx !== clickedIdx);

      // Create burst effect at particle coordinates
      const burst = Array.from({ length: 8 }).map(() => ({
        x: captured.x,
        y: captured.y,
        dx: (Math.random() - 0.5) * 6,
        dy: (Math.random() - 0.5) * 6 - 2,
        size: 3 + Math.random() * 5,
        alpha: 1,
        color: captured.color
      }));
      splashParticlesRef.current = [...splashParticlesRef.current, ...burst];

      // Invoke capture callback
      if (onCapture) {
        onCapture(captured.text);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      // Initialize background rain streaks
      raindropsRef.current = Array.from({ length: 30 }).map(() => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        length: 15 + Math.random() * 20,
        speed: 6 + Math.random() * 8,
        opacity: 0.05 + Math.random() * 0.12
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    // Initial words spawn if lyrics loaded (synced)
    if (isSynced && lyrics && activeLine >= 0) {
      const lineObj = lyrics[activeLine];
      const text = isSynced ? lineObj?.text : lineObj;
      if (text) spawnWords(text, canvas.width / dpr);
    }

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      // 0. Update and Draw Background Rain Streaks
      raindropsRef.current.forEach(r => {
        r.y += r.speed;
        if (r.y > h) {
          r.y = -25;
          r.x = Math.random() * w;
        }

        ctx.save();
        ctx.strokeStyle = `rgba(0, 212, 255, ${r.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + (r.speed * 0.04), r.y + r.length);
        ctx.stroke();
        ctx.restore();
      });

      // 1. Audio Beat Detection via Bass Energy
      let bass = 0;
      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        let bassSum = 0;
        const bassEndBin = Math.min(10, bufferLength);
        for (let i = 0; i < bassEndBin; i++) {
          bassSum += dataArray[i];
        }
        bass = bassSum / bassEndBin / 255;
      }

      const beatThreshold = 0.58;
      const isBeat = bass > beatThreshold;

      // Draw subtle beat-sync background ripple
      if (isBeat) {
        ctx.save();
        const glowGrad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, Math.max(w, h)/2);
        glowGrad.addColorStop(0, `rgba(0, 212, 255, ${bass * 0.08})`);
        glowGrad.addColorStop(0.5, `rgba(192, 38, 211, ${bass * 0.03})`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // 2. Update and Draw Word Particles
      particlesRef.current.forEach(p => {
        if (!p.settled) {
          // Physics: gravity & speed drift
          p.dy += 0.05; // gravity force
          p.x += p.dx;
          p.y += p.dy;
          p.angle += p.spin;

          // Collide with bottom boundary (lyrics drawer limits)
          const bottomBoundary = h - 25;
          if (p.y >= bottomBoundary) {
            p.y = bottomBoundary;
            p.settled = true;
            p.dy = 0;
            p.dx = 0;
            p.angle = (Math.random() - 0.5) * 0.05;
          }
        } else if (isBeat) {
          // Splat upward on beat drop!
          p.settled = false;
          p.dy = - (2 + Math.random() * 5) * (bass * 1.5);
          p.dx = (Math.random() - 0.5) * 3;
          p.spin = (Math.random() - 0.5) * 0.02;
        }

        // Draw particle text
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.font = `bold ${p.size}px system-ui, -apple-system, sans-serif`;
        
        // Add dynamic glow shadow to look premium
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.settled ? 4 : 12;
        ctx.fillStyle = p.settled ? 'rgba(255, 255, 255, 0.75)' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      });

      // 3. Update and Draw Click Burst Particles
      splashParticlesRef.current.forEach((sp, idx) => {
        sp.x += sp.dx;
        sp.y += sp.dy;
        sp.dy += 0.15; // gravity pulls burst dots down
        sp.alpha -= 0.025; // fade out

        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.alpha);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      });

      // Filter out dead splash particles
      splashParticlesRef.current = splashParticlesRef.current.filter(sp => sp.alpha > 0);

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [lyrics, activeLine, isSynced, analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      onClick={handleCanvasClick}
      className="lyric-rain-canvas"
      style={{ 
        width: '100%', 
        height: '100%', 
        cursor: 'pointer',
        display: 'block'
      }} 
    />
  );
}
