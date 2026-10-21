import React from 'react';
import './Loader.css';

export default function Loader() {
  return (
    <div className="skeleton-grid" id="loader">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-wrapper">
      <div className="skeleton skeleton-card"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text-sm"></div>
    </div>
  );
}
