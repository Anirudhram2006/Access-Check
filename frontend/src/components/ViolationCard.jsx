import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Code, HelpCircle, AlertCircle, BookOpen } from 'lucide-react';
import { getRuleSuggestion } from '../utils/ruleSuggestions';

/**
 * ViolationCard Component
 * Displays a single axe-core accessibility violation, expandable to show
 * affected nodes, CSS selectors, actual HTML, and plain-language fixes.
 * 
 * @param {object} props
 * @param {object} props.violation - The axe-core violation item
 */
export default function ViolationCard({ violation }) {
  const [isOpen, setIsOpen] = useState(false);
  const suggestion = getRuleSuggestion(violation.id);

  // Helper for impact colors
  const getImpactBadgeClass = (impact) => {
    switch (impact ? impact.toLowerCase() : 'minor') {
      case 'critical': return 'critical';
      case 'serious': return 'serious';
      case 'moderate': return 'moderate';
      case 'minor':
      default: return 'minor';
    }
  };

  return (
    <div className={`violation-card-item glass-card ${isOpen ? 'is-expanded' : ''}`}>
      {/* Clickable Header Area */}
      <div className="card-clickable-header" onClick={() => setIsOpen(!isOpen)} role="button" aria-expanded={isOpen}>
        <div className="header-left-group">
          <span className={`badge ${getImpactBadgeClass(violation.impact)}`}>
            {violation.impact || 'minor'}
          </span>
          <div className="title-and-rule">
            <h4 className="violation-help-title">{violation.help}</h4>
            <span className="rule-id-code">ID: {violation.id}</span>
          </div>
        </div>
        
        <div className="header-right-group">
          <span className="affected-count-badge">
            {violation.nodes ? violation.nodes.length : 0} {violation.nodes?.length === 1 ? 'element' : 'elements'}
          </span>
          <button type="button" className="toggle-expand-btn" aria-label={isOpen ? "Collapse details" : "Expand details"}>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isOpen && (
        <div className="expanded-content">
          <div className="violation-description-block">
            <p className="description-label">DESCRIPTION</p>
            <p className="description-text">{violation.description}</p>
          </div>

          {/* Affected Elements List */}
          {violation.nodes && violation.nodes.length > 0 && (
            <div className="nodes-section">
              <p className="description-label">AFFECTED DOM ELEMENTS</p>
              <div className="nodes-list">
                {violation.nodes.map((node, idx) => (
                  <div key={idx} className="node-item">
                    {node.selector && (
                      <div className="selector-block">
                        <span className="selector-label">CSS Selector</span>
                        <code className="selector-code">{node.selector}</code>
                      </div>
                    )}
                    
                    {node.html && (
                      <div className="html-block">
                        <span className="html-label">HTML Snippet</span>
                        <pre className="code-block"><code>{node.html}</code></pre>
                      </div>
                    )}
                    
                    {node.failureSummary && (
                      <div className="failure-summary-block">
                        <div className="failure-summary-header">
                          <AlertCircle size={14} className="text-critical" />
                          <span className="failure-summary-title">Failure Summary</span>
                        </div>
                        <p className="failure-summary-text">{node.failureSummary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Plain-Language Suggestion Box */}
          <div className="plain-language-suggestion-box">
            <div className="suggestion-box-header">
              <BookOpen size={18} className="text-indigo" />
              <h5 className="suggestion-box-title">Access Check Plain-Language Fix</h5>
            </div>

            <div className="suggestion-grid">
              <div className="suggestion-col">
                <span className="sub-section-label">WHY IT MATTERS</span>
                <p className="suggestion-why-text">{suggestion.whyItMatters}</p>
              </div>

              <div className="suggestion-col">
                <span className="sub-section-label">HOW TO FIX</span>
                <p className="suggestion-fix-text">{suggestion.fixExplanation}</p>
              </div>
            </div>

            {suggestion.exampleBefore && suggestion.exampleAfter && (
              <div className="suggestion-examples-section">
                <div className="example-comparison-grid">
                  <div className="example-comparison-col before">
                    <span className="example-label label-before">INCORRECT (BEFORE)</span>
                    <pre className="example-code-pre"><code>{suggestion.exampleBefore}</code></pre>
                  </div>
                  <div className="example-comparison-col after">
                    <span className="example-label label-after">ACCESSIBLE (AFTER)</span>
                    <pre className="example-code-pre"><code>{suggestion.exampleAfter}</code></pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .violation-card-item {
          border-color: var(--border-color);
          transition: all var(--transition-normal);
          overflow: hidden;
          margin-bottom: 16px;
        }

        .violation-card-item:hover {
          border-color: var(--text-muted);
          box-shadow: var(--shadow-md);
        }

        .violation-card-item.is-expanded {
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }

        .card-clickable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          cursor: pointer;
          user-select: none;
          gap: 16px;
        }

        .header-left-group {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-grow: 1;
        }

        .title-and-rule {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }

        .violation-help-title {
          font-size: 16px;
          font-weight: 750;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .rule-id-code {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .header-right-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .affected-count-badge {
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          padding: 4px 10px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .toggle-expand-btn {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast);
        }

        .violation-card-item:hover .toggle-expand-btn {
          color: var(--text-primary);
        }

        /* Expanded State details styling */
        .expanded-content {
          border-top: 1px solid var(--border-color);
          padding: 24px;
          background: rgba(30, 41, 59, 0.15);
          display: flex;
          flex-direction: column;
          gap: 24px;
          text-align: left;
        }

        .violation-description-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .description-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .description-text {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* Affected elements section */
        .nodes-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .nodes-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .node-item {
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .selector-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .selector-label, .html-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .selector-code {
          font-size: 13px;
          background-color: rgba(30, 41, 59, 0.5);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #f43f5e;
          width: fit-content;
        }

        .failure-summary-block {
          background-color: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .failure-summary-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .failure-summary-title {
          font-size: 12px;
          font-weight: 800;
          color: #ef4444;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .failure-summary-text {
          font-size: 13px;
          color: #fca5a5;
          font-family: var(--font-mono);
          white-space: pre-line;
          line-height: 1.4;
        }

        /* Suggestion box styles */
        .plain-language-suggestion-box {
          background: rgba(99, 102, 241, 0.03);
          border: 1px dashed rgba(99, 102, 241, 0.35);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .suggestion-box-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .suggestion-box-title {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
        }

        .suggestion-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .sub-section-label {
          font-size: 10px;
          font-weight: 800;
          color: #a5b4fc;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          display: block;
          margin-bottom: 6px;
        }

        .suggestion-why-text, .suggestion-fix-text {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .suggestion-examples-section {
          border-top: 1px solid rgba(99, 102, 241, 0.15);
          padding-top: 18px;
          margin-top: 6px;
        }

        .example-comparison-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .example-comparison-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .example-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .example-label.label-before {
          color: #f87171;
        }

        .example-label.label-after {
          color: #34d399;
        }

        .example-code-pre {
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 12px;
          color: #e2e8f0;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .example-comparison-col.after .example-code-pre {
          border-color: rgba(16, 185, 129, 0.2);
          color: #a7f3d0;
        }

        @media (max-width: 768px) {
          .card-clickable-header {
            flex-direction: column;
            align-items: stretch;
            padding: 16px;
            gap: 12px;
          }
          
          .header-left-group {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .header-right-group {
            justify-content: space-between;
          }
          
          .suggestion-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          
          .example-comparison-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
