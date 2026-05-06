/**
 * JioSaavn API Service — Tamil Focused
 * Primary:  jiosaavn-api-privatecvc2.vercel.app (faster, no rate-limit)
 * Fallback: saavn.sumit.co (backup)
 *
 * 🔧 FIX: Full song not playing (only ~1 min preview)
 *    Root cause — JioSaavn CDN URLs with `_p` suffix are preview/truncated clips.
 *    Solution  — Always pick highest quality AND strip `_p` from URL.
 *    Also added: getStreamUrl() helper + streamUrl pre-computed field.
 */

const PRIMARY_URL  = 'https://saavn.sumit.co/api';
const FALLBACK_URL = 'https://saavn-api.vercel.app';

/* ─────────────────────────────────────────────────────────────────────────
   🔧 KEY FIX: Best stream URL picker
   downloadUrl is an array like:
     [
       { quality: "12kbps",  url: "https://..." },
       { quality: "48kbps",  url: "https://..." },
       { quality: "96kbps",  url: "https://..." },   ← may have _p (preview)
       { quality: "160kbps", url: "https://..." },
       { quality: "320kbps", url: "https://..." },   ← FULL SONG, best quality
     ]
   We MUST pick the highest available quality AND strip _p from URL.
   ───────────────────────────────────────────────────────────────────────── */
const QUALITY_PRIORITY = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];

/**
 * Strip preview marker from JioSaavn CDN URLs.
 * Preview URLs contain `_96_p.mp4` or similar — the `_p` means preview (truncated).
 * Full song URLs are `_96.mp4`, `_160.mp4`, `_320.mp4` without `_p`.
 */
function stripPreviewMarker(url) {
  if (!url || typeof url !== 'string') return url;
  return url
    .replace(/_p\.mp4/g, '.mp4')
    .replace(/_p\.m4a/g, '.m4a')
    .replace(/_p\.aac/g, '.aac');
}

export function getStreamUrl(downloadUrl) {
  if (!downloadUrl) return null;

  // Array format (primary API)
  if (Array.isArray(downloadUrl)) {
    for (const quality of QUALITY_PRIORITY) {
      const match = downloadUrl.find(
        d => d.quality === quality && (d.url || d.link)
      );
      if (match) return stripPreviewMarker(match.url || match.link);
    }
    // Fallback: last item (usually highest quality)
    const last = downloadUrl[downloadUrl.length - 1];
    return stripPreviewMarker(last?.url || last?.link || null);
  }

  // String format (some fallback API responses)
  if (typeof downloadUrl === 'string') return stripPreviewMarker(downloadUrl);

  return null;
}

/* ── Normalise song objects from the primary API (different schema) ── */
function normalizeSong(raw) {
  if (!raw) return null;
  // Map primaryArtists from array or string
  const primaryArtists =
    Array.isArray(raw.primaryArtists)
      ? raw.primaryArtists.map(a => a.name || a).join(', ')
      : raw.primaryArtists || '';

  // Map image: primary API uses array of {quality, url} or {quality, link}
  const image = Array.isArray(raw.image)
    ? raw.image.map(i => ({ quality: i.quality, url: i.url || i.link }))
    : raw.image;

  // downloadUrl: map array of {quality, url} or {quality, link}
  const downloadUrl = Array.isArray(raw.downloadUrl)
    ? raw.downloadUrl.map(d => ({ quality: d.quality, url: d.url || d.link }))
    : raw.downloadUrl;

  // 🔧 Pre-compute the best stream URL so the player can use it directly
  const streamUrl = getStreamUrl(downloadUrl);

  return { ...raw, primaryArtists, image, downloadUrl, streamUrl };
}

/* ── Universal API fetch wrapper (handles both formats) ── */
async function apiFetch(endpoint) {
  let url = `${PRIMARY_URL}${endpoint}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const json = await res.json();
    if (json.status === 'SUCCESS' || json.success === true) return json.data;
    throw new Error('API not SUCCESS');
  } catch (err) {
    console.warn(`[SaavnAPI] Primary failed (${endpoint}): ${err.message}. Trying fallback…`);
    try {
      url = `${FALLBACK_URL}${endpoint}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fallback API Error: ${res.status}`);
      const json = await res.json();
      if (json.status === 'SUCCESS' || json.success === true) return json.data;
      throw new Error('Fallback API not successful');
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}



/* ── Normalise a search results object from primary API ── */
function normalizeSearchResults(data) {
  if (!data) return { results: [], total: 0 };
  // Primary API returns {total, start, results: [...]}
  if (data.results) {
    return { ...data, results: data.results.map(normalizeSong) };
  }
  // Fallback format is the same
  return data;
}

/* ========================================================
   SEARCH
   ======================================================== */
export async function globalSearch(query) {
  if (!query || query.trim().length < 2) return null;
  try {
    return await apiFetch(`/search?query=${encodeURIComponent(query)}`);
  } catch {
    return await apiFetch(`/search/all?query=${encodeURIComponent(query)}`).catch(() => null);
  }
}

export async function searchSongs(query, limit = 20, page = 1, sortBy = null) {
  if (!query) return { results: [], total: 0 };
  
  // JioSaavn API doesn't support sortBy URL param, so we smartly append it to the query
  const finalQuery = sortBy === 'latest' ? `${query} latest` : query;
  
  try {
    const data = await apiFetch(
      `/search/songs?query=${encodeURIComponent(finalQuery)}&page=${page}&limit=${limit}`
    );
    return normalizeSearchResults(data);
  } catch {
    return { results: [], total: 0 };
  }
}

/* ── Normalise an album search result (different shape from songs) ── */
function normalizeAlbumResult(raw) {
  if (!raw) return null;
  // Primary API album search result shape:
  // { id, title, subtitle, type, image: [{quality, url|link}], url, artist, description, year, songIds }
  const image = Array.isArray(raw.image)
    ? raw.image.map(i => ({ quality: i.quality, url: i.url || i.link }))
    : raw.image;

  return {
    id: raw.id,
    name: raw.name || raw.title || '',        // normalise to .name for AlbumCard
    title: raw.title || raw.name || '',
    subtitle: raw.subtitle || '',
    artist: raw.artist || raw.subtitle || '',  // AlbumCard reads .artist
    primaryArtists: raw.primaryArtists || raw.artist || raw.subtitle || '',
    year: raw.year || '',
    image,
    type: raw.type || 'album',
    url: raw.url || '',
  };
}

export async function searchAlbums(query, limit = 20) {
  if (!query) return { results: [], total: 0 };
  try {
    const data = await apiFetch(`/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`);
    const results = Array.isArray(data?.results)
      ? data.results.map(normalizeAlbumResult).filter(Boolean)
      : [];
    return { results, total: data?.total || results.length };
  } catch {
    return { results: [], total: 0 };
  }
}

export async function searchArtists(query, limit = 20) {
  if (!query) return { results: [], total: 0 };
  try {
    const data = await apiFetch(`/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`);
    return normalizeSearchResults(data);
  } catch {
    return { results: [], total: 0 };
  }
}

export async function searchPlaylists(query, limit = 20) {
  if (!query) return { results: [], total: 0 };
  try {
    const data = await apiFetch(`/search/playlists?query=${encodeURIComponent(query)}&limit=${limit}`);
    return normalizeSearchResults(data);
  } catch {
    return { results: [], total: 0 };
  }
}

/* ========================================================
   DETAILS
   ======================================================== */
export async function getSongById(id) {
  try {
    let data = await apiFetch(`/songs?id=${encodeURIComponent(id)}`).catch(() => apiFetch(`/songs/${encodeURIComponent(id)}`));
    const song = Array.isArray(data) ? data[0] : data;
    return normalizeSong(song);
  } catch {
    return null;
  }
}

export async function getSongsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  try {
    let data = await apiFetch(`/songs?ids=${ids.join(',')}`).catch(() => apiFetch(`/songs/${ids.join(',')}`));
    const arr = Array.isArray(data) ? data : [data];
    return arr.map(normalizeSong);
  } catch {
    return [];
  }
}

function normalizeAlbum(data) {
  if (!data) return null;
  const songs = Array.isArray(data.songs) ? data.songs.map(normalizeSong) : [];
  return { ...data, songs };
}

export async function getAlbumById(id) {
  try {
    const data = await apiFetch(`/albums?id=${encodeURIComponent(id)}`);
    return normalizeAlbum(data);
  } catch {
    return null;
  }
}

export async function getPlaylistById(id) {
  try {
    const data = await apiFetch(`/playlists?id=${encodeURIComponent(id)}`);
    return normalizeAlbum(data);
  } catch {
    return null;
  }
}

export async function getSongLyrics(id) {
  try {
    return await apiFetch(`/lyrics?id=${encodeURIComponent(id)}`);
  } catch {
    try { return await apiFetch(`/songs/${encodeURIComponent(id)}/lyrics`); }
    catch { return null; }
  }
}

/* ========================================================
   SMART INFINITE SUGGESTIONS
   Keeps cycling through multiple queries & pages
   so the queue NEVER runs out of Tamil songs.
   ======================================================== */
const SUGGESTION_QUERIES = [
  'anirudh ravichander',
  'ar rahman tamil',
  'yuvan shankar raja',
  'harris jayaraj',
  'd imman tamil',
  'sid sriram tamil',
  'hip hop tamizha',
  'ilaiyaraaja',
  'gv prakash tamil',
  'dhanush songs',
  'tamil hits 2024',
  'tamil hits 2025',
  'tamil melody love',
  'tamil kuthu party',
  'vijay mass songs',
];

let _suggestionQueryIdx = 0;
let _suggestionPage = 1;

export async function getSongSuggestions(songId, limit = 50) {
  try {
    // Step 1: Try to get artist from song and use their name
    const song = await getSongById(songId);
    const artistStr = song?.primaryArtists || '';
    const mainArtist = artistStr.split(', ')[0] || '';

    if (mainArtist) {
      const data = await searchSongs(`${mainArtist} tamil songs`, limit, _suggestionPage);
      if (data?.results?.length > 0) {
        _suggestionPage++;
        return data.results;
      }
    }
    throw new Error('Artist search empty, rotating query');
  } catch {
    // Step 2: Rotate through our curated list of queries with pagination
    const query = SUGGESTION_QUERIES[_suggestionQueryIdx % SUGGESTION_QUERIES.length];
    _suggestionQueryIdx++;
    const page = Math.ceil(_suggestionQueryIdx / SUGGESTION_QUERIES.length);

    try {
      const data = await searchSongs(query, limit, page);
      if (data?.results?.length > 0) return data.results;
    } catch { /* ignore */ }

    // Step 3: Ultimate fallback — random Tamil hits page
    const fallbackPage = Math.floor(Math.random() * 5) + 1;
    const fallback = await searchSongs('tamil latest hits 2025', limit, fallbackPage);
    return fallback?.results || [];
  }
}

/* ========================================================
   CONVENIENCE SECTION FETCHERS (used by CategoryView)
   ======================================================== */
export async function getTamilTrending()   { return (await searchSongs('tamil hits 2025 latest', 50)).results || []; }
export async function getTamilNewReleases(){ return (await searchSongs('new tamil songs 2025', 50)).results || []; }
export async function getAnirudhHits()     { return (await searchSongs('anirudh ravichander tamil', 50)).results || []; }
export async function getARRahmanHits()    { return (await searchSongs('ar rahman tamil hits', 50)).results || []; }
export async function getYuvanHits()       { return (await searchSongs('yuvan shankar raja hits', 50)).results || []; }
export async function getSidSriramHits()   { return (await searchSongs('sid sriram tamil songs', 50)).results || []; }
export async function getHipHopTamizha()   { return (await searchSongs('hip hop tamizha', 50)).results || []; }
export async function getTamilMelody()     { return (await searchSongs('tamil melody love songs', 50)).results || []; }
export async function getTamilDevotional() { return (await searchSongs('tamil devotional songs', 50)).results || []; }
export async function getTamilRomantic()   { return (await searchSongs('tamil romantic songs 2024', 50)).results || []; }
export async function getTamilParty()      { return (await searchSongs('tamil party dance kuthu songs', 50)).results || []; }
export async function getIlaiyaraajaHits() { return (await searchSongs('ilaiyaraaja tamil classic', 50)).results || []; }
export async function getSpbHits()         { return (await searchSongs('spb tamil songs', 50)).results || []; }
export async function getHarrisJayarajHits(){ return (await searchSongs('harris jayaraj hits', 50)).results || []; }
export async function getImmanHits()       { return (await searchSongs('d imman tamil songs', 50)).results || []; }
export async function getDhanushSongs()    { return (await searchSongs('dhanush tamil songs', 50)).results || []; }
