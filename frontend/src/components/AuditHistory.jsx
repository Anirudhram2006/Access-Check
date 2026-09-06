import { useState, useEffect } from 'react';
import { Clock, ExternalLink, ArrowLeft, AlertTriangle, Globe, Calendar, Download, Loader2, FileCode2, Files, Code2, Wrench, Server } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import ViolationSummary from './ViolationSummary';
import WebsitePreview from './WebsitePreview';
import ViolationCard from './ViolationCard';
import { SourceFindingCard } from './SourceCodeAnalysis';
import { ApiResultView } from './ApiAnalysis';
import { calculateScore } from '../utils/score';

const BACKEND_URL = 'http://localhost:5000';

/**
 * AuditHistory Component
 * Displays user's past audits and individual audit details.
 * Reuses existing ScoreGauge, ViolationSummary, WebsitePreview, ViolationCard components.
 */
export default function AuditHistory() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const fetchAuditDetail = async (auditId) => {
    setDetailError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/audits/${auditId}`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        setDetailError('Session expired. Please log in again.');
        return;
      }
      if (response.status === 404) {
        setDetailError('Audit not found.');
        return;
      }
      if (response.status === 403) {
        setDetailError('You do not have access to this audit.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load audit details.');
      }
      const data = await response.json();
      setSelectedAudit(data);
    } catch (err) {
      setDetailError(err.message || 'Failed to load audit details.');
    }
  };

  const handleExportPdf = async (auditId) => {
    setPdfExporting(true);
    setPdfError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/audits/${auditId}/pdf`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        setPdfError('Session expired. Please log in again.');
        return;
      }
      if (response.status === 404) {
        setPdfError('Audit not found.');
        return;
      }
      if (response.status === 403) {
        setPdfError('You do not have access to this audit.');
        return;
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate PDF.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `access-check-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setPdfError(err.message || 'Failed to export PDF.');
    } finally {
      setPdfExporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${BACKEND_URL}/api/audits`, {
          credentials: 'include'
        });
        if (cancelled) return;
        if (response.status === 401) {
          setError('Session expired. Please log in again.');
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to load audit history.');
        }
        const data = await response.json();
        if (!cancelled) setAudits(data.audits || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load audit history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  // Detail view
  if (selectedAudit) {
    const detailViolations = selectedAudit.violations || [];

    // ------------------------------------------------
    // Source Code Analysis detail (data read from the
    // stored record — the analysis is never re-run)
    // ------------------------------------------------
    if (selectedAudit.auditType === 'source-code') {
      const sourceFiles = Array.isArray(selectedAudit.sourceFiles) ? selectedAudit.sourceFiles : [];
      const primaryName = sourceFiles.length > 0 ? sourceFiles[0].name : selectedAudit.scannedUrl || 'Source analysis';
      const fileTypes = [...new Set(sourceFiles.map(f => f.type).filter(Boolean))].join(', ') || 'Unknown';
      const fixableCount = detailViolations.filter(v => v && v.fixStatus === 'fixable').length;
      const manualCount = detailViolations.length - fixableCount;

      return (
        <div className="history-detail-container container">
          <button className="history-back-btn" onClick={() => { setSelectedAudit(null); setPdfError(''); }}>
            <ArrowLeft size={16} />
            <span>Back to History</span>
          </button>

          <div className="history-detail-header glass-card">
            <div className="history-detail-url">
              <FileCode2 size={16} className="text-indigo" />
              <span className="history-detail-title-line">
                <span className="history-detail-title-label">SOURCE CODE ANALYSIS</span>
                <span className="history-detail-title-value">{primaryName}</span>
              </span>
            </div>
            <div className="history-detail-actions">
              <button
                type="button"
                className="export-pdf-btn"
                onClick={() => handleExportPdf(selectedAudit.id)}
                disabled={pdfExporting}
              >
                {pdfExporting ? (
                  <>
                    <Loader2 size={14} className="spinning" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Export PDF</span>
                  </>
                )}
              </button>
              <div className="history-detail-meta">
                <Calendar size={14} />
                <span>{formatDate(selectedAudit.createdAt)}</span>
              </div>
            </div>
          </div>

          {detailError && (
            <div className="history-detail-error glass-card">
              <AlertTriangle size={16} />
              <span>{detailError}</span>
            </div>
          )}

          {pdfError && (
            <div className="history-detail-error glass-card">
              <AlertTriangle size={16} />
              <span>{pdfError}</span>
            </div>
          )}

          {!detailError && (
            <div className="history-detail-results">
              <ScoreGauge score={selectedAudit.score} />
              <ViolationSummary violations={detailViolations} />

              {detailViolations.length > 0 && (
                <div className="history-fix-readiness glass-card">
                  <Wrench size={15} className="text-indigo" />
                  <span className="fix-readiness-label">FIX STATUS</span>
                  <span className="fix-readiness-pill fixable">{fixableCount} auto-fixable</span>
                  <span className="fix-readiness-pill manual">{manualCount} manual</span>
                  <span className="fix-readiness-note">
                    Change Code can generate the auto-fixable ones automatically when you re-analyze the same files.
                  </span>
                </div>
              )}

              <div className="source-files-analyzed glass-card">
                <div className="history-source-files-header">
                  <Files size={16} className="text-indigo" />
                  <span className="history-source-files-title">
                    FILES ANALYZED ({sourceFiles.length})
                  </span>
                </div>
                <div className="history-source-file-chips">
                  {sourceFiles.map(f => (
                    <span key={f.name} className="history-source-file-chip">
                      <Code2 size={13} />
                      <span className="hsf-name">{f.name}</span>
                      <span className="hsf-meta">{f.type}</span>
                      <span className="hsf-meta">{f.issues} {f.issues === 1 ? 'issue' : 'issues'}</span>
                    </span>
                  ))}
                </div>
                {fileTypes && (
                  <div className="history-source-filetype">
                    File type(s): {fileTypes}
                  </div>
                )}
              </div>

              <div className="history-violations-list">
                <h3 className="history-violations-title">
                  <AlertTriangle size={16} />
                  Findings ({detailViolations.length})
                </h3>
                {detailViolations.length === 0 ? (
                  <div className="history-no-violations glass-card">
                    No accessibility issues found in the analyzed source code. Great job!
                  </div>
                ) : (
                  detailViolations.map((f, i) => (
                    <SourceFindingCard key={`${f.id}-${f.file}-${i}`} finding={f} />
                  ))
                )}
              </div>
            </div>
          )}

          <style>{`
            .history-detail-container {
              padding: 40px 24px 80px;
              max-width: 900px;
            }
            .history-back-btn {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 600;
              color: var(--text-secondary);
              background: rgba(255,255,255,0.04);
              border: 1px solid var(--border-color);
              border-radius: var(--radius-sm);
              cursor: pointer;
              margin-bottom: 24px;
              transition: all var(--transition-fast);
            }
            .history-back-btn:hover {
              color: var(--text-primary);
              background: rgba(255,255,255,0.08);
            }
            .history-detail-header {
              padding: 24px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
            }
            .history-detail-url {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 15px;
              font-weight: 700;
              color: var(--text-primary);
              word-break: break-all;
              min-width: 0;
            }
            .history-detail-title-line {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;
            }
            .history-detail-title-label {
              font-size: 10px;
              font-weight: 800;
              color: var(--primary);
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .history-detail-title-value {
              font-family: var(--font-mono);
              font-size: 15px;
              font-weight: 700;
              word-break: break-all;
            }
            .history-detail-actions {
              display: flex;
              align-items: center;
              gap: 16px;
              flex-shrink: 0;
            }
            .export-pdf-btn {
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 700;
              color: #ffffff;
              background: #6366F1;
              border: 1px solid #4F46E5;
              border-radius: var(--radius-sm);
              cursor: pointer;
              transition: all var(--transition-fast);
              white-space: nowrap;
            }
            .export-pdf-btn:hover:not(:disabled) {
              background: #4F46E5;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }
            .export-pdf-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
            .export-pdf-btn .spinning {
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .history-detail-meta {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 13px;
              color: var(--text-muted);
            }
            .history-detail-error {
              padding: 16px;
              display: flex;
              align-items: center;
              gap: 8px;
              color: #fca5a5;
              margin-bottom: 24px;
            }
            .history-detail-results {
              display: flex;
              flex-direction: column;
              gap: 24px;
            }
            .history-fix-readiness {
              padding: 16px 20px;
              display: flex;
              align-items: center;
              gap: 10px;
              flex-wrap: wrap;
              border-color: rgba(99,102,241,0.25);
              background: rgba(99,102,241,0.04);
            }
            .fix-readiness-label {
              font-size: 10px;
              font-weight: 800;
              color: var(--text-muted);
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .fix-readiness-pill {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              padding: 3px 10px;
              border-radius: 9999px;
            }
            .fix-readiness-pill.fixable {
              color: var(--success);
              background: var(--success-bg);
              border: 1px solid rgba(16,185,129,0.3);
            }
            .fix-readiness-pill.manual {
              color: #fbbf24;
              background: rgba(234,179,8,0.08);
              border: 1px solid rgba(234,179,8,0.3);
            }
            .fix-readiness-note {
              font-size: 12px;
              color: var(--text-secondary);
              font-weight: 600;
              margin-left: auto;
              white-space: normal;
            }
            .source-files-analyzed {
              padding: 24px;
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            .history-source-files-header {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .history-source-files-title {
              font-size: 11px;
              font-weight: 800;
              color: var(--text-muted);
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .history-source-file-chips {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .history-source-file-chip {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: var(--bg-input);
              border: 1px solid var(--border-color);
              padding: 8px 12px;
              border-radius: var(--radius-sm);
              font-size: 12px;
            }
            .hsf-name {
              font-family: var(--font-mono);
              font-weight: 600;
              color: var(--text-primary);
            }
            .hsf-meta {
              font-size: 11px;
              font-weight: 700;
              color: var(--text-muted);
              text-transform: uppercase;
            }
            .history-source-filetype {
              font-size: 12px;
              color: var(--text-secondary);
              font-weight: 600;
              word-break: break-all;
            }
            .history-violations-title {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 16px;
              font-weight: 800;
              color: var(--text-primary);
              margin-bottom: 16px;
            }
            .history-no-violations {
              padding: 24px;
              text-align: center;
              color: #22c55e;
              font-weight: 600;
              font-size: 14px;
            }
          `}</style>
        </div>
      );
    }

    // API Analysis detail (the stored analysis is a single result object)
    if (selectedAudit.auditType === 'api-analysis') {
      const analysis = selectedAudit.violations; // the analysis result object
      return (
        <div className="history-detail-container container">
          <button className="history-back-btn" onClick={() => { setSelectedAudit(null); setPdfError(''); }}>
            <ArrowLeft size={16} />
            <span>Back to History</span>
          </button>

          <div className="history-detail-header glass-card">
            <div className="history-detail-url">
              <Server size={16} className="text-indigo" />
              <span className="history-detail-title-line">
                <span className="history-detail-title-label">API ANALYSIS</span>
                <span className="history-detail-title-value">{selectedAudit.scannedUrl}</span>
              </span>
            </div>
            <div className="history-detail-meta">
              <Calendar size={14} />
              <span>{formatDate(selectedAudit.createdAt)}</span>
            </div>
          </div>

          {detailError && (
            <div className="history-detail-error glass-card">
              <AlertTriangle size={16} />
              <span>{detailError}</span>
            </div>
          )}

          {!detailError && (
            <ApiResultView result={analysis} />
          )}

          <style>{`
            .history-detail-container {
              padding: 40px 24px 80px;
              max-width: 900px;
            }
            .history-back-btn {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 600;
              color: var(--text-secondary);
              background: rgba(255,255,255,0.04);
              border: 1px solid var(--border-color);
              border-radius: var(--radius-sm);
              cursor: pointer;
              margin-bottom: 24px;
              transition: all var(--transition-fast);
            }
            .history-back-btn:hover {
              color: var(--text-primary);
              background: rgba(255,255,255,0.08);
            }
            .history-detail-header {
              padding: 24px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
            }
            .history-detail-url {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 15px;
              font-weight: 700;
              color: var(--text-primary);
              word-break: break-all;
              min-width: 0;
            }
            .history-detail-title-line {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;
            }
            .history-detail-title-label {
              font-size: 10px;
              font-weight: 800;
              color: var(--primary);
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .history-detail-title-value {
              font-family: var(--font-mono);
              font-size: 15px;
              font-weight: 700;
              word-break: break-all;
            }
            .history-detail-meta {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 13px;
              color: var(--text-muted);
            }
            .history-detail-error {
              padding: 16px;
              display: flex;
              align-items: center;
              gap: 8px;
              color: #fca5a5;
              margin-bottom: 24px;
            }
          `}</style>
        </div>
      );
    }

    // Website audit detail (unchanged behaviour)
    return (
      <div className="history-detail-container container">
        <button className="history-back-btn" onClick={() => { setSelectedAudit(null); setPdfError(''); }}>
          <ArrowLeft size={16} />
          <span>Back to History</span>
        </button>

        <div className="history-detail-header glass-card">
          <div className="history-detail-url">
            <Globe size={16} className="text-indigo" />
            <span>{selectedAudit.scannedUrl}</span>
          </div>
          <div className="history-detail-actions">
            <button
              type="button"
              className="export-pdf-btn"
              onClick={() => handleExportPdf(selectedAudit.id)}
              disabled={pdfExporting}
            >
              {pdfExporting ? (
                <>
                  <Loader2 size={14} className="spinning" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Export PDF</span>
                </>
              )}
            </button>
            <div className="history-detail-meta">
              <Calendar size={14} />
              <span>{formatDate(selectedAudit.createdAt)}</span>
            </div>
          </div>
        </div>

        {detailError && (
          <div className="history-detail-error glass-card">
            <AlertTriangle size={16} />
            <span>{detailError}</span>
          </div>
        )}

        {pdfError && (
          <div className="history-detail-error glass-card">
            <AlertTriangle size={16} />
            <span>{pdfError}</span>
          </div>
        )}

        {!detailError && (
          <div className="history-detail-results">
            <ScoreGauge score={calculateScore(detailViolations)} />
            <ViolationSummary violations={detailViolations} />
            {selectedAudit.screenshotUrl && (
              <WebsitePreview
                url={selectedAudit.scannedUrl}
                screenshotPath={selectedAudit.screenshotUrl}
              />
            )}
            <div className="history-violations-list">
              <h3 className="history-violations-title">
                <AlertTriangle size={16} />
                Findings ({detailViolations.length})
              </h3>
              {detailViolations.length === 0 ? (
                <div className="history-no-violations glass-card">
                  No accessibility violations found. Great job!
                </div>
              ) : (
                detailViolations.map((v, i) => (
                  <ViolationCard key={`${v.id}-${i}`} violation={v} index={i} />
                ))
              )}
            </div>
          </div>
        )}

        <style>{`
          .history-detail-container {
            padding: 40px 24px 80px;
            max-width: 900px;
          }
          .history-back-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
            background: rgba(255,255,255,0.04);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            cursor: pointer;
            margin-bottom: 24px;
            transition: all var(--transition-fast);
          }
          .history-back-btn:hover {
            color: var(--text-primary);
            background: rgba(255,255,255,0.08);
          }
          .history-detail-header {
            padding: 24px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
          }
          .history-detail-url {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
            word-break: break-all;
          }
          .history-detail-actions {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
          }
          .export-pdf-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            background: #6366F1;
            border: 1px solid #4F46E5;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all var(--transition-fast);
            white-space: nowrap;
          }
          .export-pdf-btn:hover:not(:disabled) {
            background: #4F46E5;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          .export-pdf-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .export-pdf-btn .spinning {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .history-detail-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: var(--text-muted);
          }
          .history-detail-error {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #fca5a5;
            margin-bottom: 24px;
          }
          .history-detail-results {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .history-violations-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            font-weight: 800;
            color: var(--text-primary);
            margin-bottom: 16px;
          }
          .history-no-violations {
            padding: 24px;
            text-align: center;
            color: #22c55e;
            font-weight: 600;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  // List view
  return (
    <div className="history-page-container container">
      <div className="history-page-header">
        <h2 className="history-page-title">
          <Clock size={22} className="text-indigo" />
          Audit History
        </h2>
      </div>

      {loading && (
        <div className="history-loading glass-card">
          <span className="animate-pulse">Loading audit history...</span>
        </div>
      )}

      {!loading && error && (
        <div className="history-error glass-card">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && audits.length === 0 && (
        <div className="history-empty glass-card">
          <Clock size={40} className="text-muted" />
          <h3>No audits yet</h3>
          <p>Scan a website or analyze source code to see your audit history here.</p>
        </div>
      )}

      {!loading && !error && audits.length > 0 && (
        <div className="history-list">
          {audits.map(audit => {
            const isSource = audit.audit_type === 'source-code';
            const isApi = audit.audit_type === 'api-analysis';
            const sourceFiles = Array.isArray(audit.source_files) ? audit.source_files : [];
            const label = isSource
              ? (sourceFiles.length > 0 ? sourceFiles[0].name : audit.scanned_url)
              : audit.scanned_url;
            const countLabel = isSource
              ? `${audit.violation_count} issue${audit.violation_count !== 1 ? 's' : ''}`
              : `${audit.violation_count} violation${audit.violation_count !== 1 ? 's' : ''}`;
            const chipClass = isSource ? 'source' : (isApi ? 'api' : 'website');
            const chipLabel = isSource ? 'SOURCE CODE ANALYSIS' : (isApi ? 'API ANALYSIS' : 'WEBSITE AUDIT');
            return (
              <button
                key={audit.id}
                className="history-card glass-card"
                onClick={() => fetchAuditDetail(audit.id)}
              >
                <div className="history-card-main">
                  <div className="history-card-type-row">
                    <span className={`history-type-chip ${chipClass}`}>
                      {chipLabel}
                    </span>
                    {isSource && sourceFiles.length > 0 && (
                      <span className="history-file-count">
                        {sourceFiles.length} {sourceFiles.length === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </div>
                  <div className="history-card-url">
                    {isSource
                      ? <FileCode2 size={14} className="text-indigo" />
                      : isApi
                        ? <Server size={14} className="text-indigo" />
                        : <Globe size={14} className="text-indigo" />}
                    <span>{label}</span>
                  </div>
                  <div className="history-card-date">
                    <Calendar size={12} />
                    <span>{formatDate(audit.created_at)}</span>
                  </div>
                </div>
                <div className="history-card-stats">
                  {isApi ? (
                    <span className="history-card-api-view">View</span>
                  ) : (
                    <>
                      <div
                        className="history-card-score"
                        style={{ color: getScoreColor(audit.score) }}
                      >
                        {audit.score}
                      </div>
                      <div className="history-card-violations">
                        <AlertTriangle size={12} />
                        <span>{countLabel}</span>
                      </div>
                    </>
                  )}
                  <ExternalLink size={14} className="text-muted" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        .history-page-container {
          padding: 40px 24px 80px;
          max-width: 800px;
        }
        .history-page-header {
          margin-bottom: 32px;
        }
        .history-page-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 850;
          margin: 0;
        }
        .history-loading, .history-error {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
        }
        .history-error {
          color: #fca5a5;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .history-empty {
          padding: 60px 40px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .history-empty h3 {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
        }
        .history-empty p {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .history-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          text-align: left;
          cursor: pointer;
          transition: all var(--transition-fast);
          width: 100%;
          border: 1px solid var(--border-color);
        }
        .history-card:hover {
          border-color: rgba(99, 102, 241, 0.3);
          background: rgba(99, 102, 241, 0.03);
        }
        .history-card-main {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .history-card-type-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .history-type-chip {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 9999px;
          width: fit-content;
        }
        .history-type-chip.website {
          color: var(--minor);
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .history-type-chip.source {
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }
        .history-type-chip.api {
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .history-card-api-view {
          font-size: 13px;
          font-weight: 800;
          color: #34d399;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .history-file-count {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
        }
        .history-card-url {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .history-card-date {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .history-card-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
          margin-left: 16px;
        }
        .history-card-score {
          font-size: 22px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .history-card-violations {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
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
          .history-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .history-card-stats {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
