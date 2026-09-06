import { useRef, useState } from 'react';
import { FileCode2, UploadCloud, ShieldAlert,
  X, FileText, Code2, CheckCircle2, RefreshCw, Trash2, ChevronUp, ChevronDown, BookOpen, Clock,
  Wrench, FileDown, AlertTriangle, Loader2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

const SEVERITY_META = {
  critical: { color: 'var(--critical)', bg: 'var(--critical-bg)', border: 'var(--critical-border)', icon: 'critical' },
  serious: { color: 'var(--serious)', bg: 'var(--serious-bg)', border: 'var(--serious-border)', icon: 'serious' },
  moderate: { color: 'var(--moderate)', bg: 'var(--moderate-bg)', border: 'var(--moderate-border)', icon: 'moderate' },
  minor: { color: 'var(--minor)', bg: 'var(--minor-bg)', border: 'var(--minor-border)', icon: 'minor' },
};

const SUPPORTED_HINTS = ['HTML', 'JSX', 'JS', 'TS', 'TSX', 'CSS'];
const severityOrder = ['critical', 'serious', 'moderate', 'minor'];

export default function SourceCodeAnalysis({ onViewHistory }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    // Append new files, de-duplicate by name.
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      const fresh = files.filter(f => !names.has(f.name));
      return [...prev, ...fresh];
    });
  };

  const removeFile = (name) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
    setResult(null);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one source file to analyze.');
      return;
    }
    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(f => formData.append('files', f, f.name));

      const response = await fetch(`${BACKEND_URL}/api/source-analysis`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        let msg = 'The analysis could not be completed.';
        try {
          const d = await response.json();
          msg = d.error || msg;
        } catch {
          // Non-JSON error body — fall back to the default message.
        }
        if (response.status === 401) {
          msg = 'Your session has expired. Please log in again.';
        }
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
      setAnalyzing(false);
    }
  };

  return (
    <div className="source-analysis-container container">
      <div className="source-page-header">
        <h2 className="source-title">Source Code Analysis</h2>
        <p className="source-subtitle">
          Upload your website source code and Access Check will statically inspect it for
          accessibility problems — no browser, no execution, your code is never stored.
        </p>
      </div>

      {/* Upload Card */}
      <div className="glass-card source-upload-card">
        <div className="upload-card-top">
          <div className="upload-icon-wrap">
            <FileCode2 size={22} className="text-indigo" />
          </div>
          <div>
            <h3 className="upload-heading">Upload your source code</h3>
            <p className="upload-hint">
              Supported: {SUPPORTED_HINTS.join(', ')} · up to 20 files · 1&nbsp;MB each · 5&nbsp;MB total
            </p>
          </div>
        </div>

        <div
          className="drop-zone"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length === 0) return;
            setError('');
            setSelectedFiles(prev => {
              const names = new Set(prev.map(f => f.name));
              const fresh = files.filter(f => !names.has(f.name));
              return [...prev, ...fresh];
            });
          }}
        >
          <UploadCloud size={32} className="drop-icon" />
          <span className="drop-text">Click or drop source files here</span>
          <span className="drop-subtext">HTML, JSX, JS, TS, TSX, CSS</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".html,.htm,.jsx,.js,.ts,.tsx,.css"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <span className="file-list-title">
                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
              </span>
              <button type="button" className="clear-btn" onClick={clearFiles}>
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </div>
            <div className="file-chips">
              {selectedFiles.map((f) => (
                <span key={f.name} className="file-chip">
                  <FileText size={14} className="file-chip-icon" />
                  <span className="file-chip-name">{f.name}</span>
                  <button
                    type="button"
                    className="file-chip-remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removeFile(f.name)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="analyze-actions">
          <button
            type="button"
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={analyzing || selectedFiles.length === 0}
          >
            <Code2 size={16} />
            <span>{analyzing ? 'Analyzing...' : 'Analyze Code'}</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner glass-card source-error">
          <ShieldAlert className="error-icon text-critical" size={24} />
          <div className="error-text-block">
            <h4 className="error-title">Analysis Interrupted</h4>
            <p className="error-description">{error}</p>
          </div>
        </div>
      )}

      {analyzing && (
        <div className="source-analyzing glass-card">
          <div className="spinner" />
          <span>Analyzing source code for accessibility issues...</span>
        </div>
      )}

      {/* Results */}
      {result && !analyzing && (
        <SourceResults result={result} onReset={clearFiles} saved={result.saved} onViewHistory={onViewHistory} files={selectedFiles} />
      )}

      <style>{`
        .source-analysis-container {
          padding: 48px 24px 100px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          text-align: left;
        }
        .source-page-header { text-align: center; }
        .source-title { font-size: 30px; font-weight: 850; letter-spacing: -0.02em; margin-bottom: 8px; }
        .source-subtitle { font-size: 14px; color: var(--text-secondary); max-width: 620px; margin: 0 auto; line-height: 1.6; }
        .source-upload-card { padding: 28px; display: flex; flex-direction: column; gap: 20px; }
        .upload-card-top { display: flex; align-items: center; gap: 14px; }
        .upload-icon-wrap {
          width: 48px; height: 48px; border-radius: var(--radius-md);
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .text-indigo { color: #a5b4fc; }
        .upload-heading { font-size: 18px; font-weight: 800; margin: 0; }
        .upload-hint { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }
        .drop-zone {
          border: 1.5px dashed var(--border-color); border-radius: var(--radius-lg);
          padding: 40px 24px; display: flex; flex-direction: column; align-items: center; gap: 6px;
          cursor: pointer; transition: all var(--transition-fast); background: rgba(30,41,59,0.2);
        }
        .drop-zone:hover { border-color: var(--primary); background: rgba(99,102,241,0.04); }
        .drop-icon { color: var(--primary); }
        .drop-text { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .drop-subtext { font-size: 13px; color: var(--text-muted); }
        .file-list { display: flex; flex-direction: column; gap: 12px; }
        .file-list-header { display: flex; justify-content: space-between; align-items: center; }
        .file-list-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
        .clear-btn { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
          color: var(--text-muted); padding: 6px 10px; border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .clear-btn:hover { color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .file-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .file-chip { display: inline-flex; align-items: center; gap: 8px; background: var(--bg-input);
          border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 9999px; font-size: 12px; }
        .file-chip-icon { color: var(--primary); }
        .file-chip-name { font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); }
        .file-chip-remove { color: var(--text-muted); display: flex; align-items: center;
          border-radius: 50%; padding: 2px; transition: all var(--transition-fast); }
        .file-chip-remove:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
        .analyze-actions { display: flex; justify-content: flex-end; }
        .analyze-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--primary);
          border: 1px solid #4f46e5; color:#fff; font-size:14px; font-weight:750; padding: 12px 26px;
          border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .analyze-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .source-error { max-width: 680px; width: 100%; margin: 0 auto; display: flex; align-items: flex-start; gap: 16px; }
        .source-analyzing { display: flex; align-items: center; justify-content: center; gap: 14px;
          padding: 28px; font-size: 14px; color: var(--text-secondary); font-weight: 600; }
        .spinner { width: 22px; height: 22px; border: 3px solid var(--border-color); border-top-color: var(--primary);
          border-radius: 50%; animation: srcspin 0.7s linear infinite; }
        @keyframes srcspin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .source-analysis-container { padding: 32px 20px 80px; }
          .source-upload-card { padding: 20px; }
          .analyze-actions { justify-content: stretch; }
          .analyze-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

export function SourceResults({ result, onReset, saved, onViewHistory, files }) {
  const summaryItems = severityOrder
    .map((key) => ({ key, count: (result.summary && result.summary[key]) || 0 }))
    .filter((s) => s.count > 0);

  // Per-file fix classification (backend already attaches fixStatus to each finding).
  const fixableByFile = {};
  const manualByFile = {};
  result.findings.forEach((f) => {
    const key = f.file;
    if (f.fixStatus === 'fixable') fixableByFile[key] = (fixableByFile[key] || 0) + 1;
    else manualByFile[key] = (manualByFile[key] || 0) + 1;
  });
  const fixableTotal = Object.values(fixableByFile).reduce((a, b) => a + b, 0);
  const manualTotal = Object.values(manualByFile).reduce((a, b) => a + b, 0);

  // Original uploaded source per file, provided by the backend in the analysis
  // response. This is the authoritative copy used for the ORIGINAL CODE view,
  // for sending the fix request, and for the download request.
  const uploadedSources = {};
  (result.files || []).forEach((f) => {
    if (typeof f.content === 'string') uploadedSources[f.name] = f.content;
  });

  const [fixing, setFixing] = useState(false);
  const [fixAction, setFixAction] = useState('');
  const [fixError, setFixError] = useState('');
  const [fixResult, setFixResult] = useState(null);
  const [originals, setOriginals] = useState({});
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzed, setReanalyzed] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const readFileContent = async (f) => {
    if (f && typeof f.text === 'function') return await f.text();
    return '';
  };

  // Get a file's original content: prefer the backend-provided source, then
  // fall back to re-reading the actual uploaded File object.
  const getContent = async (name) => {
    if (uploadedSources[name]) return uploadedSources[name];
    const file = files.find((f) => f.name === name);
    return file ? await readFileContent(file) : '';
  };

  const handleFixError = (err, status) => {
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (err && err.message && err.message.includes('Failed to fetch')) {
      return 'The Access Check backend server appears to be offline. Make sure the Node.js server is running on http://localhost:5000.';
    }
    return err && err.message ? err.message : 'The fixed code could not be generated.';
  };

  const applyAllSafeFixes = async () => {
    setFixError('');
    setReanalyzed(null);
    setFixAction('all');
    setFixing(true);
    try {
      const contents = {};
      const payload = [];
      for (const f of files) {
        const content = await getContent(f.name);
        contents[f.name] = content;
        payload.push({ name: f.name, content });
      }
      const response = await fetch(`${BACKEND_URL}/api/source-analysis/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload }),
        credentials: 'include'
      });
      let status = response.status;
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) throw new Error(handleFixError(data, status));
      setOriginals(contents);
      setFixResult(data);
    } catch (err) {
      setFixError(handleFixError(err));
    } finally {
      setFixing(false);
      setFixAction('');
    }
  };

  const changeOne = async (finding) => {
    setFixError('');
    setReanalyzed(null);
    const file = files.find((f) => f.name === finding.file);
    if (!file && !uploadedSources[finding.file]) {
      setFixError('The matching file is no longer selected. Please re-run the analysis.');
      return;
    }
    const orig = uploadedSources[finding.file] || (await readFileContent(file));
    if (!orig) {
      setFixError('The original source could not be read. Please re-run the analysis.');
      return;
    }
    setFixAction('single');
    setFixing(true);
    try {
      setOriginals(prev => ({ ...prev, [finding.file]: orig }));
      const response = await fetch(`${BACKEND_URL}/api/source-analysis/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: finding.file, content: orig }],
          target: { file: finding.file, line: finding.line, id: finding.id }
        }),
        credentials: 'include'
      });
      let status = response.status;
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) throw new Error(handleFixError(data, status));
      setFixResult(data);
    } catch (err) {
      setFixError(handleFixError(err));
    } finally {
      setFixing(false);
      setFixAction('');
    }
  };

  // Download the corrected file through the authenticated backend endpoint so
  // the server re-generates and serves the authoritative fixed source with the
  // correct Content-Disposition / Content-Type headers.
  const downloadFixedFile = async (rf) => {
    if (rf.verification && rf.verification.blocked) return;
    if (downloading) return;
    const content = await getContent(rf.name);
    if (!content) {
      setFixError(`The original source for ${rf.name} is no longer available. Please re-run the analysis.`);
      return;
    }
    setFixError('');
    setDownloading(rf.name);
    try {
      const response = await fetch(`${BACKEND_URL}/api/source-analysis/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ name: rf.name, content }] }),
        credentials: 'include'
      });
      if (response.status === 422) {
        let data = {};
        try { data = await response.json(); } catch { /* ignore */ }
        throw new Error(data.error || 'This file is blocked from download because it contains sensitive content.');
      }
      if (!response.ok) {
        let msg = 'The file could not be downloaded.';
        try {
          const data = await response.json();
          if (data && data.error) msg = data.error;
        } catch { /* non-JSON error body — keep default message */ }
        throw new Error(handleFixError({ message: msg }, response.status));
      }
      const blob = await response.blob();
      let filename = rf.fixedFileName;
      const cd = response.headers.get('Content-Disposition') || '';
      const m = /filename="?([^";]+)"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setFixError(handleFixError(err));
    } finally {
      setDownloading(null);
    }
  };

  const reanalyzeFixed = async () => {
    if (!fixResult || !fixResult.results) return;
    setReanalyzing(true);
    setFixError('');
    try {
      const payload = fixResult.results.map(r => ({ name: r.name, content: r.fixedContent }));
      const response = await fetch(`${BACKEND_URL}/api/source-analysis/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload }),
        credentials: 'include'
      });
      let status = response.status;
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) throw new Error(handleFixError(data, status));
      setReanalyzed(data);
    } catch (err) {
      setFixError(handleFixError(err));
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="source-results">
      {/* Header bar */}
      <div className="report-meta-bar">
        <div className="meta-info">
          <span className="meta-label">SOURCE CODE ANALYSIS</span>
          <h2 className="meta-url">
            {result.total} {result.total === 1 ? 'issue' : 'issues'} across {result.files.length} {result.files.length === 1 ? 'file' : 'files'}
          </h2>
        </div>
        <button type="button" onClick={onReset} className="re-scan-btn">
          <RefreshCw size={14} />
          <span>NEW ANALYSIS</span>
        </button>
      </div>

      {/* Saved to history notice */}
      {saved !== false && (
        <div className="saved-to-history-note glass-card">
          <CheckCircle2 size={18} className="text-success" />
          <span className="saved-to-history-text">
            This analysis was saved to your Audit History automatically.
          </span>
          {onViewHistory && (
            <button type="button" className="view-history-btn" onClick={onViewHistory}>
              <Clock size={14} />
              <span>View in History</span>
            </button>
          )}
        </div>
      )}

      {/* Severity summary */}
      <div className="source-summary-grid">
        <div className="source-summary-card glass-card">
          <div className="summary-big-number">{result.total}</div>
          <div className="summary-big-label">Total Issues</div>
        </div>
        {summaryItems.length === 0 && (
          <div className="source-summary-card glass-card success">
            <CheckCircle2 size={26} className="text-success" />
            <div className="summary-clean-label">No issues detected</div>
            <div className="summary-clean-sub">Good job — no accessibility problems found in the uploaded code.</div>
          </div>
        )}
        {summaryItems.map((item) => (
          <div key={item.key} className="source-summary-card glass-card">
            <div className="summary-big-number" style={{ color: SEVERITY_META[item.key].color }}>
              {item.count}
            </div>
            <div className="summary-big-label">{item.key}</div>
          </div>
        ))}
      </div>

      {/* Change Code (Auto-Fix) panel */}
      <div className="fix-panel glass-card">
        <div className="fix-panel-header">
          <div className="fix-icon-wrap">
            <Wrench size={20} className="text-indigo" />
          </div>
          <div className="fix-heading-block">
            <h3 className="fix-panel-title">Change Code — Automatic Fix</h3>
            <p className="fix-panel-sub">
              Corrected code is generated from the actual findings above and verified for valid markup.
              Your original files are never modified — the fixed copies (e.g. &ldquo;name-fixed.html&rdquo;) are only downloaded when you choose to.
            </p>
          </div>
        </div>

        {fixError && (
          <div className="fix-error-note">
            <ShieldAlert size={16} className="text-critical" />
            <span>{fixError}</span>
          </div>
        )}

        {result.files.length > 0 && (
          <div className="fix-per-file">
            {result.files.map((f) => {
              const fx = fixableByFile[f.name] || 0;
              const mn = manualByFile[f.name] || 0;
              const fixed = fixResult ? fixResult.results.find(r => r.name === f.name) : null;
              return (
                <div key={f.name} className={`fix-file-row ${fixed ? 'has-fixed' : ''}`}>
                  <div className="fix-file-name">
                    <FileText size={14} />
                    <span>{f.name}</span>
                  </div>
                  <div className="fix-file-stats">
                    {fx > 0 && <span className="fix-stat fixable">{fx} auto-fixable</span>}
                    {mn > 0 && <span className="fix-stat manual">{mn} manual</span>}
                    {fx === 0 && mn === 0 && <span className="fix-stat clean">no issues</span>}
                    {fixed && fixed.verification && fixed.verification.blocked && (
                      <span className="fix-stat blocked">download blocked</span>
                    )}
                    {fixed && !(fixed.verification && fixed.verification.blocked) && (
                      <button
                        type="button"
                        className="fix-dl-btn"
                        onClick={() => downloadFixedFile(fixed)}
                        disabled={downloading === f.name}
                      >
                        {downloading === f.name ? <Loader2 size={14} className="spinning" /> : <FileDown size={14} />}
                        <span>{downloading === f.name ? 'Preparing…' : `Download ${fixed.fixedFileName}`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="fix-actions">
          <button
            type="button"
            className="apply-all-btn"
            onClick={applyAllSafeFixes}
            disabled={fixing || fixableTotal === 0}
          >
            {fixing ? <Loader2 size={15} className="spinning" /> : <Wrench size={15} />}
            <span>
              {fixing
                ? (fixAction === 'single' ? 'Changing code…' : 'Applying safe fixes…')
                : `Apply All Safe Fixes (${fixableTotal})`}
            </span>
          </button>
          {fixResult && (
            <button
              type="button"
              className="reanalyze-btn"
              onClick={reanalyzeFixed}
              disabled={reanalyzing}
            >
              {reanalyzing ? <Loader2 size={15} className="spinning" /> : <RefreshCw size={15} />}
              <span>Re-Analyze Fixed Code</span>
            </button>
          )}
          {fixableTotal > 0 && manualTotal > 0 && (
            <span className="fix-actions-hint">
              {manualTotal} {manualTotal === 1 ? 'issue needs' : 'issues need'} manual review — they are never auto-changed.
            </span>
          )}
        </div>

        {/* Comparison after a fix has been generated */}
        {fixResult && fixResult.results.length > 0 && (
          <div className="fix-comparison">
            <div className="fix-comparison-head">
              <span className="section-label">
                ORIGINAL VS FIXED ({fixResult.totals.files} {fixResult.totals.files === 1 ? 'file' : 'files'})
              </span>
              <span className="fix-summary-line">
                {fixResult.totals.fixesApplied} {fixResult.totals.fixesApplied === 1 ? 'fix' : 'fixes'} applied · {fixResult.totals.resolvedCount} {fixResult.totals.resolvedCount === 1 ? 'issue resolved' : 'issues resolved'} · {fixResult.totals.manualCount} {fixResult.totals.manualCount === 1 ? 'needs' : 'need'} manual review
              </span>
            </div>

            {fixResult.results.map((rf) => {
              const orig = uploadedSources[rf.name] || originals[rf.name] || '';
              const fixedChanged = new Set(rf.diff.fixedChanged || []);
              const originalChanged = new Set(rf.diff.originalChanged || []);
              const blocked = !!(rf.verification && rf.verification.blocked);
              const re = reanalyzed ? reanalyzed.results.find(x => x.name === rf.name) : null;
              return (
                <div key={rf.name} className="fix-compare-card">
                  <div className="fix-compare-title">
                    <FileText size={14} className="text-indigo" />
                    <span className="fix-compare-name">{rf.name}</span>
                    <span className="fix-compare-arrow">→</span>
                    <span className="fix-compare-fixed">{rf.fixedFileName}</span>
                    <div className="fix-compare-stats">
                      <span className="fix-stat fixable">{rf.beforeCount} → {rf.afterCount} issues</span>
                      {re && (
                        <span className="fix-stat verified">re-analysis confirms {re.total} issue{re.total === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>

                  {blocked && (
                    <div className="fix-blocked-note">
                      <ShieldAlert size={16} className="text-critical" />
                      <span>
                        Download blocked — sensitive content was detected in the fixed output
                        ({rf.verification.sensitive.join(', ')}). Review and clean the file before exporting it.
                      </span>
                    </div>
                  )}

                  <div className="fix-compare-code">
                    <CodeView content={orig} changedSet={originalChanged} label="ORIGINAL" />
                    <CodeView content={rf.fixedContent} changedSet={fixedChanged} label="FIXED" />
                  </div>

                  {rf.manualFixes && rf.manualFixes.length > 0 && (
                    <div className="fix-manual-list">
                      <div className="fix-manual-title">
                        <AlertTriangle size={14} className="text-muted" />
                        <span>Manual review required ({rf.manualFixes.length}) — these need human judgment:</span>
                      </div>
                      <div className="fix-manual-items">
                        {rf.manualFixes.map((m, i) => (
                          <span key={`${m.id}-${m.line}-${i}`} className="fix-manual-chip">
                            {m.id} · Line {m.line}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Original uploaded code — always shown so the user can see the exact
          source that was analyzed and compare it against the fixed output. */}
      <div className="original-code-section">
        <div className="section-label">ORIGINAL CODE ({result.files.length} {result.files.length === 1 ? 'file' : 'files'})</div>
        {result.files.length === 0 ? (
          <div className="skipped-note">No source code is available to display.</div>
        ) : (
          result.files.map((f) => {
            const content = uploadedSources[f.name] || '';
            return (
              <div key={f.name} className="original-code-card glass-card">
                <div className="original-code-head">
                  <FileText size={14} className="text-indigo" />
                  <span className="original-code-name">{f.name}</span>
                  <span className="original-code-meta">{f.issues} {f.issues === 1 ? 'issue' : 'issues'}</span>
                </div>
                <div className="original-code-body">
                  {content ? (
                    <CodeView content={content} changedSet={new Set()} label="ORIGINAL" />
                  ) : (
                    <div className="code-line"><span className="code-line-no">1</span><span className="code-line-text">(no source available for this file)</span></div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Files affected */}
      <div className="source-files-section">
        <div className="section-label">FILES ANALYZED ({result.files.length})</div>
        <div className="source-file-list">
          {result.files.map((f) => (
            <span key={f.name} className="source-file-chip">
              <FileText size={14} />
              <span className="sf-name">{f.name}</span>
              <span className="sf-meta">{f.issues} {f.issues === 1 ? 'issue' : 'issues'}</span>
            </span>
          ))}
        </div>
        {result.skipped && result.skipped.length > 0 && (
          <div className="skipped-note">
            Skipped {result.skipped.length} {result.skipped.length === 1 ? 'file' : 'files'}:
            {result.skipped.map(s => ` ${s.name} (${s.reason})`).join(';')}
          </div>
        )}
        {result.warnings && result.warnings.length > 0 && (
          <div className="skipped-note">
            {result.warnings.map((w) => `${w.file}: ${w.message}`).join('; ')}
          </div>
        )}
      </div>

      {/* Findings list */}
      <div className="findings-section">
        <div className="findings-header">
          <div className="findings-title-group">
            <h3 className="findings-main-title">Accessibility Findings</h3>
            <p className="findings-subtitle">
              Showing {result.findings.length} of {result.total} total issues
            </p>
          </div>
        </div>

        {result.findings.length === 0 ? (
          <div className="no-filtered-violations glass-card">
            <CheckCircle2 size={32} className="text-success" />
            <h4 className="no-violations-title">No accessibility issues found</h4>
            <p className="no-violations-desc">The uploaded source code passed the static accessibility checks.</p>
          </div>
        ) : (
          <div className="violations-list-wrapper">
            {result.findings.map((f, idx) => (
              <SourceFindingCard
                key={`${f.file}-${f.line}-${idx}`}
                finding={f}
                onChangeCode={fixing ? undefined : changeOne}
                changeBusy={fixing && fixAction === 'single'}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .source-results { display: flex; flex-direction: column; gap: 32px; margin-top: 8px; }
        .saved-to-history-note { display: flex; align-items: center; gap: 12px; padding: 16px 20px;
          border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.05); flex-wrap: wrap; }
        .saved-to-history-text { font-size: 13px; font-weight: 650; color: var(--success); flex: 1; }
        .view-history-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
          font-weight: 700; color: #fff; background: var(--primary); border: 1px solid #4f46e5;
          padding: 8px 14px; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .view-history-btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
        .source-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
        .source-summary-card { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
        .summary-big-number { font-size: 34px; font-weight: 850; color: #fff; line-height: 1; }
        .summary-big-label { font-size: 12px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
        .text-success { color: var(--success); }
        .summary-clean-label { font-size: 15px; font-weight: 750; color: var(--success); margin-top: 4px; }
        .summary-clean-sub { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
        .text-critical { color: var(--critical); }

        .fix-panel { padding: 24px; display: flex; flex-direction: column; gap: 16px;
          border-color: rgba(99,102,241,0.25); background: rgba(99,102,241,0.03); }
        .fix-panel-header { display: flex; align-items: flex-start; gap: 14px; }
        .fix-icon-wrap { width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
          display: flex; align-items: center; justify-content: center; }
        .fix-heading-block { display: flex; flex-direction: column; gap: 4px; }
        .fix-panel-title { font-size: 17px; font-weight: 800; margin: 0; }
        .fix-panel-sub { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.6; max-width: 760px; }
        .fix-error-note { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #fca5a5;
          background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); padding: 10px 14px; border-radius: var(--radius-sm); }
        .fix-per-file { display: flex; flex-direction: column; gap: 8px; }
        .fix-file-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
          padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .fix-file-row.has-fixed { border-color: rgba(16,185,129,0.35); }
        .fix-file-name { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono);
          font-weight: 650; font-size: 13px; color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fix-file-stats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .fix-stat { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
          padding: 3px 10px; border-radius: 9999px; }
        .fix-stat.fixable { color: var(--success); background: var(--success-bg); border: 1px solid rgba(16,185,129,0.25); }
        .fix-stat.manual { color: #fbbf24; background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.3); }
        .fix-stat.blocked { color: #fca5a5; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); }
        .fix-stat.clean { color: var(--text-muted); background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); }
        .fix-stat.verified { color: #93c5fd; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); }
        .fix-dl-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
          color: #a5b4fc; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3);
          padding: 6px 12px; border-radius: 9999px; cursor: pointer; transition: all var(--transition-fast); white-space: nowrap; }
        .fix-dl-btn:hover { background: rgba(99,102,241,0.22); color: #fff; }
        .fix-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .apply-all-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--primary);
          border: 1px solid #4f46e5; color: #fff; font-size: 13px; font-weight: 750; padding: 10px 18px;
          border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .apply-all-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .apply-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .reanalyze-btn { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700;
          color: var(--text-secondary); background: rgba(255,255,255,0.04); border: 1px solid var(--border-color);
          padding: 10px 18px; border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .reanalyze-btn:hover:not(:disabled) { color: var(--text-primary); border-color: rgba(99,102,241,0.4); }
        .reanalyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fix-actions-hint { font-size: 12px; color: var(--text-muted); font-weight: 600; }
        .spinning { animation: fixspin 0.8s linear infinite; }
        @keyframes fixspin { to { transform: rotate(360deg); } }

        .fix-comparison { display: flex; flex-direction: column; gap: 16px; border-top: 1px solid var(--border-color); padding-top: 16px; }
        .fix-comparison-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fix-summary-line { font-size: 12px; font-weight: 700; color: var(--success); }
        .fix-compare-card { display: flex; flex-direction: column; gap: 12px; }
        .fix-compare-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; font-weight: 750; }
        .fix-compare-name { font-family: var(--font-mono); color: var(--critical); }
        .fix-compare-arrow { color: var(--text-muted); }
        .fix-compare-fixed { font-family: var(--font-mono); color: var(--success); }
        .fix-compare-stats { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; }
        .fix-blocked-note { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #fca5a5;
          background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); padding: 10px 14px; border-radius: var(--radius-sm); }
        .fix-compare-code { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .code-view { display: flex; flex-direction: column; border: 1px solid var(--border-color);
          border-radius: var(--radius-md); overflow: hidden; background: var(--bg-input); min-width: 0; }
        .code-view-head { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: var(--text-muted);
          padding: 8px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color); }
        .code-view-body { max-height: 360px; overflow: auto; font-family: var(--font-mono); font-size: 12px; line-height: 1.55; }
        .code-line { display: flex; }
        .code-line.changed { background: rgba(251,191,36,0.12); }
        .code-line-no { flex-shrink: 0; width: 40px; text-align: right; padding: 0 10px;
          color: var(--text-muted); user-select: none; opacity: 0.7; }
        .code-line-text { white-space: pre; padding: 0 12px 0 6px; color: var(--text-primary); }
        .original-code-section { display: flex; flex-direction: column; gap: 12px; }
        .original-code-card { padding: 14px; display: flex; flex-direction: column; gap: 10px;
          border-color: var(--border-color); }
        .original-code-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 750;
          font-family: var(--font-mono); flex-wrap: wrap; }
        .original-code-name { color: var(--text-primary); }
        .original-code-meta { margin-left: auto; font-size: 11px; font-weight: 800; color: var(--text-muted); }
        .original-code-body { max-height: 420px; overflow: auto; background: var(--bg-input);
          border: 1px solid var(--border-color); border-radius: var(--radius-md); }
        .original-code-body .code-line-no { width: 38px; }
        .fix-manual-list { display: flex; flex-direction: column; gap: 8px;
          background: rgba(234,179,8,0.04); border: 1px solid rgba(234,179,8,0.2); padding: 12px 14px; border-radius: var(--radius-sm); }
        .fix-manual-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #fbbf24; }
        .fix-manual-items { display: flex; flex-wrap: wrap; gap: 8px; }
        .fix-manual-chip { font-size: 11px; font-weight: 700; color: var(--text-secondary); font-family: var(--font-mono);
          background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); padding: 3px 10px; border-radius: 9999px; }

        .source-files-section { display: flex; flex-direction: column; gap: 12px; }
        .section-label { font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; }
        .source-file-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .source-file-chip { display: inline-flex; align-items: center; gap: 8px; background: var(--bg-input);
          border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; }
        .sf-name { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
        .sf-meta { font-size: 11px; font-weight: 700; color: var(--text-muted); }
        .skipped-note { font-size: 12px; color: #fbbf24; background: rgba(234,179,8,0.06);
          border: 1px solid rgba(234,179,8,0.2); padding: 8px 12px; border-radius: var(--radius-sm); line-height: 1.4; }
        @media (max-width: 640px) {
          .source-summary-grid { grid-template-columns: repeat(2, 1fr); }
          .fix-compare-code { grid-template-columns: 1fr; }
          .fix-comparison-head { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

function CodeView({ content, changedSet, label }) {
  const lines = content.split(/\r\n|\r|\n/);
  return (
    <div className="code-view">
      <div className="code-view-head">{label}</div>
      <div className="code-view-body">
        {lines.map((ln, i) => (
          <div key={i} className={`code-line ${changedSet.has(i + 1) ? 'changed' : ''}`}>
            <span className="code-line-no">{i + 1}</span>
            <span className="code-line-text">{ln || ' '}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="code-line">
            <span className="code-line-no">1</span>
            <span className="code-line-text">(empty file)</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SourceFindingCard({ finding, onChangeCode, changeBusy }) {
  const [open, setOpen] = useState(false);
  const sev = finding.impact ? finding.impact.toLowerCase() : 'minor';
  const showLine = typeof finding.line === 'number' ? `Line ${finding.line}` : finding.line || 'Line: Not available';
  const fixable = finding.fixStatus === 'fixable';
  const canFix = onChangeCode && fixable;

  return (
    <div className={`violation-card-item glass-card ${open ? 'is-expanded' : ''}`}>
      <div className="card-clickable-header" onClick={() => setOpen(!open)} role="button" aria-expanded={open}>
        <div className="header-left-group">
          <span className={`badge ${sev}`}>{finding.impact}</span>
          <div className="title-and-rule">
            <h4 className="violation-help-title">{finding.help}</h4>
            <span className="rule-id-code">ID: {finding.id}</span>
          </div>
        </div>
        <div className="header-right-group">
          <span className={`conf-pill ${finding.confidence === 'definite' ? 'definite' : 'potential'}`}>
            {finding.confidence === 'definite' ? 'Definite' : 'Potential'}
          </span>
          {finding.fixStatus && (
            <span className={`fixstat-pill ${fixable ? 'fixable' : 'manual'}`}>
              {fixable ? 'Auto-Fixable' : 'Manual Fix'}
            </span>
          )}
          <span className="file-loc-badge">
            {finding.file} · {showLine}
          </span>
          <button type="button" className="toggle-expand-btn" aria-label={open ? "Collapse details" : "Expand details"}>
            {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="expanded-content">
          <div className="violation-description-block">
            <p className="description-label">PROBLEM</p>
            <p className="description-text">{finding.description}</p>
          </div>

          {finding.code && (
            <div className="code-block-wrap">
              <p className="description-label">CODE SNIPPET</p>
              <pre className="code-block"><code>{finding.code}</code></pre>
            </div>
          )}

          <div className="src-info-grid">
            <div className="src-info-item">
              <span className="src-info-label">FILE</span>
              <span className="src-info-value mono">{finding.file}</span>
            </div>
            <div className="src-info-item">
              <span className="src-info-label">LINE</span>
              <span className="src-info-value">{showLine}</span>
            </div>
            <div className="src-info-item">
              <span className="src-info-label">CATEGORY</span>
              <span className="src-info-value">{finding.category}</span>
            </div>
            <div className="src-info-item">
              <span className="src-info-label">CONFIDENCE</span>
              <span className="src-info-value">{finding.confidence}</span>
            </div>
          </div>

          {canFix && (
            <div className="one-fix-row">
              <button type="button" className="change-code-btn" onClick={() => onChangeCode(finding)} disabled={changeBusy}>
                {changeBusy ? <Loader2 size={14} className="spinning" /> : <Wrench size={14} />}
                <span>Change Code</span>
              </button>
              <span className="one-fix-hint">
                Auto-fix this finding and preview the corrected code below. Your original is never modified.
              </span>
            </div>
          )}

          <div className="plain-language-suggestion-box">
            <div className="suggestion-box-header">
              <BookOpen size={18} className="text-indigo" />
              <h5 className="suggestion-box-title">Access Check Fix</h5>
            </div>
            <div className="suggestion-grid">
              <div className="suggestion-col">
                <span className="sub-section-label">WHY IT MATTERS</span>
                <p className="suggestion-why-text">{finding.whyItMatters}</p>
              </div>
              <div className="suggestion-col">
                <span className="sub-section-label">HOW TO FIX</span>
                <p className="suggestion-fix-text">{finding.fix}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .conf-pill { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
          padding: 3px 9px; border-radius: 9999px; }
        .conf-pill.definite { color: var(--success); background: var(--success-bg); border: 1px solid rgba(16,185,129,0.25); }
        .conf-pill.potential { color: #fbbf24; background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.3); }
        .file-loc-badge { background-color: rgba(255,255,255,0.05); border: 1px solid var(--border-color);
          font-size: 11px; font-weight: 700; color: var(--text-secondary); padding: 4px 10px; border-radius: 9999px;
          font-family: var(--font-mono); }
        .code-block-wrap { display: flex; flex-direction: column; gap: 6px; }
        .src-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;
          background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; }
        .src-info-item { display: flex; flex-direction: column; gap: 4px; }
        .src-info-label { font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .src-info-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .src-info-value.mono { font-family: var(--font-mono); }
        .fixstat-pill { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
          padding: 3px 9px; border-radius: 9999px; white-space: nowrap; }
        .fixstat-pill.fixable { color: var(--success); background: var(--success-bg); border: 1px solid rgba(16,185,129,0.3); }
        .fixstat-pill.manual { color: #fbbf24; background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.3); }
        .one-fix-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.25); padding: 12px 14px; border-radius: var(--radius-sm); }
        .change-code-btn { display: inline-flex; align-items: center; gap: 7px; background: var(--primary);
          border: 1px solid #4f46e5; color: #fff; font-size: 13px; font-weight: 750; padding: 9px 16px;
          border-radius: var(--radius-md); transition: all var(--transition-fast); }
        .change-code-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .change-code-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .one-fix-hint { font-size: 12px; color: var(--text-muted); font-weight: 600; }
        @media (max-width: 768px) {
          .file-loc-badge { display: none; }
        }
      `}</style>
    </div>
  );
}
