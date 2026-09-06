import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Trash2, AlertCircle, Loader2, Bot, User } from 'lucide-react';
import { calculateScore } from '../utils/score';

const BACKEND_URL = 'http://localhost:5000';

/**
 * AccessibilityChatbot Component
 * AI-powered assistant for understanding accessibility audit results.
 *
 * @param {object} props
 * @param {object|null} props.scanResult - Current scan result (violations, score, etc.)
 * @param {boolean} props.isDemoMode - Whether the scan is from demo mode
 * @param {object|null} props.sourceAnalysisResult - Latest source code analysis result (findings, score)
 */
export default function AccessibilityChatbot({ scanResult, isDemoMode, sourceAnalysisResult }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  /**
   * Build the scan context payload to send with each message.
   */
  const buildScanContext = () => {
    const ctx = {};

    if (scanResult) {
      if (scanResult.scannedUrl) ctx.scannedUrl = scanResult.scannedUrl;
      if (isDemoMode) ctx.isDemoMode = true;

      const score = typeof scanResult.score === 'number'
        ? scanResult.score
        : calculateScore(scanResult.violations);
      ctx.score = score;

      const violations = Array.isArray(scanResult.violations) ? scanResult.violations : [];
      if (violations.length > 0) {
        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        violations.forEach(v => {
          const impact = (v.impact || 'minor').toLowerCase();
          if (Object.hasOwn(counts, impact)) counts[impact]++;
          else counts.minor++;
        });
        ctx.violationCount = violations.length;
        ctx.severityBreakdown = counts;
        ctx.violations = violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help
        }));
      }
    }

    if (sourceAnalysisResult) {
      const findings = Array.isArray(sourceAnalysisResult.findings) ? sourceAnalysisResult.findings : [];
      if (findings.length > 0) {
        ctx.sourceFindings = findings.map(f => ({
          id: f.id,
          impact: f.impact,
          description: f.description,
          file: f.file,
          line: f.line,
          help: f.help
        }));
        if (sourceAnalysisResult.score !== undefined) {
          ctx.sourceCodeScore = sourceAnalysisResult.score;
        }
      }
    }

    return Object.keys(ctx).length > 0 ? ctx : null;
  };

  /**
   * Send a user message to the backend and display the response.
   */
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setError('');
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    abortRef.current = false;

    try {
      const scanContext = buildScanContext();

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, scanContext })
      });

      if (abortRef.current) return;

      if (!response.ok) {
        let errText = 'Failed to get a response from the assistant.';
        try {
          const errData = await response.json();
          errText = errData.error || errText;
        } catch { /* ignore */ }

        if (response.status === 401) {
          errText = 'Your session has expired. Please log in again.';
        }

        setError(errText);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (abortRef.current) return;

      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setError('The assistant returned an empty response.');
      }
    } catch (err) {
      if (abortRef.current) return;
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Cannot reach the Access Check backend server. Make sure the Node.js server is running.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      if (!abortRef.current) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Handle Enter key press to send, Shift+Enter for newline.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Clear all messages and errors.
   */
  const handleClear = () => {
    setMessages([]);
    setError('');
    if (inputRef.current) inputRef.current.focus();
  };

  /**
   * Render a single message bubble.
   */
  const renderMessage = (msg, idx) => {
    const isUser = msg.role === 'user';
    return (
      <div
        key={idx}
        className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-assistant'}`}
        role="article"
        aria-label={isUser ? 'Your message' : 'Assistant response'}
      >
        <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-assistant'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
          {msg.content}
        </div>
      </div>
    );
  };

  const hasScanContext = !!(scanResult || sourceAnalysisResult);

  return (
    <div className="chatbot-container container">
      <div className="chatbot-layout glass-card">
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-header-icon">
              <MessageCircle size={20} />
            </div>
            <div>
              <h2 className="chatbot-title">Accessibility Assistant</h2>
              <p className="chatbot-subtitle">
                Ask questions about your accessibility audit, violations, and possible fixes.
              </p>
            </div>
          </div>
          <div className="chatbot-header-actions">
            {hasScanContext && (
              <span className="chatbot-context-badge" title="Scan context will be included with your messages">
                Context active
              </span>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                className="chatbot-clear-btn"
                onClick={handleClear}
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="chatbot-messages" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.length === 0 && !isLoading && (
            <div className="chatbot-empty">
              <div className="chatbot-empty-icon">
                <Bot size={40} />
              </div>
              <h3 className="chatbot-empty-title">How can I help?</h3>
              <p className="chatbot-empty-description">
                I can explain accessibility violations, suggest fixes, and help you understand your audit results.
              </p>
              <div className="chatbot-suggestions">
                {hasScanContext ? (
                  <>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('What does this violation mean?'); inputRef.current?.focus(); }}>
                      What does this violation mean?
                    </button>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('What should I fix first?'); inputRef.current?.focus(); }}>
                      What should I fix first?
                    </button>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('Why is my accessibility score low?'); inputRef.current?.focus(); }}>
                      Why is my accessibility score low?
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('What is WCAG?'); inputRef.current?.focus(); }}>
                      What is WCAG?
                    </button>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('How do I fix color contrast?'); inputRef.current?.focus(); }}>
                      How do I fix color contrast?
                    </button>
                    <button type="button" className="chatbot-suggestion-btn" onClick={() => { setInputValue('What does missing alt text mean?'); inputRef.current?.focus(); }}>
                      What does missing alt text mean?
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => renderMessage(msg, idx))}

          {isLoading && (
            <div className="chat-message chat-message-assistant" aria-label="Assistant is typing">
              <div className="chat-avatar chat-avatar-assistant">
                <Bot size={16} />
              </div>
              <div className="chat-bubble chat-bubble-assistant chat-typing">
                <Loader2 size={16} className="typing-spinner" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Bar */}
        {error && (
          <div className="chatbot-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button type="button" className="chatbot-error-dismiss" onClick={() => setError('')} aria-label="Dismiss error">
              &times;
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="chatbot-input-area">
          <label htmlFor="chatbot-input" className="sr-only">Type your message</label>
          <textarea
            id="chatbot-input"
            ref={inputRef}
            className="chatbot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about accessibility..."
            rows={1}
            disabled={isLoading}
            aria-label="Type your accessibility question"
          />
          <button
            type="button"
            className="chatbot-send-btn"
            onClick={handleSend}
            disabled={isLoading || inputValue.trim().length === 0}
            aria-label="Send message"
            title="Send message"
          >
            {isLoading ? <Loader2 size={18} className="typing-spinner" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      <style>{`
        .chatbot-container {
          padding: 40px 24px 80px;
          display: flex;
          justify-content: center;
        }

        .chatbot-layout {
          max-width: 780px;
          width: 100%;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 160px);
          min-height: 480px;
          max-height: 800px;
          overflow: hidden;
        }

        /* Header */
        .chatbot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          gap: 12px;
        }

        .chatbot-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .chatbot-header-icon {
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: var(--radius-md);
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
        }

        .chatbot-title {
          font-size: 20px;
          font-weight: 850;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.2;
        }

        .chatbot-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 2px 0 0;
          line-height: 1.4;
        }

        .chatbot-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chatbot-context-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--success);
          background: var(--success-bg);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 4px 12px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .chatbot-clear-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .chatbot-clear-btn:hover {
          color: var(--critical);
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.25);
        }

        .chatbot-clear-btn:focus-visible {
          outline: 2px solid var(--border-focus);
          outline-offset: 2px;
        }

        /* Messages Area */
        .chatbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Empty State */
        .chatbot-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          padding: 24px;
        }

        .chatbot-empty-icon {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 50%;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 20px;
        }

        .chatbot-empty-title {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 8px;
        }

        .chatbot-empty-description {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 380px;
          line-height: 1.5;
          margin: 0 0 24px;
        }

        .chatbot-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .chatbot-suggestion-btn {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.15);
          padding: 8px 16px;
          border-radius: 9999px;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .chatbot-suggestion-btn:hover {
          color: var(--primary);
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .chatbot-suggestion-btn:focus-visible {
          outline: 2px solid var(--border-focus);
          outline-offset: 2px;
        }

        /* Message Bubbles */
        .chat-message {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }

        .chat-message-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .chat-message-assistant {
          align-self: flex-start;
        }

        .chat-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .chat-avatar-user {
          background: var(--primary);
          color: #ffffff;
        }

        .chat-avatar-assistant {
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.2);
          color: var(--primary);
        }

        .chat-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .chat-bubble-user {
          background: var(--primary);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .chat-bubble-assistant {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }

        .chat-typing {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .typing-spinner {
          animation: spin 1s linear infinite;
        }

        /* Error Bar */
        .chatbot-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(239, 68, 68, 0.08);
          border-top: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          font-size: 13px;
          font-weight: 500;
        }

        .chatbot-error svg {
          flex-shrink: 0;
          color: var(--critical);
        }

        .chatbot-error-dismiss {
          margin-left: auto;
          font-size: 18px;
          color: var(--text-muted);
          padding: 0 4px;
          line-height: 1;
        }

        .chatbot-error-dismiss:hover {
          color: var(--critical);
        }

        .chatbot-error-dismiss:focus-visible {
          outline: 2px solid var(--border-focus);
          outline-offset: 2px;
        }

        /* Input Area */
        .chatbot-input-area {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
          background: rgba(15, 23, 42, 0.4);
        }

        .chatbot-input {
          flex: 1;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.5;
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          resize: none;
          min-height: 42px;
          max-height: 120px;
          transition: border-color var(--transition-fast);
        }

        .chatbot-input::placeholder {
          color: var(--text-muted);
        }

        .chatbot-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .chatbot-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chatbot-send-btn {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary);
          color: #ffffff;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .chatbot-send-btn:hover:not(:disabled) {
          background: var(--primary-hover);
        }

        .chatbot-send-btn:focus-visible {
          outline: 2px solid var(--border-focus);
          outline-offset: 2px;
        }

        .chatbot-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Screen reader only */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .chatbot-container {
            padding: 20px 12px 60px;
          }

          .chatbot-layout {
            height: calc(100vh - 140px);
            min-height: 400px;
          }

          .chatbot-header {
            padding: 16px;
          }

          .chatbot-title {
            font-size: 17px;
          }

          .chatbot-subtitle {
            font-size: 12px;
          }

          .chatbot-messages {
            padding: 16px;
          }

          .chat-message {
            max-width: 92%;
          }

          .chatbot-input-area {
            padding: 12px;
          }
        }

        @media (max-width: 480px) {
          .chatbot-header-left {
            gap: 10px;
          }

          .chatbot-header-icon {
            padding: 8px;
          }

          .chatbot-suggestions {
            flex-direction: column;
            align-items: stretch;
          }

          .chatbot-suggestion-btn {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
