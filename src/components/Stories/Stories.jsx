import React, { useState, useEffect } from 'react';
import { IoAdd } from 'react-icons/io5';
import { usePlayer } from '../../context/PlayerContext';
import './Stories.css';

/**
 * Stories Component — Works with localStorage (no Firebase/Google login needed)
 * Stories are stored locally and shared via Gun.js later
 */
export default function Stories() {
  const { userProfile } = usePlayer();
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);

  useEffect(() => {
    // Load stories from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('beatbox_stories') || '[]');
      // Filter expired stories (older than 24 hours)
      const now = Date.now();
      const valid = saved.filter(s => now - s.createdAt < 24 * 60 * 60 * 1000);
      
      // Group by user
      const userStories = {};
      valid.forEach(story => {
        if (!userStories[story.userId]) {
          userStories[story.userId] = {
            userId: story.userId,
            userName: story.userName,
            userAvatar: story.userAvatar,
            clips: []
          };
        }
        userStories[story.userId].clips.push(story);
      });

      setStories(Object.values(userStories));
      // Save back filtered list
      localStorage.setItem('beatbox_stories', JSON.stringify(valid));
    } catch (e) {
      console.warn('Failed to load stories:', e);
    }
  }, []);

  const handleOpenStory = (storyGroup) => {
    setActiveStory(storyGroup);
  };

  return (
    <div className="stories-container">
      <div className="stories-scroll">
        {/* My Story Add */}
        <div className="story-item my-story">
          <div className="avatar-wrapper">
            <img src={userProfile?.avatar || 'https://i.pravatar.cc/150?u=me'} alt="My Story" />
            <div className="add-icon"><IoAdd /></div>
          </div>
          <span>Your story</span>
        </div>

        {/* User Stories */}
        {stories.map((group) => (
          <div key={group.userId} className="story-item" onClick={() => handleOpenStory(group)}>
            <div className="avatar-wrapper has-story">
              <img src={group.userAvatar} alt={group.userName} />
            </div>
            <span>{group.userName.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {activeStory && (
        <div className="story-viewer-overlay" onClick={() => setActiveStory(null)}>
          <div className="story-viewer-content" onClick={e => e.stopPropagation()}>
            <div className="story-progress-bar">
              {activeStory.clips.map((_, i) => <div key={i} className="progress-segment active"></div>)}
            </div>
            <div className="story-header">
              <img src={activeStory.userAvatar} alt="" />
              <span>{activeStory.userName}</span>
            </div>
            <div className="story-video">
               <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeStory.clips[0].clipId}?autoplay=1&controls=0&modestbranding=1&showinfo=0&rel=0`}
                title="Story"
                allow="autoplay; encrypted-media"
                frameBorder="0"
              />
            </div>
            <div className="story-footer">
              <span className="song-info">🎵 {activeStory.clips[0].songName}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
