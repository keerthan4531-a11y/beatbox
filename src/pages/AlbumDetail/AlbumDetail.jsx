import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAlbumById, getHomepageData, searchSongs } from '../../api/saavn';
import { usePlayer } from '../../context/PlayerContext';
import { getHighQualityImage, decodeHTML } from '../../utils/helpers';
import SongRow from '../../components/SongRow/SongRow';
import Loader from '../../components/Loader/Loader';
import SectionHeader from '../../components/SectionHeader/SectionHeader';
import { IoArrowBack, IoPlay, IoTimeOutline, IoMusicalNotes } from 'react-icons/io5';
import './AlbumDetail.css';

export default function AlbumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying, togglePlay } = usePlayer();
  const [album, setAlbum] = useState(null);
  const [recData, setRecData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [matchSongs, setMatchSongs] = useState([]);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchLoaded, setMatchLoaded] = useState(false);

  const loadMatchingSongs = async () => {
    if (!album) return;
    setLoadingMatch(true);
    try {
      const artistStr = album.primaryArtists || album.artist || '';
      const cleanArtist = artistStr.split(',')[0].split('&')[0].split(';')[0].trim() + ' tamil hits';
      const data = await searchSongs(cleanArtist, 20);
      const searchResults = data?.results || [];

      const existingIds = (album.songs || []).map(s => s.id);
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
        const [alb, rec] = await Promise.all([
          getAlbumById(id),
          getHomepageData('tamil')
        ]);
        setAlbum(alb);
        setRecData(rec);
      } catch (err) {
        console.error('Failed to fetch album data:', err);
      }
      setLoading(false);
    }
    fetchData();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id]);

  if (loading) return <div className="album-detail-page"><Loader /></div>;
  if (!album) return <div className="album-detail-page"><p>Album not found</p></div>;

  const songs = album.songs || [];
  const artwork = getHighQualityImage(album.image);
  const title = decodeHTML(album.name || album.title);
  const artist = album.primaryArtists || album.artist || 'Various Artists';
  const year = album.year || '';

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playSong(songs[0], songs, 0);
    }
  };

  return (
    <div className="album-detail-page" id="album-detail">
      {/* Dynamic Background */}
      <div className="album-detail__bg" style={{ backgroundImage: `url(${artwork})` }} />
      <div className="album-detail__overlay" />

      {/* Sticky Header */}
      <div className={`album-detail__sticky-header ${isScrolled ? 'visible' : ''}`}>
        <button className="album-detail__back-small" onClick={() => navigate(-1)}>
          <IoArrowBack size={20} />
        </button>
        <span className="album-detail__sticky-title">{title}</span>
        {songs.length > 0 && (
          <button className="album-detail__play-small" onClick={handlePlayAll}>
            <IoPlay size={20} />
          </button>
        )}
      </div>

      {/* Header / Banner */}
      <div className="album-detail__header">
        <button className="album-detail__back" onClick={() => navigate(-1)}>
          <IoArrowBack size={24} />
        </button>

        <div className="album-detail__info">
          <div className="album-detail__artwork-wrap">
            <img src={artwork} alt={title} className="album-detail__artwork" />
          </div>
          <div className="album-detail__meta">
            <span className="album-detail__type">ALBUM</span>
            <h1 className="album-detail__title">{title}</h1>
            <div className="album-detail__artist-row">
              <img src={artwork} className="album-detail__mini-artist-img" alt="" />
              <span className="album-detail__artist-name">{artist}</span>
              {year && <span className="album-detail__dot">•</span>}
              {year && <span className="album-detail__year">{year}</span>}
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
              showAlbum={false}
            />
          ))
        ) : (
          <div className="album-detail__empty">
            <IoMusicalNotes size={48} />
            <p>No songs found in this album</p>
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
            ➕ Add More💙!!
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
                  showAlbum={false}
                />
              ))}
            </div>
          </div>
        )}

        {matchLoaded && matchSongs.length === 0 && (
          <p className="add-more-empty">All matched songs are already in this album!</p>
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
              {recData.newAlbums.slice(0, 10).map((alb) => (
                <div
                  key={alb.id}
                  className="spotify-card"
                  onClick={() => navigate(`/album/${alb.id}`)}
                >
                  <div className="spotify-card__img-container">
                    <img src={getHighQualityImage(alb.image)} alt={alb.title} className="spotify-card__img" loading="lazy" />
                    <div className="spotify-card__play">▶</div>
                  </div>
                  <h4 className="spotify-card__title">{decodeHTML(alb.title || alb.name)}</h4>
                  <p className="spotify-card__desc">{alb.primaryArtists || 'Trending Album'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
