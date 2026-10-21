import React, { useRef, useState, useEffect } from 'react';
import './LiquidUI.css';

const LiquidCard = ({ children, className = '', onClick, style }) => {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState({ x: 50, y: 50 });
  const [rotations, setRotations] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsMobile(isTouch);

    if (!isTouch) return;

    const handleOrientation = (e) => {
      // gamma (left-to-right tilt in degrees -90 to 90)
      // beta (front-to-back tilt in degrees -180 to 180)
      const gamma = e.gamma || 0;
      const beta = e.beta || 0;

      // Scale to max 8 degrees tilt
      // Assume user holds phone at ~45 degrees screen pitch
      const targetBeta = beta - 45;
      const rotY = Math.max(-16, Math.min(16, gamma)) * 0.5;
      const rotX = -Math.max(-16, Math.min(16, targetBeta)) * 0.5;

      const shineX = 50 + (gamma * 1.8);
      const shineY = 50 + (targetBeta * 1.8);

      setCoords({ 
        x: Math.max(0, Math.min(100, shineX)), 
        y: Math.max(0, Math.min(100, shineY)) 
      });
      setRotations({ x: rotX, y: rotY });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const handleMouseMove = (e) => {
    if (isMobile) return; // disable mouse tilt on touch screens to prevent conflicts
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Mouse coordinates relative to card bounds (in percentage)
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Rotations based on mouse position from card center
    // Max rotation is 8 degrees for a subtle 3D card tilt
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotX = -((e.clientY - centerY) / (rect.height / 2)) * 8;
    const rotY = ((e.clientX - centerX) / (rect.width / 2)) * 8;

    setCoords({ x, y });
    setRotations({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    // Reset tilt and sheen to center
    setCoords({ x: 50, y: 50 });
    setRotations({ x: 0, y: 0 });
    setIsClicked(false);
  };

  const handleMouseDown = () => {
    setIsClicked(true);
  };

  const handleMouseUp = () => {
    setIsClicked(false);
  };

  const cardStyle = {
    ...style,
    '--mouse-x': `${coords.x}%`,
    '--mouse-y': `${coords.y}%`,
    transform: `perspective(1000px) rotateX(${rotations.x}deg) rotateY(${rotations.y}deg) scale(${isClicked ? 0.95 : 1})`,
    transition: isClicked ? 'transform 0.08s ease' : 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
  };

  return (
    <div className="liquid-card-container">
      <div 
        ref={cardRef}
        className={`liquid-card ${className}`} 
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        style={cardStyle}
      >
        <div className="liquid-card__sheen" style={isMobile ? { opacity: 0.6 } : undefined} />
        <div className="liquid-card-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default LiquidCard;
