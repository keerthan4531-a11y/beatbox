import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { 
  IoArrowBack, 
  IoCreateOutline, 
  IoChevronDown, 
  IoSearch,
  IoCameraOutline
} from 'react-icons/io5';
import './ChatList.css';

/**
 * ChatList Page — Uses localStorage for chat data (no Firebase needed)
 * Will be upgraded to Gun.js later for real-time P2P messaging
 */
export default function ChatList() {
  const navigate = useNavigate();
  const { userProfile } = usePlayer();
  const [activeTab, setActiveTab] = useState('Primary');
  const [chats, setChats] = useState([]);
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [myNote, setMyNote] = useState('');

  // Fetch Chats from localStorage
  useEffect(() => {
    try {
      const chatMeta = JSON.parse(localStorage.getItem('beatbox_chat_meta') || '{}');
      const chatList = Object.entries(chatMeta).map(([id, data]) => ({
        id,
        ...data,
      })).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setChats(chatList);
    } catch (e) {
      setChats([]);
    }
  }, []);

  // Load Notes from localStorage
  useEffect(() => {
    try {
      const savedNotes = JSON.parse(localStorage.getItem('beatbox_notes') || '[]');
      if (savedNotes.length === 0) {
        // Show some sample notes for UI
        setNotes([
          { id: '1', name: 'BeatBox', avatar: 'https://i.pravatar.cc/150?u=1', note: 'Music is life 🎵' },
          { id: '2', name: 'DJ Mix', avatar: 'https://i.pravatar.cc/150?u=2', note: 'New tracks dropping...' },
          { id: '3', name: 'Melody', avatar: 'https://i.pravatar.cc/150?u=3', note: 'Vibe check ✨' },
        ]);
      } else {
        setNotes(savedNotes);
      }
    } catch (e) {
      setNotes([]);
    }
  }, []);

  const handlePostNote = () => {
    if (!myNote.trim()) return;
    const newNote = {
      id: Date.now().toString(),
      name: userProfile?.name || 'You',
      avatar: userProfile?.avatar || 'https://i.pravatar.cc/150?u=me',
      note: myNote.trim()
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    localStorage.setItem('beatbox_notes', JSON.stringify(updatedNotes));
    setShowNoteInput(false);
    setMyNote('');
  };

  return (
    <div className="chat-list-page">
      <div className="chat-list-header">
        <div className="header-left" onClick={() => navigate(-1)}>
          <IoArrowBack />
          <span className="username">{userProfile?.name || 'User'} <IoChevronDown /></span>
        </div>
        <div className="header-right">
          <IoCreateOutline className="edit-icon" />
        </div>
      </div>

      <div className="chat-tabs">
        <button 
          className={activeTab === 'Primary' ? 'active' : ''} 
          onClick={() => setActiveTab('Primary')}
        >
          Primary
        </button>
        <button 
          className={activeTab === 'General' ? 'active' : ''} 
          onClick={() => setActiveTab('General')}
        >
          General
        </button>
        <button 
          className={activeTab === 'Requests' ? 'active' : ''} 
          onClick={() => setActiveTab('Requests')}
        >
          Requests
        </button>
      </div>

      <div className="chat-search-bar">
        <IoSearch className="search-icon" />
        <input 
          type="text" 
          placeholder="Search" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="notes-container">
        <div className="notes-scroll">
          <div className="note-item my-note" onClick={() => setShowNoteInput(true)}>
            <div className="avatar-wrapper">
              <img src={userProfile?.avatar || 'https://i.pravatar.cc/150?u=me'} alt="" />
              <div className="note-bubble">Share your thoughts...</div>
            </div>
            <span className="note-name">Your note</span>
          </div>
          
          {notes.map(note => (
            <div key={note.id} className="note-item">
              <div className="avatar-wrapper">
                <img src={note.avatar} alt="" />
                <div className="note-bubble">{note.note}</div>
              </div>
              <span className="note-name">{note.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chats-container">
        {chats.length > 0 ? chats.map(chat => (
          <div 
            key={chat.id} 
            className="chat-row" 
            onClick={() => navigate(`/chat/${chat.otherId}`)}
          >
            <img src={chat.otherUser?.avatar || 'https://i.pravatar.cc/150?u=default'} alt="" className="chat-avatar" />
            <div className="chat-info">
              <span className="chat-name">{chat.otherUser?.name || 'User'}</span>
              <p className={`chat-last-msg ${chat.unread ? 'unread' : ''}`}>
                {chat.lastMessage || 'Start a conversation'} • {chat.lastMessageTime || 'now'}
              </p>
            </div>
            {chat.unread && <div className="unread-dot"></div>}
            <IoCameraOutline className="camera-icon" />
          </div>
        )) : (
          <div className="empty-chats">
            <p>No messages yet.</p>
            <button className="start-chat-btn" onClick={() => navigate('/search')}>Find people to follow</button>
          </div>
        )}
      </div>

      {showNoteInput && (
        <div className="note-input-modal" onClick={() => setShowNoteInput(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>New Note</h3>
            <textarea 
              placeholder="What's on your mind?" 
              maxLength={60}
              value={myNote}
              onChange={e => setMyNote(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowNoteInput(false)}>Cancel</button>
              <button className="post-btn" onClick={handlePostNote}>Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
