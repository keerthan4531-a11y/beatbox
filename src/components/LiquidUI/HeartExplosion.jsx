import React, { useEffect, useState, useRef } from 'react';
import './HeartExplosion.css';

export default function HeartExplosion({ active, onComplete }) {
  const [particles, setParticles] = useState([]);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    const newParticles = Array.from({ length: 12 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.4;
      const velocity = 2 + Math.random() * 4;
      return {
        id: i,
        x: 0,
        y: 0,
        dx: Math.cos(angle) * velocity,
        dy: Math.sin(angle) * velocity - 1.5, // drift upwards slightly
        scale: 0.4 + Math.random() * 0.8,
        opacity: 1,
      };
    });

    setParticles(newParticles);

    let animationFrame;
    const startTime = Date.now();

    const update = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 700) {
        setParticles([]);
        if (onCompleteRef.current) onCompleteRef.current();
        return;
      }

      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.dx,
          y: p.y + p.dy,
          dy: p.dy + 0.15, // gravity effect pulling them down slightly
          opacity: Math.max(0, 1 - elapsed / 700),
        }))
      );

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationFrame);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="heart-explosion-container">
      {particles.map((p) => (
        <span
          key={p.id}
          className="heart-particle"
          style={{
            transform: `translate(${p.x}px, ${p.y}px) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}
