import React from 'react';
import { Eye, Shield, HelpCircle, Info, Scan } from 'lucide-react';

/**
 * Header Component
 * Shows application title, tagline, and main navigation tabs.
 * 
 * @param {object} props
 * @param {string} props.activeTab - Currently active tab ('scanner', 'simulator', 'about')
 * @param {function} props.setActiveTab - State setter to switch tabs
 */
export default function Header({ activeTab, setActiveTab }) {
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
            className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
            aria-label="About Access Check"
          >
            <Info size={18} />
            <span>About</span>
          </button>
        </nav>
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
        }
      `}</style>
    </header>
  );
}
