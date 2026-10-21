import React from 'react';
import { getMediumQualityImage, decodeHTML } from '../../utils/helpers';
import './SearchRow.css';

/**
 * SearchRow — A compact list item for Search results
 * Used to match the JioSaavn multi-column search layout.
 */
export default function SearchRow({ item, onClick, type }) {
  if (!item) return null;

  const title = item.title || item.name || 'Unknown';
  const subtitle = item.subtitle || item.description || item.primaryArtists || '';
  const image = getMediumQualityImage(item.image);

  return (
    <div className={`search-row search-row--${type || 'default'}`} onClick={() => onClick(item)}>
      <div className="search-row__image-container">
        {image ? (
          <img src={image} alt={decodeHTML(title)} className="search-row__image" loading="lazy" />
        ) : (
          <div className="search-row__placeholder">
            <span>{type === 'artist' ? '👤' : '🎵'}</span>
          </div>
        )}
      </div>
      <div className="search-row__content">
        <div className="search-row__title">{decodeHTML(title)}</div>
        <div className="search-row__subtitle">{decodeHTML(subtitle)}</div>
      </div>
    </div>
  );
}
