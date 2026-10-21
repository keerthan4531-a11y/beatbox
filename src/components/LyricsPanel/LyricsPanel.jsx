import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IoClose, IoMusicalNotes, IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack } from 'react-icons/io5';
import { getLyrics } from '../../api/saavn';
import { getHighQualityImage, decodeHTML, getArtistNames, formatDuration } from '../../utils/helpers';
import { usePlayer } from '../../context/PlayerContext';
import LyricRainCanvas from './LyricRainCanvas';
import './LyricsPanel.css';

/**
 * LyricsPanel — Fetches lyrics from JioSaavn native API first,
 * falls back to lyrics.ovh / lyrist external APIs
 */

const LYRICS_CACHE = {};

function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
  
  lines.forEach(line => {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseInt(msStr, 10);
      const timeInSeconds = min * 60 + sec + (ms / (msStr.length === 3 ? 1000 : 100));
      const text = line.replace(timeRegex, '').trim();
      if (text) {
         result.push({ time: timeInSeconds, text });
      }
    }
  });
  return result;
}

async function fetchLyrics(songId, title, artist) {
  const key = songId || `${title}__${artist}`;
  if (LYRICS_CACHE[key]) return LYRICS_CACHE[key];

  try {
    const res = await getLyrics(songId, title, artist);
    const lyricsText = res?.lyrics || res?.data?.lyrics || null;
    const copyright = res?.copyright || res?.data?.copyright || '';
    const isSynced = res?.isSynced || res?.data?.isSynced || false;

    if (lyricsText && lyricsText.length > 20) {
      if (isSynced || lyricsText.includes('[00:')) {
        const syncedLines = parseLRC(lyricsText);
        if (syncedLines.length > 0) {
          const result = { lines: syncedLines, isSynced: true, copyright };
          LYRICS_CACHE[key] = result;
          return result;
        }
      }

      // Plain text fallback
      const lines = lyricsText
        .replace(/<br\s*\/?>/gi, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      
      if (lines.length > 0) {
        const result = { lines, isSynced: false, copyright };
        LYRICS_CACHE[key] = result;
        return result;
      }
    }
  } catch (err) {
    console.debug('[Lyrics] Fetch failed:', err);
  }

  return null;
}

export default function LyricsPanel({ song, currentTime, onClose }) {
  const { isPlaying, togglePlay, nextSong, prevSong, duration, seekTo } = usePlayer();
  const [lyricsData, setLyricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rainMode, setRainMode] = useState(false);
  const [showVibeBoard, setShowVibeBoard] = useState(false);
  const [capturedVibes, setCapturedVibes] = useState([]);
  
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const progressRef = useRef(null);
  
  // Progress bar drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const title = decodeHTML(song?.name || song?.title || '');
  const artist = getArtistNames(song?.artists, song?.primaryArtists) || '';
  const songId = song?.id || '';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    setLyricsData(null);

    if (!title || !artist) {
      setLoading(false);
      setError(true);
      return;
    }

    fetchLyrics(songId, title, artist).then(result => {
      if (!mounted) return;
      if (result) {
        setLyricsData(result);
      } else {
        setError(true);
      }
      setLoading(false);
    });

    // Load vibes from localStorage
    const cached = localStorage.getItem('beatbox_captured_vibes');
    if (cached) {
      try {
        setCapturedVibes(JSON.parse(cached));
      } catch (e) {}
    }

    return () => { mounted = false; };
  }, [songId, title, artist]);

  const handleCaptureWord = (word) => {
    setCapturedVibes((prev) => {
      const cleaned = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").trim();
      if (!cleaned || prev.includes(cleaned)) return prev;
      const next = [cleaned, ...prev];
      localStorage.setItem('beatbox_captured_vibes', JSON.stringify(next));
      return next;
    });
  };

  const lyrics = lyricsData?.lines || null;
  const isSynced = lyricsData?.isSynced || false;
  const copyright = lyricsData?.copyright || '';

  // ── Drag Logic for Progress Bar ──
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
    if (e.cancelable) e.preventDefault();
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
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(percent * duration);
  }, [duration, seekTo]);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration ? (displayTime / duration) * 100 : 0;

  // ── Active Line Tracking ──
  let activeLine = -1;
  if (isSynced && lyrics) {
    activeLine = lyrics.reduce((acc, curr, idx) => {
      if (displayTime + 0.3 >= curr.time) return idx;
      return acc;
    }, -1);
  }

  // Auto-scroll to active line
  useEffect(() => {
    if (isSynced && activeLineRef.current && activeLine !== -1 && !isDragging) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLine, isSynced, isDragging]);

  return (
    <div className="lyrics-panel" id="lyrics-panel">
      <div 
        className="lyrics-panel__bg" 
        style={{ backgroundImage: `url(${getHighQualityImage(song?.image)})` }} 
      />
      <div className="lyrics-panel__overlay" />

      <div className="lyrics-panel__header">
        <h3><IoMusicalNotes /> Lyrics</h3>
        {lyrics && !loading && (
          <div className="lyrics-panel__mode-selector glass-panel">
            <button 
              className={`mode-btn ${!rainMode ? 'active' : ''}`}
              onClick={() => setRainMode(false)}
            >
              Normal
            </button>
            <button 
              className={`mode-btn ${rainMode ? 'active' : ''}`}
              onClick={() => setRainMode(true)}
            >
              🌧️ Rain
            </button>
          </div>
        )}
        {lyrics && !loading && (
          <button 
            className={`lyrics-panel__vibe-btn glass-panel ${showVibeBoard ? 'active' : ''}`} 
            onClick={() => setShowVibeBoard(v => !v)}
          >
            ✨ Vibes ({capturedVibes.length})
          </button>
        )}
        <button className="lyrics-panel__close" onClick={onClose}>
          <IoClose />
        </button>
      </div>

      <div className="lyrics-panel__body" ref={containerRef} style={{ padding: rainMode ? 0 : undefined, overflow: rainMode ? 'hidden' : undefined }}>
        {loading && (
          <div className="lyrics-panel__loading">
            <div className="lyrics-spinner"></div>
            <p>Finding lyrics...</p>
          </div>
        )}

        {error && !loading && (
          <div className="lyrics-panel__error">
            <IoMusicalNotes className="big-icon" />
            <p>Lyrics not available for this song</p>
            <span>Try searching "<em>{title}</em>" lyrics online</span>
          </div>
        )}

        {lyrics && !loading && (
          rainMode ? (
            <LyricRainCanvas 
              song={song} 
              activeLine={activeLine} 
              lyrics={lyrics} 
              isSynced={isSynced} 
              onCapture={handleCaptureWord} 
            />
          ) : (
            <>
              <div className="lyrics-panel__lines">
                {lyrics.map((lineObj, idx) => {
                  const text = isSynced ? lineObj.text : lineObj;
                  return (
                    <p
                      key={idx}
                      ref={idx === activeLine ? activeLineRef : null}
                      className={`lyrics-line ${idx === activeLine ? 'active' : ''} ${idx < activeLine ? 'past' : ''}`}
                      onClick={() => {
                        if (isSynced && lineObj.time) {
                          seekTo(lineObj.time);
                        }
                      }}
                      style={{ cursor: isSynced ? 'pointer' : 'default' }}
                    >
                      {decodeHTML(text)}
                    </p>
                  );
                })}
              </div>
              {copyright && (
                <div className="lyrics-panel__copyright">
                  <small>{copyright}</small>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ── Mini Player Controls at Bottom ── */}
      <div className="lyrics-panel__controls-wrapper">
        <div className="lyrics-panel__progress-section">
          <span className="lyrics-panel__time">{formatDuration(displayTime)}</span>
          <div
            className={`lyrics-panel__progress-bar ${isDragging ? 'dragging' : ''}`}
            ref={progressRef}
            onClick={handleProgressClick}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <div className="lyrics-panel__progress-fill" style={{ width: `${progressPercent}%` }}>
              <div className="lyrics-panel__progress-thumb" />
            </div>
          </div>
          <span className="lyrics-panel__time">{formatDuration(duration)}</span>
        </div>

        <div className="lyrics-panel__controls">
          <button className="lyrics-panel__ctrl-btn" onClick={prevSong} aria-label="Previous">
            <IoPlaySkipBack />
          </button>
          <button className="lyrics-panel__play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <IoPause /> : <IoPlay style={{ marginLeft: 3 }} />}
          </button>
          <button className="lyrics-panel__ctrl-btn" onClick={nextSong} aria-label="Next">
            <IoPlaySkipForward />
          </button>
        </div>
      </div>

      {/* ── Sliding Glass Vibe Board Panel ── */}
      {showVibeBoard && (
        <div className="vibe-board glass-panel" onClick={e => e.stopPropagation()}>
          <div className="vibe-board__header">
            <h4>✨ Captured Vibes</h4>
            <button className="vibe-board__close" onClick={() => setShowVibeBoard(false)}>
              <IoClose />
            </button>
          </div>
          <div className="vibe-board__content">
            {capturedVibes.length === 0 ? (
              <p className="empty-vibes">Tap falling words in Lyric Rain mode to capture them here!</p>
            ) : (
              <div className="vibe-chips">
                {capturedVibes.map((vibe, idx) => (
                  <span key={idx} className="vibe-chip animate-fade-in">
                    {vibe}
                    <button 
                      className="delete-vibe"
                      onClick={() => {
                        const next = capturedVibes.filter((_, i) => i !== idx);
                        setCapturedVibes(next);
                        localStorage.setItem('beatbox_captured_vibes', JSON.stringify(next));
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
