import React, { useRef, useCallback, useState } from 'react';
import {
  IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack,
  IoShuffle, IoRepeat, IoVolumeHigh, IoVolumeMute, IoVolumeMedium,
  IoHeart, IoHeartOutline, IoChevronDown, IoEllipsisHorizontal,
  IoList, IoShareSocial, IoAdd
} from 'react-icons/io5';
import { usePlayer } from '../../context/PlayerContext';
import { getHighQualityImage, decodeHTML, getArtistNames, formatDuration } from '../../utils/helpers';
import './ExpandedPlayer.css';

export default function ExpandedPlayer({ onClose }) {
  const {
    currentSong, isPlaying, togglePlay, nextSong, prevSong,
    duration, currentTime, seekTo, volume, setVolume,
    isMuted, toggleMute, isShuffled, toggleShuffle,
    repeatMode, cycleRepeat, toggleLike, isLiked,
    toggleQueue, queue, addToQueue,
  } = usePlayer();

  const progressRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleProgressClick = useCallback((e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(percent * duration);
  }, [duration, seekTo]);

  if (!currentSong) return null;

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const liked = isLiked(currentSong.id);
  const albumArt = getHighQualityImage(currentSong.image);
  const artistName = getArtistNames(currentSong.artists, currentSong.primaryArtists);

  return (
    <div className="exp-player" id="expanded-player">
      {/* Blurred background from album art */}
      <div
        className="exp-player__bg"
        style={{ backgroundImage: `url(${albumArt})` }}
      />
      <div className="exp-player__overlay" />

      {/* Header */}
      <div className="exp-player__header">
        <button className="exp-player__down-btn" onClick={onClose} aria-label="Close">
          <IoChevronDown />
        </button>
        <div className="exp-player__header-info">
          <span className="exp-player__context">Now Playing</span>
        </div>
        <button
          className="exp-player__menu-btn"
          onClick={() => setShowMenu(v => !v)}
          aria-label="More options"
        >
          <IoEllipsisHorizontal />
        </button>
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
          <button onClick={() => {
            if (navigator.share) navigator.share({ title: decodeHTML(currentSong.name), text: artistName });
            setShowMenu(false);
          }}>
            <IoShareSocial /> Share Song
          </button>
        </div>
      )}

      {/* Album Art */}
      <div className="exp-player__art-wrapper">
        <img
          className={`exp-player__art ${isPlaying ? 'playing' : ''}`}
          src={albumArt}
          alt={decodeHTML(currentSong.name)}
        />
      </div>

      {/* Song Info + Like */}
      <div className="exp-player__info-row">
        <div className="exp-player__info">
          <h2 className="exp-player__title">{decodeHTML(currentSong.name)}</h2>
          <p className="exp-player__artist">{artistName}</p>
        </div>
        <button
          className={`exp-player__like-btn ${liked ? 'liked' : ''}`}
          onClick={() => toggleLike(currentSong)}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <IoHeart /> : <IoHeartOutline />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="exp-player__progress-section">
        <div
          className="exp-player__progress-bar"
          ref={progressRef}
          onClick={handleProgressClick}
        >
          <div className="exp-player__progress-fill" style={{ width: `${progressPercent}%` }}>
            <div className="exp-player__progress-thumb" />
          </div>
        </div>
        <div className="exp-player__times">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="exp-player__controls">
        <button
          className={`exp-player__ctrl-btn ${isShuffled ? 'active' : ''}`}
          onClick={toggleShuffle}
          aria-label="Shuffle"
        >
          <IoShuffle />
        </button>
        <button className="exp-player__ctrl-btn" onClick={prevSong} aria-label="Previous">
          <IoPlaySkipBack />
        </button>
        <button className="exp-player__play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <IoPause /> : <IoPlay style={{ marginLeft: 3 }} />}
        </button>
        <button className="exp-player__ctrl-btn" onClick={nextSong} aria-label="Next">
          <IoPlaySkipForward />
        </button>
        <button
          className={`exp-player__ctrl-btn ${repeatMode !== 'off' ? 'active' : ''}`}
          onClick={cycleRepeat}
          aria-label="Repeat"
        >
          <IoRepeat />
          {repeatMode === 'one' && <span className="exp-player__repeat-one">1</span>}
        </button>
      </div>

      {/* Bottom Row: Volume + Queue */}
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
          onClick={() => {
            if (navigator.share) navigator.share({ title: decodeHTML(currentSong.name), text: artistName });
          }}
          aria-label="Share"
        >
          <IoShareSocial />
        </button>
      </div>
    </div>
  );
}
