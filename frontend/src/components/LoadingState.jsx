import React, { useState, useEffect } from 'react';
import { Loader2, Shield } from 'lucide-react';

/**
 * LoadingState Component
 * Displays a beautiful, animated loading state with rotating message hints.
 */
export default function LoadingState() {
  const messages = [
    'Launching headless browser...',
    'Navigating to target URL safely...',
    'Establishing secure sandbox session...',
    'Analyzing complete page DOM structure...',
    'Injecting modern axe-core auditing rules...',
    'Running comprehensive accessibility checks...',
    'Evaluating element color-contrast ratios...',
    'Validating structural layout landmark regions...',
    'Scanning form inputs, labels, and roles...',
    'Capturing visual full-page snapshot...',
    'Assembling results payload...'
  ];

  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 2800); // cycle through messages every 2.8s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-container container">
      <div className="loading-card glass-card">
        <div className="loading-icon-wrapper">
          <Loader2 className="spinner-icon text-indigo" size={48} />
          <Shield className="center-shield-icon" size={20} />
        </div>
        
        <h2 className="loading-title">Auditing Webpage</h2>
        
        <div className="message-carousel-container">
          <p className="loading-message-text" key={messageIndex}>
            {messages[messageIndex]}
          </p>
        </div>
        
        <div className="loading-progress-bar">
          <div className="progress-bar-fill"></div>
        </div>

        <p className="loading-hint-text">
          Our backend engine is spinning up an isolated Chromium browser instance to inspect accessibility conditions in real-time. This can take up to 20 seconds.
        </p>
      </div>

      <style>{`
        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          min-height: 50vh;
        }

        .loading-card {
          width: 100%;
          max-width: 540px;
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          border-color: rgba(99, 102, 241, 0.2);
          box-shadow: 0 20px 50px rgba(99, 102, 241, 0.1);
        }

        .loading-icon-wrapper {
          position: relative;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: rgba(99, 102, 241, 0.05);
          border-radius: 50%;
        }

        .spinner-icon {
          animation: spin 1.8s linear infinite;
        }

        .center-shield-icon {
          position: absolute;
          color: #a5b4fc;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-title {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .message-carousel-container {
          height: 24px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-message-text {
          font-size: 15px;
          color: var(--text-secondary);
          font-weight: 600;
          animation: fadeInOut 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }

        .loading-progress-bar {
          width: 100%;
          height: 4px;
          background-color: var(--bg-input);
          border-radius: 999px;
          margin-bottom: 24px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary) 0%, #a5b4fc 100%);
          width: 70%;
          border-radius: 999px;
          animation: progressAnimation 10s ease-in-out infinite alternate;
        }

        @keyframes progressAnimation {
          0% { width: 5%; }
          50% { width: 65%; }
          85% { width: 92%; }
          100% { width: 98%; }
        }

        .loading-hint-text {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
