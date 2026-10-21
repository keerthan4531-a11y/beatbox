import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack,
  IoShuffle, IoRepeat, IoVolumeHigh, IoVolumeMute, IoVolumeMedium,
  IoHeart, IoHeartOutline, IoChevronDown, IoEllipsisHorizontal,
  IoList, IoShareSocial, IoAdd, IoMusicalNotes
} from 'react-icons/io5';
import { usePlayer } from '../../context/PlayerContext';
import { getYouTubeShortUrl } from '../../api/saavn';
import { getHighQualityImage, decodeHTML, getArtistNames, formatDuration } from '../../utils/helpers';
import Clips from '../Clips/Clips';
import LyricsPanel from '../LyricsPanel/LyricsPanel';
import HeartExplosion from '../LiquidUI/HeartExplosion';
import LiquidVisualizer from '../LiquidUI/LiquidVisualizer';
import ShareModal from '../ShareModal/ShareModal';
import LiquidCard from '../LiquidUI/LiquidCard';
import { createPortal } from 'react-dom';
import './ExpandedPlayer.css';

export default function ExpandedPlayer({ isOpen, onClose }) {
  const {
    currentSong, isPlaying, togglePlay, nextSong, prevSong,
    duration, currentTime, seekTo, volume, setVolume,
    isMuted, toggleMute, isShuffled, toggleShuffle,
    repeatMode, cycleRepeat, toggleLike, isLiked,
    toggleQueue, queue, addToQueue,
  } = usePlayer();

  const progressRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const [hasOpened, setHasOpened] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const isDraggingSheet = useRef(false);
  const [explosionActive, setExplosionActive] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleLikeClick = () => {
    toggleLike(currentSong);
    if (!liked) {
      setExplosionActive(true);
    }
  };

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  const handleSheetTouchStart = (e) => {
    if (e.target.closest('.exp-player__header') || e.target.closest('.exp-player__art-wrapper') || e.target.closest('.exp-player__info-row')) {
      dragStartY.current = e.touches[0].clientY;
      isDraggingSheet.current = true;
    }
  };

  const handleSheetTouchMove = (e) => {
    if (!isDraggingSheet.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleSheetTouchEnd = () => {
    if (!isDraggingSheet.current) return;
    isDraggingSheet.current = false;
    if (dragOffset > 150) {
      onClose();
    }
    setDragOffset(0);
  };

  // ── Clips / Reels State ──
  const [showClips, setShowClips] = useState(false);
  const [clipData, setClipData] = useState(null);

  // Check if a clip is available when song changes
  useEffect(() => {
    if (!currentSong) return;
    setClipData(null);

    const songName = decodeHTML(currentSong.name || currentSong.title || '');
    const artistName = getArtistNames(currentSong.artists, currentSong.primaryArtists);

    getYouTubeShortUrl(songName, artistName).then(data => {
      setClipData(data);
    }).catch(() => {
      setClipData(null);
    });
  }, [currentSong?.id]);

  // ── Touch / Mouse Drag Seek ──
  const getSeekPercent = useCallback((e) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
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

  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    const pct = getSeekPercent(e);
    setDragTime(pct * duration);
  }, [duration, getSeekPercent]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    const pct = getSeekPercent(e);
    setDragTime(pct * duration);
  }, [isDragging, duration, getSeekPercent]);

  const handleDragEnd = useCallback((e) => {
    if (!isDragging) return;
    const pct = getSeekPercent(e);
    const time = pct * duration;
    seekTo(time);
    setIsDragging(false);
  }, [isDragging, duration, seekTo, getSeekPercent]);

  // Attach global move/end listeners when dragging
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

  // Click to seek (non-drag)
  const handleProgressClick = useCallback((e) => {
    e.stopPropagation();
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(percent * duration);
  }, [duration, seekTo]);

  if (!currentSong || !hasOpened) return null;

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration ? (displayTime / duration) * 100 : 0;
  const liked = isLiked(currentSong.id);
  const albumArt = getHighQualityImage(currentSong.image);
  const artistName = getArtistNames(currentSong.artists, currentSong.primaryArtists);

  return (
    <div 
      className={`exp-player ${isOpen ? 'open' : ''}`} 
      id="expanded-player"
      onTouchStart={handleSheetTouchStart}
      onTouchMove={handleSheetTouchMove}
      onTouchEnd={handleSheetTouchEnd}
      style={{
        transform: isOpen ? `translateY(${dragOffset}px)` : `translateY(100%)`,
        transition: isDraggingSheet.current ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      {/* Blurred background from album art */}
      <div
        className="exp-player__bg"
        style={{ backgroundImage: `url(${albumArt})` }}
      />
      <div className="exp-player__overlay" />
      <LiquidVisualizer isPlaying={isPlaying} volume={volume} />

      {/* Header */}
      <div className="exp-player__header">
        <button className="exp-player__down-btn" onClick={onClose} aria-label="Close">
          <IoChevronDown />
        </button>
        <div className="exp-player__header-info">
          <span className="exp-player__context">Now Playing</span>
        </div>
        <div className="exp-player__header-actions">
          <button
            className="exp-player__menu-btn"
            onClick={() => setShowMenu(v => !v)}
            aria-label="More options"
          >
            <IoEllipsisHorizontal />
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div className="exp-player__menu glass-panel">
          <button onClick={() => { addToQueue(currentSong); setShowMenu(false); }}>
            <IoAdd /> Add to Queue
          </button>
          <button onClick={() => { toggleQueue(); setShowMenu(false); }}>
            <IoList /> View Queue
          </button>
          <button onClick={() => { setShowShareModal(true); setShowMenu(false); }}>
            <IoShareSocial /> Share Song
          </button>
        </div>
      )}

      {/* Lyrics Panel (rendered via portal for true full-screen) */}
      {showLyrics && createPortal(
        <LyricsPanel
          song={currentSong}
          currentTime={currentTime}
          onClose={() => setShowLyrics(false)}
        />,
        document.body
      )}

      {/* Album Art */}
      <div className="exp-player__art-wrapper">
        <LiquidCard className="exp-player__art-card">
          <img
            className={`exp-player__art ${isPlaying ? 'playing' : ''}`}
            src={albumArt}
            alt={decodeHTML(currentSong.name)}
          />
        </LiquidCard>
      </div>

      {/* Song Info + Clips Trigger + Lyrics + Like */}
      <div className="exp-player__info-row">
        <div className="exp-player__info">
          <h2 className="exp-player__title">{decodeHTML(currentSong.name)}</h2>
          <p className="exp-player__artist">{artistName}</p>
        </div>
        <div className="exp-player__info-actions">
          {/* Clips Trigger Button — small album art thumbnail with play icon */}
          {clipData && (
            <button 
              className="exp-player__clips-trigger"
              onClick={() => setShowClips(true)}
              aria-label="View Clip"
              title="Watch Clip"
            >
              <div className="clips-trigger-inner">
                <img src={albumArt} alt="" />
                <div className="clips-trigger-icon">
                  <IoPlay size={12} />
                </div>
              </div>
            </button>
          )}

          <button
            className={`exp-player__lyrics-btn ${showLyrics ? 'active' : ''}`}
            onClick={() => setShowLyrics(v => !v)}
            aria-label="Lyrics"
            title="Lyrics"
          >
            <IoMusicalNotes />
          </button>

          <button
            className={`exp-player__like-btn spring-haptic ${liked ? 'liked' : ''}`}
            onClick={handleLikeClick}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <HeartExplosion active={explosionActive} onComplete={() => setExplosionActive(false)} />
            {liked ? <IoHeart /> : <IoHeartOutline />}
          </button>
        </div>
      </div>

      {/* Progress Bar — Touch Drag + Click Seek */}
      <div className="exp-player__progress-section">
        <div
          className={`exp-player__progress-bar ${isDragging ? 'dragging' : ''}`}
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="exp-player__progress-track" />
          <div className="exp-player__progress-fill" style={{ width: `${progressPercent}%` }}>
            <div className="exp-player__progress-glow" />
            <div className="exp-player__progress-thumb" />
          </div>
        </div>
        <div className="exp-player__times">
          <span>{formatDuration(displayTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="exp-player__controls">
        <button
          className={`exp-player__ctrl-btn spring-haptic ${isShuffled ? 'active' : ''}`}
          onClick={toggleShuffle}
          aria-label="Shuffle"
        >
          <IoShuffle />
        </button>
        <button className="exp-player__ctrl-btn spring-haptic" onClick={prevSong} aria-label="Previous">
          <IoPlaySkipBack />
        </button>
        <button className="exp-player__play-btn spring-haptic" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <IoPause /> : <IoPlay style={{ marginLeft: 3 }} />}
        </button>
        <button className="exp-player__ctrl-btn spring-haptic" onClick={nextSong} aria-label="Next">
          <IoPlaySkipForward />
        </button>
        <button
          className={`exp-player__ctrl-btn spring-haptic ${repeatMode !== 'off' ? 'active' : ''}`}
          onClick={cycleRepeat}
          aria-label="Repeat"
        >
          <IoRepeat />
          {repeatMode === 'one' && <span className="exp-player__repeat-one">1</span>}
        </button>
      </div>

      {/* Bottom Row: Volume + Queue + Share */}
      <div className="exp-player__bottom-row">
        <button className="exp-player__vol-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <IoVolumeMute /> : volume < 0.5 ? <IoVolumeMedium /> : <IoVolumeHigh />}
        </button>
        <button
          className="exp-player__queue-btn"
          onClick={() => { toggleQueue(); onClose(); }}
          aria-label="Queue"
        >
          <IoList />
        </button>
        <button
          className="exp-player__share-btn"
          onClick={() => setShowShareModal(true)}
          aria-label="Share"
        >
          <IoShareSocial />
        </button>
      </div>

      {/* Render Spotify Clips Full-Screen Reel via React Portal so it truly overlays everything */}
      {showClips && createPortal(
        <Clips song={currentSong} clipId={clipData?.videoId} onClose={() => setShowClips(false)} />,
        document.body
      )}

      {showShareModal && (
        <ShareModal song={currentSong} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}
