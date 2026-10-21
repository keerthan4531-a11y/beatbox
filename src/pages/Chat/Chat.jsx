import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { 
  IoArrowBack, 
  IoSend, 
  IoImage, 
  IoMusicalNote, 
  IoCall, 
  IoVideocam, 
  IoInformationCircleOutline,
  IoHappyOutline,
  IoMicOutline
} from 'react-icons/io5';
import './Chat.css';

/**
 * Chat Page — Uses localStorage for messages (no Firebase needed)
 * Will be upgraded to Gun.js later for real-time P2P chat
 */
export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = usePlayer();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  const messagesEndRef = useRef(null);

  const chatId = userProfile && id 
    ? [userProfile.uid || 'local', id].sort().join('_') 
    : null;

  useEffect(() => {
    // Load target user from localStorage contacts
    if (!id) return;
    try {
      const contacts = JSON.parse(localStorage.getItem('beatbox_contacts') || '{}');
      if (contacts[id]) {
        setTargetUser(contacts[id]);
      } else {
        setTargetUser({ 
          name: `User ${id.slice(0, 6)}`, 
          avatar: `https://i.pravatar.cc/150?u=${id}`,
          email: ''
        });
      }
    } catch (e) {
      setTargetUser({ name: 'User', avatar: 'https://i.pravatar.cc/150?u=default' });
    }
  }, [id]);

  useEffect(() => {
    if (!chatId) return;
    // Load messages from localStorage
    try {
      const allChats = JSON.parse(localStorage.getItem('beatbox_messages') || '{}');
      setMessages(allChats[chatId] || []);
    } catch (e) {
      setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    const newMsg = {
      id: Date.now().toString(),
      text: msgText,
      senderId: userProfile?.uid || 'local_user',
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);

    // Save to localStorage
    try {
      const allChats = JSON.parse(localStorage.getItem('beatbox_messages') || '{}');
      allChats[chatId] = updatedMessages;
      localStorage.setItem('beatbox_messages', JSON.stringify(allChats));

      // Update chat list metadata
      const chatMeta = JSON.parse(localStorage.getItem('beatbox_chat_meta') || '{}');
      chatMeta[chatId] = {
        participants: [userProfile?.uid || 'local_user', id],
        lastMessage: msgText,
        lastMessageAt: Date.now(),
        otherId: id,
        otherUser: targetUser
      };
      localStorage.setItem('beatbox_chat_meta', JSON.stringify(chatMeta));
    } catch (err) {
      console.error("Error saving message", err);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-header-insta">
        <div className="header-left" onClick={() => navigate(-1)}>
          <IoArrowBack />
          {targetUser && (
            <div className="target-profile">
              <img src={targetUser.avatar} alt="" />
              <div className="target-text">
                <span className="target-name">{targetUser.name}</span>
                <span className="target-status">Active now</span>
              </div>
            </div>
          )}
        </div>
        <div className="header-right">
          <IoCall />
          <IoVideocam />
          <IoInformationCircleOutline />
        </div>
      </div>

      <div className="chat-messages-insta">
        <div className="chat-target-meta">
          <img src={targetUser?.avatar} alt="" />
          <h3>{targetUser?.name}</h3>
          <p>BeatBox User • {targetUser?.email || 'Music Lover'}</p>
          <button onClick={() => navigate(`/user/${id}`)}>View Profile</button>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === (userProfile?.uid || 'local_user');
          return (
            <div key={msg.id || idx} className={`msg-row ${isMe ? 'me' : 'them'}`}>
              {!isMe && <img src={targetUser?.avatar} className="msg-avatar" alt="" />}
              <div className="msg-bubble">
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-insta">
        <div className="input-wrapper">
          <button className="input-icon-btn"><IoHappyOutline /></button>
          <input 
            type="text" 
            placeholder="Message..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          {newMessage.trim() ? (
            <button className="send-text-btn" onClick={handleSend}>Send</button>
          ) : (
            <div className="input-actions">
              <IoMicOutline />
              <IoImage />
              <IoMusicalNote />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
