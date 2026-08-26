import React from 'react';
import { ShieldCheck, Eye, HelpCircle } from 'lucide-react';

/**
 * EmptyState Component
 * Displays the core capabilities of Access Check in a premium card layout.
 * Shown before any scan is performed.
 */
export default function EmptyState() {
  const capabilities = [
    {
      icon: <ShieldCheck className="cap-icon text-indigo" size={32} />,
      title: 'AUDIT',
      description: 'Real axe-core accessibility analysis',
      details: 'Inspect your markup against Web Content Accessibility Guidelines (WCAG) 2.1 AA and AAA standards. Detect contrast bugs, markup issues, and missing labels instantly.',
      gradientClass: 'border-indigo'
    },
    {
      icon: <Eye className="cap-icon text-amber" size={32} />,
      title: 'SIMULATE',
      description: 'Experience accessibility conditions visually',
      details: 'See your webpage through the eyes of users with protanopia, deuteranopia, low vision blur, and other visual or cognitive differences. (Coming soon in Next Phase!)',
      gradientClass: 'border-amber'
    },
    {
      icon: <HelpCircle className="cap-icon text-emerald" size={32} />,
      title: 'UNDERSTAND',
      description: 'Get plain-language fixes developers can act on',
      details: 'Translate obscure, technical WCAG failures into clear, developer-friendly code snippets showing exact "before" and "after" examples to resolve issues quickly.',
      gradientClass: 'border-emerald'
    }
  ];

  return (
    <div className="empty-state-container container">
      <div className="empty-state-grid">
        {capabilities.map((cap, i) => (
          <div key={i} className={`capability-card glass-card ${cap.gradientClass}`}>
            <div className="cap-icon-container">
              {cap.icon}
            </div>
            <h3 className="cap-title">{cap.title}</h3>
            <p className="cap-tagline">{cap.description}</p>
            <p className="cap-details">{cap.details}</p>
          </div>
        ))}
      </div>

      <style>{`
        .empty-state-container {
          padding: 20px 0 80px;
        }

        .empty-state-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .capability-card {
          padding: 32px;
          text-align: left;
          transition: all var(--transition-normal);
          position: relative;
          overflow: hidden;
        }

        .capability-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: transparent;
          transition: background var(--transition-fast);
        }

        .capability-card:hover {
          transform: translateY(-4px);
          border-color: var(--text-muted);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
        }

        .border-indigo:hover::before {
          background: var(--primary);
        }

        .border-amber:hover::before {
          background: var(--serious);
        }

        .border-emerald:hover::before {
          background: var(--success);
        }

        .cap-icon-container {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid var(--border-color);
          width: fit-content;
          padding: 12px;
          border-radius: var(--radius-md);
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .text-indigo {
          color: #a5b4fc;
        }

        .text-amber {
          color: #fdba74;
        }

        .text-emerald {
          color: #6ee7b7;
        }

        .cap-title {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.15em;
          margin-bottom: 8px;
        }

        .cap-tagline {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
          line-height: 1.3;
        }

        .cap-details {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .capability-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
