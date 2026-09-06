/**
 * Static accessibility analysis of uploaded source code.
 *
 * This module performs lightweight, dependency-free lexical analysis of
 * source files (HTML/JSX/JS/TS/TSX/CSS) to detect common accessibility
 * problems directly from the implementation. It never executes or renders
 * the uploaded code.
 *
 * Rules that are confidently determinable from the file are reported as
 * "definite". Heuristic rules are labeled "potential" so we never present a
 * guess as a guaranteed failure.
 */

const CATEGORY_HTML = 'HTML / JSX';
const CATEGORY_CSS = 'CSS';

/* Known WAI-ARIA roles for `aria-valid` checks (subset of the spec). */
const KNOWN_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote',
  'button', 'caption', 'cell', 'checkbox', 'code', 'columnheader',
  'combobox', 'complementary', 'contentinfo', 'definition', 'deletion',
  'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form',
  'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion',
  'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math',
  'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'meter', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation',
  'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
  'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch',
  'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer',
  'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
]);

/* Elements that do not need an accessible name for label purposes. */
const NO_LABEL_NEEDED = new Set([
  'hidden', 'submit', 'reset', 'button', 'image'
]);

/* HTML tags that are inherently interactive (no generic-click concern). */
const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'label', 'summary',
  'details', 'option', 'optgroup', 'audio', 'video', 'iframe', 'object',
  'embed', 'area', 'form'
]);

/* Void / self-closing HTML tags for list handling in JSX. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr'
]);

/**
 * Splits source into lines (keeping track of 1-based line numbers).
 */
function toLines(source) {
  return String(source).split(/\r\n|\r|\n/);
}

/**
 * Finds the line number for a character offset.
 */
function lineForOffset(source, offset) {
  const upTo = source.slice(0, offset);
  const nl = upTo.match(/\n/g);
  return nl ? nl.length + 1 : 1;
}

/**
 * A tiny, tolerant tokenizer that walks a JSX/HTML source and yields
 * "element" tokens: {tag, attrs, selfClosing, line, raw, hasClosingTag}.
 *
 * It is deliberately naive: it does not build an AST, but it is robust
 * enough to extract elements and their attributes from typical mark-up,
 * including JSX expressions `attr={...}`.
 */
function *iterElements(source) {
  const lines = toLines(source);
  const src = String(source);
  const re = /<(\/?)\s*([A-Za-z][A-Za-z0-9]*)\b([^>]*)>/g;
  let m;

  // Track open/closing tags so we can know whether an element has an explicit
  // closing tag and to find inner text for accessible-name checks.
  const stack = [];

  while ((m = re.exec(src)) !== null) {
    const isClosing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrsRaw = m[3];
    const selfClosing = /\/\s*>$/.test(m[3]);
    const line = lineForOffset(src, m.index);

    if (!isClosing) {
      stack.push({ tag, line, selfClosing });

      let attrs = {};
      const attrRe = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*'|\{[^}]*\}|[^\s>]+)/g;
      let am;
      while ((am = attrRe.exec(attrsRaw)) !== null) {
        attrs[am[1].toLowerCase()] = am[2];
      }
      // Boolean-ish attributes (present without a value) e.g. `disabled`
      const boolRe = /\b([A-Za-z_:][A-Za-z0-9_.:-]*)\s*(?==|[\s>])/g;
      let bm;
      while ((bm = boolRe.exec(attrsRaw)) !== null) {
        const name = bm[1].toLowerCase();
        if (!(name in attrs) && !/^[\/\s>]/.test(bm[1].slice(-1))) {
          attrs[name] = '';
        }
      }

      yield { tag, attrs, selfClosing, line, raw: m[0], start: m.index, end: m.index + m[0].length };
    }

    if (isClosing) {
      // pop matching open tag
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
    }

    if (!selfClosing && !isClosing && VOID_TAGS.has(tag)) {
      // void tags are implicitly closed
      stack.pop();
    }
  }
}

/**
 * Strips quotes (and bracket wrappers) from an attribute value and returns
 * its unquoted text. JSX `{expr}` values are returned as-is minus braces.
 */
function attrValue(raw) {
  if (raw == null) return null;
  let v = String(raw).trim();
  if (v.startsWith('{') && v.endsWith('}')) {
    return v.slice(1, -1).trim();
  }
  if (v.length >= 2 && (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )) {
    return v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Returns the trimmed text content of an element by scanning from its start
 * tag to its matching closing tag. Used for accessible-name checks on
 * anchors/buttons.
 */
function elementTextContent(source, startOffset, tagName) {
  const startTag = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>/.exec(source.slice(startOffset));
  if (!startTag) return '';
  const openTagLen = startTag[0].length;
  let pos = startOffset + openTagLen;
  const openRe = new RegExp(`<(/?)\\s*${tagName}\\b[^>]*>`, 'g');
  openRe.lastIndex = pos;
  const closeRe = /<\/\s*([A-Za-z][A-Za-z0-9]*)\s*>/g;
  // Use a global scan with a tag-aware depth counter.
  const seg = source.slice(pos);
  const tagRe = /<(\/?)\s*([A-Za-z][A-Za-z0-9]*)\b[^>]*>/g;
  let depth = 1;
  let lastEnd = 0;
  let tm;
  while ((tm = tagRe.exec(seg)) !== null) {
    const closingThis = tm[1] === '/';
    const thisTag = tm[2].toLowerCase();
    if (thisTag === tagName) {
      if (closingThis) {
        depth--;
        if (depth === 0) {
          return cleanText(seg.slice(0, tm.index));
        }
      } else {
        depth++;
      }
    }
    lastEnd = tm.index;
  }
  // No closing tag found — fall back to everything up to end of line.
  const nl = seg.search(/\n/);
  return cleanText(seg.slice(0, nl >= 0 ? nl : seg.length));
}

function cleanText(s) {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A minimal source-code "composable analyzer pipeline".
 * Each rule is a function(source, filename, ext) -> array of findings.
 */

function finding(ruleId, impact, category, filename, opts) {
  return {
    id: ruleId,
    impact,
    category,
    file: filename,
    line: opts.line != null ? opts.line : 'Not available',
    help: opts.help,
    description: opts.description,
    code: opts.code != null ? opts.code : '',
    whyItMatters: opts.whyItMatters,
    fix: opts.fix,
    confidence: opts.confidence || 'definite'
  };
}

/* ------------------------------------------------------------------ */
/* HTML / JSX rules                                                    */
/* ------------------------------------------------------------------ */

function checkImageAlt(source, filename) {
  const findings = [];
  for (const el of iterElements(source)) {
    if (el.tag === 'img') {
      const alt = el.attrs['alt'];
      const hasAlt = alt !== undefined;
      const altText = hasAlt ? attrValue(el.attrs['alt']) : null;
      // alt="" is a valid decorative image; alt="..." is informative.
      // A missing alt attribute (not even present) or a JSX expression with
      // no value is the problem case.
      const role = el.attrs['role'] ? attrValue(el.attrs['role']) : null;
      if (!hasAlt) {
        // If the image has role="presentation"/"none", it is intentionally
        // decorative — skip.
        if (role === 'presentation' || role === 'none') continue;
        findings.push(finding('image-alt', 'serious', CATEGORY_HTML, filename, {
          line: el.line,
          help: 'Images must have an accessible alternative text (alt) attribute.',
          description: 'This image does not have an `alt` attribute. Screen reader and non-visual users will not know what the image conveys.',
          code: el.raw,
          whyItMatters: 'The `alt` attribute provides the text alternative for an image, which is what assistive technologies announce instead of the image itself.',
          fix: 'Add a descriptive `alt` attribute that conveys the image\'s meaning, e.g. <img src="logo.png" alt="Company logo">, or use alt="" if the image is purely decorative.'
        }));
      } else if (altText != null && altText.length === 0) {
        const isRoleImg = el.attrs['role'] && (attrValue(el.attrs['role']) === 'img');
        if (isRoleImg) {
          findings.push(finding('image-alt', 'serious', CATEGORY_HTML, filename, {
            line: el.line,
            help: 'Images with role="img" must have an accessible name.',
            description: 'This element uses role="img" (indicating it should be treated as an image) but has an empty alt text, so it exposes no accessible name.',
            code: el.raw,
            whyItMatters: 'An image role with an empty accessible name is announced as nothing, hiding the image entirely from assistive technology.',
            fix: 'Provide a non-empty `alt`, `aria-label` or `aria-labelledby` for this image.'
          }));
        }
      }
    }
  }
  return findings;
}

/**
 * Checks that anchors and buttons have an accessible name (text or
 * aria-label/aria-labelledby).
 */
function checkNameRequired(source, filename) {
  const findings = [];
  const src = String(source);
  // Return true if element (with raw start tag at offset) has any visible text
  // or an aria-label/aria-labelledby/title.
  const hasAccessibleName = (el) => {
    if (el.attrs['aria-label']) {
      const v = attrValue(el.attrs['aria-label']);
      if (v && v.trim().length > 0) return true;
    }
    if (el.attrs['aria-labelledby']) {
      const v = attrValue(el.attrs['aria-labelledby']);
      if (v && v.trim().length > 0) return true;
    }
    if (el.attrs['title']) {
      const v = attrValue(el.attrs['title']);
      if (v && v.trim().length > 0) return true;
    }
    return false;
  };

  for (const el of iterElements(source)) {
    if (el.tag === 'a' && !el.selfClosing) {
      if (hasAccessibleName(el)) continue;
      const href = el.attrs['href'];
      // Only treat as a real link; skip placeholder anchors without href.
      if (href === undefined) continue;
      const hrefVal = attrValue(el.attrs['href']);
      if (hrefVal && /^\s*#\s*$/.test(hrefVal)) continue; // placeholder
      const openOffset = src.indexOf(el.raw);
      const text = openOffset >= 0 ? elementTextContent(src, openOffset, 'a') : '';
      if (!text) {
        findings.push(finding('link-name', 'serious', CATEGORY_HTML, filename, {
          line: el.line,
          help: 'Links must have discernible text.',
          description: 'This link has no visible text or accessible name, so screen reader and keyboard users cannot tell where the link goes.',
          code: el.raw,
          whyItMatters: 'A link with no accessible name is announced as an empty/broken link and provides no navigation cue.',
          fix: 'Add descriptive link text between the opening and closing anchor tags, or add an `aria-label`/`aria-labelledby` describing the destination.'
        }));
      }
    }

    if (el.tag === 'button') {
      if (hasAccessibleName(el)) continue;
      const openOffset = src.indexOf(el.raw);
      const text = openOffset >= 0 ? elementTextContent(src, openOffset, 'button') : '';
      const withIconOnly = /<[^>]*svg/i.test(source.slice(Math.max(0, openOffset), openOffset + 300));
      if (!text && !withIconOnly) {
        findings.push(finding('button-name', 'serious', CATEGORY_HTML, filename, {
          line: el.line,
          help: 'Buttons must have discernible text.',
          description: 'This button has no visible text or accessible name, so assistive technology cannot describe its purpose.',
          code: el.raw,
          whyItMatters: 'A button without a name is announced by screen readers as an unlabeled control.',
          fix: 'Add visible text between the button tags, or an `aria-label`/`aria-labelledby` that describes the action.'
        }));
      }
    }
  }
  return findings;
}

/**
 * Checks form controls have an associated label / accessible name.
 */
function checkFormLabels(source, filename) {
  const findings = [];
  const src = String(source);
  // Collect ids used in <label for="...">
  const labeledIds = new Set();
  for (const m of src.matchAll(/<label\b[^>]*\bfor\s*=\s*("[^"]*"|'[^']*'|\{[^}]*\})/gi)) {
    const v = attrValue(m[1]);
    if (v) labeledIds.add(v);
  }
  // Collect aria-labelledby etc. targets (forwards reference).
  const ariaLabeledByTargets = new Set();
  for (const m of src.matchAll(/\baria-labelledby\s*=\s*("[^"]*"|'[^']*'|\{[^}]*\})/gi)) {
    const v = attrValue(m[1]);
    if (v) v.split(/\s+/).forEach(t => t && ariaLabeledByTargets.add(t));
  }

  for (const el of iterElements(source)) {
    if (!['input', 'textarea', 'select'].includes(el.tag)) continue;
    if (el.tag === 'input') {
      const type = el.attrs['type'] ? attrValue(el.attrs['type']) : 'text';
      if (NO_LABEL_NEEDED.has(type.toLowerCase())) continue;
    }
    // Has an accessible name from aria-label/aria-labelledby/title/placeholder
    const ariaLabel = attrValue(el.attrs['aria-label']);
    if (ariaLabel && ariaLabel.trim().length > 0) continue;
    const ariaLabelledby = attrValue(el.attrs['aria-labelledby']);
    if (ariaLabelledby && ariaLabelledby.trim().length > 0) continue;
    const title = attrValue(el.attrs['title']);
    if (title && title.trim().length > 0) continue;
    // Placeholder alone is not a sufficient accessible name (WCAG).
    const id = el.attrs['id'] ? attrValue(el.attrs['id']) : null;
    if (id && (labeledIds.has(id) || ariaLabeledByTargets.has(id))) continue;
    // Wrapping label: check if this input sits inside a <label>...</label>.
    if (isInsideLabel(src, src.indexOf(el.raw))) continue;

    const controlLabel = el.tag === 'input' ? 'input' : (el.tag === 'textarea' ? 'textarea' : 'select');
    findings.push(finding('label', 'serious', CATEGORY_HTML, filename, {
      line: el.line,
      help: 'Form controls must have labels.',
      description: `This ${controlLabel} has no associated <label> and no accessible name (aria-label/aria-labelledby/title). Users cannot tell what information is expected.`,
      code: el.raw,
      whyItMatters: 'Screen reader users navigate forms by label; an unlabeled field gives no indication of its purpose.',
      fix: `Wrap it in a <label> or add a <label for="..."> pointing to its id, or add an aria-label, e.g. <label for="${id || 'email'}">Email</label> with id="${id || 'email'}".`
    }));
  }
  return findings;
}

function isInsideLabel(src, offset) {
  if (offset < 0) return false;
  const before = src.slice(0, offset);
  const after = src.slice(offset);
  const openRe = /<label\b[^>]*>/gi;
  let lastOpen = -1;
  let om;
  while ((om = openRe.exec(before)) !== null) {
    const closeIdx = before.indexOf('</label', om.index);
    // Only consider labels that remain open at offset (close after offset).
    if (closeIdx === -1 || closeIdx > offset) {
      lastOpen = om.index;
    }
  }
  if (lastOpen === -1) return false;
  // Check the matching close is after offset.
  const seg = before.slice(lastOpen);
  const closePos = seg.search(/<\/label/i);
  if (closePos === -1) return true;
  return closePos + lastOpen > offset;
}

/**
 * Heading structure heuristic: detect skipped levels and multiple <h1>.
 * Heuristic -> potential.
 */
function checkHeadingOrder(source, filename) {
  const findings = [];
  const levels = [];
  for (const el of iterElements(source)) {
    if (/^h[1-6]$/.test(el.tag)) {
      levels.push({ level: Number(el.tag[1]), line: el.line, raw: el.raw });
    }
  }
  const h1s = levels.filter(l => l.level === 1);
  if (h1s.length > 1) {
    findings.push(finding('heading-order', 'moderate', CATEGORY_HTML, filename, {
      line: h1s[1].line,
      help: 'Avoid multiple top-level <h1> headings on a page.',
      description: `This file contains ${h1s.length} <h1> headings. A page usually should have a single primary <h1> that describes the whole page.`,
      code: h1s.map(h => h.raw).join(' '),
      whyItMatters: 'Multiple <h1> headings can confuse the document outline used by screen reader users to navigate.',
      fix: 'Keep a single <h1> as the page title and demote additional <h1> headings to <h2> or lower.',
      confidence: 'potential'
    }));
  }
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1].level;
    const cur = levels[i].level;
    if (cur > prev + 1) {
      findings.push(finding('heading-order', 'moderate', CATEGORY_HTML, filename, {
        line: levels[i].line,
        help: 'Heading levels should only increase by one.',
        description: `Heading level jumps from <h${prev}> to <h${cur}>, skipping a level. This can make the document outline confusing.`,
        code: levels[i].raw,
        whyItMatters: 'Screen reader users use heading levels to skim a page; skipped levels break the expected structure.',
        fix: `Change this heading to <h${prev + 1}> (or restructure the hierarchy so levels increment by one).`,
        confidence: 'potential'
      }));
    }
  }
  return findings;
}

/**
 * Full-document rules: lang attribute and main landmark.
 * Only applied when the file appears to be a complete HTML document.
 */
function checkDocumentRules(source, filename) {
  const findings = [];
  const src = String(source);
  const looksLikeDoc =
    /<!doctype\s+html/i.test(src) ||
    (/<html[\s>]/i.test(src) && /<body[\s>]/i.test(src));

  if (!looksLikeDoc) return findings;

  // html lang
  const htmlRe = /<html\b[^>]*>/i;
  const htmlMatch = src.match(htmlRe);
  if (htmlMatch && !/\blang\s*=/.test(htmlMatch[0])) {
    const line = lineForOffset(src, htmlMatch.index);
    findings.push(finding('html-lang', 'serious', CATEGORY_HTML, filename, {
      line,
      help: 'The <html> element must have a lang attribute.',
      description: 'The document has an <html> element without a `lang` attribute, so screen readers do not know the primary language of the page content.',
      code: htmlMatch[0],
      whyItMatters: 'Assistive technologies use the lang attribute to load the correct pronunciation and character set.',
      fix: `Add a lang attribute to the document root, e.g. <html lang="en">.`
    }));
  }

  // main landmark
  const mainRe = /<main\b[^>]*>/i;
  if (!mainRe.test(src)) {
    const bodyMatch = src.match(/<body\b[^>]*>/i);
    findings.push(finding('landmark-one-main', 'serious', CATEGORY_HTML, filename, {
      line: bodyMatch ? lineForOffset(src, bodyMatch.index) : 'Not available',
      help: 'Document should have one main landmark.',
      description: 'This full HTML document does not contain a <main> element, so there is no programmatic main landmark for assistive technology.',
      code: '<body>…</body>',
      whyItMatters: 'The <main> landmark lets screen reader users jump straight to the primary content.',
      fix: 'Wrap the primary page content in a single <main> element.',
      confidence: 'potential'
    }));
  }
  return findings;
}

/**
 * ARIA role validity check (typo / unknown role).
 */
function checkAriaRoles(source, filename) {
  const findings = [];
  for (const el of iterElements(source)) {
    if (el.attrs['role'] === undefined) continue;
    const role = attrValue(el.attrs['role']);
    if (!role) continue;
    // role can be a space-separated list; validate each token.
    const tokens = role.split(/\s+/).filter(Boolean);
    const bad = tokens.filter(t => !KNOWN_ROLES.has(t.toLowerCase()));
    if (bad.length > 0) {
      findings.push(finding('aria-valid-attr', 'moderate', CATEGORY_HTML, filename, {
        line: el.line,
        help: 'ARIA roles must be valid.',
        description: `This element uses an ARIA role that is not recognized: ${bad.join(', ')}.`,
        code: el.raw,
        whyItMatters: 'An invalid role is ignored by assistive technology, so the intended semantics are never conveyed.',
        fix: `Use a valid WAI-ARIA role. Received "${bad.join(', ')}" — check the ARIA roles spec.`
      }));
    }
  }
  return findings;
}

/**
 * Positive tabindex misuse.
 */
function checkTabindex(source, filename) {
  const findings = [];
  for (const el of iterElements(source)) {
    if (el.attrs['tabindex'] === undefined) continue;
    const v = attrValue(el.attrs['tabindex']);
    // JSX tabIndex prop
    const jx = el.attrs['tabindex'] || attrsIn(el, 'tabIndex', source);
    const val = v != null ? v.replace(/^'+|'+$/g, '').trim() : null;
    const n = parseInt(val, 10);
    if (!Number.isNaN(n) && n > 0) {
      findings.push(finding('tabindex-positive', 'serious', CATEGORY_HTML, filename, {
        line: el.line,
        help: 'Avoid positive tabindex values.',
        description: `This element uses tabindex="${n}". Positive tabindex forces the element into a specific position before the natural tab order, which can confuse keyboard users.`,
        code: el.raw,
        whyItMatters: 'Positive tabindex overrides the natural focus order and can create a confusing, out-of-order keyboard experience.',
        fix: 'Remove the tabindex, or use tabindex="0" if the element needs to be focusable in the natural order.',
        confidence: 'potential'
      }));
    }
  }
  return findings;
}

function attrsIn(el, name, source) {
  const re = new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  const m = re.exec(el.raw);
  return m ? m[1] : undefined;
}

/**
 * onClick on non-interactive elements without keyboard support (JSX).
 * Heuristic -> potential.
 */
function checkOnClickKeyboard(source, filename) {
  const findings = [];
  const src = String(source);
  for (const el of iterElements(source)) {
    if (INTERACTIVE_TAGS.has(el.tag)) continue;
    if (el.selfClosing) continue;
    const hasOnClick = /onclick\s*=/i.test(el.raw);
    const hasOnClickProp = el.attrs['onclick'] !== undefined || attrsIn(el, 'onClick', source) !== undefined || el.attrs['onClick'] !== undefined;
    if (!(hasOnClick || hasOnClickProp)) continue;
    const rolePresent = !!el.attrs['role'];
    const hasTabindex = el.attrs['tabindex'] !== undefined || el.attrs['tabindex'] !== undefined;
    const hasKeyHandler = attrsIn(el, 'onKeyDown', source) !== undefined || attrsIn(el, 'onKeyUp', source) !== undefined || attrsIn(el, 'onKeyPress', source) !== undefined;
    // An <a> without href but with onClick is fine only if it's not used as a link.
    if (el.tag === 'a') {
      // anchor without href handled separately; skip generic click check
      continue;
    }
    if (!rolePresent && !hasTabindex && !hasKeyHandler) {
      findings.push(finding('onclick-keyboard', 'moderate', CATEGORY_HTML, filename, {
        line: el.line,
        help: 'Clickable custom elements must be keyboard accessible.',
        description: `This <${el.tag}> relies on onClick, but is not keyboard accessible (no role, tabindex, or keyboard handler). Clicking with a mouse works but pressing Enter/Space cannot activate it.`,
        code: el.raw,
        whyItMatters: 'Keyboard and screen reader users cannot operate mouse-only controls, so the element is effectively unusable for some users.',
        fix: `Prefer a semantic element such as <button> or <a href>. If a non-semantic element must be used, add role="button", tabindex="0", and an onKeyDown handler that triggers the action on Enter/Space.`,
        confidence: 'potential'
      }));
    }
  }
  return findings;
}

/**
 * window click handlers are out of scope (per-file static analysis).
 */

/* ------------------------------------------------------------------ */
/* CSS rules                                                           */
/* ------------------------------------------------------------------ */

/**
 * Extracts CSS rule blocks: {selector, declarations[]}.
 * Handles nested braces by tracking depth.
 */
function cssRules(source) {
  const src = String(source);
  const rules = [];
  const reFor = /([^{}]+)\{/g; // selector open
  let m;
  while ((m = reFor.exec(src)) !== null) {
    let openIdx = m.index + m[0].length - 1; // position of the `{`
    let depth = 1;
    let i = openIdx + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      if (src[i] === '}') depth--;
      i++;
    }
    const block = src.slice(openIdx + 1, i - 1);
    const selector = m[1].trim();
    if (selector && block) {
      rules.push({ selector, block, startLine: lineForOffset(src, m.index) });
    }
    reFor.lastIndex = i;
  }
  return rules;
}

function checkCssFocusOutline(source, filename) {
  const findings = [];
  for (const rule of cssRules(source)) {
    const outlineM = /(?:^|;)\s*outline(?:-style)?\s*:\s*([^;]+)/i.exec(rule.block);
    if (!outlineM) continue;
    const value = outlineM[1].trim().toLowerCase();
    const isNone = /^(none|0|0px|0\s+px|0\s+solid|hidden)$/.test(value);
    if (!isNone) continue;
    // If the same rule provides an alternate visible focus indicator (box-shadow
    // or border), removing the default outline may be intentional — skip those.
    const hasAlternate =
      /box-shadow\s*:/i.test(rule.block) ||
      /border\s*:/i.test(rule.block);
    if (hasAlternate) continue;
    findings.push(finding('outline-none', 'moderate', CATEGORY_CSS, filename, {
      line: rule.startLine,
      help: 'Do not remove the visible focus indicator.',
      description: 'This rule removes the focus outline (outline: none/0). Users navigating by keyboard may lose their visible position indicator if no alternate focus style is provided.',
      code: `${rule.selector} { ${rule.block.trim()} }`,
      whyItMatters: 'A visible focus indicator is essential for keyboard-only and low-vision users to know where they are on the page.',
      fix: 'Provide an alternate visible focus style instead of removing the outline, e.g. outline: 2px solid #6366f1, or box-shadow: 0 0 0 2px #6366f1.',
      confidence: 'potential'
    }));
  }
  return findings;
}

function checkCssFontSize(source, filename) {
  const findings = [];
  for (const rule of cssRules(source)) {
    const m = /(?:^|;)\s*font-size\s*:\s*([^;]+)/i.exec(rule.block);
    if (!m) continue;
    const val = m[1].trim();
    const px = /(\d+(?:\.\d+)?)\s*px/i.exec(val);
    if (px && parseFloat(px[1]) < 12) {
      findings.push(finding('font-size-too-small', 'minor', CATEGORY_CSS, filename, {
        line: rule.startLine,
        help: 'Avoid fixed text sizes smaller than 12px.',
        description: `This rule uses a fixed font-size of ${px[1]}px. Very small fixed text can be difficult for users to read, especially on high-resolution displays.`,
        code: `${rule.selector} { ${rule.block.trim()} }`,
        whyItMatters: 'Small text reduces readability and can become unreadable without browser text zoom.',
        fix: `Use a relative unit such as rem or increase the size to at least 1rem (16px).`,
        confidence: 'potential'
      }));
    }
  }
  return findings;
}

/**
 * Contrast check: only when both a text color and a background color with
 * literal (hex/rgb) values are present in the same rule. Heuristic -> potential.
 */
function parseColor(val) {
  val = String(val).trim();
  let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(val))) {
    return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
  }
  if ((m = /^#([0-9a-f]{6})$/i.exec(val))) {
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  }
  if ((m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(val))) {
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return null;
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkCssContrast(source, filename) {
  const findings = [];
  for (const rule of cssRules(source)) {
    const colorM = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(rule.block);
    const bgM = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(rule.block);
    if (!colorM || !bgM) continue;
    const fg = parseColor(colorM[1]);
    const bg = parseColor(bgM[1]);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      const fontSize = /(?:^|;)\s*font-size\s*:\s*([^;]+)/i.exec(rule.block);
      let threshold = 4.5;
      if (fontSize) {
        const px = /(\d+(?:\.\d+)?)\s*px/i.exec(fontSize[1]);
        if (px && parseFloat(px[1]) >= 24) threshold = 3; // large text
      }
      if (ratio < threshold) {
        findings.push(finding('color-contrast', 'serious', CATEGORY_CSS, filename, {
          line: rule.startLine,
          help: 'Text must have sufficient color contrast against its background.',
          description: `This rule sets a text color and background where the contrast ratio is approximately ${ratio.toFixed(2)}:1, below the recommended ${threshold}:1 for normal text.`,
          code: `${rule.selector} { ${rule.block.trim()} }`,
          whyItMatters: 'Low contrast text is hard to read for users with low vision and can be illegible on poor displays.',
          fix: `Adjust the text and/or background colors so the contrast ratio is at least ${threshold}:1 (prefer 4.5:1 for normal text).`,
          confidence: 'potential'
        }));
      }
    }
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

const RULE_RUNNERS = [
  // HTML / JSX
  checkImageAlt,
  checkNameRequired,
  checkFormLabels,
  checkHeadingOrder,
  checkDocumentRules,
  checkAriaRoles,
  checkTabindex,
  checkOnClickKeyboard,
  // CSS
  checkCssFocusOutline,
  checkCssFontSize,
  checkCssContrast
];

/**
 * Analyzes a single source file.
 * @param {string} filename - sanitized file name
 * @param {string} content - file text content
 * @param {string} ext - lowercased extension (html|htm|jsx|js|ts|tsx|css)
 * @returns {Array} array of findings
 */
function analyzeSourceFile(filename, content, ext) {
  const findings = [];
  for (const runner of RULE_RUNNERS) {
    try {
      const hits = runner(content, filename);
      if (hits && hits.length) findings.push(...hits);
    } catch (err) {
      // A rule must never crash the whole analysis; log and continue.
      console.error(`[sourceAnalyzer] rule ${runner.name} failed for ${filename}:`, err.message);
    }
  }
  return findings;
}

module.exports = { analyzeSourceFile, iterElements, KNOWN_ROLES, CATEGORY_HTML, CATEGORY_CSS };
