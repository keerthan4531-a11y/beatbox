import React from 'react';
import './LiquidMeshBg.css';

export default function LiquidMeshBg() {
  return (
    <div className="liquid-mesh-container">
      <div className="liquid-mesh-blob blob-1" />
      <div className="liquid-mesh-blob blob-2" />
      <div className="liquid-mesh-blob blob-3" />
      <div className="liquid-mesh-blob blob-4" />
      <div className="liquid-mesh-overlay" />
    </div>
  );
}
