import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen/SplashScreen';
import { Routes, Route } from 'react-router-dom';
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

import { usePlayer } from './context/PlayerContext';
import { getHighQualityImage } from './utils/helpers';
import './App.css';

import { LocalNotifications } from '@capacitor/local-notifications';

export default function App() {
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

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app" id="app">
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      {/* Sidebar */}
      <Sidebar mode={mode} setMode={setMode} />

      {/* Main Area */}
      <div className="app__main-wrapper">
        {/* Content + Queue */}
        <div className="app__content-area">
          <div className="app__main-content" id="main-content">
            {/* Ambient Glow */}
            {currentSong && (
              <div
                className="app__ambient"
                style={{ backgroundImage: ambientBg, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
            )}

            {/* Navbar */}
            <Navbar />

            {/* All Routes */}
            <Routes>
              {/* Music Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library" element={<Library />} />
              <Route path="/liked" element={<LikedSongs />} />
              <Route path="/recent" element={<RecentlyPlayed />} />
              <Route path="/category/:query" element={<CategoryView />} />
              <Route path="/album/:id" element={<AlbumDetail />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />

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

        {/* Mobile Tab Bar */}
        <MobileTabBar mode={mode} setMode={setMode} />

        {/* Player Bar */}
        <Player />

        {/* Overlay Modals & Panels at root level to prevent stacking context bugs */}
        {showQueue && <QueuePanel />}
        {showSettings && <SettingsModal onClose={() => toggleSettings()} />}
      </div>
    </div>
  );
}
