import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { 
  IoArrowBack, 
  IoCamera,
  IoHeart,
  IoSettingsOutline,
  IoMusicalNote,
  IoArrowDownCircle,
  IoStatsChart,
  IoTrashOutline
} from 'react-icons/io5';
import Loader from '../../components/Loader/Loader';
import SongRow from '../../components/SongRow/SongRow';
import { decodeHTML, getHighQualityImage, getMediumQualityImage, getArtistNames } from '../../utils/helpers';
import { buildTasteProfile } from '../../utils/userTaste';
import { deleteSongDownload } from '../../utils/offline';
import './UserProfile.css';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, likedSongs, playSong, recentlyPlayed, toggleSettings } = usePlayer();
  
  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('liked'); // 'liked' | 'downloads' | 'stats'
  const [downloads, setDownloads] = useState([]);
  const fileInputRef = useRef(null);

  // Sync downloads list from localStorage
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('beatbox_downloaded_songs') || '[]');
      setDownloads(list);
    } catch (e) {
      console.warn('Failed to load downloaded songs:', e);
    }
  }, [activeTab]);

  useEffect(() => {
    async function fetchUser() {
      if (!id) return;
      try {
        const contacts = JSON.parse(localStorage.getItem('beatbox_contacts') || '{}');
        const followData = JSON.parse(localStorage.getItem('beatbox_follows') || '{}');
        
        if (id === (userProfile?.uid || 'local_user')) {
          setTargetUser({
            ...userProfile,
            followers: followData.myFollowers || [],
            following: followData.myFollowing || [],
          });
        } else if (contacts[id]) {
          setTargetUser(contacts[id]);
        } else {
          setTargetUser({
            name: `User ${id.slice(0, 6)}`,
            avatar: `https://i.pravatar.cc/150?u=${id}`,
            email: '',
            followers: [],
            following: [],
          });
        }
      } catch (e) {
        console.error("Error fetching user", e);
      }
      setLoading(false);
    }
    fetchUser();
  }, [id, userProfile]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      const contacts = JSON.parse(localStorage.getItem('beatbox_contacts') || '{}');
      const myId = userProfile?.uid || 'local_user';
      contacts[myId] = { ...(contacts[myId] || {}), avatar: base64 };
      localStorage.setItem('beatbox_contacts', JSON.stringify(contacts));
      setTargetUser(prev => ({ ...prev, avatar: base64 }));
      alert("Profile picture updated!");
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDownload = async (songId, e) => {
    e.stopPropagation();
    const success = await deleteSongDownload(songId);
    if (success) {
      setDownloads(prev => prev.filter(s => s.id !== songId));
    }
  };

  if (loading) return <Loader />;
  if (!targetUser) return <div className="user-profile-error">User not found</div>;

  const isSelf = (userProfile?.uid || 'local_user') === id;

  // Build taste profile for stats
  const tasteProfile = buildTasteProfile(recentlyPlayed, likedSongs);

  return (
    <div className="user-profile-page">
      <div className="user-profile-top-nav">
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <IoArrowBack />
        </button>
        <span className="nav-username">My Profile</span>
        {isSelf ? (
          <button className="icon-btn" onClick={() => toggleSettings()}>
            <IoSettingsOutline />
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>
      
      {/* Premium Glassmorphism Profile Header */}
      <div className="profile-header-glass">
        <div className="profile-header-glass__sheen" />
        <div className="user-profile-header-main">
          <div className="avatar-wrapper">
            <img src={targetUser.avatar} alt={targetUser.name} className="main-avatar" />
            {isSelf && (
              <button className="change-avatar-btn" onClick={() => fileInputRef.current?.click()}>
                <IoCamera />
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="user-bio-section">
            <h3 className="full-name">{targetUser.name}</h3>
            <p className="bio">Music Lover • BeatBox Pro</p>
            <p className="email-small">{targetUser.email || 'localuser@beatbox.fm'}</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-item">
            <span className="count">{likedSongs.length}</span>
            <span className="label">Liked</span>
          </div>
          <div className="stat-item">
            <span className="count">{downloads.length}</span>
            <span className="label">Offline</span>
          </div>
          <div className="stat-item">
            <span className="count">{recentlyPlayed.length}</span>
            <span className="label">Played</span>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={`tab-btn ${activeTab === 'liked' ? 'active' : ''}`} onClick={() => setActiveTab('liked')}>
          <IoHeart /> <span>Liked</span>
        </button>
        <button className={`tab-btn ${activeTab === 'downloads' ? 'active' : ''}`} onClick={() => setActiveTab('downloads')}>
          <IoArrowDownCircle /> <span>Downloads</span>
        </button>
        <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          <IoStatsChart /> <span>Stats</span>
        </button>
      </div>

      <div className="tab-content-container">
        {/* LIKED SONGS LIST */}
        {activeTab === 'liked' && (
          <div className="liked-list fade-in">
            {likedSongs.map((song, idx) => (
              <SongRow 
                key={song.id} 
                song={song} 
                index={idx} 
                queue={likedSongs}
                showAlbum={false}
              />
            ))}
            {likedSongs.length === 0 && (
              <div className="empty-tab">
                <IoHeart size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>No liked songs yet. Start liking tracks to build your library!</p>
              </div>
            )}
          </div>
        )}

        {/* OFFLINE DOWNLOADS LIST */}
        {activeTab === 'downloads' && (
          <div className="downloads-list fade-in">
            {downloads.map((song, idx) => (
              <div 
                key={song.id} 
                className="offline-song-card"
                onClick={() => playSong(song, downloads, idx)}
              >
                <img src={getMediumQualityImage(song.image)} alt={song.name} className="offline-song-card__img" />
                <div className="offline-song-card__details">
                  <div className="offline-song-card__title">{decodeHTML(song.name)}</div>
                  <div className="offline-song-card__artist">{getArtistNames(song.artists, song.primaryArtists)}</div>
                </div>
                <button 
                  className="offline-song-card__delete"
                  onClick={(e) => handleDeleteDownload(song.id, e)}
                  title="Remove offline download"
                >
                  <IoTrashOutline />
                </button>
              </div>
            ))}
            {downloads.length === 0 && (
              <div className="empty-tab">
                <IoArrowDownCircle size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>No offline songs. Click the download icon next to any song to listen without internet!</p>
              </div>
            )}
          </div>
        )}

        {/* STATISTICS TAB */}
        {activeTab === 'stats' && (
          <div className="stats-tab fade-in">
            {tasteProfile ? (
              <div className="stats-grid-glass">
                {/* Listening Overview */}
                <div className="stat-glass-card">
                  <h4>🎧 Taste Analyzer</h4>
                  <div className="stat-glass-card__highlight">{tasteProfile.totalSongs}</div>
                  <p className="stat-glass-card__desc">Unique songs analyzed in your library</p>
                </div>

                {/* Favorite Language */}
                <div className="stat-glass-card">
                  <h4>🗣️ Top Language</h4>
                  <div className="stat-glass-card__highlight" style={{ textTransform: 'capitalize' }}>
                    {tasteProfile.topLanguage}
                  </div>
                  <p className="stat-glass-card__desc">Your preferred music dialect</p>
                </div>

                {/* Top Artists Ranking */}
                <div className="stat-glass-card span-2">
                  <h4>🔥 Favorite Artists</h4>
                  <div className="top-artists-list">
                    {tasteProfile.topArtists.slice(0, 4).map((artist, idx) => (
                      <div key={artist} className="artist-rank-row">
                        <span className="rank-num">#{idx+1}</span>
                        <span className="rank-name">{artist}</span>
                        <div className="rank-bar-bg">
                          <div className="rank-bar-fill" style={{ width: `${100 - idx * 20}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mood / Genres */}
                <div className="stat-glass-card span-2">
                  <h4>💡 Current Vibe / Mood</h4>
                  <div className="mood-chips-container">
                    {tasteProfile.topMoods.length > 0 ? (
                      tasteProfile.topMoods.map(mood => (
                        <span key={mood} className="mood-chip">{mood}</span>
                      ))
                    ) : (
                      <span className="mood-chip">Eclectic Mix</span>
                    )}
                  </div>
                  <p className="stat-glass-card__desc" style={{ marginTop: 12 }}>
                    Based on keywords and genres of songs you play frequently
                  </p>
                </div>
              </div>
            ) : (
              <div className="empty-tab">
                <IoStatsChart size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>Not enough listening history. Play more songs to generate your personal statistics!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
