import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import AuditResults from './components/AuditResults';
import VisionSimulator from './components/VisionSimulator';
import AuditHistory from './components/AuditHistory';
import CommonMistakes from './components/CommonMistakes';
import SourceCodeAnalysis from './components/SourceCodeAnalysis';
import ApiAnalysis from './components/ApiAnalysis';
import GitHubIntegration from './components/GitHubIntegration';
import AccessibilityChatbot from './components/AccessibilityChatbot';
import AuthPage from './components/AuthPage';
import { demoScan } from './utils/demoScan';
import { ShieldAlert, BookOpen, Cpu, HardDrive } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scanner');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [customTamilText, setCustomTamilText] = useState(null);
  const [customHindiText, setCustomHindiText] = useState(null);

  // Check if user has an active session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch {
        // Server unreachable or not authenticated - stay logged out
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Proceed with local logout even if server call fails
    }
    setUser(null);
    setScanResult(null);
    setIsDemoMode(false);
    setErrorMsg('');
    setActiveTab('scanner');
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'var(--text-secondary)',
        fontSize: '14px',
        fontWeight: 600
      }}>
        <span className="animate-pulse">Loading Access Check...</span>
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage onAuth={setUser} />;
  }

  /**
   * Triggers a live accessibility audit by sending a POST request to our Node/Express backend.
   * 
   * @param {string} targetUrl 
   */
  const handleLiveScan = async (targetUrl) => {
    setLoading(true);
    setScanResult(null);
    setIsDemoMode(false);
    setErrorMsg('');
    setCustomTamilText(null);
    setCustomHindiText(null);

    try {
      console.log(`Contacting backend to scan URL: ${targetUrl}`);
      
      const response = await fetch(`${BACKEND_URL}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!response.ok) {
        let errMessage = 'The server rejected the request.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (_) {
          // Fallback if not JSON
          errMessage = `Server error (Status Code: ${response.status})`;
        }

        // If session expired, force re-login
        if (response.status === 401) {
          setUser(null);
          return;
        }

        throw new Error(errMessage);
      }

      const data = await response.json();
      
      if (!data || !data.violations) {
        throw new Error('Malformed scanner response. Expected a violations list.');
      }

      setScanResult(data);
    } catch (error) {
      console.error('Scan operation failed:', error);
      
      // Determine user-friendly error string
      let friendlyError = error.message;
      if (error.message.includes('Failed to fetch')) {
        friendlyError = 'The Access Check backend server appears to be offline. Make sure the Node.js server is running on http://localhost:5000 before scanning.';
      } else if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
        friendlyError = 'The target website took too long to load (30s timeout). Please verify that the URL is live and accessible.';
      } else if (error.message.includes('failed to respond') || error.message.includes('unreachable') || error.message.includes('failed:')) {
        friendlyError = 'The target website could not be reached. Double check the address spelling or try another website.';
      }

      setErrorMsg(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Triggers Demo Mode using the verified offline sample.com scan data
   */
  const handleDemoMode = () => {
    setErrorMsg('');
    setLoading(false);
    setIsDemoMode(true);
    setScanResult(demoScan);
    setCustomTamilText(null);
    setCustomHindiText(null);
    setActiveTab('scanner'); // ensure we are on the scanner view
  };

  /**
   * Resets the scan states back to home view
   */
  const handleReset = () => {
    setScanResult(null);
    setIsDemoMode(false);
    setErrorMsg('');
    setCustomTamilText(null);
    setCustomHindiText(null);
  };

  return (
    <div id="root">
      {/* Header Navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

      {/* Main Container Area */}
      <main className="main-content">
        
        {/* TAB 1: SCANNER VIEW */}
        {activeTab === 'scanner' && (
          <>
            {/* If there is no active result and we are not loading, show Scanner input Home */}
            {!loading && !scanResult && (
              <>
                <Hero 
                  onScan={handleLiveScan} 
                  onDemoMode={handleDemoMode} 
                  loading={loading} 
                />
                
                {/* Error Banner Callout if any */}
                {errorMsg && (
                  <div className="container error-banner-wrapper">
                    <div className="error-banner glass-card">
                      <ShieldAlert className="error-icon text-critical" size={24} />
                      <div className="error-text-block">
                        <h4 className="error-title">Audit Interrupted</h4>
                        <p className="error-description">{errorMsg}</p>
                      </div>
                    </div>
                  </div>
                )}

                <EmptyState />
              </>
            )}

            {/* If loading is active, show premium loading skeleton screen */}
            {loading && <LoadingState />}

            {/* If we have successful results, display dashboard */}
            {!loading && scanResult && (
              <AuditResults 
                scanResult={scanResult} 
                isDemoMode={isDemoMode} 
                onReset={handleReset} 
              />
            )}
          </>
        )}

        {/* TAB 2: SIMULATOR VIEW */}
        {activeTab === 'simulator' && (
          <VisionSimulator 
            scanResult={scanResult} 
            isDemoMode={isDemoMode} 
            onNavigateToScanner={() => setActiveTab('scanner')} 
            customTamilText={customTamilText}
            setCustomTamilText={setCustomTamilText}
            customHindiText={customHindiText}
            setCustomHindiText={setCustomHindiText}
          />
        )}

        {/* TAB 3: HISTORY VIEW */}
        {activeTab === 'history' && (
          <AuditHistory />
        )}

        {/* TAB 4: INSIGHTS VIEW */}
        {activeTab === 'insights' && (
          <CommonMistakes />
        )}

        {/* TAB: SOURCE CODE ANALYSIS VIEW */}
        {activeTab === 'source' && (
          <SourceCodeAnalysis onViewHistory={() => setActiveTab('history')} />
        )}

        {/* TAB: API / BACKEND ANALYSIS VIEW */}
        {activeTab === 'api' && (
          <ApiAnalysis />
        )}

        {/* TAB: GITHUB INTEGRATION VIEW */}
        {activeTab === 'github' && (
          <GitHubIntegration onViewHistory={() => setActiveTab('history')} />
        )}

        {/* TAB: ACCESSIBILITY CHATBOT VIEW */}
        {activeTab === 'chatbot' && (
          <AccessibilityChatbot 
            scanResult={scanResult} 
            isDemoMode={isDemoMode} 
          />
        )}

        {/* TAB 5: ABOUT VIEW */}
        {activeTab === 'about' && (
          <div className="about-page-container container">
            <div className="about-grid">
              
              <div className="about-main-col glass-card">
                <h2 className="about-section-title">About Access Check</h2>
                <p className="about-paragraph">
                  <strong>Access Check</strong> is an advanced, premium accessibility auditor and experience simulator. Our mission is to democratize accessibility auditing by making WCAG guidelines clear, visual, and highly actionable for developers and design teams alike.
                </p>
                <p className="about-paragraph">
                  Rather than outputting tedious spreadsheets of technical jargon, Access Check integrates axe-core directly into headless browser contexts, compiling a visual rendering of elements alongside clear, step-by-step recommended fixes.
                </p>

                <div className="tech-stack-section">
                  <h3 className="tech-stack-title">Engine Technology Stack</h3>
                  <div className="tech-badge-flex">
                    <div className="tech-badge">
                      <Cpu size={14} />
                      <span>Node.js / Express</span>
                    </div>
                    <div className="tech-badge">
                      <HardDrive size={14} />
                      <span>Puppeteer (Chromium headless)</span>
                    </div>
                    <div className="tech-badge">
                      <Cpu size={14} />
                      <span>axe-core Engine</span>
                    </div>
                    <div className="tech-badge">
                      <Cpu size={14} />
                      <span>React (Vite)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="about-side-col glass-card">
                <h3 className="about-side-title">Project Intent</h3>
                <p className="about-side-text">
                  This application was crafted for the premium Project Expo. It represents a highly visual, modern tool helping developers build empathy and compliance into every digital product.
                </p>
                
                <div className="side-callout-box">
                  <BookOpen size={16} className="text-indigo" />
                  <span>WCAG 2.1 Compliance Auditor</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Styles for main orchestrator views */}
      <style>{`
        /* Error Banner CSS */
        .error-banner-wrapper {
          padding-top: 24px;
          display: flex;
          justify-content: center;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.25);
          padding: 18px 24px;
          border-radius: var(--radius-lg);
          max-width: 680px;
          width: 100%;
          text-align: left;
        }

        .error-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .error-text-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .error-title {
          font-size: 15px;
          font-weight: 800;
          color: #ef4444;
          margin: 0;
        }

        .error-description {
          font-size: 13px;
          color: #fca5a5;
          line-height: 1.5;
          margin: 0;
        }

        /* About Page View */
        .about-page-container {
          padding: 60px 24px 100px;
        }

        .about-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
          text-align: left;
        }

        .about-main-col, .about-side-col {
          padding: 40px;
        }

        .about-section-title {
          font-size: 28px;
          font-weight: 850;
          letter-spacing: -0.02em;
          margin-bottom: 20px;
        }

        .about-paragraph {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.65;
          margin-bottom: 20px;
        }

        .tech-stack-section {
          margin-top: 32px;
          border-top: 1px solid var(--border-color);
          padding-top: 24px;
        }

        .tech-stack-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .tech-badge-flex {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tech-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 600;
        }

        .about-side-title {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .about-side-text {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .side-callout-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background-color: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.15);
          padding: 12px 16px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 750;
          color: #ffffff;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @media (max-width: 1024px) {
          .about-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        @media (max-width: 640px) {
          .about-main-col, .about-side-col {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
