import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { searchSongs, searchAlbums } from '../../api/saavn';
import { usePlayer } from '../../context/PlayerContext';
import SongRow from '../../components/SongRow/SongRow';
import AlbumCard from '../../components/AlbumCard/AlbumCard';
import Loader from '../../components/Loader/Loader';
import { filterByLanguage } from '../../utils/userTaste';
import { IoPlay, IoShuffle, IoGrid, IoList } from 'react-icons/io5';
import './CategoryView.css';

export default function CategoryView() {
  const { query } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const title = location.state?.title || decodeURIComponent(query);
  const sortBy = location.state?.sortBy || null;
  // If navigated from an album section, show albums instead of songs
  const useAlbums = location.state?.useAlbums || false;
  const usePlaylists = location.state?.usePlaylists || false;

  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState(
    useAlbums ? 'albums' : (usePlaylists ? 'playlists' : 'songs')
  );
  const { playSong } = usePlayer();

  useEffect(() => {
    let mounted = true;
    setSongs([]);
    setAlbums([]);
    setPlaylists([]);
    setPage(1);
    setLoading(true);

    async function load() {
      try {
        if (viewMode === 'albums') {
          const data = await searchAlbums(decodeURIComponent(query), 40);
          if (mounted && data?.results) {
            setAlbums(data.results);
          }
        } else if (viewMode === 'playlists') {
          const data = await searchPlaylists(decodeURIComponent(query), 40);
          if (mounted && data?.results) {
            setPlaylists(data.results);
          }
        } else {
          const decodedQuery = decodeURIComponent(query);
          const data = await searchSongs(decodedQuery, 50, 1, sortBy);
          if (mounted && data?.results) {
            // Skip language filter if query already targets Tamil
            const isTamilQuery = decodedQuery.toLowerCase().includes('tamil');
            const filtered = isTamilQuery ? data.results : filterByLanguage(data.results);
            
            // Fallback: if 0 results, try simpler query variants
            if (filtered.length === 0) {
              const words = decodedQuery.split(' ').filter(w => w.toLowerCase() !== 'tamil');
              const fallbackQueries = [
                words.join(' '),                          // without 'tamil'
                `${words[0] || 'tamil'} songs`,           // first word + songs 
                'tamil hits',                             // ultimate fallback
              ];
              for (const fallback of fallbackQueries) {
                if (!mounted) break;
                const fb = await searchSongs(fallback, 50);
                const fbResults = isTamilQuery ? (fb?.results || []) : filterByLanguage(fb?.results || []);
                if (fbResults.length > 0) {
                  setSongs(fbResults);
                  if (location.state?.autoPlay && fbResults.length > 0) {
                    navigate(location.pathname, { replace: true, state: { ...location.state, autoPlay: false } });
                    playSong(fbResults[0], fbResults, 0);
                  }
                  break;
                }
              }
            } else {
              setSongs(filtered);
              if (location.state?.autoPlay && filtered.length > 0) {
                navigate(location.pathname, { replace: true, state: { ...location.state, autoPlay: false } });
                playSong(filtered[0], filtered, 0);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load category:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [query, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more songs (pagination — only in songs mode)
  useEffect(() => {
    if (page === 1) return;
    let mounted = true;
    async function loadMore() {
      try {
        const data = await searchSongs(decodeURIComponent(query), 50, page, sortBy);
        if (mounted && data?.results) {
          const filtered = filterByLanguage(data.results);
          setSongs(prev => [...prev, ...filtered]);
        }
      } catch {}
    }
    loadMore();
    return () => { mounted = false; };
  }, [page, query, sortBy]);

  const handlePlayAll = () => {
    if (songs.length > 0) playSong(songs[0], songs, 0);
  };

  const handleShufflePlay = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], shuffled, 0);
    }
  };

  if (loading && songs.length === 0 && albums.length === 0 && playlists.length === 0) return <Loader />;

  const getBannerUrl = (item) => {
    if (!item?.image) return '';
    if (Array.isArray(item.image)) {
      return item.image.find(i => i.quality === '500x500')?.url || item.image[item.image.length - 1]?.url || '';
    }
    return item.image; 
  };

  const bannerImage = viewMode === 'albums' 
    ? getBannerUrl(albums[0]) 
    : (viewMode === 'playlists' ? getBannerUrl(playlists[0]) : getBannerUrl(songs[0]));


  return (
    <div className="category-view animate-fade-in">
      <div className="category-view__header">
        <div
          className="category-view__header-bg"
          style={{ backgroundImage: bannerImage ? `url(${bannerImage})` : 'none' }}
        />
        <div className="category-view__header-content">
          {bannerImage && <img className="category-view__cover" src={bannerImage} alt={title} />}
          <div className="category-view__info">
            <span className="category-view__badge">
              {viewMode === 'albums' ? 'Albums' : (viewMode === 'playlists' ? 'Playlists' : 'Songs')}
            </span>
            <h1 className="category-view__title">{title}</h1>
            <p className="category-view__desc">
              {viewMode === 'albums'
                ? `${albums.length} albums found`
                : (viewMode === 'playlists' ? `${playlists.length} playlists found` : `Over ${songs.length} songs.`)}
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="category-view__actions">
        {viewMode === 'songs' && (
          <>
            <button className="category-view__play-btn" onClick={handlePlayAll}><IoPlay /></button>
            <button className="category-view__shuffle-btn" onClick={handleShufflePlay}><IoShuffle /></button>
          </>
        )}
        <div className="category-view__toggle">
          <button
            className={`category-view__toggle-btn${viewMode === 'playlists' ? ' active' : ''}`}
            onClick={() => setViewMode('playlists')}
          >
            Playlists
          </button>
          <button
            className={`category-view__toggle-btn${viewMode === 'albums' ? ' active' : ''}`}
            onClick={() => setViewMode('albums')}
          >
            Albums
          </button>
          <button
            className={`category-view__toggle-btn${viewMode === 'songs' ? ' active' : ''}`}
            onClick={() => setViewMode('songs')}
          >
            Songs
          </button>
        </div>
      </div>

      {/* Playlists grid */}
      {viewMode === 'playlists' && (
        <div className="category-view__albums-grid">
          {playlists.map((pl, i) => (
            <div
              key={`${pl.id}-${i}`}
              className="spotify-card"
              onClick={() => navigate(`/playlist/${pl.id}`)}
            >
              <div className="spotify-card__img-container">
                <img src={getBannerUrl(pl)} alt={pl.name} className="spotify-card__img" loading="lazy" />
                <div className="spotify-card__play">▶</div>
              </div>
              <h4 className="spotify-card__title">{decodeHTML(pl.name || pl.title)}</h4>
              <p className="spotify-card__desc">{pl.subtitle || 'Playlist'}</p>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'albums' && (
        <div className="category-view__albums-grid">
          {albums.map((album, i) => (
            <AlbumCard
              key={`${album.id}-${i}`}
              album={album}
              onClick={(a) => navigate(`/album/${a.id}`)}
            />
          ))}
          {albums.length === 0 && !loading && (
            <p style={{ color: 'rgba(255,255,255,0.5)', padding: '32px 0' }}>No albums found.</p>
          )}
        </div>
      )}

      {/* Songs list */}
      {viewMode === 'songs' && (
        <>
          <div className="category-view__list">
            {songs.map((song, idx) => (
              <SongRow
                key={`${song.id}-${idx}`}
                song={song}
                index={idx}
                queue={songs}
              />
            ))}
          </div>
          <div className="category-view__load-more">
            <button className="glass-btn" onClick={() => setPage(p => p + 1)}>
              Load More Songs
            </button>
          </div>
        </>
      )}
    </div>
  );
}
