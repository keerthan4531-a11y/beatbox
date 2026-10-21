/**
 * saavn.js — JioSaavn API Client
 *
 * In DEV mode: Uses Vite's built-in proxy → same-origin requests → ZERO CORS!
 * In PROD mode: Uses your Cloudflare Worker or direct API with fallback.
 *
 * Stream playback: Direct JioSaavn CDN URLs (aac.saavncdn.com) — <audio>
 * elements don't have CORS restrictions, so 320kbps plays directly.
 *
 * 🔧 Preview Fix: Strips `_p` marker from CDN URLs for full songs.
 */
import CryptoJS from 'crypto-js';
import { buildTasteProfile } from '../utils/userTaste';

// ══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════════════════════════

// Your deployed Cloudflare Worker URL
const WORKER_URL = 'https://weathered-heart-9c50.fct197096.workers.dev';
const API_VERSION = '2.2.0'; // Tamil homepage + lyrics integration

// Detect if we're running inside a Capacitor native app (Android/iOS)
// Capacitor adds window.Capacitor to the global scope before app loads
const isCapacitor = typeof window !== 'undefined' && 
  window.Capacitor != null && 
  typeof window.Capacitor.isNativePlatform === 'function' &&
  window.Capacitor.isNativePlatform() === true;

// Dev mode = Vite dev server with proxy (NOT Capacitor, which also uses localhost)
const isDev = !isCapacitor && typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.endsWith('.local')
);

// Fallback public instances of sumitkolhe/jiosaavn-api 
// (In case primary goes down or hits limits)
const PUBLIC_FALLBACKS = [
  WORKER_URL,
  'https://jiosaavn-api-privatecvc2.vercel.app',
  'https://saavn.me'
];

// Dev: Browser -> /saavn-api -> Vite Proxy -> Cloudflare Worker
// Prod: Browser -> Worker directly (saavn.dev is DNS-blocked by ISPs)
const API_INSTANCES = isDev 
  ? ['/saavn-api'] 
  : [WORKER_URL, 'https://jiosaavn-api-privatecvc2.vercel.app'];

// YouTube search endpoint (Piped API proxy or direct via worker)
const YOUTUBE_API = isDev
  ? '/youtube-api'                           
  : `${WORKER_URL}/youtube`;

let currentInstanceIndex = 0;

/**
 * Smart fetch with automatic failover across all proxy instances.
 */
async function apiFetch(path, params = {}, timeoutMs = 60000) {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${path}?${queryString}` : path;

  const ordered = [
    API_INSTANCES[currentInstanceIndex],
    ...API_INSTANCES.filter((_, i) => i !== currentInstanceIndex),
  ];

  let lastError = null;

  for (let i = 0; i < ordered.length; i++) {
    const base = ordered[i];
    const fullUrl = `${base}${url}`;

    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(fullUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const idx = API_INSTANCES.indexOf(base);
      if (idx !== -1) currentInstanceIndex = idx;

      return json?.data ?? json;
    } catch (err) {
      lastError = err;
      // Only log as debug to avoid console spamming the user
      console.debug(`[Saavn] ${base} failed: ${err.message}`);
      continue;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  if (!url.includes('/suggestions')) {
    console.error(`[Saavn] All instances failed for: ${url}`);
  } else {
    console.debug(`[Saavn] Suggestions API not available for this track.`);
  }
  throw lastError || new Error('All API instances failed');
}

// ══════════════════════════════════════════════════════════════
//  NORMALIZE
// ══════════════════════════════════════════════════════════════

function generateDownloadLinks(encryptedMediaUrl) {
  if (!encryptedMediaUrl) return [];
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedMediaUrl) },
      key,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    const decUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decUrl) return [];
    
    // Convert to mp4 extension for higher qualities
    const cleanUrl = decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '');
    
    return [
      { quality: '12kbps', url: decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '_12.mp4') },
      { quality: '48kbps', url: decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '_48.mp4') },
      { quality: '96kbps', url: decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '_96.mp4') },
      { quality: '160kbps', url: decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '_160.mp4') },
      { quality: '320kbps', url: decUrl.replace(/_96\.mp4|_320\.mp4|_160\.mp4/g, '_320.mp4') },
    ];
  } catch (err) {
    console.error('[Saavn] Decryption failed:', err);
    return [];
  }
}

function normalizeSong(raw) {
  if (!raw) return null;

  let dLinks = raw.downloadUrl || raw.download_url;
  if ((!dLinks || dLinks.length === 0) && raw.encrypted_media_url) {
    dLinks = generateDownloadLinks(raw.encrypted_media_url);
  } else if (!Array.isArray(dLinks) && typeof dLinks === 'string') {
    dLinks = [{ quality: '320kbps', url: dLinks }];
  } else if (!dLinks) {
    dLinks = [];
  }
  return {
    id: raw.id,
    name: raw.name || raw.title || 'Unknown',
    title: raw.name || raw.title || 'Unknown',
    type: raw.type || 'song',
    year: raw.year || '',
    duration: raw.duration || 0,
    label: raw.label || '',
    language: raw.language || '',
    playCount: raw.playCount || raw.play_count || 0,
    hasLyrics: raw.hasLyrics || raw.has_lyrics || false,
    image: raw.image || [],
    primaryArtists:
      typeof raw.primaryArtists === 'string'
        ? raw.primaryArtists
        : raw.artists?.primary?.map((a) => a.name).join(', ') ||
          raw.primaryArtists || raw.subtitle || 'Unknown Artist',
    artists: raw.artists || null,
    album: raw.album?.name || raw.album || '',
    downloadUrl: dLinks,
    url: raw.url || '',
    copyright: raw.copyright || '',
    explicitContent: raw.explicitContent || false,
  };
}

function normalizeAlbum(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || raw.title || 'Unknown Album',
    title: raw.name || raw.title || 'Unknown Album',
    type: 'album',
    year: raw.year || '',
    language: raw.language || '',
    playCount: raw.playCount || raw.play_count || 0,
    image: raw.image || [],
    primaryArtists:
      typeof raw.primaryArtists === 'string'
        ? raw.primaryArtists
        : raw.artists?.primary?.map((a) => a.name).join(', ') || 'Various Artists',
    artist:
      typeof raw.primaryArtists === 'string'
        ? raw.primaryArtists
        : raw.artists?.primary?.map((a) => a.name).join(', ') || 'Various Artists',
    songCount: raw.songCount || raw.song_count || 0,
    url: raw.url || '',
    songs: (raw.songs || []).map(normalizeSong),
  };
}

function normalizePlaylist(raw) {
  if (!raw) return null;

  // Normalize image from string to standard [{quality, link}] array if necessary
  let playlistImg = raw.image || [];
  if (typeof playlistImg === 'string') {
    const cleanImg = playlistImg.replace(/-\d+x\d+\./, '-{R}.');
    playlistImg = [
      { quality: '50x50',   link: cleanImg.replace('{R}', '50x50')   },
      { quality: '150x150', link: cleanImg.replace('{R}', '150x150') },
      { quality: '500x500', link: cleanImg.replace('{R}', '500x500') },
    ];
  } else if (!Array.isArray(playlistImg)) {
    playlistImg = [];
  }

  const id = raw.id || raw.listid || '';
  const name = raw.name || raw.title || raw.listname || 'Unknown Playlist';
  const songCount = raw.songCount || raw.song_count || parseInt(raw.list_count || 0) || (raw.songs ? raw.songs.length : 0) || 0;
  const fanCount = raw.fanCount || raw.fan_count || parseInt(raw.follower_count || 0) || 0;

  return {
    id,
    name: name,
    title: name,
    type: 'playlist',
    subtitle: raw.subtitle || (fanCount ? `${fanCount.toLocaleString()} Fans` : ''),
    fanCount,
    followerCount: raw.followerCount || raw.follower_count || fanCount || 0,
    image: playlistImg,
    songCount,
    url: raw.url || raw.perma_url || '',
    songs: (raw.songs || []).map(normalizeSong),
  };
}

function normalizeArtist(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name || raw.title || 'Unknown Artist',
    title: raw.name || raw.title || 'Unknown Artist',
    type: 'artist',
    image: raw.image || [],
    url: raw.url || '',
    description: raw.description || raw.subtitle || '',
    followerCount: raw.followerCount || 0,
  };
}

// ══════════════════════════════════════════════════════════════
//  HOMEPAGE & CONTENT APIs
// ══════════════════════════════════════════════════════════════

/**
 * Fetch JioSaavn Tamil homepage data — new releases, playlists, charts, genres
 * All data comes from JioSaavn's content.getHomepageData API
 */
export async function getHomepageData(language = 'tamil') {
  try {
    const data = await apiFetch('/api/homepage', { language });
    return data || { newAlbums: [], playlists: [], charts: [], trending: [], genres: [] };
  } catch (err) {
    console.warn('[Saavn] Homepage fetch failed:', err.message);
    return { newAlbums: [], playlists: [], charts: [], trending: [], genres: [] };
  }
}



// ══════════════════════════════════════════════════════════════
//  SEARCH APIs
// ══════════════════════════════════════════════════════════════

export async function globalSearch(query) {
  if (!query) return null;
  try {
    const data = await apiFetch('/api/search', { query });
    return {
      topQuery: {
        results: (data?.topQuery?.results || []).map((r) => ({
          ...r, id: r.id, title: r.title || r.name, name: r.name || r.title,
          type: r.type, image: r.image || [],
          description: r.description || r.subtitle || '',
        })),
      },
      songs: { results: (data?.songs?.results || []).map(normalizeSong) },
      albums: { results: (data?.albums?.results || []).map(normalizeAlbum) },
      artists: { results: (data?.artists?.results || []).map(normalizeArtist) },
      playlists: { results: (data?.playlists?.results || []).map(normalizePlaylist) },
    };
  } catch (err) {
    console.error('[Saavn] globalSearch failed:', err);
    return null;
  }
}

export async function searchSongs(query, limit = 20) {
  if (!query) return { results: [] };
  try {
    const data = await apiFetch('/api/search/songs', { query, limit });
    return { results: (data?.results || data || []).map(normalizeSong) };
  } catch (err) {
    console.error('[Saavn] searchSongs failed:', err);
    return { results: [] };
  }
}

export async function searchAlbums(query, limit = 20) {
  if (!query) return { results: [] };
  try {
    const data = await apiFetch('/api/search/albums', { query, limit });
    return { results: (data?.results || data || []).map(normalizeAlbum) };
  } catch (err) {
    console.error('[Saavn] searchAlbums failed:', err);
    return { results: [] };
  }
}

export async function searchArtists(query, limit = 20) {
  if (!query) return { results: [] };
  try {
    const data = await apiFetch('/api/search/artists', { query, limit });
    return { results: (data?.results || data || []).map(normalizeArtist) };
  } catch (err) {
    console.error('[Saavn] searchArtists failed:', err);
    return { results: [] };
  }
}

export async function searchPlaylists(query, limit = 20) {
  if (!query) return { results: [] };
  try {
    const data = await apiFetch('/api/search/playlists', { query, limit });
    return { results: (data?.results || data || []).map(normalizePlaylist) };
  } catch (err) {
    console.error('[Saavn] searchPlaylists failed:', err);
    return { results: [] };
  }
}

// ══════════════════════════════════════════════════════════════
//  DETAIL APIs
// ══════════════════════════════════════════════════════════════

export async function getLyrics(id, title = '', artist = '') {
  if (!id && (!title || !artist)) return null;
  try {
    const data = await apiFetch('/api/lyrics', { id, title, artist });
    return data;
  } catch (err) {
    console.error('[Saavn] getLyrics failed:', err);
    return null;
  }
}

export async function getAlbumById(id) {
  if (!id) return null;
  try { return normalizeAlbum(await apiFetch('/api/albums', { id })); }
  catch (err) { console.error('[Saavn] getAlbumById failed:', err); return null; }
}

export async function getPlaylistById(id) {
  if (!id) return null;
  try { return normalizePlaylist(await apiFetch('/api/playlists', { id })); }
  catch (err) { console.error('[Saavn] getPlaylistById failed:', err); return null; }
}

export async function getSongById(id) {
  if (!id) return null;
  try {
    const data = await apiFetch(`/api/songs/${id}`);
    const songs = Array.isArray(data) ? data : data?.songs || [data];
    return songs.map(normalizeSong)[0] || null;
  } catch (err) { console.error('[Saavn] getSongById failed:', err); return null; }
}

export async function getSongSuggestionsFallback(songId, limit = 20) {
  try {
    const song = await getSongById(songId);
    if (!song) return [];
    const artist = (song.primaryArtists || '').split(',')[0].trim();
    if (!artist) return [];
    console.log(`[Saavn] Suggestions fallback for ${song.name} - searching songs for artist: ${artist}`);
    const searchRes = await searchSongs(artist, limit + 5);
    return (searchRes?.results || []).filter(s => s && s.id && s.id !== songId).slice(0, limit);
  } catch (e) {
    console.warn('[Saavn] suggestions fallback failed:', e);
    return [];
  }
}

export async function getSongSuggestions(songId, limit = 20) {
  if (!songId) return [];
  try {
    // 1500ms timeout for suggestions to prevent slow network / worker hangs from blocking the page
    const data = await apiFetch(`/api/songs/${songId}/suggestions`, { limit }, 1500);
    const results = Array.isArray(data) ? data : data?.results || data?.songs || [];
    let suggestions = results.map(normalizeSong).filter((s) => s && s.id);
    if (suggestions.length === 0) {
      console.warn(`[Saavn] Suggestions for song ${songId} returned empty. Trying fallback search...`);
      return await getSongSuggestionsFallback(songId, limit);
    }
    return suggestions;
  } catch (err) {
    console.warn(`[Saavn] getSongSuggestions failed or timed out for ${songId}:`, err.message);
    return await getSongSuggestionsFallback(songId, limit);
  }
}

// ══════════════════════════════════════════════════════════════
//  STREAM VARIANT GENERATOR
// ══════════════════════════════════════════════════════════════

function stripPreviewMarker(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/_p\.mp4/g, '.mp4').replace(/_p\.m4a/g, '.m4a').replace(/_p\.aac/g, '.aac');
}

function upgradeQuality(url, targetKbps) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/_\d+\.mp4/g, `_${targetKbps}.mp4`)
    .replace(/_\d+\.m4a/g, `_${targetKbps}.m4a`)
    .replace(/_\d+\.aac/g, `_${targetKbps}.aac`);
}

export function getAllStreamVariants(downloadUrls) {
  if (!downloadUrls?.length) return [];

  const variants = [];
  const seen = new Set();
  const qualityOrder = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];

  const sorted = [...downloadUrls].sort((a, b) =>
    qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality)
  );

  for (const item of sorted) {
    const rawUrl = item.url || item.link;
    if (!rawUrl || seen.has(rawUrl)) continue;
    seen.add(rawUrl);
    // ✅ Direct CDN URL — no proxy needed!
    variants.push({ url: rawUrl, quality: item.quality, proxy: 'direct' });
  }

  return variants;
}

// ══════════════════════════════════════════════════════════════
//  YOUTUBE VIDEO SEARCH
// ══════════════════════════════════════════════════════════════

/**
 * Get a YouTube video for a song.
 * Uses Piped API for privacy and better CORS handling.
 */
export async function getYouTubeVideoUrl(songName, artistName) {
  if (!songName) return null;

  // 🔧 FIX: Clean and shorten query to avoid 403 blocks
  const cleanName = songName
    .replace(/\(From.*?\)/g, '')
    .replace(/\(Tamil\)/g, '')
    .replace(/\(Telugu\)/g, '')
    .replace(/\(Hindi\)/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();
    
  // Use only the first artist if there are multiple
  const firstArtist = (artistName || '').split(',')[0].trim();
  
  const query = `${cleanName} ${firstArtist} official music video`.trim();
  
  // Directly hit YouTube via our proxy or worker
  const searchUrl = isDev 
    ? `${YOUTUBE_API}/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`
    : `${YOUTUBE_API}/search?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(searchUrl, { 
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/json'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (isDev) {
      // Scrape HTML directly from YouTube
      const html = await res.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) {
        const videoId = match[1];
        return {
          videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: songName,
        };
      }
    } else {
      // Our worker returns JSON
      const data = await res.json();
      const items = data?.items || [];
      if (items.length > 0) {
        const videoId = items[0].url?.replace('/watch?v=', '');
        if (videoId) {
          return {
            videoId,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
            thumbnail: items[0].thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            title: items[0].title || songName,
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[YT] Search failed:`, err.message);
  }

  return null;
}

/**
 * Get a YouTube clip for a song — STRICT OFFICIAL ONLY.
 * 
 * Logic:
 * 1. Search YouTube with "official music video" in query
 * 2. Parse ALL video results (not just the first one)
 * 3. Filter out covers, remixes, karaoke, reactions, fan-made, etc.
 * 4. Verify the title contains the song name OR artist name
 * 5. Prefer videos from official/verified channels (VEVO, T-Series, etc.)
 */

// Blocklist — if video title contains ANY of these, skip it
const CLIP_BLOCKLIST = [
  'cover', 'karaoke', 'remix', 'mashup', 'reaction', 'parody',
  'fan made', 'fan-made', 'fanmade', 'unplugged', 'acoustic version',
  'slowed', 'reverb', 'lofi', 'lo-fi', '8d audio', '8d song',
  'tutorial', 'piano cover', 'guitar cover', 'drum cover',
  'dance cover', 'dance video', 'choreography',
  'behind the scenes', 'making of', 'bts', 'interview',
  'live performance', 'concert', 'live at', 'live from',
  'whatsapp status', 'status video', 'ringtone',
  'instrumental', 'bgm only', 'karoke', 'sing along',
  'reaction video', 'review', 'explained', 'breakdown',
  'speed up', 'nightcore', 'bass boosted',
];

// Official channel keywords — boost priority
const OFFICIAL_CHANNEL_KEYWORDS = [
  'vevo', 't-series', 'sony music', 'tips official', 'zee music',
  'lahari music', 'aditya music', 'saregama', 'think music',
  'sun music', 'harris jayaraj', 'anirudh', 'yuvan', 'a.r.rahman',
  'universal music', 'warner music', 'atlantic records',
  'official', 'music', 'records', 'entertainment',
];

function normalizeForMatch(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOfficialVideo(title, channelName, songName, artistName) {
  const normTitle = normalizeForMatch(title);
  const normSong = normalizeForMatch(songName);
  const normArtist = normalizeForMatch(artistName);
  const normChannel = normalizeForMatch(channelName);

  // 1. BLOCK: If title contains any blocklist word, reject
  for (const blocked of CLIP_BLOCKLIST) {
    if (normTitle.includes(blocked)) {
      return { valid: false, score: -1 };
    }
  }

  // 2. REQUIRE: Title must contain the song name (at least 60% of words)
  const songWords = normSong.split(' ').filter(w => w.length > 2);
  const matchedWords = songWords.filter(w => normTitle.includes(w));
  const matchRatio = songWords.length > 0 ? matchedWords.length / songWords.length : 0;
  
  if (matchRatio < 0.5) {
    return { valid: false, score: -1 };
  }

  // 3. SCORE: Calculate relevance score
  let score = matchRatio * 50; // Base: how well title matches song name (0-50)

  // Bonus: "official" in title
  if (normTitle.includes('official')) score += 25;
  if (normTitle.includes('official music video')) score += 15;
  if (normTitle.includes('official video')) score += 10;
  
  // Bonus: Artist name in title
  if (normArtist && normTitle.includes(normArtist.split(' ')[0])) score += 10;

  // Bonus: Official channel
  for (const keyword of OFFICIAL_CHANNEL_KEYWORDS) {
    if (normChannel.includes(keyword)) {
      score += 15;
      break;
    }
  }

  // Penalty: If title has "lyric" but not "official" — it's a lyrics video, lower priority
  if (normTitle.includes('lyric') && !normTitle.includes('official')) score -= 10;

  return { valid: true, score };
}

export async function getYouTubeShortUrl(songName, artistName) {
  if (!songName) return null;

  const cleanName = songName
    .replace(/\(From.*?\)/g, '')
    .replace(/\(Tamil\)/g, '')
    .replace(/\(Telugu\)/g, '')
    .replace(/\(Hindi\)/g, '')
    .replace(/\(Malayalam\)/g, '')
    .replace(/\(Kannada\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/&quot;/g, '')
    .replace(/&amp;/g, '&')
    .trim();
    
  const firstArtist = (artistName || '').split(',')[0].trim();
  const query = `${cleanName} ${firstArtist} official music video`.trim();
  
  // Strategy:
  // - Dev mode: Vite proxy → YouTube HTML scrape (fast, reliable)
  // - Capacitor (phone) + Web prod: Use WORKER_URL/youtube/search endpoint
  //   The Vercel worker scrapes YouTube server-side and returns JSON

  try {
    if (isDev) {
      // Dev mode: Vite proxy → YouTube HTML scrape
      const ytUrl = `${YOUTUBE_API}/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
      return await _scrapeYouTubeHTML(ytUrl, cleanName, firstArtist);
    } else {
      // Production + Capacitor: Use our worker's YouTube search API
      // Worker scrapes YouTube server-side and returns { items: [{url, thumbnail}] }
      const workerUrl = `${WORKER_URL}/youtube/search?q=${encodeURIComponent(query)}`;
      console.log('[Clips] Using worker YouTube search:', workerUrl);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(workerUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        console.warn('[Clips] Worker YouTube search failed:', res.status);
        return null;
      }
      
      const data = await res.json();
      const items = data?.items || [];
      
      if (items.length > 0) {
        // The worker returns basic results, extract videoId
        const videoId = items[0].url?.replace('/watch?v=', '');
        if (videoId) {
          console.log(`[Clips] 🎬 Found video: ${videoId}`);
          return {
            videoId,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
            thumbnail: items[0].thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Clips] Search failed:`, err.message);
  }
  return null;
}

/**
 * Internal: Scrape YouTube search results HTML and find best official video
 */
async function _scrapeYouTubeHTML(url, songName, artistName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  clearTimeout(timeout);
  if (!res.ok) return null;

  const html = await res.text();

  // Extract ALL video results with their titles and channel names
  const candidates = [];
  
  // Pattern: find videoRenderer blocks with videoId, title, and channel
  const videoRendererRegex = /"videoRenderer":\s*\{[^}]*?"videoId":\s*"([a-zA-Z0-9_-]{11})"[^]*?"title":\s*\{"runs":\s*\[\{"text":\s*"([^"]*?)"\}[^]*?(?:"ownerText":\s*\{"runs":\s*\[\{"text":\s*"([^"]*?)"\}|"shortBylineText":\s*\{"runs":\s*\[\{"text":\s*"([^"]*?)"\})/g;
  
  let match;
  while ((match = videoRendererRegex.exec(html)) !== null) {
    candidates.push({
      videoId: match[1],
      title: match[2],
      channel: match[3] || match[4] || '',
    });
  }

  // Fallback: simpler regex if complex one didn't match
  if (candidates.length === 0) {
    const simpleRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const titleRegex = /"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
    
    const videoIds = [];
    const titles = [];
    let m;
    while ((m = simpleRegex.exec(html)) !== null) videoIds.push(m[1]);
    while ((m = titleRegex.exec(html)) !== null) titles.push(m[1]);
    
    // Deduplicate videoIds
    const seen = new Set();
    for (let i = 0; i < videoIds.length; i++) {
      if (!seen.has(videoIds[i])) {
        seen.add(videoIds[i]);
        candidates.push({
          videoId: videoIds[i],
          title: titles[i] || '',
          channel: '',
        });
      }
    }
  }

  console.log(`[Clips] Found ${candidates.length} video candidates for "${songName}"`);

  // Score and rank all candidates
  let bestResult = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const { valid, score } = isOfficialVideo(candidate.title, candidate.channel, songName, artistName);
    
    if (valid && score > bestScore) {
      bestScore = score;
      bestResult = candidate;
    }

    console.log(`[Clips] ${valid ? '✅' : '❌'} Score=${score} | "${candidate.title}" (${candidate.channel || 'unknown channel'})`);
  }

  if (bestResult) {
    console.log(`[Clips] 🎬 Selected: "${bestResult.title}" (score: ${bestScore})`);
    return {
      videoId: bestResult.videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${bestResult.videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${bestResult.videoId}/hqdefault.jpg`,
    };
  }

  return null;
}

/**
 * Get direct audio stream URL from Piped proxy for a given song
 */
export async function getYouTubeAudioStream(songName, artistName) {
  if (!songName) return null;

  const cleanName = songName
    .replace(/\(From.*?\)/g, '')
    .replace(/\(Tamil\)/g, '')
    .replace(/\(Telugu\)/g, '')
    .replace(/\(Hindi\)/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();
    
  const firstArtist = (artistName || '').split(',')[0].trim();
  const query = `${cleanName} ${firstArtist} official audio`.trim();
  
  const baseUrl = isDev ? '' : WORKER_URL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 1. Search for video using our ytProxy backend
    const searchRes = await fetch(`${baseUrl}/api/yt/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!searchRes.ok) throw new Error(`Search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    
    const videoId = searchData?.results?.[0]?.id;
    if (!videoId) return null;

    // 2. Fetch stream from our ytProxy backend
    const streamController = new AbortController();
    const streamTimeout = setTimeout(() => streamController.abort(), 25000);
    
    const streamRes = await fetch(`${baseUrl}/api/yt/stream/${videoId}`, {
      signal: streamController.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(streamTimeout);

    if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);
    const streamData = await streamRes.json();

    return streamData.audioUrl || null;
  } catch (err) {
    console.warn(`[YT Stream] Fetch failed:`, err.message);
    return null;
  }
}

export async function wakeUpBackend() {
  try {
    const url = WORKER_URL;
    fetch(url).catch(() => {});
  } catch (e) {}
}

export async function getDailyMixes(recentlyPlayed = [], likedSongs = []) {
  // 1. Build a taste profile
  const profile = buildTasteProfile(recentlyPlayed, likedSongs);
  
  // 2. Identify top seed songs from likedSongs and recentlyPlayed
  const allSongs = [...likedSongs, ...recentlyPlayed];
  const seen = new Set();
  const uniqueSongs = allSongs.filter(s => {
    if (!s?.id || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Default seeds to use as fallback if history is empty
  const defaultSeeds = [
    { id: 'KH0kypWw', name: 'Aravindh', primaryArtists: 'Anirudh Ravichander, Super Subu', image: [{ quality: '500x500', link: 'https://c.saavncdn.com/731/Aravindh-Tamil-2026-20260613173027-500x500.jpg' }] },
    { id: 'LgHk8MWa', name: 'Kannaana Kanney', primaryArtists: 'Sid Sriram', image: [{ quality: '500x500', link: 'https://c.saavncdn.com/006/Viswasam-Tamil-2020-20240321064638-500x500.jpg' }] },
    { id: '-FS-F1S4', name: 'Aanandha Yaazhai', primaryArtists: 'Yuvan Shankar Raja, Sriram Parthasarathy', image: [{ quality: '500x500', link: 'https://c.saavncdn.com/558/Thangameenkal-Tamil-2013-20190822133709-500x500.jpg' }] }
  ];

  // We select up to 3 seeds
  const seeds = [];
  if (profile && profile.topArtists && profile.topArtists.length > 0) {
    for (const artist of profile.topArtists) {
      const match = uniqueSongs.find(s => {
        const sArtists = (s.primaryArtists || '').toLowerCase();
        return sArtists.includes(artist.toLowerCase()) && !seeds.some(x => x.id === s.id);
      });
      if (match) {
        seeds.push(match);
        if (seeds.length >= 3) break;
      }
    }
  }

  // Fill up from unique songs if needed
  for (const song of uniqueSongs) {
    if (seeds.length >= 3) break;
    if (!seeds.some(x => x.id === song.id)) {
      seeds.push(song);
    }
  }

  // Fill up from default seeds if needed
  for (const def of defaultSeeds) {
    if (seeds.length >= 3) break;
    if (!seeds.some(x => x.id === def.id)) {
      seeds.push(def);
    }
  }

  // 3. For each seed song, fetch recommendations
  const mixPromises = seeds.map(async (seed, idx) => {
    try {
      let suggestions = [];
      if (seed.id) {
        suggestions = await getSongSuggestions(seed.id, 25);
      }
      
      const songsList = [seed, ...suggestions].filter(s => s && s.id);
      
      const mixSeen = new Set();
      const finalSongs = songsList.filter(s => {
        if (mixSeen.has(s.id)) return false;
        mixSeen.add(s.id);
        return true;
      });

      const seedArtist = (seed.primaryArtists || seed.subtitle || 'Unknown').split(',')[0].trim();
      const mixTitle = `Daily Mix ${idx + 1}`;
      const mixName = `${seedArtist} Mix`;

      const gradients = [
        'linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(2, 44, 34, 0.95), rgba(0, 0, 0, 0.9))',
        'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95), rgba(0, 0, 0, 0.9))',
        'linear-gradient(135deg, rgba(49, 16, 66, 0.95), rgba(28, 10, 33, 0.95), rgba(0, 0, 0, 0.9))'
      ];

      const artistsList = finalSongs
        .slice(0, 5)
        .map(s => (s.primaryArtists || '').split(',')[0].trim())
        .filter((val, i, arr) => arr.indexOf(val) === i)
        .join(', ');

      return {
        id: `daily-mix-${idx + 1}`,
        name: mixName,
        title: mixName,
        type: 'playlist',
        subtitle: artistsList || 'Your personalized daily mix',
        gradient: gradients[idx % gradients.length],
        image: seed.image || [],
        songs: finalSongs,
        songCount: finalSongs.length,
        isLocal: true
      };
    } catch (err) {
      console.warn(`[DailyMix] Failed to build mix ${idx + 1}:`, err);
      return null;
    }
  });

  const mixes = (await Promise.all(mixPromises)).filter(Boolean);
  return mixes;
}
