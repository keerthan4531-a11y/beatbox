import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import './LiquidVisualizer.css';

export default function LiquidVisualizer({ isPlaying, volume }) {
  const { analyser } = usePlayer();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef(0);
  const ampRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      if (w === 0 || h === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      // Web Audio frequency analysis
      let bass = 0;
      let mid = 0;
      let treble = 0;
      let average = 0;

      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Bass range (frequencies 0-10)
        let bassSum = 0;
        for (let j = 0; j < 10; j++) {
          bassSum += dataArray[j];
        }
        bass = bassSum / 10 / 255;

        // Mids range (frequencies 10-50)
        let midSum = 0;
        for (let j = 10; j < 50; j++) {
          midSum += dataArray[j];
        }
        mid = midSum / 40 / 255;

        // Treble range (frequencies 50-100)
        let trebleSum = 0;
        for (let j = 50; j < 100; j++) {
          trebleSum += dataArray[j];
        }
        treble = trebleSum / 50 / 255;

        average = (bass + mid + treble) / 3;
      }

      // Smoothly transition current amplitude to target
      // When audio analyser is active, bass drives the height of the waves dynamically
      const audioAmp = analyser ? (bass * 48 + mid * 12) : (isPlaying ? 22 : 0);
      const targetAmp = audioAmp * (volume ?? 0.8);
      ampRef.current += (targetAmp - ampRef.current) * 0.15; // Faster interpolation

      // Wave phase speed shifts based on average audio frequency
      const speed = analyser ? (0.012 + average * 0.08) : (isPlaying ? 0.035 : 0.008);
      phaseRef.current += speed;

      // Get dynamic theme colors from DOM computed variables
      const rootStyles = getComputedStyle(document.documentElement);
      const color1 = rootStyles.getPropertyValue('--brand-primary').trim() || 'rgba(0, 212, 255, 0.4)';
      const color2 = rootStyles.getPropertyValue('--brand-accent').trim() || 'rgba(192, 38, 211, 0.3)';

      // Draw 3 layered translucent fluid waves with different speeds and heights
      drawWave(ctx, w, h, ampRef.current, phaseRef.current, color1, 0.22, 0.65);
      drawWave(ctx, w, h, ampRef.current * 0.85, phaseRef.current * 1.25 + Math.PI / 4, color2, 0.16, 0.70);
      drawWave(ctx, w, h, ampRef.current * 0.5, phaseRef.current * 0.75 - Math.PI / 3, color1, 0.12, 0.75);

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, volume, analyser]);

  const drawWave = (ctx, w, h, maxAmp, phase, color, opacity, verticalPosPercent) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    
    const midY = h * verticalPosPercent;
    ctx.moveTo(0, h);
    ctx.lineTo(0, midY);

    const segments = 4;
    const step = w / segments;
    
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const y = midY + Math.sin(phase + i * 1.5) * maxAmp;
      
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevY = midY + Math.sin(phase + (i - 1) * 1.5) * maxAmp;
        const cpX1 = prevX + step / 2;
        const cpY1 = prevY;
        const cpX2 = prevX + step / 2;
        const cpY2 = y;
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
      }
    }

    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="liquid-visualizer-canvas" 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          pointerEvents: 'none', 
          zIndex: 0,
          filter: 'url(#liquid-goo-filter)'
        }} 
      />
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="liquid-goo-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" 
              result="goo" 
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </>
  );
}
