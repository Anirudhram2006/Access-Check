import React, { useEffect, useState } from 'react';

/**
 * ScoreGauge Component
 * Renders a premium, animated donut chart representing the calculated accessibility score.
 * 
 * @param {object} props
 * @param {number} props.score - Calculated score from 0 to 100
 */
export default function ScoreGauge({ score }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score count-up on load
  useEffect(() => {
    const duration = 1200; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function - easeOutQuad
      const easedProgress = progress * (2 - progress);
      
      setAnimatedScore(Math.round(easedProgress * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  // Determine color theme based on score value
  let scoreColorClass = 'text-critical';
  let scoreStroke = 'var(--critical)';
  let ratingText = 'POOR';
  let ratingSubText = 'Significant accessibility barriers identified.';

  if (score >= 90) {
    scoreColorClass = 'text-success-gauge';
    scoreStroke = 'var(--success)';
    ratingText = 'EXCELLENT';
    ratingSubText = 'Exceptional adherence to accessibility rules.';
  } else if (score >= 70) {
    scoreColorClass = 'text-minor-gauge';
    scoreStroke = 'var(--minor)';
    ratingText = 'GOOD';
    ratingSubText = 'Minor accessibility violations detected.';
  } else if (score >= 50) {
    scoreColorClass = 'text-moderate-gauge';
    scoreStroke = 'var(--moderate)';
    ratingText = 'FAIR';
    ratingSubText = 'Several moderate and serious barriers found.';
  } else {
    ratingText = 'CRITICAL';
    ratingSubText = 'Severe accessibility barriers identified.';
  }

  // Circular gauge constants
  const radius = 80;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="score-gauge-card glass-card">
      <h3 className="card-title-uppercase">Access Check Score</h3>
      
      <div className="gauge-outer-wrapper">
        <svg className="svg-gauge" width="200" height="200" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Active colored gauge circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={scoreStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
          />
        </svg>
        <div className="gauge-center-text">
          <span className={`gauge-score-number ${scoreColorClass}`}>{animatedScore}</span>
          <span className="gauge-score-total">/ 100</span>
        </div>
      </div>

      <div className="gauge-rating-section">
        <span className={`rating-badge badge ${ratingText.toLowerCase() === 'excellent' || ratingText.toLowerCase() === 'good' ? 'success' : ratingText.toLowerCase() === 'fair' ? 'moderate' : 'critical'}`}>
          {ratingText}
        </span>
        <p className="rating-explanation">{ratingSubText}</p>
      </div>

      <div className="gauge-footer-disclaimer">
        <p>This is an Access Check project score, not an official WCAG score.</p>
      </div>

      <style>{`
        .score-gauge-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          height: 100%;
          justify-content: space-between;
        }

        .card-title-uppercase {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .gauge-outer-wrapper {
          position: relative;
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .svg-gauge {
          width: 100%;
          height: 100%;
        }

        .gauge-center-text {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .gauge-score-number {
          font-size: 56px;
          font-weight: 850;
          letter-spacing: -0.03em;
        }

        .text-success-gauge {
          color: var(--success);
          text-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
        }

        .text-minor-gauge {
          color: var(--minor);
          text-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
        }

        .text-moderate-gauge {
          color: var(--moderate);
          text-shadow: 0 0 15px rgba(234, 179, 8, 0.3);
        }

        .text-critical {
          color: var(--critical);
          text-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
        }

        .gauge-score-total {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 700;
          margin-top: 4px;
        }

        .gauge-rating-section {
          margin-bottom: 24px;
        }

        .rating-badge {
          font-size: 12px;
          padding: 6px 14px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .rating-explanation {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 220px;
          margin: 8px auto 0;
          line-height: 1.4;
        }

        .gauge-footer-disclaimer {
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
          width: 100%;
        }

        .gauge-footer-disclaimer p {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
