// ── Pure JS DES (ECB mode) ────────────────────────────────────
// JioSaavn uses DES-ECB with key '38346591'
const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const IP2= [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const S = [
  [[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]],
  [[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]],
  [[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]],
  [[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]],
  [[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]],
  [[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]],
  [[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]],
  [[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]
];
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];

function permute(block, table) {
  return table.map(b => (block[b-1]|0));
}

function toBits(bytes) {
  const bits = [];
  for (const b of bytes) for (let i=7;i>=0;i--) bits.push((b>>i)&1);
  return bits;
}

function toBytes(bits) {
  const bytes = [];
  for (let i=0;i<bits.length;i+=8) {
    let b=0;
    for (let j=0;j<8;j++) b=(b<<1)|bits[i+j];
    bytes.push(b);
  }
  return bytes;
}

function desBlock(block64bits, subkeys) {
  let b = permute(block64bits, IP);
  let L = b.slice(0,32), R = b.slice(32);
  for (let i=0;i<16;i++) {
    const Rexp = permute(R, E);
    const xored = Rexp.map((bit,j) => bit ^ subkeys[i][j]);
    let sout = [];
    for (let s=0;s<8;s++) {
      const row = (xored[s*6]<<1)|xored[s*6+5];
      const col = (xored[s*6+1]<<3)|(xored[s*6+2]<<2)|(xored[s*6+3]<<1)|xored[s*6+4];
      const val = S[s][row][col];
      for (let k=3;k>=0;k--) sout.push((val>>k)&1);
    }
    const f = permute(sout, P);
    const newR = L.map((bit,j) => bit ^ f[j]);
    L = R; R = newR;
  }
  return permute([...R,...L], IP2);
}

function getSubkeys(keyBytes) {
  const keyBits = toBits(keyBytes);
  let C = permute(keyBits, PC1).slice(0,28);
  let D = permute(keyBits, PC1).slice(28);
  const subkeys = [];
  for (const shift of SHIFTS) {
    C = [...C.slice(shift), ...C.slice(0,shift)];
    D = [...D.slice(shift), ...D.slice(0,shift)];
    subkeys.push(permute([...C,...D], PC2));
  }
  return subkeys;
}

function desDecrypt(cipherBytes, keyBytes) {
  const subkeys = getSubkeys(keyBytes);
  const reversed = [...subkeys].reverse();
  const out = [];
  for (let i=0;i<cipherBytes.length;i+=8) {
    const block = toBits(cipherBytes.slice(i,i+8));
    out.push(...toBytes(desBlock(block, reversed)));
  }
  // Remove PKCS7 padding
  const pad = out[out.length-1];
  return out.slice(0, out.length - pad);
}

function decryptSaavnUrl(encB64) {
  try {
    const enc = atob(encB64);
    const cipherBytes = Uint8Array.from(enc, c => c.charCodeAt(0));
    const keyBytes = new TextEncoder().encode('38346591');
    const decBytes = desDecrypt(Array.from(cipherBytes), Array.from(keyBytes));
    return new TextDecoder().decode(new Uint8Array(decBytes)).trim();
  } catch {
    return null;
  }
}

// ── Download URLs ─────────────────────────────────────────────
function getDownloadUrls(encUrl, previewUrl) {
  const url = encUrl || previewUrl;
  if (!url) return [];

  if (url.startsWith('http')) {
    const base = url
      .replace(/_p\.(mp4|m4a|aac)$/, '.$1')
      .replace('preview.saavncdn.com', 'aac.saavncdn.com');
    return [
      { quality: '320kbps', url: base.replace(/_\d+\./, '_320.') },
      { quality: '160kbps', url: base.replace(/_\d+\./, '_160.') },
      { quality: '96kbps',  url: base.replace(/_\d+\./, '_96.')  },
      { quality: '48kbps',  url: base.replace(/_\d+\./, '_48.')  },
    ];
  }

  const decrypted = decryptSaavnUrl(url);
  if (!decrypted?.startsWith('http')) return [];

  return [
    { quality: '320kbps', url: decrypted.replace(/_\d+\.mp4/, '_320.mp4') },
    { quality: '160kbps', url: decrypted.replace(/_\d+\.mp4/, '_160.mp4') },
    { quality: '96kbps',  url: decrypted.replace(/_\d+\.mp4/, '_96.mp4')  },
    { quality: '48kbps',  url: decrypted.replace(/_\d+\.mp4/, '_48.mp4')  },
  ];
}

// ── Image ─────────────────────────────────────────────────────
function imgs(u) {
  if (!u) return [];
  if (Array.isArray(u)) return u;
  const b = u.replace(/-\d+x\d+\./, '-{R}.');
  return [
    { quality: '50x50',   link: b.replace('{R}', '50x50')   },
    { quality: '150x150', link: b.replace('{R}', '150x150') },
    { quality: '500x500', link: b.replace('{R}', '500x500') },
  ];
}

// ── Song ──────────────────────────────────────────────────────
function normalizeSong(r) {
  if (!r) return null;
  const mi = r.more_info || {};
  const encUrl = mi.encrypted_media_url || r.encrypted_media_url || mi.encrypted_media_path;
  const previewUrl = r.media_preview_url || mi.media_preview_url;
  
  // Build image array in the format saavn.js expects
  const rawImg = r.image || mi.image || '';
  const imgBase = (typeof rawImg === 'string' ? rawImg : '').replace(/-\d+x\d+\./, '-{R}.');
  const imageArr = imgBase ? [
    { quality: '50x50',   link: imgBase.replace('{R}', '50x50')   },
    { quality: '150x150', link: imgBase.replace('{R}', '150x150') },
    { quality: '500x500', link: imgBase.replace('{R}', '500x500') },
  ] : (Array.isArray(rawImg) ? rawImg : []);

  return {
    id: r.id || r.songid,
    // ✅ Use 'name' not 'song/title' — saavn.js expects raw.name
    name: r.song || r.title || r.name || 'Unknown',
    title: r.song || r.title || r.name || 'Unknown',
    type: 'song',
    year: r.year || mi.year || '',
    duration: parseInt(r.duration || mi.duration || 0),
    language: r.language || mi.language || '',
    label: r.label || mi.label || '',
    hasLyrics: r.has_lyrics === 'true' || r.has_lyrics === true,
    // ✅ image as array of {quality, link} objects
    image: imageArr,
    primaryArtists: r.primary_artists || mi.primary_artists || r.subtitle || '',
    album: r.album || mi.album || '',
    // ✅ downloadUrl as array of {quality, url} objects
    downloadUrl: getDownloadUrls(encUrl, previewUrl),
    url: r.perma_url || r.url || '',
  };
}

// ── CORS & Response ───────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ── JioSaavn Fetch ────────────────────────────────────────────
const JIOSAAVN = 'https://www.jiosaavn.com/api.php';
const e = encodeURIComponent;

async function saavnFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, */*',
      'Referer': 'https://www.jiosaavn.com/',
      'Origin': 'https://www.jiosaavn.com',
      'Cookie': 'L=tamil; DL=english',
    },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from JioSaavn: ${text.slice(0, 300)}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
  }
}

// ── Router ────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const q = url.searchParams;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (path === '/api/search') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=autocomplete.get&_format=json&_marker=0&cc=in&query=${e(q.get('query')||'')}`);
        const fmt = arr => (arr?.data||[]).map(i=>({
          id: i.id||i.albumid||i.listid||'',
          name: i.title||i.name||i.song||'',
          title: i.title||i.name||i.song||'',
          image: imgs(i.image),
          primaryArtists: i.primary_artists||i.subtitle||'',
          url: i.perma_url||'',
        }));
        return jsonRes({ data: {
          topQuery:  { results: [] },
          songs:     { results: fmt(raw.songs)     },
          albums:    { results: fmt(raw.albums)    },
          artists:   { results: fmt(raw.artists)   },
          playlists: { results: fmt(raw.playlists) },
        }});
      }

      if (path === '/api/search/songs') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&q=${e(q.get('query')||'')}&n=${q.get('limit')||20}`);
        // JioSaavn returns { results: [...], total: "50" }
        const results = raw?.results || raw?.data || [];
        return jsonRes({ 
          data: { 
            results: results.map(normalizeSong).filter(Boolean), 
            total: parseInt(raw?.total || 0) 
          }
        });
      }

      if (path === '/api/search/albums') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=search.getAlbumResults&_format=json&_marker=0&cc=in&p=1&q=${e(q.get('query')||'')}&n=${q.get('limit')||20}`);
        const results = raw?.results || raw?.data || (Array.isArray(raw) ? raw : []);
        return jsonRes({ 
          data: { 
            results: results.map(r => ({
              id: r.albumid || r.id || '',
              name: r.title || r.name || '',
              title: r.title || r.name || '',
              image: imgs(r.image),
              primaryArtists: r.music || r.primary_artists || r.subtitle || '',
              year: r.year || '',
              url: r.perma_url || '',
            })),
            total: parseInt(raw?.total || results.length || 0)
          }
        });
      }

      if (path === '/api/search/artists') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=search.getArtistResults&_format=json&_marker=0&cc=in&p=1&q=${e(q.get('query')||'')}&n=${q.get('limit')||20}`);
        return jsonRes({ data: { results: raw.results||[], total: parseInt(raw.total||0) }});
      }

      if (path === '/api/search/playlists') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=search.getPlaylistResults&_format=json&_marker=0&cc=in&p=1&q=${e(q.get('query')||'')}&n=${q.get('limit')||20}`);
        return jsonRes({ data: { results: raw.results||[], total: parseInt(raw.total||0) }});
      }

      if (path.match(/^\/api\/songs\/[^/]+$/) && !path.includes('suggestions')) {
        const id = path.split('/')[3];
        const raw = await saavnFetch(`${JIOSAAVN}?__call=song.getDetails&_format=json&_marker=0&cc=in&pids=${e(id)}`);
        const songs = Object.values(raw).filter(s=>s?.id).map(normalizeSong).filter(Boolean);
        return jsonRes({ data: songs });
      }

      if (path.match(/^\/api\/songs\/[^/]+\/suggestions$/)) {
        const id = path.split('/')[3];
        const raw = await saavnFetch(`${JIOSAAVN}?__call=reco.getreco&_format=json&_marker=0&cc=in&pid=${e(id)}&n=${q.get('limit')||20}`);
        const arr = Array.isArray(raw) ? raw : (raw[id] || Object.values(raw)[0] || []);
        return jsonRes({ data: arr.map(normalizeSong).filter(Boolean) });
      }

      if (path === '/api/albums') {
        // Try content.getAlbumDetails first, fallback to search
        let raw;
        try {
          raw = await saavnFetch(`${JIOSAAVN}?__call=content.getAlbumDetails&_format=json&_marker=0&cc=in&albumid=${e(q.get('id')||'')}`);
        } catch {
          return jsonRes({ error: 'Album not found' }, 404);
        }

        const songs = (raw.songs || raw.list || []).map(normalizeSong).filter(Boolean);
        
        // Normalize album image same way
        const rawImg = raw.image || '';
        const imgBase = rawImg.replace(/-\d+x\d+\./, '-{R}.');
        const imageArr = [
          { quality: '50x50',   link: imgBase.replace('{R}', '50x50')   },
          { quality: '150x150', link: imgBase.replace('{R}', '150x150') },
          { quality: '500x500', link: imgBase.replace('{R}', '500x500') },
        ];

        return jsonRes({ data: {
          id: raw.albumid || raw.id,
          name: raw.title || raw.name,
          title: raw.title || raw.name,
          year: raw.year,
          language: raw.language,
          image: imageArr,
          primaryArtists: raw.primary_artists || raw.music || '',
          songs,
        }});
      }

      if (path === '/api/playlists') {
        const raw = await saavnFetch(`${JIOSAAVN}?__call=playlist.getDetails&_format=json&_marker=0&cc=in&listid=${e(q.get('id')||'')}`);
        return jsonRes({ data: { ...raw, songs: (raw.songs||[]).map(normalizeSong).filter(Boolean) }});
      }

      if (path === '/stream') {
        const streamUrl = q.get('url');
        if (!streamUrl) return jsonRes({ error: 'Missing url' }, 400);
        const streamRes = await fetch(streamUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
            'Referer': 'https://www.jiosaavn.com/',
            ...(request.headers.get('range') ? { Range: request.headers.get('range') } : {}),
          },
        });
        const headers = new Headers(streamRes.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(streamRes.body, { status: streamRes.status, headers });
      }

      if (path === '/youtube/search') {
        const ytRes = await fetch(
          `https://www.youtube.com/results?search_query=${e(q.get('q')||'')}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' } }
        );
        const html = await ytRes.text();
        const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match) return jsonRes({ items: [{ url: `/watch?v=${match[1]}`, thumbnail: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` }] });
        return jsonRes({ items: [] });
      }

      // ── Homepage Data (Tamil) ──────────────────────────────────
      // With Cookie: L=tamil, JioSaavn API returns Tamil content natively
      if (path === '/api/homepage') {
        const lang = q.get('language') || 'tamil';

        // Fetch all homepage data in parallel
        const [homepageRaw, newAlbumsRaw, chartsRaw, featuredRaw, trendingRaw] = await Promise.all([
          saavnFetch(`${JIOSAAVN}?__call=webapi.getLaunchData&_format=json&_marker=0&api_version=4&ctx=wap6dot0&__languages=${lang}`).catch(() => ({})),
          saavnFetch(`${JIOSAAVN}?__call=content.getAlbums&_format=json&_marker=0&api_version=4&ctx=wap6dot0&p=1&n=20&language=${lang}`).catch(() => ({ data: [] })),
          saavnFetch(`${JIOSAAVN}?__call=content.getCharts&_format=json&_marker=0&api_version=4&ctx=wap6dot0&__languages=${lang}`).catch(() => []),
          saavnFetch(`${JIOSAAVN}?__call=content.getFeaturedPlaylists&_format=json&_marker=0&api_version=4&ctx=wap6dot0&p=1&n=30&language=${lang}`).catch(() => ({ data: [] })),
          saavnFetch(`${JIOSAAVN}?__call=content.getTrending&_format=json&_marker=0&api_version=4&ctx=wap6dot0&type=&lang=${lang}`).catch(() => []),
        ]);

        // ── New Releases (songs + albums from content.getAlbums filtered to Tamil)
        const albumsData = newAlbumsRaw?.data || [];
        const newAlbums = albumsData
          .filter(item => {
            const itemLang = (item.language || '').toLowerCase();
            return itemLang === lang || itemLang === '';
          })
          .slice(0, 20)
          .map(item => {
            if (item.type === 'song') return normalizeSong(item);
            return {
              id: item.id,
              name: item.title || item.name || '',
              title: item.title || item.name || '',
              type: item.type || 'album',
              image: imgs(item.image),
              year: item.year || item.more_info?.release_date?.split('-')[0] || '',
              language: item.language || '',
              url: item.perma_url || '',
              primaryArtists: item.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ')
                || item.subtitle || '',
            };
          });

        // ── Featured Playlists (from content.getFeaturedPlaylists)
        const playlistsData = featuredRaw?.data || featuredRaw?.featured_playlists || homepageRaw?.top_playlists || [];
        const playlists = (Array.isArray(playlistsData) ? playlistsData : [])
          .slice(0, 30)
          .map(pl => ({
            id: pl.id || pl.listid,
            name: pl.title || pl.listname || '',
            title: pl.title || pl.listname || '',
            type: 'playlist',
            image: imgs(pl.image),
            url: pl.perma_url || '',
            songCount: parseInt(pl.more_info?.song_count || pl.list_count || 0),
            followerCount: pl.more_info?.follower_count || pl.fan_count || '',
            subtitle: pl.subtitle || `${pl.more_info?.follower_count || pl.fan_count || ''} Fans`,
          }));

        // ── Charts 
        const chartsData = Array.isArray(chartsRaw) ? chartsRaw : (chartsRaw?.data || homepageRaw?.charts || []);
        const charts = chartsData
          .map(ch => ({
            id: ch.id,
            name: ch.title || '',
            title: ch.title || '',
            type: 'playlist',
            image: imgs(ch.image),
            url: ch.perma_url || '',
            language: ch.language || '',
            subtitle: ch.subtitle || ch.more_info?.firstname || 'JioSaavn',
          }));

        // ── Trending (from webapi.getLaunchData → new_trending or content.getTrending)
        const trendingData = homepageRaw?.new_trending || (Array.isArray(trendingRaw) ? trendingRaw : (trendingRaw?.data || []));
        const trending = (Array.isArray(trendingData) ? trendingData : [])
          .slice(0, 20)
          .map(item => {
            if (item.type === 'song') return normalizeSong(item);
            return {
              id: item.id,
              name: item.title || '',
              title: item.title || '',
              type: item.type || 'playlist',
              image: imgs(item.image),
              url: item.perma_url || '',
              subtitle: item.subtitle || '',
              language: item.language || '',
              primaryArtists: item.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || item.subtitle || '',
              followerCount: item.more_info?.follower_count || item.more_info?.fan_count || '',
            };
          });

        // ── Genres (from browse_discover in launch data)
        const browseData = homepageRaw?.browse_discover || [];
        const genres = browseData.length > 0
          ? browseData.slice(0, 12).map(g => ({
              title: g.title || '',
              image: g.image || '',
              tags: g.more_info?.tags || g.title?.toLowerCase() || '',
            }))
          : [
              { title: 'Kuthu / Dance', image: 'https://c.saavncdn.com/editorial/genrecharts_Party.jpg', tags: 'kuthu dance tamil' },
              { title: 'Melody', image: 'https://c.saavncdn.com/editorial/genrecharts_Chill.jpg', tags: 'melody tamil songs' },
              { title: 'Romance', image: 'https://c.saavncdn.com/editorial/genrecharts_Classics.jpg', tags: 'romantic tamil songs' },
              { title: 'Devotional', image: 'https://c.saavncdn.com/editorial/genrecharts_Devotional.jpg', tags: 'devotional tamil songs' },
              { title: 'Folk', image: 'https://c.saavncdn.com/editorial/genrecharts_Instrumental.jpg', tags: 'folk tamil songs' },
              { title: 'Hip Hop', image: 'https://c.saavncdn.com/editorial/genrecharts_Pop.jpg', tags: 'hip hop tamizha songs' },
              { title: 'Mass', image: 'https://c.saavncdn.com/editorial/genrecharts_Rock.jpg', tags: 'mass tamil songs' },
              { title: 'Classics', image: 'https://c.saavncdn.com/editorial/genrecharts_Remixes.jpg', tags: 'classic tamil songs ilaiyaraaja' },
            ];

        return jsonRes({
          data: {
            newAlbums,
            playlists,
            charts,
            trending,
            genres,
          }
        });
      }

      // ── Lyrics (with Robust Fallback) ───────────────────────────
      if (path === '/api/lyrics') {
        const lyricsId = q.get('id') || '';
        const title = q.get('title') || '';
        const artist = q.get('artist') || '';

        let lyricsData = null;

        if (title && artist) {
          const cleanTitle = title.replace(/\(From.*?\)/gi, '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
          const cleanArtist = artist.split(',')[0].trim();
          
          const fetchPromises = [];

          // Task 1: LRCLIB (True Synced Lyrics)
          fetchPromises.push(
            fetch(`https://lrclib.net/api/search?track_name=${e(cleanTitle)}&artist_name=${e(cleanArtist)}`, {
              headers: { 'User-Agent': 'BeatBox-App/1.0.0 (https://github.com)' }
            })
            .then(res => res.json())
            .then(data => {
              if (data && data.length > 0) {
                const best = data.find(t => t.syncedLyrics) || data.find(t => t.plainLyrics);
                if (best) return { lyrics: best.syncedLyrics || best.plainLyrics, isSynced: !!best.syncedLyrics, copyright: 'Powered by LRCLIB', source: 'lrclib' };
              }
              return null;
            }).catch(() => null)
          );

          // Task 2: JioSaavn Native
          if (lyricsId) {
            fetchPromises.push(
              saavnFetch(`${JIOSAAVN}?__call=lyrics.getLyrics&lyrics_id=${e(lyricsId)}&ctx=web6dot0&api_version=4&_format=json&_marker=0`)
              .then(raw => {
                if (raw && raw.lyrics && raw.lyrics.length > 20) {
                  return { lyrics: raw.lyrics, isSynced: false, snippet: raw.lyrics_snippet || '', copyright: raw.lyrics_copyright || '', source: 'jiosaavn' };
                }
                return null;
              }).catch(() => null)
            );
          }

          // Await concurrently to drastically reduce load time
          const results = await Promise.all(fetchPromises);
          
          const lrcResult = results[0];
          const saavnResult = fetchPromises.length > 1 ? results[1] : null;

          // Prefer LRCLIB if it has synced lyrics
          if (lrcResult && lrcResult.isSynced) {
            lyricsData = lrcResult;
          } 
          // Otherwise if LRCLIB gave plain lyrics and Saavn gave nothing
          else if (lrcResult && !saavnResult) {
            lyricsData = lrcResult;
          }
          // Otherwise prefer Saavn (native plain text is usually cleaner than LRCLIB plain text)
          else if (saavnResult) {
            lyricsData = saavnResult;
          }
          else if (lrcResult) {
            lyricsData = lrcResult;
          }
        }

        // 3. Fallback to lyrics.ovh if LRCLIB fails
        if (!lyricsData && title && artist) {
          try {
            const cleanTitle = title.replace(/\(From.*?\)/gi, '').replace(/\(.*?\)/g, '').trim();
            const cleanArtist = artist.split(',')[0].trim();
            const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${e(cleanArtist)}/${e(cleanTitle)}`);
            if (ovhRes.ok) {
              const ovhData = await ovhRes.json();
              if (ovhData.lyrics) {
                lyricsData = {
                  lyrics: ovhData.lyrics,
                  snippet: '',
                  copyright: 'Powered by lyrics.ovh',
                  source: 'ovh'
                };
              }
            }
          } catch (err) {
            console.error('[Worker] OVH fallback fetch failed.');
          }
        }

        // 3. Last Fallback to Lyrist API
        if (!lyricsData && title && artist) {
          try {
            const cleanTitle = title.replace(/\(From.*?\)/gi, '').replace(/\(.*?\)/g, '').trim();
            const cleanArtist = artist.split(',')[0].trim();
            const lyristRes = await fetch(`https://lyrist.vercel.app/api/${e(cleanTitle)}/${e(cleanArtist)}`);
            if (lyristRes.ok) {
              const lyristData = await lyristRes.json();
              if (lyristData.lyrics) {
                lyricsData = {
                  lyrics: lyristData.lyrics,
                  snippet: '',
                  copyright: 'Powered by Lyrist',
                  source: 'lyrist'
                };
              }
            }
          } catch (err) {
            console.error('[Worker] Lyrist fallback failed.');
          }
        }

        return jsonRes({ data: lyricsData || { lyrics: '', snippet: '', copyright: '' } });
      }

      if (path === '/') return jsonRes({ status: 'OK', service: 'BeatBox Worker ✅' });
      return jsonRes({ error: 'Not found' }, 404);

    } catch (err) {
      return jsonRes({ error: err.message }, 502);
    }
  }
};
