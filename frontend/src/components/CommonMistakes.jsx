import { useState, useEffect } from 'react';
import { AlertTriangle, BarChart3, Shield, TrendingUp } from 'lucide-react';
import { getRuleSuggestion } from '../utils/ruleSuggestions';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const IMPACT_STYLES = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)' },
  serious: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.25)' },
  moderate: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.25)' },
  minor: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)' }
};

export default function CommonMistakes() {
  const [mistakes, setMistakes] = useState([]);
  const [totalAudits, setTotalAudits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRule, setExpandedRule] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${BACKEND_URL}/api/analytics/common-mistakes`, {
          credentials: 'include'
        });
        if (cancelled) return;
        if (response.status === 401) {
          setError('Session expired. Please log in again.');
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to load analytics.');
        }
        const data = await response.json();
        if (!cancelled) {
          setMistakes(data.mistakes || []);
          setTotalAudits(data.totalAudits || 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleExpand = (ruleId) => {
    setExpandedRule(prev => prev === ruleId ? null : ruleId);
  };

  return (
    <div className="insights-page-container container">
      <div className="insights-page-header">
        <h2 className="insights-page-title">
          <BarChart3 size={22} className="text-indigo" />
          Common Mistakes
        </h2>
        {totalAudits > 0 && (
          <p className="insights-subtitle">
            Analyzed {totalAudits} audit{totalAudits !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {loading && (
        <div className="insights-loading glass-card">
          <span className="animate-pulse">Analyzing your audit data...</span>
        </div>
      )}

      {!loading && error && (
        <div className="insights-error glass-card">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && mistakes.length === 0 && (
        <div className="insights-empty glass-card">
          <BarChart3 size={40} className="text-muted" />
          <h3>No mistake data yet</h3>
          <p>Scan a website to start building your accessibility insights.</p>
        </div>
      )}

      {!loading && !error && mistakes.length > 0 && (
        <div className="mistakes-list">
          {mistakes.map((mistake, index) => {
            const style = IMPACT_STYLES[mistake.impact] || IMPACT_STYLES.minor;
            const suggestion = getRuleSuggestion(mistake.ruleId);
            const isExpanded = expandedRule === mistake.ruleId;

            return (
              <div
                key={mistake.ruleId}
                className="mistake-card glass-card"
              >
                <button
                  type="button"
                  className="mistake-clickable-header"
                  onClick={() => toggleExpand(mistake.ruleId)}
                  aria-expanded={isExpanded}
                >
                  <div className="mistake-header-left">
                    <span className="mistake-rank">#{index + 1}</span>
                    <div className="mistake-header-info">
                      <span className="mistake-rule-id">{mistake.ruleId}</span>
                      <span className="mistake-help">{mistake.help || mistake.description}</span>
                    </div>
                  </div>
                  <div className="mistake-header-right">
                    <span className="mistake-count">{mistake.count}</span>
                    <span className="mistake-count-label">
                      occurrence{mistake.count !== 1 ? 's' : ''}
                    </span>
                    <span
                      className="mistake-impact-badge"
                      style={{
                        color: style.color,
                        backgroundColor: style.bg,
                        border: `1px solid ${style.border}`
                      }}
                    >
                      {mistake.impact}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mistake-expanded">
                    {mistake.description && (
                      <div className="mistake-section">
                        <span className="mistake-section-label">DESCRIPTION</span>
                        <p className="mistake-section-text">{mistake.description}</p>
                      </div>
                    )}

                    <div className="mistake-section">
                      <div className="mistake-fix-header">
                        <Shield size={16} className="text-indigo" />
                        <span className="mistake-section-label">PLAIN-LANGUAGE FIX</span>
                      </div>
                      <div className="mistake-fix-grid">
                        <div className="mistake-fix-col">
                          <span className="mistake-fix-sublabel">WHY IT MATTERS</span>
                          <p className="mistake-fix-text">{suggestion.whyItMatters}</p>
                        </div>
                        <div className="mistake-fix-col">
                          <span className="mistake-fix-sublabel">HOW TO FIX</span>
                          <p className="mistake-fix-text">{suggestion.fixExplanation}</p>
                        </div>
                      </div>
                    </div>

                    {suggestion.exampleBefore && suggestion.exampleAfter && (
                      <div className="mistake-section">
                        <span className="mistake-fix-sublabel">EXAMPLE</span>
                        <div className="mistake-example-grid">
                          <div className="mistake-example-col">
                            <span className="mistake-example-label mistake-example-before">BEFORE</span>
                            <pre className="mistake-example-code"><code>{suggestion.exampleBefore}</code></pre>
                          </div>
                          <div className="mistake-example-col">
                            <span className="mistake-example-label mistake-example-after">AFTER</span>
                            <pre className="mistake-example-code"><code>{suggestion.exampleAfter}</code></pre>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mistake-frequency-bar">
                      <TrendingUp size={14} className="text-muted" />
                      <span className="mistake-frequency-text">
                        Found in {mistake.count} of {totalAudits} audit{totalAudits !== 1 ? 's' : ''}
                        ({totalAudits > 0 ? Math.round((mistake.count / totalAudits) * 100) : 0}% of scans)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .insights-page-container {
          padding: 40px 24px 80px;
          max-width: 800px;
        }
        .insights-page-header {
          margin-bottom: 32px;
        }
        .insights-page-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 850;
          margin: 0;
        }
        .insights-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin: 6px 0 0;
        }
        .insights-loading, .insights-error {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
        }
        .insights-error {
          color: #fca5a5;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .insights-empty {
          padding: 60px 40px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .insights-empty h3 {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
        }
        .insights-empty p {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }
        .mistakes-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mistake-card {
          border: 1px solid var(--border-color);
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }
        .mistake-card:hover {
          border-color: rgba(99, 102, 241, 0.3);
        }
        .mistake-clickable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: 20px 24px;
          text-align: left;
          cursor: pointer;
          background: none;
          border: none;
          gap: 16px;
        }
        .mistake-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }
        .mistake-rank {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-muted);
          min-width: 28px;
        }
        .mistake-header-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .mistake-rule-id {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }
        .mistake-help {
          font-size: 13px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mistake-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .mistake-count {
          font-size: 22px;
          font-weight: 900;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .mistake-count-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .mistake-impact-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .mistake-expanded {
          border-top: 1px solid var(--border-color);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: rgba(30, 41, 59, 0.15);
        }
        .mistake-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mistake-section-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .mistake-section-text {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }
        .mistake-fix-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mistake-fix-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .mistake-fix-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mistake-fix-sublabel {
          font-size: 10px;
          font-weight: 800;
          color: #a5b4fc;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .mistake-fix-text {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }
        .mistake-example-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .mistake-example-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mistake-example-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .mistake-example-before { color: #f87171; }
        .mistake-example-after { color: #34d399; }
        .mistake-example-code {
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 12px;
          color: #e2e8f0;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
        }
        .mistake-frequency-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
        }
        .mistake-frequency-text {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        @media (max-width: 640px) {
          .mistake-clickable-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .mistake-header-right {
            width: 100%;
            justify-content: flex-start;
          }
          .mistake-fix-grid,
          .mistake-example-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
