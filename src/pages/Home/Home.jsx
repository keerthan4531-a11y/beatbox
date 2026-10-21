/**
 * Home.jsx — JioSaavn-powered Tamil Music Hub
 *
 * How it works:
 *  1. Fetches REAL Tamil homepage data from JioSaavn via getHomepageData()
 *  2. Shows: New Tamil Releases, Featured Playlists, Tamil Charts, Genres
 *  3. Keeps personalised sections from userTaste engine
 *  4. Jump Back In → recently played songs
 *  5. Click any playlist → /playlist/:id → see all songs
 *  6. Click any album → /album/:id
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomepageData, searchSongs, searchAlbums, getDailyMixes } from '../../api/saavn';
import { usePlayer } from '../../context/PlayerContext';
import AlbumCard from '../../components/AlbumCard/AlbumCard';
import SongCard from '../../components/SongCard/SongCard';
import SectionHeader from '../../components/SectionHeader/SectionHeader';
import Stories from '../../components/Stories/Stories';
import Loader from '../../components/Loader/Loader';
import { getMediumQualityImage, decodeHTML, getHighQualityImage } from '../../utils/helpers';
import { buildTasteProfile, getPersonalisedSections, filterByLanguage } from '../../utils/userTaste';
import LiquidCard from '../../components/LiquidUI/LiquidCard';
import './Home.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning ☀️';
  if (hour < 17) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
}

export default function Home() {
  const navigate = useNavigate();
  const { recentlyPlayed, likedSongs, playSong } = usePlayer();

  // JioSaavn live data
  const [homepageData, setHomepageData] = useState(null);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [dailyMixes, setDailyMixes] = useState(() => {
    try {
      const cached = localStorage.getItem('beatbox_daily_mixes');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    async function loadMixes() {
      try {
        const mixes = await getDailyMixes(recentlyPlayed, likedSongs);
        setDailyMixes(mixes);
        localStorage.setItem('beatbox_daily_mixes', JSON.stringify(mixes));
      } catch (err) {
        console.warn('[Home] Failed to generate daily mixes:', err);
      }
    }
    loadMixes();
  }, [recentlyPlayed.length, likedSongs.length]);
  const mountedRef = useRef(true);

  // Build taste profile from user history
  const tasteProfile = useMemo(
    () => buildTasteProfile(recentlyPlayed, likedSongs),
    [recentlyPlayed.length, likedSongs.length] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Get personalised sections list
  const allSections = useMemo(
    () => getPersonalisedSections(tasteProfile),
    [tasteProfile] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Fetch JioSaavn Tamil Homepage ──
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);

    async function loadHomepage() {
      try {
        const data = await getHomepageData('tamil');
        
        let extraAlbums = [];
        try {
          // Fetch a large pool of extra popular Tamil albums
          const [s1, s2, s3, s4, s5, s6, s7, s8] = await Promise.all([
            searchAlbums('tamil hits 2026', 30),
            searchAlbums('tamil hits 2025', 30),
            searchAlbums('tamil hits 2024', 30),
            searchAlbums('tamil romance', 30),
            searchAlbums('ar rahman tamil', 30),
            searchAlbums('anirudh tamil', 30),
            searchAlbums('yuvan shankar raja tamil', 30),
            searchAlbums('tamil new releases', 30)
          ]);
          extraAlbums = [
            ...(s1?.results || []),
            ...(s2?.results || []),
            ...(s3?.results || []),
            ...(s4?.results || []),
            ...(s5?.results || []),
            ...(s6?.results || []),
            ...(s7?.results || []),
            ...(s8?.results || [])
          ];
        } catch (e) {
          console.warn('[Home] Extra albums fetch failed:', e);
        }

        if (mountedRef.current) {
          // Merge homepage albums and search albums, removing duplicates
          const mergedAlbums = [...(data?.newAlbums || [])];
          extraAlbums.forEach(ea => {
            if (!mergedAlbums.some(a => a.id === ea.id)) {
              mergedAlbums.push(ea);
            }
          });

          setHomepageData({
            ...data,
            newAlbums: mergedAlbums
          });
          setLoading(false);
        }
      } catch (err) {
        console.warn('[Home] Homepage fetch failed:', err.message);
        if (mountedRef.current) setLoading(false);
      }
    }

    loadHomepage();
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load personalised + search-based sections (lazy) ──
  useEffect(() => {
    mountedRef.current = true;
    const preferredLang = tasteProfile?.topLanguage || 'tamil';

    async function fetchSection(section) {
      try {
        if (section.type === 'album') {
          const data = await searchAlbums(section.query, 12);
          const results = data?.results || [];
          if (mountedRef.current && results.length > 0) {
            setSections(prev => ({ ...prev, [section.key]: { type: 'album', items: results } }));
          }
        } else {
          const data = await searchSongs(section.query, 12);
          const results = filterByLanguage(data?.results || [], preferredLang);
          if (mountedRef.current && results.length > 0) {
            setSections(prev => ({ ...prev, [section.key]: { type: 'song', items: results } }));
          }
        }
      } catch (err) {
        console.warn(`[Home] Section "${section.key}" failed:`, err.message);
      }
    }

    // Load sections after homepage data (lower priority)
    async function loadAllSections() {
      // Small delay to let homepage render first
      await new Promise(r => setTimeout(r, 500));

      for (let i = 0; i < allSections.length; i += 2) {
        if (!mountedRef.current) return;
        await Promise.all(allSections.slice(i, i + 2).map(fetchSection));
        await new Promise(r => setTimeout(r, 400));
      }
    }

    loadAllSections();
    return () => { mountedRef.current = false; };
  }, [allSections.map(s => s.key).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickPicks = recentlyPlayed.slice(0, 6);
  const hasProfile = !!tasteProfile && tasteProfile.totalSongs >= 3;

  const handleAlbumClick = (album) => {
    if (album?.id) navigate(`/album/${album.id}`);
  };

  const handlePlaylistClick = (playlist) => {
    if (playlist?.id) navigate(`/playlist/${playlist.id}`);
  };

  // Extract live data
  const newAlbums = homepageData?.newAlbums || [];
  const featuredPlaylists = homepageData?.playlists || [];
  const charts = homepageData?.charts || [];
  const trending = homepageData?.trending || [];
  const genres = homepageData?.genres || [];

  return (
    <div className="home" id="home-page">
      <Stories />

      {/* ── Greeting ── */}
      <h2 className="home__greeting">{getGreeting()}</h2>

      {/* ── Jump Back In (recently played) ── */}
      {quickPicks.length > 0 && (
        <div className="home__section">
          <SectionHeader title="🔄 Jump Back In" actionLabel="See all" onAction={() => navigate('/recent')} />
          <div className="home__quick-picks">
            {quickPicks.map((song) => (
              <button
                key={song.id}
                className="home__quick-pick"
                onClick={() => playSong(song, quickPicks, quickPicks.indexOf(song))}
              >
                <img
                  className="home__quick-pick-image"
                  src={getMediumQualityImage(song.image)}
                  alt={decodeHTML(song.name)}
                />
                <span className="home__quick-pick-name">{decodeHTML(song.name)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero Banner ── */}
      <div className="home__hero" id="home-hero">
        <div className="home__hero-orb home__hero-orb--1" />
        <div className="home__hero-orb home__hero-orb--2" />
        <span className="home__hero-badge">
          {hasProfile ? '🎯 Personalised For You' : '✨ Tamil Music Hub'}
        </span>
        <h1 className="home__hero-title">
          Feel the <span>Beat</span>,<br />
          Live the Music.
        </h1>
        <p className="home__hero-subtitle">
          {hasProfile
            ? `Based on your taste — ${tasteProfile.topArtists.slice(0, 2).map(a => a.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ')} & more.`
            : 'Stream 320kbps Tamil hits — powered by JioSaavn. Ad-free!'}
        </p>
      </div>

      {loading && !homepageData && <Loader />}

      {/* ── ✨ Made For You (Personalized Daily Mixes) ── */}
      {dailyMixes.length > 0 && (
        <div className="home__section" id="daily-mixes-section">
          <SectionHeader title="✨ Made For You" />
          <div className="home__playlist-grid">
            {dailyMixes.map((mix, i) => {
              const cover = getHighQualityImage(mix.image);
              return (
                <LiquidCard
                  key={mix.id}
                  onClick={() => handlePlaylistClick(mix)}
                >
                  <div className="spotify-card daily-mix-card" style={{ background: mix.gradient, border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '16px' }}>
                    <div className="spotify-card__img-container">
                      {cover ? (
                        <img src={cover} alt={mix.title} className="spotify-card__img" loading="lazy" />
                      ) : (
                        <div className="spotify-card__placeholder"><span>🎛️</span></div>
                      )}
                      <div className="spotify-card__play">
                        <span style={{ marginLeft: '4px', fontSize: '18px' }}>▶</span>
                      </div>
                    </div>
                    <h4 className="spotify-card__title" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)', marginTop: '12px' }}>
                      {decodeHTML(mix.title)}
                    </h4>
                    <p className="spotify-card__desc" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                      {mix.subtitle}
                    </p>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ LIVE JIOSAAVN SECTIONS ══════════ */}

      {/* ── 🔥 Trending Now (from JioSaavn homepage — like "You Might Like") ── */}
      {trending.length > 0 && (
        <div className="home__section">
          <SectionHeader title="🔥 Trending Now" />
          <div className="home__grid">
            {trending.filter(s => s).slice(0, 14).map((item, i) => {
              if (item.type === 'song') {
                return (
                  <SongCard
                    key={`${item.id}-t-${i}`}
                    song={item}
                    queue={trending.filter(s => s?.type === 'song')}
                    index={i}
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                );
              }
              // Playlist / album type
              const cover = getHighQualityImage(item.image);
              return (
                <LiquidCard
                  key={`${item.id}-t-${i}`}
                  onClick={() => item.type === 'playlist' ? handlePlaylistClick(item) : handleAlbumClick(item)}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="spotify-card">
                    <div className="spotify-card__img-container">
                      {cover ? (
                        <img src={cover} alt={item.title} className="spotify-card__img" loading="lazy" />
                      ) : (
                        <div className="spotify-card__placeholder"><span>🎵</span></div>
                      )}
                      <div className="spotify-card__play">
                        <span style={{ marginLeft: '4px', fontSize: '18px' }}>▶</span>
                      </div>
                    </div>
                    <h4 className="spotify-card__title">{decodeHTML(item.title || item.name)}</h4>
                    <p className="spotify-card__desc">
                      {item.primaryArtists || item.subtitle || item.followerCount ? `${Number(item.followerCount || 0).toLocaleString()} Fans` : ''}
                    </p>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🆕 New & Popular Tamil Albums ── */}
      {newAlbums.length > 0 && (
        <div className="home__section">
          <SectionHeader title="🆕 New & Popular Tamil Albums" />
          <div className="home__grid">
            {newAlbums.slice(0, 80).map((item, i) => (
              <AlbumCard
                key={`${item.id}-${i}`}
                album={item}
                onClick={item.type === 'song' 
                  ? () => playSong(item)
                  : handleAlbumClick
                }
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 📊 Top Charts (from JioSaavn) ── */}
      {charts.length > 0 && (
        <div className="home__section">
          <SectionHeader title="📊 Top Charts" />
          <div className="home__playlist-grid">
            {charts.map((chart) => {
              const cover = getHighQualityImage(chart.image);
              return (
                <LiquidCard
                  key={chart.id}
                  onClick={() => handlePlaylistClick(chart)}
                >
                  <div className="spotify-card">
                    <div className="spotify-card__img-container">
                      {cover ? (
                        <img src={cover} alt={chart.title} className="spotify-card__img" loading="lazy" />
                      ) : (
                        <div className="spotify-card__placeholder"><span>📊</span></div>
                      )}
                      <div className="spotify-card__play">
                        <span style={{ marginLeft: '4px', fontSize: '18px' }}>▶</span>
                      </div>
                    </div>
                    <h4 className="spotify-card__title">{decodeHTML(chart.title)}</h4>
                    <p className="spotify-card__desc">{chart.subtitle || 'JioSaavn Chart'}</p>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🎵 Featured Tamil Playlists (from JioSaavn) ── */}
      {featuredPlaylists.length > 0 && (
        <div className="home__section">
          <SectionHeader title="🎵 Featured Playlists" />
          <div className="home__playlist-grid">
            {featuredPlaylists.slice(0, 20).map((pl) => {
              const cover = getHighQualityImage(pl.image);
              return (
                <LiquidCard
                  key={pl.id}
                  onClick={() => handlePlaylistClick(pl)}
                >
                  <div className="spotify-card">
                    <div className="spotify-card__img-container">
                      {cover ? (
                        <img src={cover} alt={pl.title} className="spotify-card__img" loading="lazy" />
                      ) : (
                        <div className="spotify-card__placeholder"><span>🎵</span></div>
                      )}
                      <div className="spotify-card__play">
                        <span style={{ marginLeft: '4px', fontSize: '18px' }}>▶</span>
                      </div>
                    </div>
                    <h4 className="spotify-card__title">{decodeHTML(pl.title)}</h4>
                    <p className="spotify-card__desc">
                      {pl.followerCount ? `${Number(pl.followerCount).toLocaleString()} Followers` : pl.subtitle || 'JioSaavn Playlist'}
                    </p>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🎭 Browse by Genre ── */}
      {genres.length > 0 && (
        <div className="home__section">
          <SectionHeader title="🎭 Browse by Genre" />
          <div className="home__genre-grid">
            {genres.map((genre) => {
              // Simple Tamil search queries that JioSaavn API actually returns results for
              const getOptimizedQuery = (title) => {
                const t = (title || '').toLowerCase();
                if (t.includes('romance') || t.includes('love')) return 'tamil love';
                if (t.includes('dance')) return 'tamil kuthu';
                if (t.includes('workout') || t.includes('gym')) return 'tamil mass';
                if (t.includes('happy')) return 'tamil melody';
                if (t.includes('chill') || t.includes('relax')) return 'tamil unplugged';
                if (t.includes('party')) return 'tamil party';
                if (t.includes('retro') || t.includes('classic')) return 'tamil 90s';
                if (t.includes('1990') || t.includes('90s')) return 'tamil 90s';
                if (t.includes('2000') || t.includes('00s')) return 'tamil 2000';
                if (t.includes('2010')) return 'tamil 2010';
                if (t.includes('2020')) return 'tamil 2020';
                if (t.includes('2021')) return 'tamil 2021';
                if (t.includes('2022')) return 'tamil 2022';
                if (t.includes('best of')) return `tamil ${t.replace('best of', '').trim()}`;
                return `tamil ${t}`;
              };

              return (
                <div
                  key={genre.title}
                  className="genre-card"
                  onClick={() => {
                    const optimizedQuery = getOptimizedQuery(genre.title);
                    navigate(`/category/${encodeURIComponent(optimizedQuery)}`, {
                      state: { title: genre.title, autoPlay: true }
                    });
                  }}
                >
                  {genre.image && <img src={genre.image} alt={genre.title} className="genre-card__img" loading="lazy" />}
                  <span className="genre-card__label">{genre.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ PERSONALISED + SEARCH SECTIONS ══════════ */}

      {allSections.map((section) => {
        const sectionData = sections[section.key];
        if (!sectionData || sectionData.items.length === 0) return null;

        return (
          <div
            className={`home__section${section.personalised ? ' home__section--personalised' : ''}`}
            key={section.key}
            id={`section-${section.key}`}
          >
            {sectionData.type === 'album' ? (
              <>
                <SectionHeader
                  title={section.title}
                  actionLabel="Show all"
                  onAction={() =>
                    navigate(`/category/${encodeURIComponent(section.query)}`, {
                      state: { title: section.title, useAlbums: true }
                    })
                  }
                  badge={section.personalised ? 'For You' : null}
                />
                <div className="home__grid">
                  {sectionData.items.slice(0, 12).map((album, i) => (
                    <AlbumCard
                      key={`${album.id || 'album'}-${i}`}
                      album={album}
                      onClick={handleAlbumClick}
                      style={{ animationDelay: `${i * 40}ms` }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <SectionHeader
                  title={section.title}
                  actionLabel="Show all"
                  onAction={() =>
                    navigate(`/category/${encodeURIComponent(section.query)}`, {
                      state: { title: section.title }
                    })
                  }
                  badge={section.personalised ? 'For You' : null}
                />
                <div className="home__grid">
                  {sectionData.items.slice(0, 12).map((song, i) => (
                    <SongCard
                      key={`${song.id || 'song'}-${i}`}
                      song={song}
                      queue={sectionData.items}
                      index={i}
                      style={{ animationDelay: `${i * 40}ms` }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
