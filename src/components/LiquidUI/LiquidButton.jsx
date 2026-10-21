import React, { useRef, useState } from 'react';
import './LiquidUI.css';

const LiquidButton = ({ children, onClick, className = '', variant = '', icon: Icon, style, morph = true }) => {
  const btnRef = useRef(null);
  const [coords, setCoords] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e) => {
    if (!btnRef.current) return;
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y });
  };

  const handleMouseLeave = () => {
    setCoords({ x: 50, y: 50 });
  };

  const btnStyle = {
    ...style,
    '--mouse-x': `${coords.x}%`,
    '--mouse-y': `${coords.y}%`,
  };

  return (
    <button 
      ref={btnRef}
      className={`liquid-btn ${variant} ${morph ? 'morphing' : ''} ${className}`} 
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={btnStyle}
    >
      <div className="liquid-btn__sheen" />
      {Icon && <Icon className="liquid-btn-icon" size={18} style={{ zIndex: 3, position: 'relative' }} />}
      <span style={{ zIndex: 3, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {children}
      </span>
    </button>
  );
};

export default LiquidButton;
