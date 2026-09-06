import React from 'react';
import { Eye, Shield, Info, Scan, LogOut, User, Clock, BarChart3, FileCode2, Server, GitBranch, MessageCircle } from 'lucide-react';

/**
 * Header Component
 * Shows application title, tagline, main navigation tabs, and user controls.
 * 
 * @param {object} props
 * @param {string} props.activeTab - Currently active tab ('scanner', 'simulator', 'about')
 * @param {function} props.setActiveTab - State setter to switch tabs
 * @param {object|null} props.user - Current authenticated user or null
 * @param {function} props.onLogout - Callback to log out the user
 */
export default function Header({ activeTab, setActiveTab, user, onLogout }) {
  return (
    <header className="header-container">
      <div className="container header-inner">
        <div className="logo-section" onClick={() => setActiveTab('scanner')}>
          <div className="logo-icon-wrapper">
            <Shield className="logo-icon text-gradient" size={28} />
          </div>
          <div>
            <h1 className="logo-text">
              ACCESS <span className="text-gradient">CHECK</span>
            </h1>
            <p className="logo-tagline">Accessibility Auditor & Experience Simulator</p>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
            aria-label="Access Scanner"
          >
            <Scan size={18} />
            <span>Scanner</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
            aria-label="Experience Simulator"
          >
            <Eye size={18} />
            <span>Simulator</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            aria-label="Audit History"
          >
            <Clock size={18} />
            <span>History</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
            aria-label="Common Mistakes Insights"
          >
            <BarChart3 size={18} />
            <span>Insights</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'source' ? 'active' : ''}`}
            onClick={() => setActiveTab('source')}
            aria-label="Source Code Analysis"
          >
            <FileCode2 size={18} />
            <span>Source Code</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
            aria-label="API Analysis"
          >
            <Server size={18} />
            <span>API Analysis</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'github' ? 'active' : ''}`}
            onClick={() => setActiveTab('github')}
            aria-label="GitHub Integration"
          >
            <GitBranch size={18} />
            <span>GitHub</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'chatbot' ? 'active' : ''}`}
            onClick={() => setActiveTab('chatbot')}
            aria-label="Accessibility Chatbot"
          >
            <MessageCircle size={18} />
            <span>Chat</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
            aria-label="About Access Check"
          >
            <Info size={18} />
            <span>About</span>
          </button>
        </nav>

        {user && (
          <div className="user-section">
            <div className="user-info">
              <div className="user-avatar">
                <User size={16} />
              </div>
              <span className="user-name">{user.name}</span>
            </div>
            <button 
              className="logout-btn" 
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
              <span className="logout-text">Logout</span>
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        .header-container {
          background-color: rgba(11, 15, 25, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 100;
          padding: 16px 0;
        }
        
        .header-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }
        
        .logo-icon-wrapper {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: var(--radius-md);
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin: 0;
          line-height: 1.1;
        }
        
        .logo-tagline {
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        
        .nav-menu {
          display: flex;
          gap: 8px;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid var(--border-color);
          padding: 4px;
          border-radius: var(--radius-md);
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        
        .nav-item:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }
        
        .nav-item.active {
          color: #ffffff;
          background: var(--primary);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .user-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .user-avatar {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 50%;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a5b4fc;
        }

        .user-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .logout-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.25);
        }
        
        @media (max-width: 640px) {
          .header-inner {
            flex-direction: column;
            text-align: center;
          }
          
          .logo-section {
            flex-direction: column;
            gap: 6px;
          }
          
          .nav-menu {
            width: 100%;
            justify-content: space-around;
          }

          .user-section {
            width: 100%;
            justify-content: center;
            padding-top: 4px;
            border-top: 1px solid var(--border-color);
          }

          .logout-text {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
