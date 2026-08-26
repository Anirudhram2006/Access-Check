import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import AuditResults from './components/AuditResults';
import VisionSimulator from './components/VisionSimulator';
import { demoScan } from './utils/demoScan';
import { ShieldAlert, BookOpen, Cpu, HardDrive } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [customTamilText, setCustomTamilText] = useState(null);
  const [customHindiText, setCustomHindiText] = useState(null);

  const BACKEND_URL = 'http://localhost:5000';

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
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

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

        {/* TAB 3: ABOUT VIEW */}
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

        /* Simulator Coming Soon View */
        .simulator-coming-soon {
          padding: 80px 24px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
        }

        .coming-soon-card {
          max-width: 600px;
          width: 100%;
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          border-color: rgba(234, 179, 8, 0.25);
          box-shadow: 0 20px 40px rgba(234, 179, 8, 0.05);
        }

        .coming-soon-icon-wrapper {
          background-color: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.2);
          padding: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .coming-soon-title {
          font-size: 26px;
          font-weight: 850;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }

        .coming-soon-tagline {
          font-size: 13px;
          font-weight: 800;
          color: #fef08a;
          background: rgba(234, 179, 8, 0.15);
          padding: 4px 12px;
          border-radius: 9999px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .coming-soon-divider {
          width: 60px;
          height: 1px;
          background-color: var(--border-color);
          margin: 24px 0;
        }

        .coming-soon-description {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .simulator-features-preview-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          padding: 18px;
          border-radius: var(--radius-md);
          text-align: left;
        }

        .feature-preview-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .feature-icon {
          flex-shrink: 0;
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
          
          .simulator-coming-soon {
            padding: 40px 12px;
          }
          
          .coming-soon-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
