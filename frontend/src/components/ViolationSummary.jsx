import React from 'react';
import { AlertCircle, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

/**
 * ViolationSummary Component
 * Displays a breaking summary count of the violations categorized by severity levels.
 * 
 * @param {object} props
 * @param {Array} props.violations - Array of violations returned by the scan
 */
export default function ViolationSummary({ violations = [] }) {
  // Count by severity level
  const counts = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };

  violations.forEach(v => {
    const impact = v.impact ? v.impact.toLowerCase() : 'minor';
    if (counts.hasOwnProperty(impact)) {
      counts[impact]++;
    } else {
      counts.minor++; // default fallback
    }
  });

  const totalIssues = violations.length;

  const severityItems = [
    {
      key: 'critical',
      label: 'Critical',
      count: counts.critical,
      color: 'var(--critical)',
      icon: <ShieldAlert size={20} className="text-critical-icon" />,
      desc: 'Severe barriers that block assistive technology users completely from key tasks.',
      bgClass: 'bg-critical'
    },
    {
      key: 'serious',
      label: 'Serious',
      count: counts.serious,
      color: 'var(--serious)',
      icon: <AlertTriangle size={20} className="text-serious-icon" />,
      desc: 'Major barriers that cause significant frustration or highly difficult workarounds.',
      bgClass: 'bg-serious'
    },
    {
      key: 'moderate',
      label: 'Moderate',
      count: counts.moderate,
      color: 'var(--moderate)',
      icon: <AlertCircle size={20} className="text-moderate-icon" />,
      desc: 'Moderate barriers that degrade the user experience but do not fully block completion.',
      bgClass: 'bg-moderate'
    },
    {
      key: 'minor',
      label: 'Minor',
      count: counts.minor,
      color: 'var(--minor)',
      icon: <Info size={20} className="text-minor-icon" />,
      desc: 'Nuisance barriers that present small visual or accessibility inconsistencies.',
      bgClass: 'bg-minor'
    }
  ];

  return (
    <div className="violation-summary-card glass-card">
      <div>
        <h3 className="card-title-uppercase">Violation Summary</h3>
        <p className="summary-subtitle">Categorized results by impact severity</p>
      </div>

      <div className="total-issues-callout">
        <span className="total-issues-count">{totalIssues}</span>
        <span className="total-issues-label">Total Accessibility Issues</span>
      </div>

      <div className="severity-breakdown-list">
        {severityItems.map((item) => (
          <div key={item.key} className={`severity-row-card ${item.key}`}>
            <div className="severity-row-header">
              <div className="severity-title-area">
                {item.icon}
                <span className="severity-row-label">{item.label}</span>
              </div>
              <div className="severity-row-badge">
                <span className="severity-count-num">{item.count}</span>
                <span className="severity-count-label">found</span>
              </div>
            </div>
            
            <p className="severity-row-desc">{item.desc}</p>
            
            {/* Visual progress bar of this severity count relative to total issues */}
            <div className="severity-progress-track">
              <div 
                className={`severity-progress-fill ${item.bgClass}`}
                style={{ width: totalIssues > 0 ? `${(item.count / totalIssues) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .violation-summary-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .summary-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
          margin-bottom: 24px;
        }

        .total-issues-callout {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid var(--border-color);
          padding: 16px 20px;
          border-radius: var(--radius-md);
          margin-bottom: 24px;
        }

        .total-issues-count {
          font-size: 32px;
          font-weight: 850;
          color: #ffffff;
          line-height: 1;
        }

        .total-issues-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .severity-breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex-grow: 1;
          justify-content: space-between;
        }

        .severity-row-card {
          border-left: 3px solid transparent;
          padding: 12px 14px;
          background: rgba(30, 41, 59, 0.2);
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .severity-row-card.critical { border-left-color: var(--critical); }
        .severity-row-card.serious { border-left-color: var(--serious); }
        .severity-row-card.moderate { border-left-color: var(--moderate); }
        .severity-row-card.minor { border-left-color: var(--minor); }

        .severity-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .severity-title-area {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .text-critical-icon { color: var(--critical); }
        .text-serious-icon { color: var(--serious); }
        .text-moderate-icon { color: var(--moderate); }
        .text-minor-icon { color: var(--minor); }

        .severity-row-label {
          font-size: 14px;
          font-weight: 750;
          color: var(--text-primary);
        }

        .severity-row-badge {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .severity-count-num {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
        }

        .severity-count-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .severity-row-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .severity-progress-track {
          width: 100%;
          height: 3px;
          background: var(--bg-input);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 4px;
        }

        .severity-progress-fill {
          height: 100%;
          border-radius: 999px;
        }

        .severity-progress-fill.bg-critical { background-color: var(--critical); }
        .severity-progress-fill.bg-serious { background-color: var(--serious); }
        .severity-progress-fill.bg-moderate { background-color: var(--moderate); }
        .severity-progress-fill.bg-minor { background-color: var(--minor); }

        @media (max-width: 640px) {
          .total-issues-callout {
            padding: 12px 16px;
          }
          
          .total-issues-count {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
