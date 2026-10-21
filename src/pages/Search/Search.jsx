import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch, searchSongs, searchAlbums, searchArtists, searchPlaylists } from '../../api/saavn';
import { usePlayer } from '../../context/PlayerContext';
import SearchBar from '../../components/SearchBar/SearchBar';
import FilterTabs from '../../components/FilterTabs/FilterTabs';
import TopResultCard from '../../components/TopResultCard/TopResultCard';
import ArtistCard from '../../components/ArtistCard/ArtistCard';
import AlbumCard from '../../components/AlbumCard/AlbumCard';
import PlaylistCard from '../../components/PlaylistCard/PlaylistCard';
import SongRow from '../../components/SongRow/SongRow';
import SearchRow from '../../components/SearchRow/SearchRow';
import RecentSearches from '../../components/RecentSearches/RecentSearches';
import SectionHeader from '../../components/SectionHeader/SectionHeader';
import Loader from '../../components/Loader/Loader';
import { IoSearch, IoMusicalNotesOutline } from 'react-icons/io5';
import { debounce, getHighQualityImage, decodeHTML } from '../../utils/helpers';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../../utils/recentSearches';
import './Search.css';

/* ── Genre Browse Cards ── */
const GENRES = [
  { name: 'Tamil Hits', query: 'tamil hits 2026', color: 'linear-gradient(135deg, #e91e63, #9c27b0)', emoji: '🎵' },
  { name: 'Bollywood', query: 'bollywood hits', color: 'linear-gradient(135deg, #ff9800, #f44336)', emoji: '🎬' },
  { name: 'Hip Hop', query: 'hip hop tamil', color: 'linear-gradient(135deg, #607d8b, #263238)', emoji: '🎤' },
  { name: 'Romantic', query: 'romantic love songs tamil', color: 'linear-gradient(135deg, #e91e63, #ff5252)', emoji: '❤️' },
  { name: 'Devotional', query: 'devotional songs tamil', color: 'linear-gradient(135deg, #ff6f00, #ffd600)', emoji: '🙏' },
  { name: 'Chill Vibes', query: 'chill vibes lofi', color: 'linear-gradient(135deg, #00bcd4, #009688)', emoji: '🌊' },
  { name: 'Party', query: 'party dance kuthu songs', color: 'linear-gradient(135deg, #7c4dff, #448aff)', emoji: '🎉' },
  { name: 'Classical', query: 'carnatic classical', color: 'linear-gradient(135deg, #795548, #4e342e)', emoji: '🎻' },
  { name: 'Melody', query: 'melody hits tamil', color: 'linear-gradient(135deg, #1de9b6, #00bfa5)', emoji: '💕' },
  { name: 'Rock', query: 'rock music english', color: 'linear-gradient(135deg, #d32f2f, #b71c1c)', emoji: '🎸' },
  { name: 'Telugu', query: 'telugu hit songs', color: 'linear-gradient(135deg, #4caf50, #2e7d32)', emoji: '🌟' },
  { name: 'Punjabi', query: 'punjabi hits 2025', color: 'linear-gradient(135deg, #ff7043, #d84315)', emoji: '🔥' },
  { name: '90s Hits', query: 'tamil 90s songs', color: 'linear-gradient(135deg, #ab47bc, #7b1fa2)', emoji: '📻' },
  { name: 'Workout', query: 'workout motivational songs', color: 'linear-gradient(135deg, #f57c00, #e65100)', emoji: '💪' },
  { name: 'Sleep', query: 'sleep calm music', color: 'linear-gradient(135deg, #1a237e, #283593)', emoji: '🌙' },
  { name: 'Indie', query: 'indie tamil music', color: 'linear-gradient(135deg, #00897b, #004d40)', emoji: '🎧' },
];

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [recentSearchList, setRecentSearchList] = useState(getRecentSearches());
  const { playSong } = usePlayer();

  /* ── Debounced Search ── */
  const performSearch = useCallback(
    debounce(async (q) => {
      if (!q || q.trim().length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [global, songsData] = await Promise.all([
          globalSearch(q),
          searchSongs(q, 30),
        ]);

        const songsList = songsData?.results || [];

        setResults({
          topQuery: global?.topQuery?.results?.[0] || songsList[0] || null,
          songs: songsList,
          albums: global?.albums?.results || [],
          artists: global?.artists?.results || [],
          playlists: global?.playlists?.results || [],
        });

        // Save to recent searches on successful search
        addRecentSearch(q);
        setRecentSearchList(getRecentSearches());
      } catch (err) {
        console.error('Search error:', err);
      }
      setLoading(false);
    }, 400),
    []
  );

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  /* ── Tab change loads more data for that specific type ── */
  const handleTabChange = useCallback(async (tab) => {
    setActiveTab(tab);
    if (!query || query.trim().length < 2) return;

    // If switching to a specific tab, load more results for that type
    if (tab === 'albums' && (!results?.albums || results.albums.length < 5)) {
      const data = await searchAlbums(query, 30);
      setResults(prev => ({ ...prev, albums: data?.results || prev?.albums || [] }));
    }
    if (tab === 'artists' && (!results?.artists || results.artists.length < 5)) {
      const data = await searchArtists(query, 30);
      setResults(prev => ({ ...prev, artists: data?.results || prev?.artists || [] }));
    }
    if (tab === 'playlists' && (!results?.playlists || results.playlists.length < 5)) {
      const data = await searchPlaylists(query, 30);
      setResults(prev => ({ ...prev, playlists: data?.results || prev?.playlists || [] }));
    }
  }, [query, results]);

  /* ── Recent Search Handlers ── */
  const handleRecentSelect = (q) => {
    setQuery(q);
    setActiveTab('all');
  };

  const handleRecentRemove = (q) => {
    removeRecentSearch(q);
    setRecentSearchList(getRecentSearches());
  };

  const handleRecentClear = () => {
    clearRecentSearches();
    setRecentSearchList([]);
  };

  /* ── Genre Click ── */
  const handleGenreClick = (genreQuery) => {
    setQuery(genreQuery);
    setActiveTab('all');
  };

  /* ── Play Helpers ── */
  const handlePlaySong = (song, songList, idx) => {
    playSong(song, songList, idx);
  };

  const handleArtistClick = (artist) => {
    setQuery(decodeHTML(artist.title || artist.name || ''));
    setActiveTab('songs');
  };

  const handleAlbumClick = (album) => {
    navigate(`/album/${album.id}`);
  };

  const handlePlaylistClick = (playlist) => {
    navigate(`/playlist/${playlist.id}`);
  };

  /* ── Computed ── */
  const topResult = results?.topQuery;
  const hasResults = results && (
    results.songs.length > 0 ||
    results.albums.length > 0 ||
    results.artists.length > 0 ||
    results.playlists.length > 0
  );

  return (
    <div className="search-page" id="search-page">
      {/* Search Bar */}
      <div className="search-page__bar">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="What do you want to listen to?"
        />
      </div>

      {/* ── No query: Browse mode ── */}
      {!query && (
        <>
          {/* Recent Searches */}
          <RecentSearches
            searches={recentSearchList}
            onSelect={handleRecentSelect}
            onRemove={handleRecentRemove}
            onClear={handleRecentClear}
          />

          {/* Genre Browse */}
          <h2 className="search-page__browse-title">Browse All</h2>
          <div className="search-page__genres" id="genre-grid">
            {GENRES.map((genre) => (
              <div
                key={genre.name}
                className="search-page__genre-card"
                style={{ background: genre.color }}
                onClick={() => handleGenreClick(genre.query)}
                id={`genre-${genre.name.toLowerCase().replace(/\s/g, '-')}`}
              >
                <span className="search-page__genre-emoji">{genre.emoji}</span>
                <span className="search-page__genre-name">{genre.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {loading && <Loader />}

      {/* ── Results ── */}
      {results && !loading && (
        <div className="search-page__results" id="search-results">
          {/* Filter Tabs */}
          <FilterTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* ════════════════ ALL TAB ════════════════ */}
          {activeTab === 'all' && hasResults && (
            <div className="search-page__grid-layout">
              {/* Column 1: Top Result */}
              <div className="search-page__column">
                <SectionHeader title="TOP RESULT" />
                <div className="search-page__column-list">
                  {results.songs.slice(0, 3).map((item, i) => (
                    <SearchRow
                      key={`top-${item.id}-${i}`}
                      item={item}
                      type="song"
                      onClick={() => handlePlaySong(item, results.songs, i)}
                    />
                  ))}
                  {results.playlists.length > 0 && results.songs.length < 3 && (
                     <SearchRow
                        item={results.playlists[0]}
                        type="playlist"
                        onClick={handlePlaylistClick}
                     />
                  )}
                </div>
              </div>

              {/* Column 2: Playlists */}
              <div className="search-page__column">
                <SectionHeader 
                  title="PLAYLISTS" 
                  actionLabel="View All" 
                  onAction={() => handleTabChange('playlists')} 
                />
                <div className="search-page__column-list">
                  {results.playlists.slice(0, 3).map((pl, i) => (
                    <SearchRow
                      key={`pl-${pl.id}-${i}`}
                      item={pl}
                      type="playlist"
                      onClick={handlePlaylistClick}
                    />
                  ))}
                </div>
              </div>

              {/* Column 3: Songs */}
              <div className="search-page__column">
                <SectionHeader 
                  title="SONGS" 
                  actionLabel="View All" 
                  onAction={() => handleTabChange('songs')} 
                />
                <div className="search-page__column-list">
                  {results.songs.slice(0, 3).map((song, i) => (
                    <SearchRow
                      key={`song-${song.id}-${i}`}
                      item={song}
                      type="song"
                      onClick={() => handlePlaySong(song, results.songs, i)}
                    />
                  ))}
                </div>
              </div>

              {/* Column 4: Albums */}
              <div className="search-page__column">
                <SectionHeader 
                  title="ALBUMS" 
                  actionLabel="View All" 
                  onAction={() => handleTabChange('albums')} 
                />
                <div className="search-page__column-list">
                  {results.albums.slice(0, 3).map((album, i) => (
                    <SearchRow
                      key={`album-${album.id}-${i}`}
                      item={album}
                      type="album"
                      onClick={handleAlbumClick}
                    />
                  ))}
                </div>
              </div>

              {/* Second Row: Artists & More */}
              <div className="search-page__column">
                <SectionHeader 
                  title="ARTISTS" 
                  actionLabel="View All" 
                  onAction={() => handleTabChange('artists')} 
                />
                <div className="search-page__column-list">
                  {results.artists.slice(0, 3).map((artist, i) => (
                    <SearchRow
                      key={`artist-${artist.id}-${i}`}
                      item={artist}
                      type="artist"
                      onClick={handleArtistClick}
                    />
                  ))}
                </div>
              </div>

              <div className="search-page__column">
                <SectionHeader 
                  title="PODCASTS" 
                  actionLabel="View All" 
                  onAction={() => {}} 
                />
                <div className="search-page__column-list">
                  {/* Podcasts usually come from a different API, showing some more playlists as placeholder */}
                  {results.playlists.slice(3, 6).map((pl, i) => (
                    <SearchRow
                      key={`podcast-pl-${pl.id}-${i}`}
                      item={pl}
                      type="playlist"
                      onClick={handlePlaylistClick}
                    />
                  ))}
                  {results.playlists.length < 4 && (
                    <div className="search-page__empty-col">No podcasts available</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ SONGS TAB ════════════════ */}
          {activeTab === 'songs' && (
            <div className="search-page__section">
              {results.songs.length > 0 ? (
                <div className="search-page__song-list">
                  {results.songs.map((song, i) => (
                    <SongRow
                      key={`${song.id}-${i}`}
                      song={song}
                      index={i}
                      queue={results.songs}
                      showAlbum={true}
                    />
                  ))}
                </div>
              ) : (
                <NoResults type="songs" />
              )}
            </div>
          )}

          {/* ════════════════ ARTISTS TAB ════════════════ */}
          {activeTab === 'artists' && (
            <div className="search-page__section">
              {results.artists.length > 0 ? (
                <div className="search-page__card-grid search-page__card-grid--artists">
                  {results.artists.map((artist, i) => (
                    <ArtistCard
                      key={`${artist.id}-${i}`}
                      artist={artist}
                      onClick={handleArtistClick}
                      style={{ animationDelay: `${i * 50}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <NoResults type="artists" />
              )}
            </div>
          )}

          {/* ════════════════ ALBUMS TAB ════════════════ */}
          {activeTab === 'albums' && (
            <div className="search-page__section">
              {results.albums.length > 0 ? (
                <div className="search-page__card-grid">
                  {results.albums.map((album, i) => (
                    <AlbumCard
                      key={`${album.id}-${i}`}
                      album={album}
                      onClick={handleAlbumClick}
                      style={{ animationDelay: `${i * 50}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <NoResults type="albums" />
              )}
            </div>
          )}

          {/* ════════════════ PLAYLISTS TAB ════════════════ */}
          {activeTab === 'playlists' && (
            <div className="search-page__section">
              {results.playlists.length > 0 ? (
                <div className="search-page__card-grid">
                  {results.playlists.map((pl, i) => (
                    <PlaylistCard
                      key={`${pl.id}-${i}`}
                      playlist={pl}
                      onClick={handlePlaylistClick}
                      style={{ animationDelay: `${i * 50}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <NoResults type="playlists" />
              )}
            </div>
          )}

          {/* No results at all */}
          {!hasResults && (
            <NoResults type="results" />
          )}
        </div>
      )}
    </div>
  );
}

/* ── No Results Component ── */
function NoResults({ type }) {
  return (
    <div className="search-page__no-results">
      <div className="search-page__no-results-icon">
        <IoMusicalNotesOutline />
      </div>
      <div className="search-page__no-results-text">
        No {type} found
      </div>
      <div className="search-page__no-results-hint">
        Try different keywords or check spelling
      </div>
    </div>
  );
}
