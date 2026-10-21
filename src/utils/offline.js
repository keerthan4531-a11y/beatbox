import { getHighQualityImage } from './helpers';
import { getAllStreamVariants } from '../api/saavn';

const CACHE_NAME = 'beatbox_offline_cache';
const WORKER_URL = 'https://weathered-heart-9c50.fct197096.workers.dev';

/**
 * Downloads a song (audio and cover artwork) to Cache Storage and saves its metadata to localStorage.
 */
export async function downloadSong(song) {
  if (!song || !song.id) throw new Error('Invalid song data');
  
  let streamUrl = null;
  if (song.downloadUrl && song.downloadUrl.length > 0) {
    const variants = getAllStreamVariants(song.downloadUrl);
    // Prefer 320kbps, then 160kbps, then whatever is available
    const best = variants.find(v => v.quality === '320kbps') || variants.find(v => v.quality === '160kbps') || variants[0];
    streamUrl = best?.url || best?.link;
  }
  
  if (!streamUrl && song.url) {
    streamUrl = song.url;
  }
  
  if (!streamUrl) throw new Error('No downloadable audio stream found');

  try {
    const cache = await caches.open(CACHE_NAME);
    
    // 1. Fetch and Cache Audio (direct or proxy)
    let audioRes;
    try {
      audioRes = await fetch(streamUrl, { mode: 'cors' });
      if (!audioRes.ok) throw new Error(`HTTP status ${audioRes.status}`);
    } catch (e) {
      console.warn(`[Offline] Direct fetch failed for song ${song.id}, falling back to worker stream proxy...`);
      const proxyUrl = `${WORKER_URL}/stream?url=${encodeURIComponent(streamUrl)}`;
      audioRes = await fetch(proxyUrl, { mode: 'cors' });
      if (!audioRes.ok) throw new Error(`Proxy HTTP status ${audioRes.status}`);
    }
    
    await cache.put(`/offline-audio/${song.id}`, audioRes);

    // 2. Fetch and Cache Artwork
    const coverUrl = getHighQualityImage(song.image);
    if (coverUrl) {
      try {
        const imgRes = await fetch(coverUrl, { mode: 'cors' });
        if (imgRes.ok) {
          await cache.put(`/offline-image/${song.id}`, imgRes);
        }
      } catch (e) {
        console.warn(`[Offline] Artwork caching failed for song ${song.id}:`, e.message);
      }
    }

    // 3. Update Downloaded Metadata in localStorage
    const downloadedList = JSON.parse(localStorage.getItem('beatbox_downloaded_songs') || '[]');
    if (!downloadedList.some(s => s.id === song.id)) {
      downloadedList.push(song);
      localStorage.setItem('beatbox_downloaded_songs', JSON.stringify(downloadedList));
    }
    
    console.log(`[Offline] Song downloaded successfully: ${song.name} (ID: ${song.id})`);
    return true;
  } catch (err) {
    console.error(`[Offline] Download failed for song ${song.id}:`, err);
    throw err;
  }
}

/**
 * Removes a song download from Cache Storage and deletes its metadata from localStorage.
 */
export async function deleteSongDownload(songId) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(`/offline-audio/${songId}`);
    await cache.delete(`/offline-image/${songId}`);
    
    const downloadedList = JSON.parse(localStorage.getItem('beatbox_downloaded_songs') || '[]');
    const updated = downloadedList.filter(s => s.id !== songId);
    localStorage.setItem('beatbox_downloaded_songs', JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error(`[Offline] Failed to delete download ${songId}:`, e);
    return false;
  }
}

/**
 * Checks if a song is downloaded offline.
 */
export function isSongDownloaded(songId) {
  try {
    const downloadedList = JSON.parse(localStorage.getItem('beatbox_downloaded_songs') || '[]');
    return downloadedList.some(s => s.id === songId);
  } catch {
    return false;
  }
}
