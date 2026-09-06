import { useState } from 'react';
import { Server, Loader2, Activity, Clock, FileText, Ruler, Gauge, ShieldCheck, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Renders the results of a single API analysis.
 * Reused both for live results and for saved history details.
 *
 * @param {object} props
 * @param {object} props.result - The API analysis result object.
 */
export function ApiResultView({ result }) {
  if (!result) return null;

  const {
    url,
    method,
    ok,
    status,
    responseTimeMs,
    contentType,
    responseSizeBytes,
    isJson,
    structure,
    bodyPreview,
    bodyTruncated,
    category,
    apiStatus,
    apiStatusEmoji,
    cors,
    observations = []
  } = result;

  const emojiColor =
    category === 'ok' ? '#22c55e' :
    category === 'redirect' ? '#60a5fa' :
    (category === 'client-error' || category === 'server-error') ? '#fbbf24' :
    '#ef4444';

  const formatSize = (bytes) => {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const corsLabel =
    cors === 'configured' ? 'Configured' :
    cors === 'not-detected' ? 'Not detected' :
    'Could not determine';

  const statCards = [
    { icon: Activity, label: 'HTTP Status', value: status != null ? status : '—', color: emojiColor },
    { icon: Clock, label: 'Response Time', value: responseTimeMs != null ? `${responseTimeMs} ms` : '—' },
    { icon: FileText, label: 'Content Type', value: contentType || '—' },
    { icon: Ruler, label: 'Response Size', value: formatSize(responseSizeBytes) },
    { icon: ShieldCheck, label: 'CORS', value: corsLabel },
    { icon: Gauge, label: 'Format', value: isJson ? 'JSON' : (contentType && contentType.includes('text/html') ? 'HTML (plain text)' : (contentType || 'Unknown')) }
  ];

  return (
    <div className="api-result">
      {/* Status banner */}
      <div
        className="api-status-banner"
        style={{ borderColor: `rgba(${emojiColor === '#22c55e' ? '16,185,129' : emojiColor === '#ef4444' ? '239,68,68' : emojiColor === '#fbbf24' ? '234,179,8' : '96,165,250'},0.35)`, background: `rgba(${emojiColor === '#22c55e' ? '16,185,129' : emojiColor === '#ef4444' ? '239,68,68' : emojiColor === '#fbbf24' ? '234,179,8' : '96,165,250'},0.06)` }}
      >
        <span className="api-status-emoji" style={{ color: emojiColor }}>{apiStatusEmoji}</span>
        <div className="api-status-text">
          <span className="api-status-title" style={{ color: emojiColor }}>{apiStatus}</span>
          <span className="api-endpoint mono">{url}</span>
        </div>
        <span className="api-method-chip">{method}</span>
      </div>

      {/* Stat cards */}
      <div className="api-stat-grid">
        {statCards.map(s => (
          <div key={s.label} className="api-stat-card glass-card">
            <s.icon size={16} className="api-stat-icon" />
            <span className="api-stat-label">{s.label}</span>
            <span className="api-stat-value" style={s.color ? { color: s.color } : undefined}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* JSON structure / summary */}
      {structure && (
        <div className="api-structure glass-card">
          <Info size={15} className="text-indigo" />
          <div>
            <span className="api-section-label">RESPONSE STRUCTURE</span>
            <span className="mono api-structure-text">{structure}</span>
          </div>
        </div>
      )}

      {/* Observations */}
      {observations.length > 0 && (
        <div className="api-observations glass-card">
          <div className="api-section-heading">
            <AlertTriangle size={15} className="text-amber" />
            <span className="api-section-label">OBSERVATIONS</span>
          </div>
          <ul className="api-obs-list">
            {observations.map((ob, i) => (
              <li key={i} className="api-obs-item">
                <span className="api-obs-dot" />
                <span>{ob}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Body preview */}
      {bodyPreview && (
        <div className="api-preview glass-card">
          <div className="api-section-heading">
            <FileText size={15} className="text-indigo" />
            <span className="api-section-label">RESPONSE PREVIEW</span>
            {bodyTruncated && <span className="api-truncated-note">(truncated)</span>}
          </div>
          <pre className="api-preview-body">{bodyPreview}</pre>
        </div>
      )}

      {!bodyPreview && !structure && observations.length === 0 && (
        <div className="api-observations glass-card">
          <div className="api-section-heading">
            <Info size={15} className="text-indigo" />
            <span className="api-section-label">RESULT</span>
          </div>
          <p className="api-obs-item" style={{ margin: 0 }}>
            {ok ? 'The endpoint responded successfully and returned no body content.' : 'No additional information is available for this request.'}
          </p>
        </div>
      )}

      {!ok && (
        <div className="api-observations glass-card">
          <div className="api-section-heading">
            <CheckCircle2 size={15} className="text-indigo" />
            <span className="api-section-label">NOTE</span>
          </div>
          <p className="api-obs-item" style={{ margin: 0 }}>
            An unreachable endpoint can indicate the service is down, the address is wrong, or it requires network access not available from this server. This tool never sends credentials or modifies data.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * ApiAnalysis Component
 * Lets an authenticated user safely test GET/HEAD API endpoints and review
 * status, latency, content type, CORS and a sample of the response.
 */
export default function ApiAnalysis() {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/api-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim(), method })
      });

      if (response.status === 401) {
        throw new Error('Your session has expired. Please log out and log in again.');
      }

      if (!response.ok) {
        let msg = `The request was rejected (HTTP ${response.status}).`;
        try {
          const e = await response.json();
          if (e && e.error) msg = e.error;
        } catch { /* keep default */ }
        throw new Error(msg);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      let friendly = err.message;
      if (err.message.includes('Failed to fetch')) {
        friendly = 'The Access Check backend server appears to be offline. Make sure the Node.js server is running on http://localhost:5000.';
      }
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = url.trim().length > 0 && !loading;

  return (
    <div className="api-container container">
      <div className="api-header">
        <h2 className="api-title">
          <Server size={22} className="text-indigo" />
          API / Backend Analysis
        </h2>
        <p className="api-subtitle">
          Safely test a GET or HEAD endpoint and review its status, response time,
          content type, CORS configuration, structure and a sample response.
          Read-only and non-destructive.
        </p>
      </div>

      {/* Input form */}
      <div className="api-form glass-card">
        <label className="api-form-label" htmlFor="api-url">API Endpoint URL</label>
        <div className="api-form-row">
          <select
            className="api-method-select"
            value={method}
            onChange={(e) => setMethod(e.target.value.toUpperCase())}
            aria-label="HTTP method"
          >
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
          <input
            id="api-url"
            className="api-url-input"
            type="text"
            placeholder="https://example.com/api/users"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleTest(); }}
          />
          <button
            className="api-test-btn"
            onClick={handleTest}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinning" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Activity size={16} />
                <span>Test API</span>
              </>
            )}
          </button>
        </div>
        <p className="api-form-hint">
          Only GET and HEAD are supported. Requests time out after 15s. Responses larger than 512 KB are truncated and private/internal network addresses are blocked for safety.
        </p>
      </div>

      {error && (
        <div className="api-error glass-card">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="api-loading glass-card">
          <Loader2 size={20} className="spinning" />
          <span className="animate-pulse">Contacting endpoint and measuring the response...</span>
        </div>
      )}

      {!loading && result && (
        <ApiResultView result={result} />
      )}

      {!loading && !result && !error && (
        <div className="api-empty glass-card">
          <Server size={40} className="text-muted" />
          <h3>No test run yet</h3>
          <p>Enter an endpoint URL above (for example <span className="mono">https://jsonplaceholder.typicode.com/todos/1</span>) and press Test API.</p>
        </div>
      )}

      <style>{`
        .api-container {
          padding: 40px 24px 80px;
          max-width: 860px;
        }
        .api-header {
          margin-bottom: 24px;
        }
        .api-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 850;
          margin: 0 0 6px 0;
        }
        .api-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          max-width: 640px;
        }
        .api-form {
          padding: 20px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .api-form-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .api-form-row {
          display: flex;
          gap: 10px;
        }
        .api-method-select {
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .api-url-input {
          flex: 1;
          min-width: 0;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 14px;
          font-family: var(--font-mono);
        }
        .api-url-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .api-test-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          background: #6366F1;
          border: 1px solid #4F46E5;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .api-test-btn:hover:not(:disabled) {
          background: #4F46E5;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .api-test-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .api-test-btn .spinning {
          animation: spin 1s linear infinite;
        }
        .api-form-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .api-error {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fca5a5;
          margin-bottom: 20px;
        }
        .api-loading {
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .api-empty {
          padding: 48px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }
        .api-empty h3 {
          font-size: 17px;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
        }
        .api-empty p {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }

        /* Result styles */
        .api-result {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .api-status-banner {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        .api-status-emoji {
          font-size: 30px;
          line-height: 1;
        }
        .api-status-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .api-status-title {
          font-size: 15px;
          font-weight: 800;
        }
        .api-endpoint {
          font-size: 12.5px;
          color: var(--text-secondary);
          word-break: break-all;
        }
        .api-method-chip {
          font-size: 11px;
          font-weight: 800;
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 4px 10px;
          border-radius: 9999px;
          flex-shrink: 0;
        }
        .api-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .api-stat-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .api-stat-icon {
          color: var(--text-muted);
        }
        .api-stat-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .api-stat-value {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
          word-break: break-word;
        }
        .api-structure {
          padding: 16px 20px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .api-section-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .api-structure-text {
          display: block;
          margin-top: 6px;
          font-size: 13px;
          color: var(--text-primary);
          word-break: break-word;
        }
        .api-observations {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .api-section-heading {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .api-obs-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .api-obs-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .api-obs-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 7px;
          background: var(--primary);
        }
        .api-preview {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .api-truncated-note {
          font-size: 11px;
          font-weight: 700;
          color: #fbbf24;
          margin-left: 4px;
        }
        .api-preview-body {
          margin: 0;
          padding: 14px;
          background: rgba(2, 6, 23, 0.6);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.5;
          color: #d1d5db;
          max-height: 320px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .mono {
          font-family: var(--font-mono);
        }
        .text-amber {
          color: #fbbf24;
        }
        @media (max-width: 640px) {
          .api-form-row {
            flex-direction: column;
          }
          .api-status-banner {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
