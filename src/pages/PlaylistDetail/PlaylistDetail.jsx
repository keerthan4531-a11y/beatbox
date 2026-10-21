import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlaylistById, getHomepageData, searchSongs } from '../../api/saavn';
import { usePlayer } from '../../context/PlayerContext';
import { getHighQualityImage, decodeHTML } from '../../utils/helpers';
import SongRow from '../../components/SongRow/SongRow';
import Loader from '../../components/Loader/Loader';
import SectionHeader from '../../components/SectionHeader/SectionHeader';
import { IoArrowBack, IoPlay, IoTimeOutline, IoMusicalNotes } from 'react-icons/io5';
import '../AlbumDetail/AlbumDetail.css'; // Reusing AlbumDetail styles since the layout is identical

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playSong } = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [recData, setRecData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matchSongs, setMatchSongs] = useState([]);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchLoaded, setMatchLoaded] = useState(false);

  const loadMatchingSongs = async () => {
    if (!playlist) return;
    setLoadingMatch(true);
    try {
      const query = playlist.name || playlist.title || 'Latest Tamil Hits';
      const cleanQuery = query.replace(/playlist|daily|mix/gi, '').trim() + ' tamil hits';
      const data = await searchSongs(cleanQuery, 20);
      const searchResults = data?.results || [];

      const existingIds = (playlist.songs || []).map(s => s.id);
      const uniqueResults = searchResults.filter(s => s && !existingIds.includes(s.id));

      setMatchSongs(uniqueResults.slice(0, 15));
      setMatchLoaded(true);
    } catch (e) {
      console.warn('Failed to load matching songs:', e);
    }
    setLoadingMatch(false);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (id && id.startsWith('daily-mix-')) {
          const cached = localStorage.getItem('beatbox_daily_mixes');
          if (cached) {
            const mixes = JSON.parse(cached);
            const mix = mixes.find(m => m.id === id);
            if (mix) {
              setPlaylist(mix);
              const rec = await getHomepageData('tamil');
              setRecData(rec);
              setLoading(false);
              return;
            }
          }
        }

        const [pl, rec] = await Promise.all([
          getPlaylistById(id),
          getHomepageData('tamil')
        ]);
        setPlaylist(pl);
        setRecData(rec);
      } catch (err) {
        console.error('Failed to fetch playlist data:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="album-detail-page"><Loader /></div>;
  if (!playlist) return <div className="album-detail-page"><p>Playlist not found</p></div>;

  const songs = playlist.songs || [];
  const artwork = getHighQualityImage(playlist.image);
  const title = decodeHTML(playlist.name || playlist.title);
  const subtitle = playlist.subtitle || playlist.fanCount ? `${playlist.fanCount} Fans` : 'Curated Playlist';

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playSong(songs[0], songs, 0);
    }
  };

  return (
    <div className="album-detail-page" id="playlist-detail">
      {/* Header / Banner */}
      <div className="album-detail__header" style={playlist?.gradient ? { background: playlist.gradient } : {}}>
        <button className="album-detail__back" onClick={() => navigate(-1)}>
          <IoArrowBack size={24} />
        </button>

        <div className="album-detail__info">
          <div className="album-detail__artwork-wrap">
            <img src={artwork} alt={title} className="album-detail__artwork" />
          </div>
          <div className="album-detail__meta">
            <span className="album-detail__type">PLAYLIST</span>
            <h1 className="album-detail__title">{title}</h1>
            <div className="album-detail__artist-row">
              <span className="album-detail__artist-name">{subtitle}</span>
              <span className="album-detail__dot">•</span>
              <span className="album-detail__count">{songs.length} songs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="album-detail__actions">
        <button className="album-detail__play-btn" onClick={handlePlayAll}>
          <IoPlay size={24} />
        </button>
      </div>

      {/* List Header */}
      <div className="album-detail__list-header">
        <div className="col-idx">#</div>
        <div className="col-title">Title</div>
        <div className="col-album">Album</div>
        <div className="col-time"><IoTimeOutline size={18} /></div>
      </div>

      {/* Songs List */}
      <div className="album-detail__songs">
        {songs.length > 0 ? (
          songs.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              index={i}
              queue={songs}
              showAlbum={true}
            />
          ))
        ) : (
          <div className="album-detail__empty">
            <IoMusicalNotes size={48} />
            <p>No songs found in this playlist</p>
          </div>
        )}
      </div>

      {/* Add More Section */}
      <div className="album-detail__add-more-section">
        {!matchLoaded && !loadingMatch && (
          <button
            className="add-more-btn glass-panel spring-haptic"
            onClick={loadMatchingSongs}
          >
            ➕ Add More 💙!!
          </button>
        )}

        {loadingMatch && (
          <div className="add-more-loading">
            <div className="share-spinner"></div>
            <p>Finding matching Tamil songs...</p>
          </div>
        )}

        {matchLoaded && matchSongs.length > 0 && (
          <div className="add-more-results animate-fade-in">
            <h3 className="add-more-title">✨ Recommended Additions</h3>
            <div className="album-detail__songs">
              {matchSongs.map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={songs.length + i}
                  queue={[...songs, ...matchSongs]}
                  showAlbum={true}
                />
              ))}
            </div>
          </div>
        )}

        {matchLoaded && matchSongs.length === 0 && (
          <p className="add-more-empty">All matched songs are already in this playlist!</p>
        )}
      </div>

      {/* Recommendations (JioSaavn Style) */}
      <div className="album-detail__recommendations">
        {recData?.trending && (
          <div className="album-detail__section">
            <SectionHeader
              title="You Might Like"
              actionLabel="See All"
              onAction={() => navigate('/category/featured playlists tamil', { state: { usePlaylists: true, title: 'Featured Tamil Playlists' } })}
            />
            <div className="album-detail__horizontal-scroll">
              {recData.trending.slice(0, 10).map((pl) => (
                <div
                  key={pl.id}
                  className="spotify-card"
                  onClick={() => pl.type === 'playlist' ? navigate(`/playlist/${pl.id}`) : navigate(`/album/${pl.id}`)}
                >
                  <div className="spotify-card__img-container">
                    <img src={getHighQualityImage(pl.image)} alt={pl.title} className="spotify-card__img" loading="lazy" />
                    <div className="spotify-card__play">▶</div>
                  </div>
                  <h4 className="spotify-card__title">{decodeHTML(pl.title || pl.name)}</h4>
                  <p className="spotify-card__desc">{pl.subtitle || 'Recommendation'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recData?.newAlbums && (
          <div className="album-detail__section">
            <SectionHeader
              title="Currently Trending Albums"
              actionLabel="See All"
              onAction={() => navigate('/category/trending tamil')}
            />
            <div className="album-detail__horizontal-scroll">
              {recData.newAlbums.slice(0, 10).map((album) => (
                <div
                  key={album.id}
                  className="spotify-card"
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <div className="spotify-card__img-container">
                    <img src={getHighQualityImage(album.image)} alt={album.title} className="spotify-card__img" loading="lazy" />
                    <div className="spotify-card__play">▶</div>
                  </div>
                  <h4 className="spotify-card__title">{decodeHTML(album.title || album.name)}</h4>
                  <p className="spotify-card__desc">{album.primaryArtists || 'Trending Album'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
