import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { getBestDownloadUrl, getHighQualityImage, decodeHTML, getArtistNames } from '../utils/helpers';
import { updateNativeNotification } from '../utils/nativeMediaBridge';

const PlayerContext = createContext(null);

const initialState = {
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 0.8,
  isMuted: false,
  isShuffled: false,
  repeatMode: 'off', // off | one | all
  isLoading: false,
  recentlyPlayed: [],
  likedSongs: [],
  showQueue: false,
  showSettings: false,
  dataSaver: JSON.parse(localStorage.getItem('beatbox_data_saver') || 'false'),
  audioQuality: localStorage.getItem('beatbox_audio_quality') || '320kbps', // 160kbps | 320kbps
  crossfade: JSON.parse(localStorage.getItem('beatbox_crossfade') || 'false'),
  gapless: JSON.parse(localStorage.getItem('beatbox_gapless') || 'true'),
  isAuthenticated: JSON.parse(localStorage.getItem('beatbox_auth') || 'false'),
  userProfile: JSON.parse(localStorage.getItem('beatbox_profile') || 'null'),
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'SET_SONG':
      return {
        ...state,
        currentSong: action.payload.song,
        queue: action.payload.queue || state.queue,
        queueIndex: action.payload.index ?? 0,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
      };

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'SET_DURATION':
      return { ...state, duration: action.payload };

    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };

    case 'SET_VOLUME':
      return { ...state, volume: action.payload, isMuted: action.payload === 0 };

    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'TOGGLE_SHUFFLE':
      return { ...state, isShuffled: !state.isShuffled };

    case 'CYCLE_REPEAT':
      const modes = ['off', 'all', 'one'];
      const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
      return { ...state, repeatMode: modes[nextIndex] };

    case 'NEXT_SONG': {
      if (state.queue.length === 0) return state;
      let nextIdx = state.queueIndex + 1;
      if (nextIdx >= state.queue.length) {
        if (state.repeatMode === 'all') nextIdx = 0;
        else return { ...state, isPlaying: false };
      }
      return {
        ...state,
        currentSong: state.queue[nextIdx],
        queueIndex: nextIdx,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
      };
    }

    case 'PREV_SONG': {
      if (state.queue.length === 0) return state;
      let prevIdx = state.queueIndex - 1;
      if (prevIdx < 0) {
        if (state.repeatMode === 'all') prevIdx = state.queue.length - 1;
        else prevIdx = 0;
      }
      return {
        ...state,
        currentSong: state.queue[prevIdx],
        queueIndex: prevIdx,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
      };
    }

    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, action.payload] };

    case 'APPEND_TO_QUEUE':
      return { ...state, queue: [...state.queue, ...action.payload] };

    case 'REMOVE_FROM_QUEUE': {
      const newQueue = state.queue.filter((_, i) => i !== action.payload);
      let newIndex = state.queueIndex;
      if (action.payload < state.queueIndex) newIndex--;
      return { ...state, queue: newQueue, queueIndex: Math.max(0, newIndex) };
    }

    case 'CLEAR_QUEUE':
      return { ...state, queue: [], queueIndex: -1 };

    case 'TOGGLE_QUEUE':
      return { ...state, showQueue: !state.showQueue };

    case 'ADD_TO_RECENTLY_PLAYED': {
      const filtered = state.recentlyPlayed.filter(s => s.id !== action.payload.id);
      return {
        ...state,
        recentlyPlayed: [action.payload, ...filtered].slice(0, 30),
      };
    }

    case 'TOGGLE_LIKE': {
      const isLiked = state.likedSongs.some(s => s.id === action.payload.id);
      return {
        ...state,
        likedSongs: isLiked
          ? state.likedSongs.filter(s => s.id !== action.payload.id)
          : [action.payload, ...state.likedSongs],
      };
    }

    case 'LOAD_SAVED_STATE':
      return { ...state, ...action.payload };

    case 'TOGGLE_SETTINGS': {
      return { ...state, showSettings: !state.showSettings };
    }

    case 'TOGGLE_DATA_SAVER': {
      const newState = !state.dataSaver;
      localStorage.setItem('beatbox_data_saver', JSON.stringify(newState));
      return { ...state, dataSaver: newState };
    }

    case 'SET_AUDIO_QUALITY': {
      localStorage.setItem('beatbox_audio_quality', action.payload);
      return { ...state, audioQuality: action.payload };
    }

    case 'TOGGLE_CROSSFADE': {
      const newState = !state.crossfade;
      localStorage.setItem('beatbox_crossfade', JSON.stringify(newState));
      return { ...state, crossfade: newState };
    }

    case 'TOGGLE_GAPLESS': {
      const newState = !state.gapless;
      localStorage.setItem('beatbox_gapless', JSON.stringify(newState));
      return { ...state, gapless: newState };
    }

    case 'LOGIN': {
      const profile = { name: action.payload.name, email: action.payload.email, avatar: `https://ui-avatars.com/api/?name=${action.payload.name}&background=00d2ff&color=10001a` };
      localStorage.setItem('beatbox_auth', 'true');
      localStorage.setItem('beatbox_profile', JSON.stringify(profile));
      return { ...state, isAuthenticated: true, userProfile: profile };
    }

    case 'LOGOUT': {
      localStorage.setItem('beatbox_auth', 'false');
      localStorage.removeItem('beatbox_profile');
      return { ...state, isAuthenticated: false, userProfile: null };
    }

    default:
      return state;
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef(new Audio());
  // Refs to track latest state values without re-registering event listeners
  const isPlayingRef = useRef(state.isPlaying);
  const repeatModeRef = useRef(state.repeatMode);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = state.isPlaying; }, [state.isPlaying]);
  useEffect(() => { repeatModeRef.current = state.repeatMode; }, [state.repeatMode]);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('beatbox-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({
          type: 'LOAD_SAVED_STATE',
          payload: {
            likedSongs: parsed.likedSongs || [],
            recentlyPlayed: parsed.recentlyPlayed || [],
            volume: parsed.volume ?? 0.8,
          },
        });
      }
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('beatbox-state', JSON.stringify({
        likedSongs: state.likedSongs,
        recentlyPlayed: state.recentlyPlayed,
        volume: state.volume,
        audioQuality: state.audioQuality,
        crossfade: state.crossfade,
        gapless: state.gapless,
      }));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }, [state.likedSongs, state.recentlyPlayed, state.volume, state.audioQuality, state.crossfade, state.gapless]);

  // 🔧 Helper: Play audio with retry (fixes background playback stuck issue)
  const playWithRetry = useCallback((audio, attempts = 3) => {
    if (!audio || !audio.src) return;
    const tryPlay = (remaining) => {
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.warn(`[BeatBox] play() failed (${remaining} retries left):`, err.message);
          if (remaining > 0) {
            setTimeout(() => tryPlay(remaining - 1), 500);
          }
        });
      }
    };
    tryPlay(attempts);
  }, []);

  // Audio element event handlers — registered ONCE, use refs for latest state
  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'auto';

    const onLoadedMetadata = () => {
      dispatch({ type: 'SET_DURATION', payload: audio.duration });
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    const onTimeUpdate = () => {
      dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime });
    };

    const onEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        playWithRetry(audio);
      } else {
        // Dispatch directly without setTimeout to avoid Doze mode throttling
        dispatch({ type: 'NEXT_SONG' });
      }
    };

    const onError = (e) => {
      console.error('[BeatBox] Audio error:', e);
      dispatch({ type: 'SET_LOADING', payload: false });
      // Auto-skip to next song on persistent error
      setTimeout(() => {
        dispatch({ type: 'NEXT_SONG' });
      }, 1500);
    };

    const onCanPlay = () => {
      dispatch({ type: 'SET_LOADING', payload: false });
      // Only play if it's currently paused to avoid micro-stutters from redundant play() calls
      if (isPlayingRef.current && audio.paused) {
        playWithRetry(audio);
      }
    };

    const onWaiting = () => {
      dispatch({ type: 'SET_LOADING', payload: true });
    };

    const onPlaying = () => {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_PLAYING', payload: true });
    };

    // 🔧 FIX: Handle audio stall (network buffer underrun)
    const onStalled = () => {
      console.warn('[BeatBox] Audio stalled, attempting recovery...');
      if (isPlayingRef.current && audio.src) {
        setTimeout(() => {
          if (audio.paused && isPlayingRef.current) {
            playWithRetry(audio, 2);
          }
        }, 1000);
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('stalled', onStalled);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('stalled', onStalled);
    };
  }, [playWithRetry]);

  // Play/pause effect
  useEffect(() => {
    const audio = audioRef.current;
    if (state.isPlaying && audio.src) {
      playWithRetry(audio);
      
      // Force MediaSession sync on play
      if ('mediaSession' in navigator && state.currentSong) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else {
      audio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [state.isPlaying, state.currentSong?.id, playWithRetry]);

  // Volume effect
  useEffect(() => {
    audioRef.current.volume = state.isMuted ? 0 : state.volume;
  }, [state.volume, state.isMuted]);

  // 🔧 Load new song with Quality Logic + Preview Marker Strip
  useEffect(() => {
    if (!state.currentSong) return;
    
    const song = state.currentSong;
    const audio = audioRef.current;
    
    // Use pre-computed streamUrl first, then fall back to quality picker
    const useHighQuality = state.audioQuality === '320kbps' && !state.dataSaver;
    let url = song.streamUrl || getBestDownloadUrl(song.downloadUrl, !useHighQuality);
    
    // 🔧 Strip preview marker from URL to ensure full song plays
    if (url && typeof url === 'string') {
      url = url.replace(/_p\.mp4/g, '.mp4').replace(/_p\.m4a/g, '.m4a').replace(/_p\.aac/g, '.aac');
    }
    
    if (!url) return;

    const doLoad = () => {
      // Pause old source cleanly before switching
      audio.pause();
      audio.src = url;
      audio.load();
      
      // Request play immediately instead of waiting for canplay.
      // This creates a Promise that the browser honors natively,
      // avoiding JS event loop throttling in the background.
      if (isPlayingRef.current) {
        playWithRetry(audio);
      }
    };
    
    // Skip crossfade if running in Capacitor (Android) as setInterval is throttled
    const isCapacitor = !!window.Capacitor;
    
    if (state.crossfade && audio.src && !audio.paused && !isCapacitor) {
       let vol = state.volume;
       const fadeOut = setInterval(() => {
         vol -= 0.1;
         if (vol <= 0) {
           clearInterval(fadeOut);
           doLoad();
           audio.volume = state.isMuted ? 0 : state.volume;
         } else {
           audio.volume = Math.max(0, vol);
         }
       }, 100);
    } else {
      doLoad();
    }
    dispatch({ type: 'ADD_TO_RECENTLY_PLAYED', payload: song });
  }, [state.currentSong?.id, state.audioQuality]);


  // Android Back Button Fix
  useEffect(() => {
    const handleBackButton = (e) => {
      // If we are not at home, go back instead of exiting
      if (window.location.pathname !== '/') {
        e.preventDefault();
        window.history.back();
      }
    };

    window.addEventListener('popstate', handleBackButton);
    // For actual Android WebView/Capacitor/Cordova environments:
    document.addEventListener('backbutton', handleBackButton, false);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, []);

  // 🔧 FIX: Resume playback when page becomes visible again (Android lock/unlock)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isPlayingRef.current) {
        const audio = audioRef.current;
        if (audio.src && audio.paused) {
          console.log('[BeatBox] Page visible, resuming playback...');
          playWithRetry(audio, 3);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [playWithRetry]);

  // 🔧 FIX: Listen for native media control actions from Android notification/lock screen
  // MainActivity injects JS that dispatches 'beatbox-media-action' events
  useEffect(() => {
    const handleNativeAction = (event) => {
      const action = event.detail?.action;
      if (!action) return;
      
      console.log('[BeatBox] Native media action received:', action);
      
      switch (action) {
        case 'play':
          if (!isPlayingRef.current) {
            dispatch({ type: 'SET_PLAYING', payload: true });
          }
          break;
        case 'pause':
          if (isPlayingRef.current) {
            dispatch({ type: 'SET_PLAYING', payload: false });
          }
          break;
        case 'next':
          dispatch({ type: 'NEXT_SONG' });
          break;
        case 'prev':
          if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
          } else {
            dispatch({ type: 'PREV_SONG' });
          }
          break;
        default:
          if (action.startsWith('seek:')) {
            const pos = parseInt(action.split(':')[1], 10);
            if (!isNaN(pos)) {
              audioRef.current.currentTime = pos / 1000; // Android sends ms
              dispatch({ type: 'SET_CURRENT_TIME', payload: pos / 1000 });
            }
          }
          break;
      }
    };

    window.addEventListener('beatbox-media-action', handleNativeAction);
    return () => window.removeEventListener('beatbox-media-action', handleNativeAction);
  }, []);

  // Smart Suggestions (Spotify-like Autoplay)
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    // Pre-fetch suggestions when we are 3 songs away from the end of the queue
    if (state.queue.length > 0 && state.queueIndex >= state.queue.length - 3 && !isFetchingRef.current) {
      const currentId = state.currentSong?.id;
      if (currentId) {
        isFetchingRef.current = true;
        import('../api/saavn').then(({ getSongSuggestions }) => {
          getSongSuggestions(currentId, 50).then(suggestions => {
            if (!mounted) return;
            if (suggestions && suggestions.length > 0) {
              // Filter out songs that are already in the queue to avoid duplicates
              const newSongs = suggestions.filter(s => !state.queue.some(q => q.id === s.id));
              if (newSongs.length > 0) {
                dispatch({ type: 'APPEND_TO_QUEUE', payload: newSongs });
              }
            }
            // Add a small delay before allowing another fetch
            setTimeout(() => {
              if (mounted) isFetchingRef.current = false;
            }, 5000);
          }).catch(err => {
            console.error("Auto-play suggestion error:", err);
            if (mounted) isFetchingRef.current = false;
          });
        });
      }
    }
    return () => { mounted = false; };
  }, [state.queueIndex, state.queue.length, state.currentSong?.id]);

  const playSong = useCallback((song, queue = [], index = 0) => {
    dispatch({ type: 'SET_SONG', payload: { song, queue: queue.length > 0 ? queue : [song], index } });
  }, []);

  const togglePlay = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: !state.isPlaying });
  }, [state.isPlaying]);

  const nextSong = useCallback(() => {
    dispatch({ type: 'NEXT_SONG' });
  }, []);

  const prevSong = useCallback(() => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      dispatch({ type: 'PREV_SONG' });
    }
  }, []);

  const seekTo = useCallback((time) => {
    audioRef.current.currentTime = time;
    dispatch({ type: 'SET_CURRENT_TIME', payload: time });
  }, []);

  // 🔧 MediaSession API (Notification & Lock Screen Controls) — Fixed artwork URL
  useEffect(() => {
    if (!state.currentSong || !('mediaSession' in navigator)) return;

    const song = state.currentSong;
    // Use getHighQualityImage which handles both array and string formats
    const artworkUrl = getHighQualityImage(song.image);
    // Ensure artwork URL is absolute (relative URLs don't work in MediaSession)
    const absoluteArtwork = artworkUrl.startsWith('http') 
      ? artworkUrl 
      : `${window.location.origin}${artworkUrl}`;
    
    const title = decodeHTML(song.name || song.title || 'Unknown Title');
    const artist = getArtistNames(song.artists, song.primaryArtists) || 'BeatBox';
    const album = decodeHTML(song.album || 'BeatBox');

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: [
        { src: absoluteArtwork, sizes: '96x96', type: 'image/jpeg' },
        { src: absoluteArtwork, sizes: '128x128', type: 'image/jpeg' },
        { src: absoluteArtwork, sizes: '256x256', type: 'image/jpeg' },
        { src: absoluteArtwork, sizes: '512x512', type: 'image/jpeg' },
      ]
    });

    // Update position state
    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration || 0,
          playbackRate: audioRef.current.playbackRate || 1,
          position: Math.min(audioRef.current.currentTime || 0, audioRef.current.duration || 0),
        });
      } catch (e) { /* position state errors are non-critical */ }
    }

    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevSong();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextSong();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime) seekTo(details.seekTime);
    });

  }, [state.currentSong?.id, nextSong, prevSong, togglePlay, seekTo]);

  // Sync MediaSession Playback State & Keep Alive
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

    // Heartbeat to keep MediaSession alive on some Android devices
    const heartbeat = setInterval(() => {
      if (state.isPlaying && 'setPositionState' in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audioRef.current.duration || 0,
            playbackRate: audioRef.current.playbackRate || 1,
            position: Math.min(audioRef.current.currentTime || 0, audioRef.current.duration || 0),
          });
        } catch (e) { /* ignore */ }
      }
    }, 2000);

    return () => clearInterval(heartbeat);
  }, [state.isPlaying]);

  // 🔧 Sync with Android Native Media Notification (lock screen + notification panel)
  useEffect(() => {
    if (!state.currentSong) return;
    const song = state.currentSong;
    const artworkUrl = getHighQualityImage(song.image);
    // Ensure absolute URL for native layer
    const absoluteArtwork = artworkUrl.startsWith('http') 
      ? artworkUrl 
      : `${window.location.origin}${artworkUrl}`;
    const title = decodeHTML(song.name || song.title || 'BeatBox');
    const artist = getArtistNames(song.artists, song.primaryArtists);

    updateNativeNotification({
      title,
      artist,
      artwork: absoluteArtwork,
      isPlaying: state.isPlaying,
    });
  }, [state.currentSong?.id, state.isPlaying]);


  const setVolume = useCallback((vol) => {
    dispatch({ type: 'SET_VOLUME', payload: vol });
  }, []);

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  const toggleShuffle = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  }, []);

  const cycleRepeat = useCallback(() => {
    dispatch({ type: 'CYCLE_REPEAT' });
  }, []);

  const addToQueue = useCallback((song) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: song });
  }, []);

  const removeFromQueue = useCallback((index) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: index });
  }, []);

  const toggleQueue = useCallback(() => {
    dispatch({ type: 'TOGGLE_QUEUE' });
  }, []);

  const toggleLike = useCallback((song) => {
    dispatch({ type: 'TOGGLE_LIKE', payload: song });
  }, []);

  const isLiked = useCallback((songId) => {
    return state.likedSongs.some(s => s.id === songId);
  }, [state.likedSongs]);

  const toggleDataSaver = useCallback(() => {
    dispatch({ type: 'TOGGLE_DATA_SAVER' });
  }, []);

  const toggleSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS' });
  }, []);

  const login = useCallback((profile) => {
    dispatch({ type: 'LOGIN', payload: profile });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const value = {
    ...state,
    playSong,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    removeFromQueue,
    toggleQueue,
    toggleSettings,
    toggleLike,
    isLiked,
    toggleDataSaver,
    login,
    logout,
    audioRef,
    dispatch,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
