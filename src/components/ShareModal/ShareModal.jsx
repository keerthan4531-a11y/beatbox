import React, { useRef, useState, useEffect } from 'react';
import { IoClose, IoDownloadOutline, IoLogoInstagram, IoShareSocialOutline } from 'react-icons/io5';
import { decodeHTML, getHighQualityImage, getArtistNames } from '../../utils/helpers';
import './ShareModal.css';

export default function ShareModal({ song, onClose }) {
  const canvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const title = decodeHTML(song?.name || song?.title || 'Unknown Track');
  const artistName = getArtistNames(song?.artists, song?.primaryArtists) || 'Unknown Artist';
  const coverUrl = getHighQualityImage(song?.image);

  // Generate a low-res dataUrl preview on mount so the user sees exactly what they download
  useEffect(() => {
    generateCardPreview();
  }, [song?.id]);

  const generateCardPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution to standard Instagram Story size (1080 x 1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw a dark premium background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0a0216');
    bgGrad.addColorStop(0.5, '#120427');
    bgGrad.addColorStop(1, '#05010b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load cover art to draw background blur & central artwork
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = coverUrl;
    img.onload = () => {
      // 2. Draw blurred ambient bleed background
      ctx.save();
      ctx.globalAlpha = 0.28;
      // Draw stretched and offset cover art to act as background art
      ctx.drawImage(img, -200, -200, canvas.width + 400, canvas.height + 400);
      ctx.restore();

      // Add a blur layer using canvas filter (supported in modern browsers)
      ctx.save();
      ctx.fillStyle = 'rgba(10, 2, 22, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 3. Draw glassmorphic main card container in the center
      const cardW = 860;
      const cardH = 1320;
      const cardX = (canvas.width - cardW) / 2;
      const cardY = 240;
      const cardRadius = 50;

      // Draw shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 20;

      // Draw Glass Card Base
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
      ctx.fillStyle = 'rgba(25, 12, 40, 0.35)';
      ctx.fill();
      ctx.restore();

      // Draw glass card stroke
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
      const strokeGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      strokeGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.05)');
      strokeGrad.addColorStop(0.7, 'rgba(0, 212, 255, 0.05)');
      strokeGrad.addColorStop(1, 'rgba(192, 38, 211, 0.2)');
      ctx.strokeStyle = strokeGrad;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // 4. Draw central high-quality album artwork with rounded corners
      const artSize = 680;
      const artX = (canvas.width - artSize) / 2;
      const artY = 320;
      const artRadius = 36;

      ctx.save();
      // Draw shadow for artwork
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 15;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, artRadius);
      ctx.fill(); // trigger shadow
      ctx.restore();

      ctx.save();
      // Clip artwork to rounded corners
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, artRadius);
      ctx.clip();
      ctx.drawImage(img, artX, artY, artSize, artSize);
      ctx.restore();

      // 5. Draw Song Information (Title & Artists)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      
      // Song Name
      ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
      // Truncate text if too long
      let songNameText = title;
      if (ctx.measureText(songNameText).width > 760) {
        while (ctx.measureText(songNameText + '...').width > 760 && songNameText.length > 0) {
          songNameText = songNameText.slice(0, -1);
        }
        songNameText += '...';
      }
      ctx.fillText(songNameText, canvas.width / 2, 1090);

      // Artist Name
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '500 38px system-ui, -apple-system, sans-serif';
      let artistText = artistName;
      if (ctx.measureText(artistText).width > 760) {
        while (ctx.measureText(artistText + '...').width > 760 && artistText.length > 0) {
          artistText = artistText.slice(0, -1);
        }
        artistText += '...';
      }
      ctx.fillText(artistText, canvas.width / 2, 1165);
      ctx.restore();

      // 6. Draw dynamic sound waves mockup inside the card
      ctx.save();
      ctx.beginPath();
      const waveY = 1260;
      const waveWidth = 560;
      const startX = (canvas.width - waveWidth) / 2;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      for (let i = 0; i < 30; i++) {
        const x = startX + (i * 20);
        // Draw heights mimicking audio frequencies
        const h = 20 + Math.sin(i * 0.4) * 45 + Math.cos(i * 0.9) * 20;
        ctx.moveTo(x, waveY - h / 2);
        ctx.lineTo(x, waveY + h / 2);
      }
      ctx.stroke();
      ctx.restore();

      // 7. Draw BeatBox Branding Logo & Specular Sheen at the bottom of the card
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.fillText('🎵  B E A T B O X  P R E M I U M', canvas.width / 2, 1440);
      ctx.restore();

      // Set preview state
      setPreviewUrl(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      // Fallback if image fails to load (draw a generic icon)
      ctx.fillStyle = '#1b1126';
      ctx.fillRect(110, 320, 860, 1320);
      setPreviewUrl(canvas.toDataURL('image/png'));
    };
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    setDownloading(true);
    const link = document.createElement('a');
    link.download = `${title.replace(/\s+/g, '_')}_ShareCard.png`;
    link.href = previewUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloading(false);
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `Check out "${title}" by ${artistName} on BeatBox!`,
        url: window.location.origin
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
      alert('App link copied to clipboard!');
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal__header">
          <h2><IoShareSocialOutline /> Share Story</h2>
          <button className="share-modal__close" onClick={onClose} aria-label="Close">
            <IoClose size={24} />
          </button>
        </div>

        <div className="share-modal__content">
          <p className="share-modal__subtitle">
            Download this premium glassmorphic card to share on your Instagram Story or WhatsApp status!
          </p>

          {/* Hidden Canvas for generation */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Card Preview Container */}
          <div className="share-card-preview-container">
            {previewUrl ? (
              <img src={previewUrl} alt="Instagram Card Preview" className="share-card-preview-img" />
            ) : (
              <div className="share-card-preview-loading">
                <div className="share-spinner"></div>
                <p>Generating glass card...</p>
              </div>
            )}
          </div>

          <div className="share-modal__actions">
            <button 
              className="share-btn download" 
              onClick={handleDownload}
              disabled={!previewUrl || downloading}
            >
              <IoDownloadOutline size={20} />
              {downloading ? 'Downloading...' : 'Download Card'}
            </button>
            <button className="share-btn instagram" onClick={handleNativeShare}>
              <IoLogoInstagram size={20} />
              Share Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
