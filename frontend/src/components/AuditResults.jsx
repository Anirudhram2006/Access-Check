import React, { useState, useEffect, useRef } from 'react';
import { Filter, AlertCircle, RefreshCw, Layers, Volume2, Pause, Square, Play } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import ViolationSummary from './ViolationSummary';
import WebsitePreview from './WebsitePreview';
import ViolationCard from './ViolationCard';
import { calculateScore } from '../utils/score';
import { getRuleSuggestion } from '../utils/ruleSuggestions';

/**
 * AuditResults Component
 * Serves as the central report dashboard. Orchestrates the score gauge,
 * summary charts, full browser screenshot rendering, and the interactive findings list.
 * 
 * @param {object} props
 * @param {object} props.scanResult - The raw JSON audit result from our Express backend
 * @param {boolean} props.isDemoMode - True if using local demo data rather than live scan
 * @param {function} props.onReset - Call to clear scan result and return to scanner input
 */
export default function AuditResults({ scanResult, isDemoMode, onReset }) {
  const [filter, setFilter] = useState('all');
  const [speechState, setSpeechState] = useState('idle');
  const utteranceRef = useRef(null);
  
  const isSupported = typeof window !== 'undefined' && !!window.speechSynthesis;

  const score = calculateScore(scanResult.violations);

  // Clean up speech synthesis on component unmount or when scanResult changes
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [scanResult]);

  // Filter logic
  const filteredViolations = scanResult.violations.filter(v => {
    if (filter === 'all') return true;
    return (v.impact ? v.impact.toLowerCase() : 'minor') === filter;
  });

  const generateNarrationText = (result) => {
    const scoreVal = calculateScore(result.violations);
    const violations = result.violations || [];
    const totalIssues = violations.length;

    const counts = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0
    };

    violations.forEach(v => {
      const impact = v.impact ? v.impact.toLowerCase() : 'minor';
      if (counts.hasOwnProperty(impact)) {
        counts[impact]++;
      } else {
        counts.minor++;
      }
    });

    let text = "Access Check accessibility report. ";
    text += `Your accessibility score is ${scoreVal} out of 100. `;

    if (totalIssues === 0) {
      text += "The scan found 0 accessibility issues. Excellent job!";
      return text;
    }

    text += `The scan found ${totalIssues} accessibility ${totalIssues === 1 ? 'issue' : 'issues'}. `;

    const severityParts = [];
    if (counts.critical > 0) {
      severityParts.push(`${counts.critical} critical ${counts.critical === 1 ? 'issue' : 'issues'}`);
    }
    if (counts.serious > 0) {
      severityParts.push(`${counts.serious} serious ${counts.serious === 1 ? 'issue' : 'issues'}`);
    }
    if (counts.moderate > 0) {
      severityParts.push(`${counts.moderate} moderate ${counts.moderate === 1 ? 'issue' : 'issues'}`);
    }
    if (counts.minor > 0) {
      severityParts.push(`${counts.minor} minor ${counts.minor === 1 ? 'issue' : 'issues'}`);
    }

    if (severityParts.length > 0) {
      if (severityParts.length === 1) {
        text += `There is ${severityParts[0]}. `;
      } else if (severityParts.length === 2) {
        text += `There are ${severityParts[0]} and ${severityParts[1]}. `;
      } else {
        const last = severityParts.pop();
        text += `There are ${severityParts.join(', ')}, and ${last}. `;
      }
    }

    violations.forEach((v, index) => {
      const ruleSug = getRuleSuggestion(v.id);
      text += `\n\nIssue ${index + 1}: `;
      text += `${v.help}. `;
      text += `\nDescription: `;
      text += `${v.description}. `;
      text += `\nSuggested fix: `;
      text += `${ruleSug.fixExplanation}. `;
    });

    return text;
  };

  const speakReport = () => {
    if (!isSupported) return;

    // Stop/cancel any ongoing speech
    window.speechSynthesis.cancel();

    const text = generateNarrationText(scanResult);
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setSpeechState('playing');
    };
    utterance.onend = () => {
      setSpeechState('idle');
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      console.log('Speech synthesis reset/interrupted:', event);
      setSpeechState('idle');
      utteranceRef.current = null;
    };
    utterance.onpause = () => {
      setSpeechState('paused');
    };
    utterance.onresume = () => {
      setSpeechState('playing');
    };

    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (isSupported) {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    }
  };

  const resumeSpeech = () => {
    if (isSupported) {
      window.speechSynthesis.resume();
      setSpeechState('playing');
    }
  };

  const stopSpeech = () => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setSpeechState('idle');
    }
  };

  return (
    <div className="audit-results-container container">
      {/* Demo Mode / Info Alert Header */}
      {isDemoMode && (
        <div className="demo-mode-header-alert">
          <Layers size={18} className="text-gold" />
          <p className="demo-mode-text">
            <strong>DEMO MODE:</strong> Displaying a previously captured real scan of <code>https://example.com</code>.
          </p>
          <span className="demo-mode-tag">REAL DATA</span>
        </div>
      )}

      {/* Report Hero Summary Panel */}
      <div className="report-meta-bar">
        <div className="meta-info">
          <span className="meta-label">SCANNED WEB ADDRESS</span>
          <h2 className="meta-url">{scanResult.scannedUrl}</h2>
        </div>
        <button type="button" onClick={onReset} className="re-scan-btn">
          <RefreshCw size={14} />
          <span>NEW SCAN</span>
        </button>
      </div>

      {/* Voice Narration Controller */}
      <div className="voice-narration-card glass-card">
        <div className="voice-card-header">
          <Volume2 className="voice-icon text-indigo" size={20} />
          <div className="voice-title-block">
            <h3 className="voice-title">Accessibility Report Narrator</h3>
            <p className="voice-subtitle">Listen to a spoken summary of the scan results and recommended fixes.</p>
          </div>
        </div>

        {isSupported ? (
          <div className="voice-controls-row">
            {speechState === 'idle' && (
              <button 
                type="button" 
                onClick={speakReport} 
                className="voice-btn primary-voice-btn"
                aria-label="Read full report aloud"
              >
                <Volume2 size={16} />
                <span>Read Report Aloud</span>
              </button>
            )}

            {speechState === 'playing' && (
              <div className="voice-btn-group">
                <button 
                  type="button" 
                  onClick={pauseSpeech} 
                  className="voice-btn secondary-voice-btn"
                  aria-label="Pause narration"
                >
                  <Pause size={16} />
                  <span>Pause</span>
                </button>
                <button 
                  type="button" 
                  onClick={stopSpeech} 
                  className="voice-btn danger-voice-btn"
                  aria-label="Stop narration"
                >
                  <Square size={16} />
                  <span>Stop</span>
                </button>
              </div>
            )}

            {speechState === 'paused' && (
              <div className="voice-btn-group">
                <button 
                  type="button" 
                  onClick={resumeSpeech} 
                  className="voice-btn primary-voice-btn"
                  aria-label="Resume narration"
                >
                  <Play size={16} />
                  <span>Resume</span>
                </button>
                <button 
                  type="button" 
                  onClick={stopSpeech} 
                  className="voice-btn danger-voice-btn"
                  aria-label="Stop narration"
                >
                  <Square size={16} />
                  <span>Stop</span>
                </button>
              </div>
            )}
            
            {speechState !== 'idle' && (
              <div className="narration-status-pill animate-pulse">
                <span className="status-dot"></span>
                <span>{speechState === 'playing' ? 'Speaking...' : 'Paused'}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="voice-unsupported-message">
            <AlertCircle size={16} className="text-warning" />
            <span>Voice narration is not supported in this browser.</span>
          </div>
        )}
      </div>

      {/* Dashboard Top Row Metrics Grid */}
      <div className="metrics-row-grid">
        <div className="metrics-col">
          <ScoreGauge score={score} />
        </div>
        <div className="metrics-col">
          <ViolationSummary violations={scanResult.violations} />
        </div>
      </div>

      {/* Dashboard Middle Row Screenshot Mockup */}
      <div className="preview-row-wrapper">
        <WebsitePreview 
          url={scanResult.scannedUrl} 
          screenshotPath={scanResult.screenshotUrl} 
        />
      </div>

      {/* Dashboard Bottom Row Detailed Findings list */}
      <div className="findings-section">
        <div className="findings-header">
          <div className="findings-title-group">
            <h3 className="findings-main-title">Accessibility Findings</h3>
            <p className="findings-subtitle">
              Showing {filteredViolations.length} of {scanResult.violations.length} total violations
            </p>
          </div>

          {/* Interactive Filter Toolbar */}
          <div className="filter-toolbar">
            <Filter size={16} className="filter-icon" />
            <span className="filter-label">Filter Impact:</span>
            <div className="filter-btn-group">
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${filter === 'critical' ? 'active' : ''}`}
                onClick={() => setFilter('critical')}
              >
                Critical
              </button>
              <button 
                className={`filter-btn ${filter === 'serious' ? 'active' : ''}`}
                onClick={() => setFilter('serious')}
              >
                Serious
              </button>
              <button 
                className={`filter-btn ${filter === 'moderate' ? 'active' : ''}`}
                onClick={() => setFilter('moderate')}
              >
                Moderate
              </button>
              <button 
                className={`filter-btn ${filter === 'minor' ? 'active' : ''}`}
                onClick={() => setFilter('minor')}
              >
                Minor
              </button>
            </div>
          </div>
        </div>

        {/* Violations Map */}
        {filteredViolations.length > 0 ? (
          <div className="violations-list-wrapper">
            {filteredViolations.map((violation, index) => (
              <ViolationCard key={violation.id || index} violation={violation} />
            ))}
          </div>
        ) : (
          <div className="no-filtered-violations glass-card">
            <AlertCircle size={32} className="text-muted" />
            <h4 className="no-violations-title">No matching violations</h4>
            <p className="no-violations-desc">There are no accessibility issues with a severity level of "{filter}" on this page.</p>
          </div>
        )}
      </div>

      <style>{`
        .audit-results-container {
          padding: 40px 24px 100px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          text-align: left;
        }

        .demo-mode-header-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.3);
          padding: 14px 20px;
          border-radius: var(--radius-md);
          font-size: 14px;
        }

        .demo-mode-text {
          color: #fef08a;
          margin: 0;
          flex-grow: 1;
        }

        .demo-mode-tag {
          font-size: 10px;
          font-weight: 800;
          background: #eab308;
          color: #000000;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .report-meta-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 24px 32px;
          box-shadow: var(--shadow-sm);
        }

        .meta-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meta-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .meta-url {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          word-break: break-all;
        }

        .re-scan-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 700;
          transition: all var(--transition-fast);
        }

        .re-scan-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          border-color: var(--text-muted);
          transform: translateY(-1px);
        }

        .metrics-row-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .metrics-col {
          height: 100%;
        }

        .preview-row-wrapper {
          width: 100%;
        }

        /* Findings list styling */
        .findings-section {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .findings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .findings-title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .findings-main-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
        }

        .findings-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .filter-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-icon {
          color: var(--text-muted);
        }

        .filter-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .filter-btn-group {
          display: flex;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          padding: 4px;
          border-radius: var(--radius-md);
        }

        .filter-btn {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .filter-btn:hover {
          color: var(--text-primary);
        }

        .filter-btn.active {
          color: #ffffff;
          background: rgba(99, 102, 241, 0.15);
          box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.4);
        }

        /* Empty state filter results */
        .no-filtered-violations {
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }

        .no-violations-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .no-violations-desc {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 380px;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .metrics-row-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        @media (max-width: 768px) {
          .report-meta-bar {
            flex-direction: column;
            align-items: flex-start;
            padding: 20px;
            gap: 16px;
          }
          
          .re-scan-btn {
            width: 100%;
            justify-content: center;
          }
          
          .findings-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .filter-toolbar {
            width: 100%;
            justify-content: space-between;
          }
          
          .filter-btn-group {
            width: 100%;
            justify-content: space-around;
            margin-top: 4px;
          }
        }

        /* Voice Narration CSS */
        .voice-narration-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 32px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          gap: 24px;
        }

        .voice-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .voice-icon {
          color: #6366f1; /* indigo */
          flex-shrink: 0;
        }

        .voice-title-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .voice-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }

        .voice-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
        }

        .voice-controls-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .voice-btn-group {
          display: flex;
          gap: 12px;
        }

        .voice-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 20px;
          transition: all var(--transition-fast);
          cursor: pointer;
        }

        .voice-btn:focus-visible {
          outline: 2px solid #a5b4fc;
          outline-offset: 2px;
        }

        .primary-voice-btn {
          background: #6366f1;
          border: 1px solid #4f46e5;
          color: #ffffff;
        }

        .primary-voice-btn:hover {
          background: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .secondary-voice-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .secondary-voice-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          border-color: var(--text-muted);
          transform: translateY(-1px);
        }

        .danger-voice-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .danger-voice-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ffffff;
          border-color: #ef4444;
          transform: translateY(-1px);
        }

        .narration-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          color: #a5b4fc;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: #6366f1;
          border-radius: 50%;
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }

        .voice-unsupported-message {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.3);
          padding: 10px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          color: #fef08a;
        }

        @media (max-width: 768px) {
          .voice-narration-card {
            flex-direction: column;
            align-items: flex-start;
            padding: 20px;
            gap: 16px;
          }

          .voice-controls-row {
            width: 100%;
            justify-content: space-between;
          }

          .voice-btn-group {
            width: 100%;
          }

          .voice-btn {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
