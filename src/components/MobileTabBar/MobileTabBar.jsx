import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoHome, IoSearch, IoLibrary, IoFilm, IoVideocam, IoHeadset, IoMusicalNotes } from 'react-icons/io5';
import './MobileTabBar.css';

export default function MobileTabBar({ mode, setMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const container = document.getElementById('main-content');
    if (!container) return;

    let timeoutId;
    const handleScroll = () => {
      setVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setVisible(false);
      }, 2500);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('tab-bar-hidden', !visible);
    return () => {
      document.body.classList.remove('tab-bar-hidden');
    };
  }, [visible]);

  const musicTabs = [
    { path: '/', label: 'Home', icon: <IoHome /> },
    { path: '/search', label: 'Search', icon: <IoSearch /> },
    { path: '/library', label: 'Library', icon: <IoLibrary /> },
    { path: '/cuts', label: 'Cuts', icon: <IoVideocam /> },
  ];

  const movieTabs = [
    { path: '/movies', label: 'Movies', icon: <IoFilm /> },
    { path: '/movies/search', label: 'Search', icon: <IoSearch /> },
  ];



  const tabs = mode === 'music' ? musicTabs : movieTabs;

  // Build the two "other mode" buttons based on current mode
  const otherModes = [];
  if (mode !== 'music') {
    otherModes.push({ key: 'music', label: 'Music', icon: <IoHome />, path: '/' });
  }
  if (mode !== 'movies') {
    otherModes.push({ key: 'movies', label: 'Movies', icon: <IoFilm />, path: '/movies' });
  }


  return (
    <div className={`mobile-tab-bar ${visible ? '' : 'hidden'}`} id="mobile-tab-bar">
      <div className="mobile-tab-bar__inner">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            className={`mobile-tab-bar__item ${location.pathname === tab.path ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="mobile-tab-bar__icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <div className="mobile-tab-bar__divider" />
        {otherModes.map((m) => (
          <button
            key={m.key}
            className={`mobile-tab-bar__item mobile-tab-bar__mode-btn ${m.isSpotify ? 'spotify-mode' : ''}`}
            onClick={() => { setMode(m.key); navigate(m.path); }}
          >
            <span className="mobile-tab-bar__icon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
