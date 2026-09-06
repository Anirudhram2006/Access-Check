import React, { useState, useEffect } from 'react';
import { Eye, Lock, RotateCw, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, ShieldAlert, Sparkles, Info } from 'lucide-react';

/**
 * VisionSimulator Component
 * Allows users to simulate how a scanned webpage looks under various visual conditions.
 * Uses client-side SVG and CSS filters for high performance.
 * 
 * @param {object} props
 * @param {object} props.scanResult - The current scan result containing scannedUrl and screenshotUrl
 * @param {boolean} props.isDemoMode - Whether the current scan is the offline demo scan
 * @param {function} props.onNavigateToScanner - Callback to return to the scanner screen
 */
export default function VisionSimulator({ 
  scanResult, 
  isDemoMode, 
  onNavigateToScanner,
  customTamilText,
  setCustomTamilText,
  customHindiText,
  setCustomHindiText 
}) {
  const [activeMode, setActiveMode] = useState('original');
  const [zoom, setZoom] = useState(100);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const modes = [
    {
      id: 'original',
      label: 'Original',
      description: 'Normal view of the scanned webpage.'
    },
    {
      id: 'protanopia',
      label: 'Protanopia',
      description: 'Simulates reduced sensitivity to red light, which can make certain red/green distinctions difficult to perceive.'
    },
    {
      id: 'deuteranopia',
      label: 'Deuteranopia',
      description: 'Simulates reduced sensitivity to green light, which can affect how some red/green color differences are perceived.'
    },
    {
      id: 'tritanopia',
      label: 'Tritanopia',
      description: 'Simulates absence of blue cone cells, causing difficulty distinguishing between blue/green and yellow/pink hues.'
    },
    {
      id: 'low-vision',
      label: 'Low Vision',
      description: 'An illustrative visual-clarity simulation using blur and contrast reduction.'
    },
    {
      id: 'tamil-sim',
      label: 'Tamil Simulator',
      description: 'Heuristic simulation exploring letter crowding, spacing anomalies, and visual drift in Tamil script to understand potential reading strain.'
    },
    {
      id: 'hindi-sim',
      label: 'Hindi Simulator',
      description: 'Heuristic simulation exploring letter crowding, spacing anomalies, and logical cluster shifts in Hindi (Devanagari) script.'
    }
  ];

  // Constants and state for experimental Indian-script simulator
  const TAMIL_SAMPLE = "அனைத்து மக்களும் இணையதளத்தை எளிதாகப் பயன்படுத்த வேண்டும் என்பதே எங்கள் நோக்கம். இந்தத் தொழில்நுட்பம் தமிழ் எழுத்துக்களின் வாசிப்புத் திறனை ஆராய உதவுகிறது. சோதனை முறையில் இதைப் பயன்படுத்திப் பார்க்கலாம்.";
  const HINDI_SAMPLE = "हमारा उद्देश्य सभी लोगों के लिए वेबसाइट को सुगम और सुलभ बनाना है। यह तकनीक हिंदी (देवनागरी) लिपि के वासी पाठकों के अनुभव को समझने में मदद करती है। कृपया यहाँ अपना हिंदी पाठ दर्ज करें।";

  const [tamilText, setTamilText] = useState(() => {
    if (customTamilText) return customTamilText;
    if (scanResult?.indicText?.tamil && scanResult.indicText.tamil.length > 0) {
      return scanResult.indicText.tamil.join('\n');
    }
    return TAMIL_SAMPLE;
  });

  const [hindiText, setHindiText] = useState(() => {
    if (customHindiText) return customHindiText;
    if (scanResult?.indicText?.hindi && scanResult.indicText.hindi.length > 0) {
      return scanResult.indicText.hindi.join('\n');
    }
    return HINDI_SAMPLE;
  });

  // Keep local states synchronized with props and scan result updates
  useEffect(() => {
    if (customTamilText !== null) {
      setTamilText(customTamilText);
    } else if (scanResult?.indicText?.tamil && scanResult.indicText.tamil.length > 0) {
      setTamilText(scanResult.indicText.tamil.join('\n'));
    } else {
      setTamilText(TAMIL_SAMPLE);
    }
  }, [customTamilText, scanResult]);

  useEffect(() => {
    if (customHindiText !== null) {
      setHindiText(customHindiText);
    } else if (scanResult?.indicText?.hindi && scanResult.indicText.hindi.length > 0) {
      setHindiText(scanResult.indicText.hindi.join('\n'));
    } else {
      setHindiText(HINDI_SAMPLE);
    }
  }, [customHindiText, scanResult]);

  const [strainLevel, setStrainLevel] = useState('moderate'); // 'mild' | 'moderate' | 'severe'

  // Segment text into Indic logical clusters (aksharas)
  const getIndicClusters = (text, lang) => {
    const clusters = [];
    let i = 0;
    
    const isDevanagari = (ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x0900 && code <= 0x097F;
    };
    
    const isTamil = (ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x0B80 && code <= 0x0BFF;
    };
    
    const isMark = (ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0x0901 && code <= 0x0903) return true; // Devanagari chandrabindu, anusvara, visarga
      if (code === 0x093C) return true; // Devanagari nukta
      if (code >= 0x093E && code <= 0x094F) return true; // Devanagari matras, virama
      if (code >= 0x0951 && code <= 0x0957) return true; // Devanagari stress marks
      if (code >= 0x0962 && code <= 0x0963) return true; // Devanagari vocalic signs
      
      if (code === 0x0B82) return true; // Tamil anusvara
      if (code >= 0x0BBE && code <= 0x0BCD) return true; // Tamil matras, pulli
      if (code === 0x0BD7) return true; // Tamil au length mark
      
      return false;
    };

    const isVirama = (ch) => {
      const code = ch.charCodeAt(0);
      return code === 0x094D || code === 0x0BCD;
    };

    while (i < text.length) {
      let ch = text[i];
      if (!isDevanagari(ch) && !isTamil(ch)) {
        clusters.push(ch);
        i++;
        continue;
      }
      
      let cluster = ch;
      i++;
      
      while (i < text.length) {
        let nextCh = text[i];
        if (isMark(nextCh)) {
          cluster += nextCh;
          i++;
          if (isVirama(nextCh) && i < text.length) {
            let conjCh = text[i];
            if (isDevanagari(conjCh) || isTamil(conjCh)) {
              cluster += conjCh;
              i++;
            }
          }
        } else {
          break;
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  };

  // Perform deterministic distortion based on Indic logical clusters
  const processText = (text, lang, strain) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const tokens = line.split(/(\s+)/);
      return tokens.map((token, tokenIdx) => {
        if (/^\s+$/.test(token)) {
          return token;
        }
        
        const clusters = getIndicClusters(token, lang);
        let finalClusters = [...clusters];
        
        let swapFreq = 0;
        if (strain === 'mild') swapFreq = 8;
        else if (strain === 'moderate') swapFreq = 4;
        else if (strain === 'severe') swapFreq = 2;
        
        // Middle-cluster reordering (safe swapping of middle adjacent clusters in word of length >= 3)
        if (clusters.length >= 3 && swapFreq > 0) {
          const deterministicVal = (lineIdx * 7 + tokenIdx * 13) % swapFreq;
          if (deterministicVal === 1) {
            const temp = finalClusters[1];
            finalClusters[1] = finalClusters[2];
            finalClusters[2] = temp;
          }
        }
        
        return {
          isWord: true,
          originalWord: token,
          clusters: finalClusters.map((cluster, clusterIdx) => {
            let marginVal = '0';
            let transformVal = 'none';
            
            const val = (lineIdx * 11 + tokenIdx * 17 + clusterIdx * 23);
            
            if (strain !== 'none') {
              let spaceMult = 1;
              if (strain === 'mild') spaceMult = 0.4;
              if (strain === 'severe') spaceMult = 1.8;
              
              // Spacing and crowding (margin adjustment)
              if (val % 4 === 0) {
                marginVal = `-${0.12 * spaceMult}em`;
              } else if (val % 4 === 2) {
                marginVal = `${0.1 * spaceMult}em`;
              }
              
              // Visual drifting and translation offsets
              let driftMult = 1;
              if (strain === 'mild') driftMult = 0.3;
              if (strain === 'severe') driftMult = 2.0;
              
              if (val % 5 === 1) {
                transformVal = `translateY(-${1.2 * driftMult}px) rotate(-${0.8 * driftMult}deg)`;
              } else if (val % 5 === 3) {
                transformVal = `translateY(${1.0 * driftMult}px) rotate(${0.6 * driftMult}deg)`;
              } else if (val % 7 === 2) {
                transformVal = `translateX(${0.8 * driftMult}px) translateY(-${0.5 * driftMult}px)`;
              }
            }
            
            return {
              char: cluster,
              marginRight: marginVal,
              transform: transformVal
            };
          })
        };
      });
    });
  };

  const renderSimulatedLine = (line, lineIdx) => {
    return (
      <div key={`sim-line-${lineIdx}`} className="sim-line">
        {line.map((token, tokenIdx) => {
          if (typeof token === 'string') {
            return <span key={`sim-ws-${tokenIdx}`} className="sim-whitespace">{token}</span>;
          }
          
          return (
            <span key={`sim-word-${tokenIdx}`} className="sim-word">
              {token.clusters.map((cluster, clusterIdx) => (
                <span 
                  key={`sim-cluster-${clusterIdx}`} 
                  className="sim-cluster"
                  style={{
                    display: 'inline-block',
                    marginRight: cluster.marginRight,
                    transform: cluster.transform,
                    transformOrigin: 'center bottom',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {cluster.char}
                </span>
              ))}
            </span>
          );
        })}
      </div>
    );
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  const handleZoomReset = () => setZoom(100);

  // If there is no active scan, display a premium empty state
  if (!scanResult) {
    return (
      <div className="simulator-no-scan container">
        <div className="no-scan-card glass-card">
          <div className="no-scan-icon-wrapper">
            <Eye className="no-scan-icon text-muted" size={48} />
          </div>
          <h2 className="no-scan-title">No website scanned yet</h2>
          <p className="no-scan-description">
            Run an accessibility scan to explore the website through different visual conditions.
          </p>
          <button 
            type="button"
            className="go-to-scanner-btn"
            onClick={onNavigateToScanner}
            aria-label="Go to Accessibility Scanner"
          >
            <Sparkles size={16} />
            <span>Go to Scanner</span>
          </button>
        </div>

        <style>{`
          .simulator-no-scan {
            padding: 80px 24px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 60vh;
          }

          .no-scan-card {
            max-width: 520px;
            width: 100%;
            padding: 48px 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            border-color: var(--border-color);
            box-shadow: var(--shadow-lg);
          }

          .no-scan-icon-wrapper {
            background-color: rgba(148, 163, 184, 0.08);
            border: 1px solid rgba(148, 163, 184, 0.2);
            padding: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
          }

          .no-scan-icon {
            color: var(--text-secondary);
          }

          .no-scan-title {
            font-size: 24px;
            font-weight: 850;
            letter-spacing: -0.02em;
            margin-bottom: 12px;
          }

          .no-scan-description {
            font-size: 15px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 28px;
            max-width: 380px;
          }

          .go-to-scanner-btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background-color: var(--primary);
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            padding: 12px 24px;
            border-radius: var(--radius-md);
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
            transition: all var(--transition-fast);
          }

          .go-to-scanner-btn:hover {
            background-color: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
          }

          .go-to-scanner-btn:focus-visible {
            outline: 2px solid var(--border-focus);
            outline-offset: 2px;
          }
        `}</style>
      </div>
    );
  }

  // Determine current active mode details
  const activeModeDetails = modes.find(m => m.id === activeMode) || modes[0];

  // Resolve absolute screenshot path
  const screenshotPath = scanResult.screenshotUrl || '';
  const absoluteScreenshotUrl = screenshotPath.startsWith('http') 
    ? screenshotPath 
    : `${BACKEND_URL}${screenshotPath}`;

  // Get active CSS filter
  const getFilterStyle = () => {
    switch (activeMode) {
      case 'protanopia':
        return 'url(#access-check-protanopia)';
      case 'deuteranopia':
        return 'url(#access-check-deuteranopia)';
      case 'tritanopia':
        return 'url(#access-check-tritanopia)';
      case 'low-vision':
        return 'blur(4px) contrast(0.75) brightness(0.95)';
      case 'original':
      default:
        return 'none';
    }
  };

  return (
    <div className="simulator-view-container container">
      {/* Hidden SVG Filters for Color Blindness simulations */}
      <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {/* Protanopia color matrix */}
          <filter id="access-check-protanopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix
              type="matrix"
              values="0.56667 0.43333 0.00000 0.00000 0.00000
                      0.55833 0.44167 0.00000 0.00000 0.00000
                      0.00000 0.24167 0.75833 0.00000 0.00000
                      0.00000 0.00000 0.00000 1.00000 0.00000"
            />
          </filter>
          {/* Deuteranopia color matrix */}
          <filter id="access-check-deuteranopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix
              type="matrix"
              values="0.62500 0.37500 0.00000 0.00000 0.00000
                      0.70000 0.30000 0.00000 0.00000 0.00000
                      0.00000 0.30000 0.70000 0.00000 0.00000
                      0.00000 0.00000 0.00000 1.00000 0.00000"
            />
          </filter>
          {/* Tritanopia color matrix — blue-yellow color blindness (Brettel/Viénot model) */}
          <filter id="access-check-tritanopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix
              type="matrix"
              values="0.95033  0.04967  0.00000  0.00000  0.00000
                      0.00000  0.43277  0.56723  0.00000  0.00000
                      0.00000  0.47300  0.52700  0.00000  0.00000
                      0.00000  0.00000  0.00000  1.00000  0.00000"
            />
          </filter>
        </defs>
      </svg>

      {/* Header and Introduction */}
      <div className="simulator-header-block">
        <div className="simulator-header-left">
          <h2 className="simulator-main-title">Experience the Web Differently</h2>
          <p className="simulator-sub-title">
            See how the same website may appear under different visual accessibility conditions.
          </p>
        </div>
        {isDemoMode && (
          <div className="demo-badge-container">
            <span className="demo-badge">Demo Mode Active</span>
          </div>
        )}
      </div>

      {/* Control Panel: Simulator Mode Switcher & Explanation */}
      <div className="simulator-controls-card glass-card">
        <div className="mode-selector-wrapper" role="tablist" aria-label="Visual accessibility modes">
          {modes.map(mode => (
            <button
              key={mode.id}
              id={`tab-${mode.id}`}
              type="button"
              role="tab"
              aria-selected={activeMode === mode.id}
              aria-controls={`panel-${mode.id}`}
              className={`mode-tab-btn ${activeMode === mode.id ? 'active' : ''}`}
              onClick={() => setActiveMode(mode.id)}
            >
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <div 
          className="mode-explanation-panel" 
          id={`panel-${activeMode}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeMode}`}
        >
          <Info size={16} className="explanation-info-icon" />
          <p className="explanation-text">
            <strong>{activeModeDetails.label}:</strong> {activeModeDetails.description}
          </p>
        </div>
      </div>

      {/* Browser Mockup Window with simulation applied */}
      <div className="simulator-browser-mockup">
        {/* Browser Mockup Header */}
        <div className="simulator-browser-titlebar">
          <div className="simulator-browser-dots">
            <span className="sim-dot sim-close"></span>
            <span className="sim-dot sim-minimize"></span>
            <span className="sim-dot sim-expand"></span>
          </div>
          
          <div className="simulator-browser-nav-icons">
            <ChevronLeft size={16} className="sim-nav-icon disabled" />
            <ChevronRight size={16} className="sim-nav-icon disabled" />
            <RotateCw size={14} className="sim-nav-icon" />
          </div>

          <div className="simulator-browser-addressbar">
            <Lock size={12} className="sim-lock-icon" />
            <span className="sim-address-text">
              {activeMode === 'tamil-sim' || activeMode === 'hindi-sim' 
                ? "https://access-check.org/experimental-indic-simulator" 
                : (scanResult.scannedUrl || "https://example.com")}
            </span>
          </div>

          {!(activeMode === 'tamil-sim' || activeMode === 'hindi-sim') && (
            <div className="simulator-browser-zoom">
              <button 
                type="button" 
                onClick={handleZoomOut} 
                className="sim-zoom-btn" 
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="sim-zoom-value">{zoom}%</span>
              <button 
                type="button" 
                onClick={handleZoomIn} 
                className="sim-zoom-btn" 
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button 
                type="button" 
                onClick={handleZoomReset} 
                className="sim-zoom-btn text-muted" 
                title="Reset Zoom"
                aria-label="Reset Zoom"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Mock Browser Viewport */}
        <div className={`simulator-browser-viewport ${activeMode === 'tamil-sim' || activeMode === 'hindi-sim' ? 'indic-active' : ''}`}>
          {activeMode === 'tamil-sim' || activeMode === 'hindi-sim' ? (
            <div className="indic-sim-workspace">
              {/* Disclaimer Banner */}
              <div className="indic-disclaimer-banner">
                <div className="indic-disclaimer-title">
                  <ShieldAlert size={14} className="disclaimer-icon" />
                  <span>Experimental — not clinically validated</span>
                </div>
                <p className="indic-disclaimer-text">
                  This is a heuristic visualization for exploring possible reading strain and is NOT medical/diagnostic. It does not claim to simulate actual dyslexia.
                </p>
              </div>

              {/* Control Bar */}
              <div className="indic-controls-bar">
                <div className="control-group">
                  <span className="control-label">Language:</span>
                  <div className="control-buttons">
                    <button
                      type="button"
                      className={`control-btn ${activeMode === 'tamil-sim' ? 'active' : ''}`}
                      onClick={() => setActiveMode('tamil-sim')}
                    >
                      Tamil
                    </button>
                    <button
                      type="button"
                      className={`control-btn ${activeMode === 'hindi-sim' ? 'active' : ''}`}
                      onClick={() => setActiveMode('hindi-sim')}
                    >
                      Hindi
                    </button>
                  </div>
                </div>

                <div className="control-group">
                  <span className="control-label">Strain Level:</span>
                  <div className="control-buttons">
                    {['mild', 'moderate', 'severe'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`control-btn level-btn ${strainLevel === level ? `active-${level}` : ''}`}
                        onClick={() => setStrainLevel(level)}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group action-group">
                  <button
                    type="button"
                    className="reset-btn"
                    onClick={() => {
                      if (activeMode === 'tamil-sim') {
                        const target = (scanResult?.indicText?.tamil && scanResult.indicText.tamil.length > 0)
                          ? scanResult.indicText.tamil.join('\n')
                          : TAMIL_SAMPLE;
                        setTamilText(target);
                        setCustomTamilText(target);
                      } else {
                        const target = (scanResult?.indicText?.hindi && scanResult.indicText.hindi.length > 0)
                          ? scanResult.indicText.hindi.join('\n')
                          : HINDI_SAMPLE;
                        setHindiText(target);
                        setCustomHindiText(target);
                      }
                    }}
                    title="Reset to default sample text"
                  >
                    <RotateCw size={12} />
                    <span>Reset Sample</span>
                  </button>
                </div>
              </div>

              {/* Main Editor & Reader Area */}
              <div className="indic-main-area">
                {/* Input Area */}
                <div className="indic-pane indic-input-pane">
                  <div className="pane-header">
                    <span>Custom Text Input</span>
                  </div>
                  <textarea
                    className="indic-textarea"
                    value={activeMode === 'tamil-sim' ? tamilText : hindiText}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (activeMode === 'tamil-sim') {
                        setTamilText(value);
                        setCustomTamilText(value);
                      } else {
                        setHindiText(value);
                        setCustomHindiText(value);
                      }
                    }}
                    placeholder={`Type or paste ${activeMode === 'tamil-sim' ? 'Tamil' : 'Hindi'} text here...`}
                    aria-label="Custom Tamil or Hindi text input"
                  />
                </div>

                {/* Output Area */}
                <div className="indic-pane indic-output-pane">
                  <div className="pane-header">
                    <span>Simulated Reading View</span>
                  </div>
                  <div className="indic-output-box">
                    {processText(
                      activeMode === 'tamil-sim' ? tamilText : hindiText,
                      activeMode === 'tamil-sim' ? 'tamil' : 'hindi',
                      strainLevel
                    ).map((line, lineIdx) => renderSimulatedLine(line, lineIdx))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="simulator-scroll-container">
              <img 
                src={absoluteScreenshotUrl} 
                alt={`Webpage mockup under ${activeModeDetails.label} simulation`}
                className="simulator-screenshot-img"
                style={{ 
                  transform: `scale(${zoom / 100})`, 
                  transformOrigin: 'top center',
                  filter: getFilterStyle()
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80';
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .simulator-view-container {
          padding: 40px 24px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Header Block */
        .simulator-header-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          text-align: left;
        }

        .simulator-main-title {
          font-size: 28px;
          font-weight: 850;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }

        .simulator-sub-title {
          font-size: 15px;
          color: var(--text-secondary);
        }

        .demo-badge-container {
          display: flex;
          align-items: center;
        }

        .demo-badge {
          font-size: 12px;
          font-weight: 800;
          color: #fef08a;
          background: rgba(234, 179, 8, 0.15);
          border: 1px solid rgba(234, 179, 8, 0.3);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Control Panel */
        .simulator-controls-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          text-align: left;
        }

        .mode-selector-wrapper {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid var(--border-color);
          padding: 6px;
          border-radius: var(--radius-md);
          width: fit-content;
        }

        .mode-tab-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mode-tab-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .mode-tab-btn:focus-visible {
          outline: 2px solid var(--border-focus);
          outline-offset: -2px;
        }

        .mode-tab-btn.active {
          color: #ffffff;
          background: var(--primary);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .mode-explanation-panel {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background-color: rgba(99, 102, 241, 0.04);
          border: 1px solid rgba(99, 102, 241, 0.15);
          padding: 14px 18px;
          border-radius: var(--radius-md);
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .explanation-info-icon {
          color: var(--primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .explanation-text strong {
          color: #ffffff;
        }

        /* Browser Mockup */
        .simulator-browser-mockup {
          background-color: #0d121f;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .simulator-browser-titlebar {
          background-color: #1e293b;
          border-bottom: 1px solid var(--border-color);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          text-align: left;
        }

        .simulator-browser-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .sim-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .sim-dot.sim-close { background-color: #ef4444; }
        .sim-dot.sim-minimize { background-color: #eab308; }
        .sim-dot.sim-expand { background-color: #22c55e; }

        .simulator-browser-nav-icons {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
        }

        .sim-nav-icon {
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .sim-nav-icon:hover {
          color: var(--text-primary);
        }

        .sim-nav-icon.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .simulator-browser-addressbar {
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 6px 14px;
          flex-grow: 1;
          min-width: 160px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .sim-lock-icon {
          color: var(--success);
        }

        .sim-address-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
          font-family: var(--font-sans);
          font-weight: 500;
        }

        .simulator-browser-zoom {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
        }

        .sim-zoom-btn {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast);
        }

        .sim-zoom-btn:hover {
          color: #ffffff;
        }

        .sim-zoom-btn:focus-visible {
          outline: 1px solid var(--border-focus);
        }

        .sim-zoom-value {
          font-size: 11px;
          font-weight: 750;
          min-width: 36px;
          text-align: center;
          color: var(--text-primary);
        }

        /* Viewport */
        .simulator-browser-viewport {
          height: 520px;
          background-color: #ffffff;
          overflow: hidden;
          position: relative;
        }

        .simulator-browser-viewport.indic-active {
          height: 600px;
        }

        .simulator-scroll-container {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: auto;
        }

        .simulator-screenshot-img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
        }

        /* Tamil/Hindi Simulator Workspace Styles */
        .indic-sim-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #0b0f19;
          color: #f8fafc;
          font-family: var(--font-sans);
        }

        .indic-disclaimer-banner {
          background-color: rgba(239, 68, 68, 0.08);
          border-bottom: 1px solid rgba(239, 68, 68, 0.25);
          padding: 10px 16px;
          text-align: left;
        }

        .indic-disclaimer-title {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #f87171;
          font-size: 13px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 2px;
        }

        .disclaimer-icon {
          flex-shrink: 0;
        }

        .indic-disclaimer-text {
          font-size: 11px;
          color: #cbd5e1;
          line-height: 1.4;
        }

        .indic-controls-bar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          padding: 12px 16px;
          background-color: #151d30;
          border-bottom: 1px solid var(--border-color);
          text-align: left;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .control-buttons {
          display: flex;
          gap: 4px;
          background-color: rgba(15, 23, 42, 0.4);
          padding: 3px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }

        .control-btn {
          font-size: 12px;
          font-weight: 750;
          color: var(--text-secondary);
          padding: 5px 12px;
          border-radius: 4px;
          transition: all var(--transition-fast);
        }

        .control-btn:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.05);
        }

        .control-btn.active {
          color: #ffffff;
          background-color: var(--primary);
          box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
        }

        .control-btn.level-btn {
          background: transparent;
        }

        .control-btn.level-btn.active-mild {
          color: #ffffff;
          background-color: var(--minor);
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }

        .control-btn.level-btn.active-moderate {
          color: #ffffff;
          background-color: var(--moderate);
          box-shadow: 0 2px 6px rgba(234, 179, 8, 0.3);
        }

        .control-btn.level-btn.active-severe {
          color: #ffffff;
          background-color: var(--critical);
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
        }

        .action-group {
          margin-left: auto;
        }

        .reset-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .reset-btn:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.08);
          border-color: var(--text-muted);
        }

        .indic-main-area {
          display: grid;
          grid-template-columns: 1fr 1fr;
          flex-grow: 1;
          overflow: hidden;
        }

        .indic-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid var(--border-color);
          text-align: left;
          overflow: hidden;
        }

        .indic-pane:last-child {
          border-right: none;
        }

        .pane-header {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          background-color: rgba(15, 23, 42, 0.5);
          padding: 6px 16px;
          border-bottom: 1px solid var(--border-color);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .indic-textarea {
          flex-grow: 1;
          background-color: #0b0f19;
          color: #e2e8f0;
          border: none;
          padding: 16px;
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.6;
          resize: none;
          outline: none;
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }

        .indic-textarea:focus {
          background-color: #0d1322;
        }

        .indic-output-pane {
          background-color: #ffffff;
          color: #0f172a;
        }

        .indic-output-box {
          flex-grow: 1;
          padding: 20px;
          overflow-y: auto;
          font-family: var(--font-sans);
          text-align: left;
          user-select: none;
          height: 100%;
        }

        /* Reading output line and word clustering */
        .sim-line {
          margin-bottom: 1.5em;
          line-height: 2.2;
          font-size: 18px;
        }

        .sim-whitespace {
          white-space: pre-wrap;
        }

        .sim-word {
          display: inline-block;
          white-space: nowrap;
        }

        .sim-cluster {
          display: inline-block;
          font-family: inherit;
        }

        @media (max-width: 1024px) {
          .simulator-view-container {
            padding: 24px 12px 60px;
          }
          
          .mode-selector-wrapper {
            width: 100%;
          }
          
          .mode-tab-btn {
            flex-grow: 1;
          }
        }

        @media (max-width: 768px) {
          .simulator-browser-viewport {
            height: 360px;
          }

          .simulator-browser-viewport.indic-active {
            height: auto;
            min-height: 700px;
          }

          .indic-main-area {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1.2fr;
            overflow: visible;
          }

          .indic-pane {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            height: auto;
            overflow: visible;
          }

          .indic-pane:last-child {
            border-bottom: none;
          }

          .indic-textarea {
            min-height: 160px;
          }

          .indic-output-box {
            min-height: 240px;
          }

          .indic-controls-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .action-group {
            margin-left: 0;
          }
          
          .simulator-browser-titlebar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 12px;
          }
          
          .simulator-browser-addressbar {
            width: 100%;
          }
          
          .simulator-browser-zoom {
            justify-content: center;
          }
          
          .simulator-header-block {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
