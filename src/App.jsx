import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen/SplashScreen';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Navbar from './components/Navbar/Navbar';
import Player from './components/Player/Player';
import QueuePanel from './components/QueuePanel/QueuePanel';
import MobileTabBar from './components/MobileTabBar/MobileTabBar';

/* Music Pages */
import Home from './pages/Home/Home';
import Search from './pages/Search/Search';
import Library from './pages/Library/Library';
import LikedSongs from './pages/LikedSongs/LikedSongs';
import RecentlyPlayed from './pages/RecentlyPlayed/RecentlyPlayed';
import CategoryView from './pages/CategoryView/CategoryView';
import Cuts from './pages/Cuts/Cuts';
import UserProfile from './pages/UserProfile/UserProfile';
import Chat from './pages/Chat/Chat';
import ChatList from './pages/ChatList/ChatList';
import AlbumDetail from './pages/AlbumDetail/AlbumDetail';
import PlaylistDetail from './pages/PlaylistDetail/PlaylistDetail';

/* Movie Pages */
import MoviesHome from './pages/MoviesHome/MoviesHome';
import MovieDetail from './pages/MovieDetail/MovieDetail';
import MovieSearch from './pages/MovieSearch/MovieSearch';
import TVDetail from './pages/TVDetail/TVDetail';
import TVShows from './pages/TVShows/TVShows';
import TrendingMovies from './pages/TrendingMovies/TrendingMovies';
import Login from './pages/Login/Login';

import SettingsModal from './components/SettingsModal/SettingsModal';
import LiquidMeshBg from './components/LiquidUI/LiquidMeshBg';
import GooeyFilter from './components/LiquidUI/GooeyFilter';
import { getDominantColor } from './utils/colorExtractor';

import { usePlayer } from './context/PlayerContext';
import { getHighQualityImage } from './utils/helpers';
import { wakeUpBackend } from './api/saavn';
import './App.css';

import { LocalNotifications } from '@capacitor/local-notifications';

function AppContent() {
  const location = useLocation();
  const { currentSong, isAuthenticated, showQueue, showSettings, toggleSettings, toggleQueue } = usePlayer();
  const [mode, setMode] = useState('music'); // 'music' | 'movies'
  const [showSplash, setShowSplash] = useState(true);

  // Request Notification Permissions
  useEffect(() => {
    const requestPerms = async () => {
      try {
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch (e) {
        console.warn('Failed to request notification permissions:', e);
      }
    };
    requestPerms();
  }, []);

  const ambientBg = currentSong
    ? `url(${getHighQualityImage(currentSong.image)})`
    : 'none';

  // Wake up Render backend on initial load
  useEffect(() => {
    wakeUpBackend();
  }, []);

  // Elastic Rubber-Band bounce scroll hook for mobile touch devices
  useEffect(() => {
    const container = document.getElementById('main-content');
    if (!container) return;

    let startY = 0;
    let isAtTop = false;
    let isAtBottom = false;
    let child = null;

    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
      isAtTop = container.scrollTop === 0;
      isAtBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight;
      child = container.firstElementChild;
      if (child) {
        child.style.transition = 'none';
      }
    };

    const handleTouchMove = (e) => {
      if (!child) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      if (isAtTop && deltaY > 0) {
        const stretch = Math.min(60, Math.pow(deltaY, 0.65) * 1.5);
        child.style.transform = `translateY(${stretch}px)`;
        if (e.cancelable) e.preventDefault();
      } else if (isAtBottom && deltaY < 0) {
        const stretch = Math.max(-60, -Math.pow(-deltaY, 0.65) * 1.5);
        child.style.transform = `translateY(${stretch}px)`;
        if (e.cancelable) e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!child) return;
      child.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.25)';
      child.style.transform = 'translateY(0)';
      child = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Dynamic Theme Extraction — Extract cover art dominant color to style CSS variables
  useEffect(() => {
    if (currentSong && currentSong.image) {
      const coverUrl = getHighQualityImage(currentSong.image);
      getDominantColor(coverUrl).then((color) => {
        if (color) {
          document.documentElement.style.setProperty('--brand-primary', `rgb(${color.r}, ${color.g}, ${color.b})`);
          document.documentElement.style.setProperty('--brand-primary-rgb', `${color.r}, ${color.g}, ${color.b}`);
          // Calculate an accent color offset (split-complementary shift)
          const accR = Math.min(255, Math.floor(color.r * 1.2));
          const accG = Math.max(0, Math.floor(color.g * 0.6));
          const accB = Math.min(255, Math.floor(color.b * 1.4));
          document.documentElement.style.setProperty('--brand-accent', `rgb(${accR}, ${accG}, ${accB})`);
          document.documentElement.style.setProperty('--brand-accent-rgb', `${accR}, ${accG}, ${accB}`);
        }
      });
    } else {
      // Reset to defaults
      document.documentElement.style.setProperty('--brand-primary', '#8b5cf6');
      document.documentElement.style.setProperty('--brand-primary-rgb', '139, 92, 246');
      document.documentElement.style.setProperty('--brand-accent', '#0ea5e9');
      document.documentElement.style.setProperty('--brand-accent-rgb', '14, 165, 233');
    }
  }, [currentSong]);

  if (!isAuthenticated) {
    return <Login />;
  }

  const isCutsPage = location.pathname === '/cuts';

  return (
    <div className="app" id="app">
      <LiquidMeshBg />
      <GooeyFilter />
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      {/* Sidebar - Hide on Cuts */}
      {!isCutsPage && <Sidebar mode={mode} setMode={setMode} />}

      {/* Main Area */}
      <div className="app__main-wrapper">
        {/* Content + Queue */}
        <div className="app__content-area">
          <div className="app__main-content" id="main-content" style={{ paddingBottom: isCutsPage ? 0 : undefined }}>
            {/* Ambient Glow */}
            {currentSong && !isCutsPage && (
              <div
                className="app__ambient"
                style={{ backgroundImage: ambientBg, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
            )}

            {/* Navbar - Hide on Cuts */}
            {!isCutsPage && <Navbar />}

            {/* All Routes */}
            <Routes>
              {/* Music Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library" element={<Library />} />
              <Route path="/cuts" element={<Cuts />} />
              <Route path="/liked" element={<LikedSongs />} />
              <Route path="/recent" element={<RecentlyPlayed />} />
              <Route path="/category/:query" element={<CategoryView />} />
              <Route path="/album/:id" element={<AlbumDetail />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/user/:id" element={<UserProfile />} />
              <Route path="/chat/:id" element={<Chat />} />
              <Route path="/chats" element={<ChatList />} />

              {/* Movie Routes */}
              <Route path="/movies" element={<MoviesHome />} />
              <Route path="/movies/search" element={<MovieSearch />} />
              <Route path="/movies/trending" element={<TrendingMovies />} />
              <Route path="/movies/tv" element={<TVShows />} />
              <Route path="/movies/:id" element={<MovieDetail />} />
              <Route path="/movies/tv/:id" element={<TVDetail />} />


            </Routes>
          </div>
        </div>

        {/* Mobile Tab Bar - Hide on Cuts */}
        {!isCutsPage && <MobileTabBar mode={mode} setMode={setMode} />}

        {/* Player Bar */}
        <Player />

        {/* Overlay Modals & Panels at root level to prevent stacking context bugs */}
        {showQueue && <QueuePanel />}
        {showSettings && <SettingsModal onClose={() => toggleSettings()} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppContent />
  );
}
