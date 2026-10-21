import React, { useRef } from 'react';
import './LiquidSlider.css';

export default function LiquidSlider({ value, min = 0, max = 100, onChange, className = '', style }) {
  const sliderRef = useRef(null);

  const handleClick = (e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (onChange) {
      onChange(min + percent * (max - min));
    }
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div 
      ref={sliderRef}
      className={`liquid-slider ${className}`}
      onClick={handleClick}
      style={style}
    >
      <div className="liquid-slider__track">
        <div className="liquid-slider__fill" style={{ width: `${percent}%` }} />
        <div className="liquid-slider__thumb" style={{ left: `${percent}%` }}>
          <div className="liquid-slider__thumb-glow" />
        </div>
      </div>
    </div>
  );
}
