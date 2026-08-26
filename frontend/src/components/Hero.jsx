import React, { useState } from 'react';
import { ArrowRight, Globe, Play, Sparkles } from 'lucide-react';

/**
 * Hero Component
 * Displays the main value proposition, URL scanner input, and Demo Mode trigger.
 * 
 * @param {object} props
 * @param {function} props.onScan - Triggered when user enters a URL and clicks Scan
 * @param {function} props.onDemoMode - Triggered when user clicks Demo Mode
 * @param {boolean} props.loading - True if a scan is currently active
 */
export default function Hero({ onScan, onDemoMode, loading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a website URL.');
      return;
    }

    // Basic protocol validation
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      new URL(targetUrl);
      onScan(targetUrl);
    } catch (err) {
      setError('Invalid URL format. Example: https://example.com');
    }
  };

  return (
    <section className="hero-section">
      <div className="container hero-inner">
        <div className="badge-announcement">
          <span className="badge-pulse"></span>
          <span className="badge-announcement-text">
            <Sparkles size={12} className="inline-icon" /> Access Check Frontend v1.0 Live
          </span>
        </div>

        <h1 className="hero-title">
          Understand your website from <br />
          <span className="text-gradient">every user's perspective.</span>
        </h1>
        
        <p className="hero-subtitle">
          Scan real webpages for accessibility barriers, understand what users experience, and get practical fixes developers can act on.
        </p>

        <form onSubmit={handleSubmit} className="scanner-form">
          <div className="input-group-container">
            <div className={`input-glow-wrapper ${error ? 'has-error' : ''}`}>
              <Globe className="input-icon" size={20} />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError('');
                }}
                placeholder="https://example.com"
                disabled={loading}
                className="url-input"
                aria-label="Website URL to scan"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="scan-button"
              >
                <span>{loading ? 'Scanning...' : 'SCAN WEBSITE'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
          {error && <p className="input-error-msg">{error}</p>}
        </form>

        <div className="demo-trigger-container">
          <button 
            type="button" 
            onClick={onDemoMode} 
            className="demo-button"
            disabled={loading}
            aria-label="Launch Demo Mode using a pre-loaded scan"
          >
            <Play size={14} fill="currentColor" />
            <span>TRY DEMO MODE</span>
          </button>
          <span className="demo-tooltip">
            Using a previously captured real scan of <strong>example.com</strong> (no internet required).
          </span>
        </div>
      </div>

      <style>{`
        .hero-section {
          padding: 80px 0 40px;
          text-align: center;
          position: relative;
        }
        
        .hero-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 800px;
          margin: 0 auto;
        }

        .badge-announcement {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 6px 14px;
          border-radius: 9999px;
          margin-bottom: 24px;
        }

        .badge-pulse {
          width: 6px;
          height: 6px;
          background-color: var(--primary);
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 8px var(--primary);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(99, 102, 241, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
          }
        }

        .badge-announcement-text {
          font-size: 12px;
          font-weight: 600;
          color: #a5b4fc;
          letter-spacing: 0.02em;
        }

        .inline-icon {
          vertical-align: middle;
          margin-right: 4px;
        }

        .hero-title {
          font-size: 48px;
          font-weight: 850;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 20px;
        }

        .hero-subtitle {
          font-size: 18px;
          color: var(--text-secondary);
          max-width: 640px;
          line-height: 1.6;
          margin-bottom: 40px;
        }

        .scanner-form {
          width: 100%;
          max-width: 680px;
          margin-bottom: 24px;
        }

        .input-group-container {
          width: 100%;
        }

        .input-glow-wrapper {
          display: flex;
          align-items: center;
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 6px 6px 6px 18px;
          gap: 12px;
          box-shadow: var(--shadow-lg);
          transition: all var(--transition-normal);
        }

        .input-glow-wrapper:focus-within {
          border-color: var(--border-focus);
          box-shadow: 0 0 25px rgba(99, 102, 241, 0.25);
        }

        .input-glow-wrapper.has-error {
          border-color: var(--critical);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
        }

        .input-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .url-input {
          flex-grow: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 16px;
          font-weight: 500;
          width: 100%;
        }

        .url-input::placeholder {
          color: var(--text-muted);
        }

        .scan-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: var(--primary);
          color: #ffffff;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-radius: 9999px;
          transition: all var(--transition-fast);
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .scan-button:hover:not(:disabled) {
          background-color: var(--primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
        }

        .scan-button:active:not(:disabled) {
          transform: translateY(1px);
        }

        .scan-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .input-error-msg {
          color: var(--critical);
          font-size: 13px;
          font-weight: 600;
          margin-top: 10px;
          text-align: left;
          padding-left: 18px;
        }

        .demo-trigger-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }

        .demo-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 8px 18px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          transition: all var(--transition-fast);
        }

        .demo-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
          border-color: var(--text-muted);
          transform: translateY(-1px);
        }

        .demo-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .demo-tooltip {
          font-size: 11px;
          color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .hero-section {
            padding: 40px 0 20px;
          }
          
          .hero-title {
            font-size: 32px;
          }
          
          .hero-subtitle {
            font-size: 15px;
            margin-bottom: 24px;
          }
          
          .input-glow-wrapper {
            flex-direction: column;
            border-radius: var(--radius-lg);
            padding: 12px;
            gap: 12px;
          }
          
          .url-input {
            text-align: center;
          }
          
          .scan-button {
            width: 100%;
            justify-content: center;
          }
          
          .demo-tooltip {
            max-width: 250px;
            line-height: 1.4;
          }
        }
      `}</style>
    </section>
  );
}
