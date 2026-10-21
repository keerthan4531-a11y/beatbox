import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack,
  IoShuffle, IoRepeat, IoVolumeHigh, IoVolumeMute, IoVolumeMedium,
  IoHeart, IoHeartOutline, IoList
} from 'react-icons/io5';
import { usePlayer } from '../../context/PlayerContext';
import { getMediumQualityImage, decodeHTML, getArtistNames, formatDuration } from '../../utils/helpers';
import ExpandedPlayer from '../ExpandedPlayer/ExpandedPlayer';
import LiquidVisualizer from '../LiquidUI/LiquidVisualizer';
import HeartExplosion from '../LiquidUI/HeartExplosion';
import './Player.css';

export default function Player() {
  const location = useLocation();
  const {
    currentSong, isPlaying, togglePlay, nextSong, prevSong,
    duration, currentTime, seekTo, volume, setVolume,
    isMuted, toggleMute, isShuffled, toggleShuffle,
    repeatMode, cycleRepeat, toggleLike, isLiked,
    toggleQueue, showQueue, isLoading,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  const mobileProgressRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [touchStartPageY, setTouchStartPageY] = useState(0);
  const [explosionActive, setExplosionActive] = useState(false);

  const handleLikeClick = (e) => {
    e.stopPropagation();
    toggleLike(currentSong);
    if (!liked) {
      setExplosionActive(true);
    }
  };

  const handlePlayerTouchStart = (e) => {
    setTouchStartPageY(e.touches[0].pageY);
  };

  const handlePlayerTouchEnd = (e) => {
    const touchEndPageY = e.changedTouches[0].pageY;
    const diff = touchEndPageY - touchStartPageY;
    if (diff < -50) {
      setExpanded(true);
    }
  };

  // ── Touch / Mouse Drag Seek for progress bar ──
  const getSeekPercent = useCallback((e, ref) => {
    const bar = ref?.current || progressRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    let clientX;
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
    } else if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    if (clientX === undefined) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const dragRef = useRef(null);

  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = progressRef;
    const pct = getSeekPercent(e, progressRef);
    setDragTime(pct * duration);
  }, [duration, getSeekPercent]);

  const handleMobileDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = mobileProgressRef;
    const pct = getSeekPercent(e, mobileProgressRef);
    setDragTime(pct * duration);
  }, [duration, getSeekPercent]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    const pct = getSeekPercent(e, dragRef.current || progressRef);
    setDragTime(pct * duration);
  }, [isDragging, duration, getSeekPercent]);

  const handleDragEnd = useCallback((e) => {
    if (!isDragging) return;
    const pct = getSeekPercent(e, dragRef.current || progressRef);
    seekTo(pct * duration);
    setIsDragging(false);
    dragRef.current = null;
  }, [isDragging, duration, seekTo, getSeekPercent]);

  // Global listeners for drag
  useEffect(() => {
    if (isDragging) {
      const move = (e) => handleDragMove(e);
      const end = (e) => handleDragEnd(e);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);
      return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', end);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', end);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleProgressClick = useCallback((e) => {
    e.stopPropagation();
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(percent * duration);
  }, [duration, seekTo]);

  const handleVolumeClick = useCallback((e) => {
    const rect = volumeRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
  }, [setVolume]);

  if (!currentSong || location.pathname === '/cuts') return null;

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration ? (displayTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;
  const liked = isLiked(currentSong.id);
  const VolumeIcon = isMuted || volume === 0 ? IoVolumeMute : volume < 0.5 ? IoVolumeMedium : IoVolumeHigh;


  return (
    <>
      {/* Expanded full-screen player */}
      <ExpandedPlayer isOpen={expanded} onClose={() => setExpanded(false)} />

      <div className="player-wrapper">
        {/* Mobile: Draggable progress bar at top of player */}
        <div 
          className={`player__mobile-progress ${isDragging ? 'dragging' : ''}`}
          ref={mobileProgressRef}
          onTouchStart={handleMobileDragStart}
          onMouseDown={handleMobileDragStart}
        >
          <div className="player__mobile-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div 
          className="player" 
          id="player-bar"
          onTouchStart={handlePlayerTouchStart}
          onTouchEnd={handlePlayerTouchEnd}
        >
          <LiquidVisualizer isPlaying={isPlaying} volume={volume} />
          {/* Left: Song Info — click to expand */}
          <div className="player__song" id="player-song-info" onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>
            <img className={`player__song-image ${isPlaying ? 'playing' : ''}`} src={getMediumQualityImage(currentSong.image)} alt={decodeHTML(currentSong.name)} />
            <div className="player__song-info">
              <div className="player__song-title">
                {isPlaying && <span className="playing-emoji" style={{ marginRight: '6px' }}>🎵</span>}
                {decodeHTML(currentSong.name)}
              </div>
              <div className="player__song-artist">{getArtistNames(currentSong.artists, currentSong.primaryArtists)}</div>
            </div>
            <button className={`player__like-btn desktop-only spring-haptic ${liked ? 'liked' : ''}`} onClick={handleLikeClick} id="player-like-btn">
              <HeartExplosion active={explosionActive} onComplete={() => setExplosionActive(false)} />
              {liked ? <IoHeart /> : <IoHeartOutline />}
            </button>
          </div>

      {/* Center: Controls (Desktop) */}
      <div className="player__controls" id="player-controls">
        <div className="player__controls-buttons">
          <button className={`player__control-btn ${isShuffled ? 'active' : ''}`} onClick={toggleShuffle} id="shuffle-btn"><IoShuffle /></button>
          <button className="player__control-btn spring-haptic" onClick={prevSong} id="prev-btn"><IoPlaySkipBack /></button>
          <button className="player__play-btn spring-haptic" onClick={togglePlay} id="play-pause-btn">
            {isPlaying ? <IoPause /> : <IoPlay style={{ marginLeft: 2 }} />}
          </button>
          <button className="player__control-btn spring-haptic" onClick={nextSong} id="next-btn"><IoPlaySkipForward /></button>
          <button className={`player__control-btn ${repeatMode !== 'off' ? 'active' : ''}`} onClick={cycleRepeat} id="repeat-btn">
            <IoRepeat />
            {repeatMode === 'one' && <span style={{ position: 'absolute', fontSize: 8, fontWeight: 700, bottom: -2, right: -2 }}>1</span>}
          </button>
        </div>
        <div className="player__progress" id="player-progress">
          <span className="player__progress-time">{formatDuration(displayTime)}</span>
          <div 
            className={`player__progress-bar ${isDragging ? 'dragging' : ''}`} 
            ref={progressRef} 
            onClick={handleProgressClick}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <div className="slider-gooey-wrapper" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <div className="player__progress-fill" style={{ width: `${progressPercent}%`, height: '100%', position: 'absolute' }}>
                <div className="player__progress-thumb" />
              </div>
            </div>
          </div>
          <span className="player__progress-time">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Extra (Desktop) */}
      <div className="player__extra" id="player-extra">
        <button className={`player__extra-btn ${showQueue ? 'active' : ''}`} onClick={toggleQueue} id="queue-toggle-btn"><IoList /></button>
        <div className="player__volume" id="player-volume">
          <button className="player__extra-btn" onClick={toggleMute}><VolumeIcon /></button>
          <div className="player__volume-bar" ref={volumeRef} onClick={handleVolumeClick}>
            <div className="slider-gooey-wrapper" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <div className="player__volume-fill" style={{ width: `${volumePercent}%`, height: '100%', position: 'absolute' }}>
                <div className="player__volume-thumb" />
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Mobile Controls */}
        <div className="player__mobile-controls">
          <button className={`player__like-btn mobile-only spring-haptic ${liked ? 'liked' : ''}`} onClick={handleLikeClick}>
            <HeartExplosion active={explosionActive} onComplete={() => setExplosionActive(false)} />
            {liked ? <IoHeart /> : <IoHeartOutline />}
          </button>
          <button className="player__mobile-play spring-haptic" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            {isPlaying ? <IoPause /> : <IoPlay style={{ marginLeft: 2 }} />}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
