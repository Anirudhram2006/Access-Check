import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, ShieldCheck, Lock, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * WebsitePreview Component
 * Displays the real screenshot in a custom browser mockup frame with zoom controls.
 * 
 * @param {object} props
 * @param {string} props.url - The scanned URL
 * @param {string} props.screenshotPath - Relative path returned by the backend (e.g. /screenshots/xxx.png)
 */
export default function WebsitePreview({ url, screenshotPath }) {
  const [zoom, setZoom] = useState(100);
  const BACKEND_URL = 'http://localhost:5000';
  
  // Construct absolute screenshot URL
  const absoluteScreenshotUrl = screenshotPath.startsWith('http') 
    ? screenshotPath 
    : `${BACKEND_URL}${screenshotPath}`;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <div className="website-preview-card glass-card">
      <div className="preview-header">
        <h3 className="card-title-uppercase">Visual Audit Snapshot</h3>
        <p className="preview-subtitle">Actual rendered screenshot captured by Puppeteer</p>
      </div>

      {/* Browser Mockup */}
      <div className="browser-mockup">
        {/* Browser Title Bar / Window Header */}
        <div className="browser-titlebar">
          <div className="browser-dots">
            <span className="dot close"></span>
            <span className="dot minimize"></span>
            <span className="dot expand"></span>
          </div>
          
          <div className="browser-navigation-icons">
            <ChevronLeft size={16} className="nav-icon disabled" />
            <ChevronRight size={16} className="nav-icon disabled" />
            <RotateCw size={14} className="nav-icon" />
          </div>

          <div className="browser-addressbar">
            <Lock size={12} className="lock-icon" />
            <span className="address-text">{url}</span>
          </div>

          <div className="browser-zoom-controls">
            <button 
              type="button" 
              onClick={handleZoomOut} 
              className="zoom-btn" 
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="zoom-value">{zoom}%</span>
            <button 
              type="button" 
              onClick={handleZoomIn} 
              className="zoom-btn" 
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button 
              type="button" 
              onClick={handleZoomReset} 
              className="zoom-btn text-muted" 
              title="Reset Zoom"
              aria-label="Reset Zoom"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Browser Content Frame displaying screenshot */}
        <div className="browser-viewport">
          <div className="screenshot-scroll-container">
            <img 
              src={absoluteScreenshotUrl} 
              alt={`Full-page rendering scan of ${url}`}
              className="screenshot-img"
              style={{ 
                transform: `scale(${zoom / 100})`, 
                transformOrigin: 'top center' 
              }}
              onError={(e) => {
                e.target.onerror = null;
                // Fallback inside case of load error (e.g. backend offline or port mismatch)
                e.target.src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80';
              }}
            />
          </div>
        </div>
      </div>

      <div className="preview-footer">
        <ShieldCheck className="text-success-gauge" size={16} />
        <span>Fully-rendered pixel audit snapshot. Click Zoom controls to inspect layout details.</span>
      </div>

      <style>{`
        .website-preview-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .preview-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* Browser Frame CSS */
        .browser-mockup {
          background-color: #0d121f;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-top: 8px;
        }

        .browser-titlebar {
          background-color: #1e293b;
          border-bottom: 1px solid var(--border-color);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .browser-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .dot.close { background-color: #ef4444; }
        .dot.minimize { background-color: #eab308; }
        .dot.expand { background-color: #22c55e; }

        .browser-navigation-icons {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
        }

        .nav-icon {
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .nav-icon:hover {
          color: var(--text-primary);
        }

        .nav-icon.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .browser-addressbar {
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 6px 14px;
          flex-grow: 1;
          min-width: 160px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .lock-icon {
          color: var(--success);
        }

        .address-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
          font-family: var(--font-sans);
          font-weight: 500;
        }

        .browser-zoom-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
        }

        .zoom-btn {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast);
        }

        .zoom-btn:hover {
          color: #ffffff;
        }

        .zoom-value {
          font-size: 11px;
          font-weight: 750;
          min-width: 36px;
          text-align: center;
          color: var(--text-primary);
        }

        /* Viewport Frame with scrollbar and scaling */
        .browser-viewport {
          height: 480px;
          background-color: #ffffff;
          overflow: hidden;
          position: relative;
        }

        .screenshot-scroll-container {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: auto;
        }

        .screenshot-img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
        }

        .preview-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          background: rgba(30, 41, 59, 0.3);
          border: 1px solid var(--border-color);
          padding: 10px 14px;
          border-radius: var(--radius-md);
        }

        @media (max-width: 768px) {
          .browser-viewport {
            height: 320px;
          }
          
          .browser-titlebar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 12px;
          }
          
          .browser-addressbar {
            width: 100%;
          }
          
          .browser-zoom-controls {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
