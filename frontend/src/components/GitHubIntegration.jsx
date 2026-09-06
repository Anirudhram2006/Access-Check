import { useState, useEffect } from 'react';
import { GitBranch, Loader2, Folder, FolderGit2, FileText, ArrowLeft, RefreshCw, Unplug, Info, AlertTriangle, CheckCircle2, FileCode2, Files, Link2, Lock, Globe, Play, MonitorPlay } from 'lucide-react';
import { SourceResults } from './SourceCodeAnalysis';
import { DEMO_USERNAME, DEMO_REPOS, getDemoDirEntries, getDemoFileContent } from '../utils/demoGitHubData';

const BACKEND_URL = 'http://localhost:5000';

const SUPPORTED_EXT = new Set(['html', 'htm', 'jsx', 'js', 'ts', 'tsx', 'css']);

function extOf(name) {
  const parts = String(name || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

// Parses OAuth callback params (?github=connected&username=... or ?github=error&error=...)
// exactly once during initial render and clears them from the URL.
function parseCallbackBanner() {
  const params = new URLSearchParams(window.location.search);
  const gh = params.get('github');
  if (!gh) return null;
  window.history.replaceState({}, '', window.location.pathname);
  if (gh === 'connected') {
    const u = params.get('username') || '';
    return { kind: 'success', text: u ? `Successfully connected to GitHub as @${u}.` : 'Successfully connected to GitHub.' };
  }
  if (gh === 'error') {
    const reason = params.get('error') || 'unknown';
    const msg = {
      denied: 'You denied the GitHub authorization request. No connection was created.',
      'invalid-state': 'The OAuth request was invalid (state mismatch). This can happen if the page was reloaded mid-flow. Please try again.',
      'no-code': 'GitHub did not return an authorization code. Please try again.',
      'invalid-code': 'The authorization code from GitHub was invalid or expired. Please try again.',
      'token-exchange-failed': 'Could not exchange the authorization code with GitHub. Please try again later.',
      'profile-failed': 'Could not retrieve your GitHub profile after authorization.',
      'session-lost': 'Your session expired during the GitHub authorization. Please log in and try again.',
      'save-failed': 'Could not save the GitHub connection. Please try again.',
      'not-configured': 'GitHub OAuth is not configured on the server.'
    }[reason] || 'GitHub authorization could not be completed. Please try again.';
    return { kind: 'error', text: msg };
  }
  return null;
}

/**
 * GitHubIntegration Component
 * Lets an authenticated user connect their GitHub account, browse repositories
 * and files, and analyze a supported source file using the EXISTING source-code
 * analysis pipeline (identical results/format to manual uploads).
 */
export default function GitHubIntegration({ onViewHistory }) {
  const [statusLoading, setStatusLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [configured, setConfigured] = useState(true);
  const [banner, setBanner] = useState(() => parseCallbackBanner());
  const [error, setError] = useState('');

  // Repo browsing state
  const [repos, setRepos] = useState(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null); // { owner, name, full_name }
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState(null);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Branch selection state
  const [branches, setBranches] = useState(null);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  // Demo mode state
  const [demoMode, setDemoMode] = useState(false);
  const [demoConnected, setDemoConnected] = useState(false);
  const [demoSelectedRepo, setDemoSelectedRepo] = useState(null);
  const [demoPath, setDemoPath] = useState('');
  const [demoEntries, setDemoEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      setStatusLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/github/status`, { credentials: 'include' });
        if (cancelled) return;
        if (response.status === 401) {
          setError('Your session has expired. Please log in again.');
          return;
        }
        const data = await response.json();
        setConnected(!!data.connected);
        setConfigured(data.configured !== false);
        setUsername(data.githubUsername || '');
        if (data.connected) loadRepos();
      } catch {
        if (!cancelled) setError('The Access Check backend server appears to be offline.');
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    loadStatus();
    return () => { cancelled = true; };
  }, []);

  async function loadRepos() {
    setReposLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/github/repos`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        setRepos([]);
        setError(data.message || data.error || 'Could not load your repositories.');
        return;
      }
      setRepos(data.repos || []);
    } catch {
      setError('Could not load your repositories.');
    } finally {
      setReposLoading(false);
    }
  }

  const handleConnect = async () => {
    setError('');
    setBanner(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/github/auth`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || data.error || 'Could not start GitHub authorization.');
        return;
      }
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }
    } catch {
      setError('Could not reach the backend to start GitHub authorization.');
    }
  };

  const handleDisconnect = async () => {
    setError('');
    try {
      await fetch(`${BACKEND_URL}/api/github/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch { /* best effort; clear UI state regardless */ }
    setConnected(false);
    setUsername('');
    setRepos(null);
    setSelectedRepo(null);
    setEntries(null);
    setBranches(null);
    setSelectedBranch('');
    setBranchError('');
    setAnalysisResult(null);
    setAnalysisError('');
    setBanner(null);
  };

  const handleSelectRepo = (repo) => {
    setSelectedRepo({ owner: repo.owner, name: repo.name, full_name: repo.full_name, private: repo.private, description: repo.description, default_branch: repo.default_branch });
    setPath('');
    setEntries(null);
    setSelectedBranch(repo.default_branch || '');
    setBranchError('');
    setAnalysisResult(null);
    setAnalysisError('');
    loadBranches(repo.owner, repo.name);
    loadContents(repo.owner, repo.name, '', repo.default_branch || '');
  };

  const handleBackToRepos = () => {
    setSelectedRepo(null);
    setPath('');
    setEntries(null);
    setBranches(null);
    setSelectedBranch('');
    setBranchError('');
    setAnalysisResult(null);
    setAnalysisError('');
  };

  const loadBranches = async (owner, name) => {
    setBranchesLoading(true);
    setBranches(null);
    setBranchError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        setBranches([]);
        setBranchError(data.message || data.error || 'Could not load branches for this repository.');
        return;
      }
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
      setBranchError('Could not load branches for this repository.');
    } finally {
      setBranchesLoading(false);
    }
  };

  const onBranchChange = (branch) => {
    if (!selectedRepo || !branch || branch === selectedBranch) return;
    setSelectedBranch(branch);
    setPath('');
    setEntries(null);
    setAnalysisResult(null);
    setAnalysisError('');
    setBranchError('');
    loadContents(selectedRepo.owner, selectedRepo.name, '', branch);
  };

  const loadContents = async (owner, name, dirPath, branch) => {
    setEntriesLoading(true);
    setError('');
    setEntries(null);
    try {
      const params = new URLSearchParams();
      if (dirPath) params.set('path', dirPath);
      if (branch) params.set('ref', branch);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${BACKEND_URL}/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents${qs}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        setEntries([]);
        setError(data.message || data.error || 'Could not list this directory.');
        return;
      }
      setPath(dirPath || '');
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
      setError('Could not list this directory.');
    } finally {
      setEntriesLoading(false);
    }
  };

  const openDir = (entry) => {
    const nextPath = path ? `${path}/${entry.path.split('/').pop()}` : entry.path;
    loadContents(selectedRepo.owner, selectedRepo.name, nextPath, selectedBranch);
  };

  const goUp = () => {
    const parts = path.split('/');
    parts.pop();
    const parent = parts.join('/');
    loadContents(selectedRepo.owner, selectedRepo.name, parent, selectedBranch);
  };

  const handleAnalyzeFile = async (entry) => {
    const ext = extOf(entry.name);
    if (!SUPPORTED_EXT.has(ext)) {
      setAnalysisError('Unsupported file type. Supported: HTML, JSX, JS, TS, TSX, CSS.');
      return;
    }
    if (entry.size > 1024 * 1024) {
      setAnalysisError('This file is larger than the 1 MB limit and was not loaded.');
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError('');
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('path', entry.path);
      if (selectedBranch) params.set('ref', selectedBranch);
      const response = await fetch(
        `${BACKEND_URL}/api/github/repos/${encodeURIComponent(selectedRepo.owner)}/${encodeURIComponent(selectedRepo.name)}/file?${params.toString()}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Could not load this file from GitHub.');
      }
      const fileName = entry.name;
      const file = new File([data.content], fileName, { type: 'text/plain' });

      // Reuse the EXISTING source-code analysis pipeline — identical to manual upload.
      const formData = new FormData();
      formData.append('files', file, fileName);
      const analysisResponse = await fetch(`${BACKEND_URL}/api/source-analysis`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const analysisData = await analysisResponse.json();
      if (!analysisResponse.ok) {
        throw new Error(analysisData.error || 'The analysis could not be completed.');
      }
      setAnalysisResult({ result: analysisData, file });
    } catch (err) {
      const msg = err.message && err.message.includes('Failed to fetch')
        ? 'The Access Check backend server appears to be offline.'
        : err.message;
      setAnalysisError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Demo mode handlers ──────────────────────────────────────────────
  const enterDemoMode = () => {
    setDemoMode(true);
    setDemoConnected(true);
    setStatusLoading(false);
    setConfigured(false);
    setConnected(false);
    setError('');
  };

  const exitDemoMode = () => {
    setDemoMode(false);
    setDemoConnected(false);
    setDemoSelectedRepo(null);
    setDemoPath('');
    setDemoEntries(null);
    setAnalysisResult(null);
    setAnalysisError('');
  };

  const handleDemoSelectRepo = (repo) => {
    setDemoSelectedRepo(repo);
    setDemoPath('');
    setDemoEntries(null);
    setAnalysisResult(null);
    setAnalysisError('');
    loadDemoContents(repo.name, '');
  };

  const loadDemoContents = (repoName, dirPath) => {
    const entries = getDemoDirEntries(repoName, dirPath);
    setDemoPath(dirPath || '');
    setDemoEntries(entries);
  };

  const openDemoDir = (entry) => {
    const nextPath = demoPath ? `${demoPath}/${entry.name}` : entry.name;
    loadDemoContents(demoSelectedRepo.name, nextPath);
  };

  const goDemoUp = () => {
    const parts = demoPath.split('/');
    parts.pop();
    loadDemoContents(demoSelectedRepo.name, parts.join('/'));
  };

  const handleDemoAnalyzeFile = async (entry) => {
    const ext = extOf(entry.name);
    if (!SUPPORTED_EXT.has(ext)) {
      setAnalysisError('Unsupported file type. Supported: HTML, JSX, JS, TS, TSX, CSS.');
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError('');
    setError('');
    try {
      const content = getDemoFileContent(demoSelectedRepo.name, entry.path);
      if (!content) {
        throw new Error('Could not load this file from the demo repository.');
      }
      const file = new File([content], entry.name, { type: 'text/plain' });
      const formData = new FormData();
      formData.append('files', file, entry.name);
      const analysisResponse = await fetch(`${BACKEND_URL}/api/source-analysis`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const analysisData = await analysisResponse.json();
      if (!analysisResponse.ok) {
        throw new Error(analysisData.error || 'The analysis could not be completed.');
      }
      setAnalysisResult({ result: analysisData, file });
    } catch (err) {
      const msg = err.message && err.message.includes('Failed to fetch')
        ? 'The Access Check backend server appears to be offline.'
        : err.message;
      setAnalysisError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const crumbs = demoMode ? demoPath.split('/').filter(Boolean) : path.split('/').filter(Boolean);

  return (
    <div className="gh-container container">
      <div className="gh-page-header">
        <h2 className="gh-title">
          <GitBranch size={22} className="text-indigo" />
          GitHub Integration
        </h2>
        <p className="gh-subtitle">
          Connect your GitHub account to browse repositories and analyze source files
          with the existing Access Check source-code analyzer.
        </p>
      </div>

      {banner && (
        <div className={`gh-banner ${banner.kind === 'success' ? 'success' : 'error'}`}>
          {banner.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      {error && (
        <div className="gh-error glass-card">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {statusLoading && (
        <div className="gh-loading glass-card">
          <Loader2 size={20} className="spinning" />
          <span className="animate-pulse">Checking GitHub connection...</span>
        </div>
      )}

      {!statusLoading && (
        <>
          {/* Simulation Mode badge */}
          {demoMode && (
            <div className="gh-demo-badge glass-card">
              <MonitorPlay size={18} />
              <div className="gh-demo-badge-text">
                <span className="gh-demo-badge-label">SIMULATION MODE</span>
                <span className="gh-demo-badge-desc">
                  You are browsing a simulated GitHub workspace. Files are pre-built demo sources with real accessibility issues — analysis uses the same pipeline as real uploads.
                </span>
              </div>
              <button type="button" className="gh-demo-exit-btn" onClick={exitDemoMode}>
                <Unplug size={14} />
                <span>Exit Demo</span>
              </button>
            </div>
          )}

          {/* ---------- Not connected ---------- */}
          {!connected && !demoConnected && (
            <div className="gh-connect-card glass-card">
              <div className="gh-connect-icon">
                <GitBranch size={30} />
              </div>
              <h3 className="gh-connect-title">Connect GitHub</h3>
              <p className="gh-connect-sub">
                Connect your GitHub account to securely browse your repositories and run
                the existing source-code accessibility analysis on any supported file.
              </p>

              {configured ? (
                <button type="button" className="gh-connect-btn" onClick={handleConnect}>
                  <Link2 size={16} />
                  <span>Connect GitHub</span>
                </button>
              ) : (
                <>
                  <button type="button" className="gh-connect-btn" onClick={handleConnect}>
                    <Link2 size={16} />
                    <span>Connect GitHub</span>
                  </button>
                  <div className="gh-not-configured glass-card">
                    <Info size={16} />
                    <div>
                      <strong>GitHub OAuth is not configured on the server.</strong>
                      <p>
                        Set the <span className="mono">GITHUB_CLIENT_ID</span> and{' '}
                        <span className="mono">GITHUB_CLIENT_SECRET</span> environment variables,
                        then restart the backend to enable GitHub connection.
                      </p>
                    </div>
                  </div>
                  <div className="gh-demo-divider">
                    <span className="gh-demo-divider-line"></span>
                    <span className="gh-demo-divider-text">or</span>
                    <span className="gh-demo-divider-line"></span>
                  </div>
                  <button type="button" className="gh-demo-btn" onClick={enterDemoMode}>
                    <Play size={16} />
                    <span>Try Demo Mode</span>
                  </button>
                  <p className="gh-demo-hint">
                    Explore GitHub integration with a pre-built demo workspace — no account needed.
                  </p>
                </>
              )}

              {!configured && (
                <p className="gh-connect-note">
                  You will be redirected to GitHub to authorize. Only your connected account's
                  repositories are ever accessible — never another user's.
                </p>
              )}
            </div>
          )}

          {/* ---------- Demo mode connected ---------- */}
          {!connected && demoConnected && !analysisResult && (
            <>
              <div className="gh-connected-bar glass-card gh-demo-connected-bar">
                <div className="gh-connected-identity">
                  <div className="gh-avatar">
                    <MonitorPlay size={16} />
                  </div>
                  <div className="gh-connected-text">
                    <span className="gh-connected-label">SIMULATION MODE</span>
                    <span className="gh-connected-user">@{DEMO_USERNAME}</span>
                  </div>
                </div>
                <button type="button" className="gh-disconnect-btn" onClick={exitDemoMode}>
                  <Unplug size={15} />
                  <span>Exit Demo</span>
                </button>
              </div>

              {/* Demo repository grid */}
              <div className="gh-section">
                <div className="gh-section-head">
                  <Files size={16} className="text-indigo" />
                  <span className="gh-section-label">
                    {demoSelectedRepo ? demoSelectedRepo.full_name : 'Select a Repository'}
                  </span>
                </div>

                {demoEntries === null && !demoSelectedRepo && (
                  <div className="gh-repo-grid">
                    {DEMO_REPOS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="gh-repo-card glass-card"
                        onClick={() => handleDemoSelectRepo(r)}
                      >
                        <div className="gh-repo-top">
                          <FolderGit2 size={18} className="text-indigo" />
                          <span className={`gh-repo-vis ${r.private ? 'private' : 'public'}`}>
                            {r.private ? <Lock size={11} /> : <Globe size={11} />}
                            {r.private ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <div className="gh-repo-name">{r.name}</div>
                        {r.description && <div className="gh-repo-desc">{r.description}</div>}
                        <span className="gh-repo-open">Browse Files →</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Demo file browser */}
                {demoSelectedRepo && (
                  <div className="gh-filebrowser">
                    <div className="gh-crumbs">
                      <button type="button" className="gh-crumb" onClick={() => loadDemoContents(demoSelectedRepo.name, '')}>
                        {demoSelectedRepo.full_name}
                      </button>
                      {crumbs.map((c, i) => {
                        const target = crumbs.slice(0, i + 1).join('/');
                        return (
                          <span key={c} className="gh-crumb-pair">
                            <span className="gh-crumb-sep">/</span>
                            <button type="button" className="gh-crumb" onClick={() => loadDemoContents(demoSelectedRepo.name, target)}>
                              {c}
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    {demoPath && (
                      <button type="button" className="gh-up-btn" onClick={goDemoUp}>
                        <ArrowLeft size={13} />
                        <span>Up one level</span>
                      </button>
                    )}

                    {demoEntries !== null && demoEntries.length === 0 && (
                      <div className="gh-empty glass-card">
                        <FolderGit2 size={30} className="text-muted" />
                        <span>This directory is empty.</span>
                      </div>
                    )}

                    {demoEntries !== null && demoEntries.length > 0 && (
                      <div className="gh-entry-list glass-card">
                        {demoEntries.map((e) => (
                          <div key={e.path} className="gh-entry-row">
                            <div className="gh-entry-name">
                              {e.type === 'dir' ? <Folder size={16} className="text-indigo" /> : <FileText size={16} className="text-muted" />}
                              <span>{e.name}</span>
                            </div>
                            <div className="gh-entry-actions">
                              {e.type === 'dir' ? (
                                <button type="button" className="gh-open-btn" onClick={() => openDemoDir(e)}>
                                  Open
                                </button>
                              ) : SUPPORTED_EXT.has(extOf(e.name)) ? (
                                <div className="gh-file-actions">
                                  <span className="gh-file-ext">{extOf(e.name).toUpperCase()}</span>
                                  <span className="gh-file-size">{formatSize(e.size)}</span>
                                  <button type="button" className="gh-analyze-btn" onClick={() => handleDemoAnalyzeFile(e)}>
                                    <FileCode2 size={13} />
                                    <span>Analyze</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="gh-file-actions">
                                  <span className="gh-file-ext">{extOf(e.name).toUpperCase()}</span>
                                  <span className="gh-unsupported">Unsupported file type.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysisError && (
                      <div className="gh-error glass-card">
                        <AlertTriangle size={16} />
                        <span>{analysisError}</span>
                      </div>
                    )}

                    {analyzing && (
                      <div className="gh-loading glass-card">
                        <Loader2 size={18} className="spinning" />
                        <span className="animate-pulse">Analyzing the selected source file...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---------- Real OAuth connected ---------- */}
          {connected && !analysisResult && (
            <>
              <div className="gh-connected-bar glass-card">
                <div className="gh-connected-identity">
                  <div className="gh-avatar">
                    <GitBranch size={16} />
                  </div>
                  <div className="gh-connected-text">
                    <span className="gh-connected-label">CONNECTED AS</span>
                    <span className="gh-connected-user">@{username}</span>
                  </div>
                </div>
                <button type="button" className="gh-disconnect-btn" onClick={handleDisconnect}>
                  <Unplug size={15} />
                  <span>Disconnect GitHub</span>
                </button>
              </div>

              {/* Repository grid */}
              {repos === null && <div className="gh-connect-note-inline el">Loading repositories...</div>}

              {reposLoading && (
                <div className="gh-loading glass-card">
                  <Loader2 size={20} className="spinning" />
                  <span className="animate-pulse">Loading your repositories...</span>
                </div>
              )}

              {!reposLoading && repos !== null && (
                <div className="gh-section">
                  <div className="gh-section-head">
                    <Files size={16} className="text-indigo" />
                    <span className="gh-section-label">
                      {selectedRepo ? selectedRepo.full_name : 'Select a Repository'}
                    </span>
                    {!selectedRepo && repos.length > 0 && (
                      <button type="button" className="gh-refresh-btn" onClick={loadRepos}>
                        <RefreshCw size={13} />
                        <span>Refresh</span>
                      </button>
                    )}
                    {selectedRepo && (
                      <button type="button" className="gh-back-repos-btn" onClick={handleBackToRepos}>
                        <ArrowLeft size={13} />
                        <span>Repositories</span>
                      </button>
                    )}
                  </div>

                  {repos.length === 0 && (
                    <div className="gh-empty glass-card">
                      <FolderGit2 size={34} className="text-muted" />
                      <span>No repositories found for this GitHub account.</span>
                    </div>
                  )}

                  {repos.length > 0 && !selectedRepo && (
                    <div className="gh-repo-grid">
                      {repos.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="gh-repo-card glass-card"
                          onClick={() => handleSelectRepo(r)}
                        >
                          <div className="gh-repo-top">
                            <FolderGit2 size={18} className="text-indigo" />
                            <span className={`gh-repo-vis ${r.private ? 'private' : 'public'}`}>
                              {r.private ? <Lock size={11} /> : <Globe size={11} />}
                              {r.private ? 'Private' : 'Public'}
                            </span>
                          </div>
                          <div className="gh-repo-name">{r.name}</div>
                          {r.description && <div className="gh-repo-desc">{r.description}</div>}
                          <span className="gh-repo-open">Browse Files →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* File browser for a selected repo */}
                  {selectedRepo && (
                    <div className="gh-filebrowser">
                      {/* Branch selector */}
                      <div className="gh-branch-row">
                        <GitBranch size={14} className="text-indigo" />
                        <span className="gh-branch-label">Branch</span>
                        <select
                          className="gh-branch-select"
                          value={selectedBranch || ''}
                          onChange={(e) => onBranchChange(e.target.value)}
                          disabled={!branches || branches.length === 0 || branchesLoading}
                        >
                          {branchesLoading && <option value="">Loading branches...</option>}
                          {!branchesLoading && branches !== null && branches.length === 0 && !selectedBranch && (
                            <option value="">No branches available</option>
                          )}
                          {!branchesLoading && branches !== null && branches.map((b) => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      {branchError && (
                        <div className="gh-branch-error">
                          <AlertTriangle size={14} />
                          <span>{branchError}</span>
                        </div>
                      )}
                      <div className="gh-crumbs">
                        <button type="button" className="gh-crumb" onClick={() => loadContents(selectedRepo.owner, selectedRepo.name, '', selectedBranch)}>
                          {selectedRepo.full_name}
                        </button>
                        {crumbs.map((c, i) => {
                          const target = crumbs.slice(0, i + 1).join('/');
                          return (
                            <span key={c} className="gh-crumb-pair">
                              <span className="gh-crumb-sep">/</span>
                              <button type="button" className="gh-crumb" onClick={() => loadContents(selectedRepo.owner, selectedRepo.name, target, selectedBranch)}>
                                {c}
                              </button>
                            </span>
                          );
                        })}
                      </div>

                      {path && (
                        <button type="button" className="gh-up-btn" onClick={goUp}>
                          <ArrowLeft size={13} />
                          <span>Up one level</span>
                        </button>
                      )}

                      {entriesLoading && (
                        <div className="gh-loading glass-card">
                          <Loader2 size={18} className="spinning" />
                          <span className="animate-pulse">Listing files...</span>
                        </div>
                      )}

                      {!entriesLoading && entries !== null && entries.length === 0 && (
                        <div className="gh-empty glass-card">
                          <FolderGit2 size={30} className="text-muted" />
                          <span>This directory is empty.</span>
                        </div>
                      )}

                      {!entriesLoading && entries !== null && entries.length > 0 && (
                        <div className="gh-entry-list glass-card">
                          {entries.map((e) => (
                            <div key={e.path} className="gh-entry-row">
                              <div className="gh-entry-name">
                                {e.type === 'dir' ? <Folder size={16} className="text-indigo" /> : <FileText size={16} className="text-muted" />}
                                <span>{e.name}</span>
                              </div>
                              <div className="gh-entry-actions">
                                {e.type === 'dir' ? (
                                  <button type="button" className="gh-open-btn" onClick={() => openDir(e)}>
                                    Open
                                  </button>
                                ) : SUPPORTED_EXT.has(extOf(e.name)) ? (
                                  <div className="gh-file-actions">
                                    <span className="gh-file-ext">{extOf(e.name).toUpperCase()}</span>
                                    <span className="gh-file-size">{formatSize(e.size)}</span>
                                    <button type="button" className="gh-analyze-btn" onClick={() => handleAnalyzeFile(e)}>
                                      <FileCode2 size={13} />
                                      <span>Analyze</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="gh-file-actions">
                                    <span className="gh-file-ext">{extOf(e.name).toUpperCase()}</span>
                                    <span className="gh-unsupported">Unsupported file type.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {analysisError && (
                        <div className="gh-error glass-card">
                          <AlertTriangle size={16} />
                          <span>{analysisError}</span>
                        </div>
                      )}

                      {analyzing && (
                        <div className="gh-loading glass-card">
                          <Loader2 size={18} className="spinning" />
                          <span className="animate-pulse">Analyzing the selected source file...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ---------- Analysis results (reuse existing SourceResults) ---------- */}
          {(connected || demoConnected) && analysisResult && (
            <>
              <div className="gh-back-banner">
                <button type="button" className="gh-back-btn" onClick={() => {
                  setAnalysisResult(null);
                  setAnalysisError('');
                }}>
                  <ArrowLeft size={15} />
                  <span>{demoMode ? 'Back to Demo Files' : 'Back to Repositories'}</span>
                </button>
              </div>
              <SourceResults
                result={analysisResult.result}
                saved={analysisResult.result.saved}
                onViewHistory={onViewHistory}
                files={[analysisResult.file]}
                onReset={() => {
                  setAnalysisResult(null);
                  setAnalysisError('');
                }}
              />
            </>
          )}
        </>
      )}

      <style>{`
        .gh-container {
          padding: 40px 24px 80px;
          max-width: 880px;
        }
        .gh-page-header {
          margin-bottom: 24px;
        }
        .gh-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 850;
          margin: 0 0 6px 0;
        }
        .gh-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          max-width: 680px;
        }
        .text-indigo { color: #a5b4fc; }
        .mono { font-family: var(--font-mono); }
        .spinning { animation: ghspin 0.8s linear infinite; }
        @keyframes ghspin { to { transform: rotate(360deg); } }
        .animate-pulse { animation: ghpulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
        @keyframes ghpulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }

        .gh-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 18px;
          border-radius: var(--radius-md);
          margin-bottom: 18px;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .gh-banner.success { color: var(--success); background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.3); }
        .gh-banner.error { color: #fca5a5; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); }

        .gh-error {
          padding: 16px 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: #fca5a5;
          margin-bottom: 18px;
        }
        .gh-loading {
          padding: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .gh-connect-card {
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }
        .gh-connect-icon {
          width: 64px; height: 64px; border-radius: 9999px;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
          display: flex; align-items: center; justify-content: center; color: #a5b4fc;
        }
        .gh-connect-title { font-size: 20px; font-weight: 800; margin: 0; }
        .gh-connect-sub { font-size: 14px; color: var(--text-secondary); max-width: 560px; margin: 0; line-height: 1.6; }
        .gh-connect-btn {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 8px;
          padding: 12px 26px; font-size: 14px; font-weight: 750; color: #fff;
          background: #24292f; border: 1px solid #444c56; border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }
        .gh-connect-btn:hover { background: #30363d; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(36,41,47,0.4); }
        .gh-connect-note { font-size: 12px; color: var(--text-muted); max-width: 540px; margin: 0; line-height: 1.5; }
        .gh-not-configured {
          margin-top: 8px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 10px; text-align: left;
          color: #fbbf24; border-color: rgba(234,179,8,0.3); background: rgba(234,179,8,0.05); max-width: 620px;
        }
        .gh-not-configured strong { font-size: 13px; }
        .gh-not-configured p { font-size: 12.5px; color: var(--text-secondary); margin: 4px 0 0; line-height: 1.5; }

        .gh-connected-bar {
          padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
          gap: 12px; flex-wrap: wrap; margin-bottom: 24px; border-color: rgba(99,102,241,0.3);
        }
        .gh-connected-identity { display: flex; align-items: center; gap: 12px; }
        .gh-avatar {
          width: 38px; height: 38px; border-radius: 50%; background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; color: #a5b4fc;
        }
        .gh-connected-text { display: flex; flex-direction: column; gap: 1px; }
        .gh-connected-label { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; }
        .gh-connected-user { font-size: 15px; font-weight: 800; color: var(--text-primary); }
        .gh-disconnect-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 650;
          color: #fca5a5; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        .gh-disconnect-btn:hover { background: rgba(239,68,68,0.12); }

        .gh-section { display: flex; flex-direction: column; gap: 14px; }
        .gh-section-head { display: flex; align-items: center; gap: 8px; }
        .gh-section-label { font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; }
        .gh-refresh-btn { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; font-size: 12px; font-weight: 700;
          color: var(--text-secondary); padding: 5px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
          transition: all var(--transition-fast); }
        .gh-refresh-btn:hover { color: var(--text-primary); border-color: rgba(99,102,241,0.4); }

        .gh-back-repos-btn {
          display: inline-flex; align-items: center; gap: 5px; margin-left: auto;
          font-size: 12px; font-weight: 700; color: var(--text-secondary);
          padding: 5px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        .gh-back-repos-btn:hover { color: var(--text-primary); border-color: rgba(99,102,241,0.4); }

        .gh-empty { padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--text-muted); text-align: center; }

        .gh-repo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .gh-repo-card {
          padding: 18px; display: flex; flex-direction: column; gap: 10px; text-align: left; cursor: pointer;
          transition: all var(--transition-fast); border: 1px solid var(--border-color);
        }
        .gh-repo-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.04); transform: translateY(-1px); }
        .gh-repo-top { display: flex; align-items: center; justify-content: space-between; }
        .gh-repo-vis { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 9999px; }
        .gh-repo-vis.public { color: var(--success); background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); }
        .gh-repo-vis.private { color: #fbbf24; background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.3); }
        .gh-repo-name { font-size: 16px; font-weight: 750; color: var(--text-primary); font-family: var(--font-mono); word-break: break-all; }
        .gh-repo-desc { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
        .gh-repo-open { font-size: 12px; font-weight: 750; color: #a5b4fc; margin-top: auto; }

        .gh-filebrowser { display: flex; flex-direction: column; gap: 12px; }

        .gh-branch-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .gh-branch-label {
          font-size: 11px; font-weight: 800; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .gh-branch-select {
          appearance: none; -webkit-appearance: none;
          padding: 7px 34px 7px 12px;
          font-size: 13px; font-weight: 650; font-family: var(--font-mono);
          color: var(--text-primary);
          background-color: var(--bg-input);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          border: 1px solid var(--border-color); border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          cursor: pointer;
        }
        .gh-branch-select:hover { border-color: rgba(99,102,241,0.4); }
        .gh-branch-select:focus { outline: none; border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--primary-glow); }
        .gh-branch-select:disabled { opacity: 0.55; cursor: not-allowed; }
        .gh-branch-select option { color: var(--text-primary); background-color: var(--bg-card); }
        .gh-branch-error {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 12.5px; color: #fbbf24; line-height: 1.5;
        }
        .gh-crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; font-size: 13px; }
        .gh-crumb {
          background: none; border: none; color: #a5b4fc; font-weight: 700; font-family: var(--font-mono);
          padding: 4px 6px; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-fast);
        }
        .gh-crumb:hover { background: rgba(99,102,241,0.12); }
        .gh-crumb-pair { display: inline-flex; align-items: center; }
        .gh-crumb-sep { color: var(--text-muted); }
        .gh-up-btn { display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 6px 12px; font-size: 12px;
          font-weight: 700; color: var(--text-secondary); background: rgba(255,255,255,0.04); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .gh-up-btn:hover { color: var(--text-primary); border-color: rgba(99,102,241,0.4); }

        .gh-entry-list { padding: 8px; display: flex; flex-direction: column; }
        .gh-entry-row {
          display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px;
          border-radius: var(--radius-sm); transition: background var(--transition-fast);
        }
        .gh-entry-row:hover { background: rgba(255,255,255,0.03); }
        .gh-entry-name { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: var(--text-primary);
          font-family: var(--font-mono); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gh-entry-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .gh-open-btn { padding: 6px 12px; font-size: 12px; font-weight: 700; color: #a5b4fc;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .gh-open-btn:hover { background: rgba(99,102,241,0.2); }
        .gh-file-actions { display: flex; align-items: center; gap: 8px; }
        .gh-file-ext { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.04em; }
        .gh-file-size { font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .gh-unsupported { font-size: 12px; color: #fbbf24; font-weight: 600; }
        .gh-analyze-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: 750;
          color: #fff; background: #6366F1; border: 1px solid #4F46E5; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .gh-analyze-btn:hover { background: #4F46E5; transform: translateY(-1px); }

        .gh-back-banner { margin-bottom: 4px; }
        .gh-back-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; font-weight: 650;
          color: var(--text-secondary); background: rgba(255,255,255,0.04); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .gh-back-btn:hover { color: var(--text-primary); border-color: rgba(99,102,241,0.4); }
        .text-muted { color: var(--text-muted); }

        /* Demo mode styles */
        .gh-demo-badge {
          display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;
          border-color: rgba(139,92,246,0.35); background: rgba(139,92,246,0.06);
          color: #c4b5fd;
        }
        .gh-demo-badge svg { flex-shrink: 0; margin-top: 2px; color: #a78bfa; }
        .gh-demo-badge-text { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .gh-demo-badge-label { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #a78bfa; }
        .gh-demo-badge-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .gh-demo-exit-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 12px; font-weight: 700;
          color: #fca5a5; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-sm);
          transition: all var(--transition-fast); flex-shrink: 0;
        }
        .gh-demo-exit-btn:hover { background: rgba(239,68,68,0.12); }

        .gh-demo-divider {
          display: flex; align-items: center; gap: 14px; width: 100%; max-width: 360px; margin-top: 8px;
        }
        .gh-demo-divider-line { flex: 1; height: 1px; background: var(--border-color); }
        .gh-demo-divider-text { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

        .gh-demo-btn {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 4px;
          padding: 12px 26px; font-size: 14px; font-weight: 750; color: #fff;
          background: linear-gradient(135deg, #7c3aed, #6366f1); border: 1px solid rgba(139,92,246,0.4); border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }
        .gh-demo-btn:hover { background: linear-gradient(135deg, #6d28d9, #4f46e5); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(139,92,246,0.3); }
        .gh-demo-hint { font-size: 12px; color: var(--text-muted); max-width: 400px; margin: 0; text-align: center; line-height: 1.5; }

        .gh-demo-connected-bar {
          border-color: rgba(139,92,246,0.35) !important;
          background: rgba(139,92,246,0.04) !important;
        }

        @media (max-width: 640px) {
          .gh-container { padding: 28px 18px 70px; }
          .gh-repo-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
