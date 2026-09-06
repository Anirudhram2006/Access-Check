const express = require('express');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Authentication middleware                                           */
/* ------------------------------------------------------------------ */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/* ------------------------------------------------------------------ */
/* Violation knowledge base                                            */
/* ------------------------------------------------------------------ */

const VIOLATION_INFO = {
  'color-contrast': {
    what: 'The contrast ratio between text and its background is too low.',
    why: 'Users with low vision or color blindness may not be able to read the text. WCAG requires a ratio of at least 4.5:1 for normal text and 3:1 for large text.',
    fix: 'Increase the contrast between foreground and background colors. Use a contrast checker tool to verify your ratio meets WCAG AA standards.'
  },
  'image-alt': {
    what: 'An image is missing an alt attribute, or the alt text is empty on a meaningful image.',
    why: 'Screen readers cannot describe the image to blind users. They may read the file name instead, which is confusing.',
    fix: 'Add a descriptive alt attribute to each meaningful image: <img src="photo.jpg" alt="Team meeting in progress">. Use alt="" only for purely decorative images.'
  },
  'html-has-lang': {
    what: 'The <html> element is missing a lang attribute.',
    why: 'Screen readers use the lang attribute to select the correct pronunciation rules. Without it, content may be read with the wrong accent or language model.',
    fix: 'Add a lang attribute to your <html> tag: <html lang="en">. Use the appropriate language code for your page content.'
  },
  'label': {
    what: 'A form input is missing an associated <label> element.',
    why: 'Screen reader users cannot identify what information each form field expects. Visual-only labels also fail when text is resized.',
    fix: 'Associate labels with inputs using matching for/id attributes: <label for="email">Email</label> <input id="email" type="email">.'
  },
  'link-name': {
    what: 'A link has no discernible text, or uses non-descriptive text like "click here".',
    why: 'Screen reader users navigating by links hear every link\'s text. Generic text like "click here" provides no context about the destination.',
    fix: 'Use descriptive link text that explains where the link goes: "Read our accessibility guide" instead of "Click here".'
  },
  'region': {
    what: 'Page content is not contained within ARIA landmarks.',
    why: 'Screen reader users rely on landmarks to quickly navigate page sections. Without them, they must tab through every element.',
    fix: 'Wrap content in semantic HTML5 elements like <header>, <nav>, <main>, <footer>, or add ARIA landmark roles.'
  },
  'landmark-one-main': {
    what: 'The page does not have exactly one main landmark.',
    why: 'Screen reader users expect a single <main> landmark to skip directly to the primary content. Multiple or missing mains make navigation harder.',
    fix: 'Wrap your primary page content in a single <main> element. Use <section> with aria-label for other major areas.'
  },
  'heading-order': {
    what: 'Heading levels are skipped (e.g., h1 followed by h3).',
    why: 'Screen reader users navigate by heading level. Skipped levels break the document outline and make it hard to understand page structure.',
    fix: 'Use headings in sequential order: h1 > h2 > h3. Never skip levels for visual styling—use CSS instead.'
  },
  'aria-allowed-attr': {
    what: 'An ARIA attribute is used on an element that does not support it.',
    why: 'Incorrect ARIA usage can confuse assistive technologies, causing them to announce incorrect states or properties.',
    fix: 'Check the ARIA specification to verify which attributes are allowed for each role. Remove or move unsupported attributes.'
  },
  'button-name': {
    what: 'A button has no accessible name (no text, aria-label, or aria-labelledby).',
    why: 'Screen reader users hear "button" with no indication of what it does. This makes forms and interactive content unusable.',
    fix: 'Add visible text inside the button, or use aria-label="descriptive text" if the button only contains an icon.'
  },
  'document-title': {
    what: 'The HTML document is missing a <title> element, or the title is empty.',
    why: 'The page title is the first thing screen reader users hear when a page loads. It also appears in browser tabs and bookmarks.',
    fix: 'Add a unique, descriptive <title> element inside <head>: <title>My Page - Site Name</title>.'
  },
  'meta-viewport': {
    what: 'The viewport meta tag disables user scaling.',
    why: 'Users with low vision need to zoom in to read content. Disabling pinch-to-zoom breaks WCAG Success Criterion 1.4.4.',
    fix: 'Remove or fix the maximum-scale and user-scalable attributes: <meta name="viewport" content="width=device-width, initial-scale=1">'
  }
};

/* ------------------------------------------------------------------ */
/* Local response generator                                            */
/* ------------------------------------------------------------------ */

function generateLocalResponse(message, context) {
  const lower = message.toLowerCase().trim();
  const hasScan = context && context.violations && context.violations.length > 0;
  const violations = hasScan ? context.violations : [];
  const severity = context && context.severityBreakdown ? context.severityBreakdown : null;

  // ---- Score-related questions ----
  if (/\b(score|rating|grade)\b/.test(lower) && (/\b(low|bad|poor|why|how)\b/.test(lower) || /\?/.test(lower))) {
    if (hasScan) {
      const score = context.score;
      let response = `Your current accessibility score is ${score}. `;
      if (score >= 90) {
        response += 'This is excellent! Your page has very few accessibility issues.';
      } else if (score >= 70) {
        response += 'This is a decent score, but there is room for improvement.';
      } else if (score >= 50) {
        response += 'This score indicates several significant accessibility barriers exist.';
      } else {
        response += 'This is a low score, meaning there are many accessibility barriers that need attention.';
      }
      if (severity) {
        const parts = [];
        if (severity.critical) parts.push(`${severity.critical} critical`);
        if (severity.serious) parts.push(`${severity.serious} serious`);
        if (severity.moderate) parts.push(`${severity.moderate} moderate`);
        if (severity.minor) parts.push(`${severity.minor} minor`);
        response += `\n\nThe ${context.violationCount} issues break down as: ${parts.join(', ')}.`;
      }
      return response;
    }
    return 'Your accessibility score is calculated by penalizing violations: critical issues subtract 15 points, serious 8, moderate 4, and minor 1. Run a scan to see your site\'s score.';
  }

  // ---- What to fix first ----
  if (/\b(first|priority|important|start|begin|urgent)\b/.test(lower)) {
    if (hasScan) {
      const critical = violations.filter(v => (v.impact || '').toLowerCase() === 'critical');
      const serious = violations.filter(v => (v.impact || '').toLowerCase() === 'serious');
      let response = 'Here is the recommended order to fix issues:\n\n';
      if (critical.length > 0) {
        response += `1. CRITICAL (${critical.length} issues) — Fix these first as they block access entirely:\n`;
        critical.slice(0, 5).forEach(v => {
          const info = VIOLATION_INFO[v.id];
          response += `  - ${v.id}: ${v.help || v.description}${info ? '\n    ' + info.fix : ''}\n`;
        });
      }
      if (serious.length > 0) {
        response += `${critical.length > 0 ? '\n' : ''}2. SERIOUS (${serious.length} issues) — Fix next:\n`;
        serious.slice(0, 5).forEach(v => {
          const info = VIOLATION_INFO[v.id];
          response += `  - ${v.id}: ${v.help || v.description}${info ? '\n    ' + info.fix : ''}\n`;
        });
      }
      if (critical.length === 0 && serious.length === 0) {
        response += 'No critical or serious issues found. Address moderate and minor issues for the best experience.';
      }
      return response;
    }
    return 'Always fix critical issues first, then serious, then moderate, then minor. Critical issues (like missing alt text or low contrast on essential content) block users from accessing your page entirely.';
  }

  // ---- How many violations ----
  if (/\b(how many|count|number|total)\b/.test(lower) && /\b(violation|issue|error|problem|finding)\b/.test(lower)) {
    if (hasScan) {
      let response = `Your scan found ${context.violationCount} violation${context.violationCount !== 1 ? 's' : ''}.`;
      if (severity) {
        const parts = [];
        if (severity.critical) parts.push(`${severity.critical} critical`);
        if (severity.serious) parts.push(`${severity.serious} serious`);
        if (severity.moderate) parts.push(`${severity.moderate} moderate`);
        if (severity.minor) parts.push(`${severity.minor} minor`);
        response += ` Breakdown: ${parts.join(', ')}.`;
      }
      return response;
    }
    return 'Run a scan first to see how many violations your page has. I can then break them down by severity and help you prioritize.';
  }

  // ---- Explain scan / summary ----
  if (/\b(explain|summary|summarize|tell me about|overview|scan|results)\b/.test(lower)) {
    if (hasScan) {
      let response = `Scan of ${context.scannedUrl || 'your page'}\n`;
      response += `Score: ${context.score}/100\n`;
      response += `Total violations: ${context.violationCount}\n\n`;
      const grouped = { critical: [], serious: [], moderate: [], minor: [] };
      violations.forEach(v => {
        const imp = (v.impact || 'minor').toLowerCase();
        if (grouped[imp]) grouped[imp].push(v);
        else grouped.minor.push(v);
      });
      for (const [level, items] of Object.entries(grouped)) {
        if (items.length > 0) {
          response += `${level.toUpperCase()} (${items.length}):\n`;
          items.slice(0, 5).forEach(v => {
            response += `  - ${v.id}: ${v.help || v.description}\n`;
          });
          if (items.length > 5) response += `  ... and ${items.length - 5} more\n`;
          response += '\n';
        }
      }
      return response.trim();
    }
    return 'No scan results available yet. Run a scan on a website first, then ask me to explain the results.';
  }

  // ---- Critical issues ----
  if (/\b(critical)\b/.test(lower)) {
    if (hasScan) {
      const critical = violations.filter(v => (v.impact || '').toLowerCase() === 'critical');
      if (critical.length === 0) {
        return 'Great news — your scan found no critical issues!';
      }
      let response = `Your scan has ${critical.length} critical issue${critical.length !== 1 ? 's' : ''}. These are the most severe barriers and should be fixed immediately:\n\n`;
      critical.forEach(v => {
        const info = VIOLATION_INFO[v.id];
        response += `• ${v.id}\n  ${v.help || v.description}`;
        if (info) response += `\n  Why it matters: ${info.what}\n  How to fix: ${info.fix}`;
        response += '\n\n';
      });
      return response.trim();
    }
    return 'Critical issues are the most severe accessibility barriers — they completely block certain users from accessing content. Run a scan to check for critical issues on your site.';
  }

  // ---- Serious issues ----
  if (/\b(serious)\b/.test(lower)) {
    if (hasScan) {
      const serious = violations.filter(v => (v.impact || '').toLowerCase() === 'serious');
      if (serious.length === 0) {
        return 'Your scan found no serious issues.';
      }
      let response = `Your scan has ${serious.length} serious issue${serious.length !== 1 ? 's' : ''}:\n\n`;
      serious.forEach(v => {
        const info = VIOLATION_INFO[v.id];
        response += `• ${v.id}\n  ${v.help || v.description}`;
        if (info) response += `\n  How to fix: ${info.fix}`;
        response += '\n\n';
      });
      return response.trim();
    }
    return 'Serious issues significantly hinder accessibility but do not completely block access. Run a scan to see if your site has any.';
  }

  // ---- Specific violation lookups (by ID or keyword) ----
  // Check if any scan violation is being referenced
  for (const v of violations) {
    const vid = (v.id || '').toLowerCase();
    const vhelp = (v.help || '').toLowerCase();
    const vdesc = (v.description || '').toLowerCase();
    if (lower.includes(vid) || (vid && lower.includes(vid.replace(/-/g, ' ')))) {
      const info = VIOLATION_INFO[v.id];
      let response = `The violation "${v.id}" means: ${v.help || v.description}\n\n`;
      if (info) {
        response += `What it is: ${info.what}\n`;
        response += `Why it matters: ${info.why}\n`;
        response += `How to fix: ${info.fix}`;
      } else {
        response += `Description: ${vdesc || vhelp || 'No additional details available.'}`;
      }
      return response;
    }
  }

  // ---- Generic "explain this violation" / "what does this mean" ----
  if (/\b(explain|what does|what is|meaning|mean)\b/.test(lower) && /\b(violation|issue|error|finding|this)\b/.test(lower)) {
    if (hasScan) {
      let response = 'Here are the violations found in your scan:\n\n';
      violations.slice(0, 10).forEach(v => {
        const info = VIOLATION_INFO[v.id];
        response += `• ${v.id} (${v.impact || 'minor'}): ${v.help || v.description}`;
        if (info) response += `\n  Fix: ${info.fix}`;
        response += '\n\n';
      });
      if (violations.length > 10) response += `...and ${violations.length - 10} more. Ask about a specific violation for details.`;
      return response.trim();
    }
    return 'I can explain specific accessibility violations. Run a scan first, then ask about a particular issue.';
  }

  // ---- "How do I fix" questions ----
  if (/\b(how|fix|solve|remedy|resolve|repair)\b/.test(lower)) {
    if (hasScan) {
      // Try to match a specific violation
      for (const v of violations) {
        const vid = (v.id || '').toLowerCase().replace(/-/g, ' ');
        if (lower.includes(vid) || lower.includes((v.id || '').toLowerCase())) {
          const info = VIOLATION_INFO[v.id];
          if (info) return `How to fix "${v.id}":\n\n${info.fix}\n\nDetailed explanation: ${info.why}`;
          return `To fix "${v.id}": ${v.help || v.description}. Check the violation details for specific remediation steps.`;
        }
      }
      // General fix advice
      const critical = violations.filter(v => (v.impact || '').toLowerCase() === 'critical');
      if (critical.length > 0) {
        return `Start by fixing the ${critical.length} critical issue${critical.length !== 1 ? 's' : ''} first. The most impactful fixes are:\n\n${critical.slice(0, 3).map(v => {
          const info = VIOLATION_INFO[v.id];
          return `• ${v.id}: ${info ? info.fix : (v.help || v.description)}`;
        }).join('\n\n')}`;
      }
      return 'To improve your score, address the remaining violations in order of severity. Ask about a specific violation for detailed fix instructions.';
    }
    return 'I can provide specific fix instructions for accessibility issues. Run a scan first, then ask how to fix a particular violation.';
  }

  // ---- Specific topic questions ----
  if (/\b(alt text|alternative text|image alt)\b/.test(lower)) {
    if (hasScan) {
      const imgAlt = violations.find(v => v.id === 'image-alt');
      if (imgAlt) {
        const info = VIOLATION_INFO['image-alt'];
        return `Your scan found an image-alt violation:\n\n${info.what}\n\nWhy it matters: ${info.why}\n\nHow to fix: ${info.fix}`;
      }
      return 'Your scan did not find any alt text issues. All images appear to have proper alt attributes.';
    }
    return 'Alt text (alternative text) is a description added to images via the alt attribute. It allows screen readers to describe images to blind users. Every meaningful image should have descriptive alt text. Decorative images should use alt="".';
  }

  if (/\b(color contrast|contrast ratio|contrast)\b/.test(lower)) {
    if (hasScan) {
      const cc = violations.find(v => v.id === 'color-contrast');
      if (cc) {
        return `Your scan found a color-contrast violation:\n\n${VIOLATION_INFO['color-contrast'].what}\n\nWhy it matters: ${VIOLATION_INFO['color-contrast'].why}\n\nHow to fix: ${VIOLATION_INFO['color-contrast'].fix}`;
      }
      return 'Your scan did not find any color contrast issues. Text colors appear to meet WCAG contrast requirements.';
    }
    return 'Color contrast measures how distinguishable text is from its background. WCAG requires a ratio of at least 4.5:1 for normal text and 3:1 for large text (18pt+ or 14pt+ bold). Use tools like the WebAIM Contrast Checker to verify your colors.';
  }

  if (/\b(landmark|landmarks|navigation|nav|main|header|footer)\b/.test(lower)) {
    if (hasScan) {
      const region = violations.find(v => v.id === 'region');
      const main = violations.find(v => v.id === 'landmark-one-main');
      let response = '';
      if (region) response += 'Your scan found a region violation: page content should be contained within ARIA landmarks.\n\n';
      if (main) response += 'Your scan found a missing main landmark: the page should have exactly one <main> element.\n\n';
      if (response) {
        response += 'Landmarks are structural HTML elements (<header>, <nav>, <main>, <footer>) or ARIA roles that help screen reader users navigate page sections. Wrap your content in these elements.';
        return response;
      }
      return 'Landmarks look good in your scan. Your page uses proper semantic HTML landmarks.';
    }
    return 'Landmarks are special HTML elements or ARIA roles that divide a page into regions. Screen reader users use them to jump directly to specific sections. Common landmarks include <header>, <nav>, <main>, <aside>, and <footer>.';
  }

  if (/\b(aria|aria-)\b/.test(lower)) {
    if (hasScan) {
      const ariaIssues = violations.filter(v => (v.id || '').startsWith('aria'));
      if (ariaIssues.length > 0) {
        let response = `Your scan found ${ariaIssues.length} ARIA-related issue${ariaIssues.length !== 1 ? 's' : ''}:\n\n`;
        ariaIssues.forEach(v => {
          const info = VIOLATION_INFO[v.id];
          response += `• ${v.id}: ${v.help || v.description}`;
          if (info) response += `\n  Fix: ${info.fix}`;
          response += '\n\n';
        });
        return response.trim();
      }
      return 'No ARIA-related issues found in your scan.';
    }
    return 'ARIA (Accessible Rich Internet Applications) is a set of attributes that define ways to make web content more accessible to assistive technologies. Use ARIA only when native HTML elements cannot convey the required semantics.';
  }

  if (/\b(keyboard|tab|focus|tabindex)\b/.test(lower)) {
    return 'Keyboard accessibility means all interactive elements can be reached and operated using only a keyboard. Key requirements:\n\n1. All links and form controls must be reachable with Tab\n2. Focus order must follow a logical reading order\n3. Focus must be visually visible\n4. No keyboard traps (users must be able to Tab away from any element)\n5. Custom widgets need proper keyboard event handlers\n\nTest by unplugging your mouse and navigating your page entirely with Tab, Shift+Tab, Enter, and Space.';
  }

  if (/\b(screen reader|assistive tech|nvda|jaws|voiceover)\b/.test(lower)) {
    return 'Screen readers are assistive technologies that convert on-screen content to speech or Braille. The main ones are:\n\n• NVDA (Windows, free)\n• JAWS (Windows, commercial)\n• VoiceOver (macOS/iOS, built-in)\n• TalkBack (Android, built-in)\n\nTo make your site screen reader friendly: use semantic HTML, provide alt text for images, use proper headings, ensure form labels are associated, and test with at least one screen reader.';
  }

  if (/\b(wcag|web content accessibility guidelines)\b/.test(lower)) {
    return 'WCAG (Web Content Accessibility Guidelines) is the international standard for web accessibility, published by W3C. It has three conformance levels:\n\n• Level A — Minimum. Addresses the most basic barriers.\n• Level AA — Recommended. Addresses the most common barriers for people with disabilities.\n• Level AAA — Highest. Difficult to achieve for all content.\n\nMost legal requirements and government standards target WCAG 2.1 Level AA. The four principles of WCAG are POUR: Perceivable, Operable, Understandable, and Robust.';
  }

  if (/\b(what is accessibility|define accessibility|accessibility mean|accessible)\b/.test(lower)) {
    return 'Web accessibility means designing websites so everyone can use them, including people with disabilities such as visual, auditory, motor, or cognitive impairments. An accessible website allows users to:\n\n• Perceive all information (alt text, captions, sufficient contrast)\n• Navigate using keyboard, screen reader, or other tools\n• Understand content (clear language, proper structure)\n• Interact with all features (target sizes, time limits, error handling)\n\nAccessibility is both a legal requirement and a moral imperative. It also improves usability for all users.';
  }

  // ---- URL-specific questions ----
  if (hasScan && context.scannedUrl) {
    if (/\b(url|website|site|page|webpage|link|domain)\b/.test(lower) && /\b(my|this|the|current|scanned|scan)\b/.test(lower)) {
      return `The scanned URL is: ${context.scannedUrl}\n\nScore: ${context.score}/100\nTotal violations: ${context.violationCount}\n\nAsk me about specific violations, what to fix first, or for explanations of any issues.`;
    }
  }

  // ---- Source code findings ----
  if (context && context.sourceFindings && context.sourceFindings.length > 0) {
    if (/\b(source|code|file|finding|upload)\b/.test(lower)) {
      let response = `Source code analysis found ${context.sourceFindings.length} finding${context.sourceFindings.length !== 1 ? 's' : ''}:\n\n`;
      context.sourceFindings.slice(0, 8).forEach(f => {
        response += `• ${f.id} (${f.impact || 'minor'}) in ${f.file || 'unknown'}:${f.line || '?'}\n  ${f.help || f.description}\n\n`;
      });
      return response.trim();
    }
  }

  // ---- Fallback ----
  return 'I can help with your Access Check results, WCAG concepts, accessibility violations, and suggested fixes. Try asking me about your score, a specific violation, or how to fix an issue.';
}

/* ------------------------------------------------------------------ */
/* Chat endpoint                                                       */
/* ------------------------------------------------------------------ */

/**
 * POST /api/chat
 * Body: { message: string, scanContext?: object }
 *
 * Requires authentication. Analyzes the user's question locally and
 * returns an accessibility-focused response using the current scan
 * context when available.
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { message, scanContext } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter a message.' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 4000) {
      return res.status(400).json({ error: 'Message is too long. Please keep it under 4000 characters.' });
    }

    // Build context from the scan data
    const context = {};
    if (scanContext && typeof scanContext === 'object') {
      if (scanContext.scannedUrl) context.scannedUrl = scanContext.scannedUrl;
      if (scanContext.isDemoMode) context.isDemoMode = true;
      if (typeof scanContext.score === 'number') context.score = scanContext.score;

      const violations = Array.isArray(scanContext.violations) ? scanContext.violations : [];
      if (violations.length > 0) {
        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        violations.forEach(v => {
          const impact = (v.impact || 'minor').toLowerCase();
          if (counts[impact] !== undefined) counts[impact]++;
          else counts.minor++;
        });
        context.violationCount = violations.length;
        context.severityBreakdown = counts;
        context.violations = violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help
        }));
      }

      const findings = Array.isArray(scanContext.findings) ? scanContext.findings : [];
      if (findings.length > 0) {
        context.sourceFindings = findings.map(f => ({
          id: f.id,
          impact: f.impact,
          description: f.description,
          file: f.file,
          line: f.line,
          help: f.help
        }));
        if (typeof scanContext.sourceCodeScore === 'number') {
          context.sourceCodeScore = scanContext.sourceCodeScore;
        }
      }
    }

    const reply = generateLocalResponse(trimmedMessage, Object.keys(context).length > 0 ? context : null);

    return res.json({ reply });
  } catch (error) {
    console.error('[chat] Error:', error.message);
    return res.status(500).json({
      error: 'The assistant encountered an unexpected error. Please try again.'
    });
  }
});

module.exports = router;
