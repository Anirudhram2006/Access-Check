/**
 * Plain-language accessibility explanations and concrete fixes for common axe-core rules.
 * 
 * Each rule provides:
 * - whyItMatters (string)
 * - fixExplanation (string)
 * - exampleBefore (string)
 * - exampleAfter (string)
 */
export const ruleSuggestions = {
  'color-contrast': {
    whyItMatters: 'Users with visual impairments or low contrast sensitivity cannot read text that does not stand out sufficiently from the background. Proper contrast ensures legibility in various lighting conditions for all users.',
    fixExplanation: 'Increase the contrast between the foreground text color and the background color. Web Content Accessibility Guidelines (WCAG) AAA requires a ratio of at least 4.5:1 for normal text and 3:1 for large text.',
    exampleBefore: '<span style="color: #999; background-color: #fff;">Faint grey text</span>',
    exampleAfter: '<span style="color: #595959; background-color: #fff;">Dark grey text (contrast ratio of 4.5:1+)</span>'
  },
  'image-alt': {
    whyItMatters: 'Screen readers read alternative (alt) text to convey the meaning of images to users who are blind or low vision. Without alt text, screen readers may read the file name instead, which is confusing.',
    fixExplanation: 'Add a descriptive `alt` attribute to the `<img>` tag. For decorative images that don\'t convey meaning, use an empty alt attribute (`alt=""`) so screen readers skip them.',
    exampleBefore: '<img src="logo.png">',
    exampleAfter: '<img src="logo.png" alt="Company logo">'
  },
  'label': {
    whyItMatters: 'Form labels give users context and help screen reader users know what information is expected in a form field. When clicking a label, focus is automatically set to the field, aiding users with motor difficulties.',
    fixExplanation: 'Associate the `<label>` element with its `<input>` element using matching `for` (in HTML) or `htmlFor` (in React) and `id` attributes, or wrap the input inside the label.',
    exampleBefore: 'First Name: <input type="text">',
    exampleAfter: '<label htmlFor="first-name">First Name:</label>\n<input id="first-name" type="text">'
  },
  'link-name': {
    whyItMatters: 'Screen readers read link text aloud. Generic text like "click here" or "more" provides no context about where the link goes, making navigation difficult for screen reader users browsing links in a list.',
    fixExplanation: 'Ensure all links contain meaningful text that describes their destination. If using an icon-only link, provide description via an `aria-label` or hidden screen-reader text.',
    exampleBefore: '<a href="/details">Click here</a>',
    exampleAfter: '<a href="/details">View project details</a>'
  },
  'button-name': {
    whyItMatters: 'Buttons represent interactive triggers. Screen readers rely on button text or accessible names to announce what action will occur when the button is pressed.',
    fixExplanation: 'Ensure buttons contain text, or use `aria-label` or `aria-labelledby` to describe the action, particularly for icon-only buttons.',
    exampleBefore: '<button><i className="icon-trash"></i></button>',
    exampleAfter: '<button aria-label="Delete item"><i className="icon-trash"></i></button>'
  },
  'html-has-lang': {
    whyItMatters: 'Screen readers use the HTML `lang` attribute to load the correct pronunciation dictionaries and voice engines. If not set, the browser defaults to the system\'s language, mispronouncing content.',
    fixExplanation: 'Add the `lang` attribute to the root `<html>` element with the appropriate language code (e.g., "en" for English, "es" for Spanish).',
    exampleBefore: '<html>\n  <head>...</head>\n</html>',
    exampleAfter: '<html lang="en">\n  <head>...</head>\n</html>'
  },
  'document-title': {
    whyItMatters: 'The page title is the first thing announced by a screen reader. It helps users understand what website and page they are on and lets them quickly orient themselves among multiple open tabs.',
    fixExplanation: 'Add a non-empty `<title>` element containing descriptive text to the `<head>` section of your HTML document.',
    exampleBefore: '<head>\n  <meta charset="UTF-8">\n</head>',
    exampleAfter: '<head>\n  <title>Dashboard - Access Check</title>\n</head>'
  },
  'aria-allowed-attr': {
    whyItMatters: 'Applying disallowed ARIA attributes can confuse screen readers and cause them to announce incorrect information or ignore elements entirely. Each HTML role only supports a specific set of ARIA attributes.',
    fixExplanation: 'Remove unsupported ARIA attributes or change the element\'s role to one that allows the attribute. Always refer to WAI-ARIA standards for valid attribute matching.',
    exampleBefore: '<span role="button" aria-checked="true">Submit</span>',
    exampleAfter: '<span role="checkbox" aria-checked="true">Subscribe</span>'
  },
  'aria-roles': {
    whyItMatters: 'Screen readers use ARIA roles to understand the purpose and interactive behavior of elements. An invalid or misspelled role prevents assistive technologies from communicating the element\'s purpose correctly.',
    fixExplanation: 'Ensure all `role` attribute values are valid WAI-ARIA roles (e.g., `button`, `dialog`, `main`, `navigation`, `tab`). Check for typographical errors.',
    exampleBefore: '<div role="navigationbar">...</div>',
    exampleAfter: '<div role="navigation">...</div>'
  },
  'aria-valid-attr': {
    whyItMatters: 'Browsers ignore invalid or misspelled ARIA attributes. Assistive technologies rely on these attributes to understand state, properties, and relationships between elements.',
    fixExplanation: 'Correct the spelling of any invalid ARIA attributes (e.g., changing `aria-labeledby` to `aria-labelledby`) and ensure they are recognized in the ARIA specifications.',
    exampleBefore: '<input type="text" aria-labeledby="name-label">',
    exampleAfter: '<input type="text" aria-labelledby="name-label">'
  },
  'aria-required-attr': {
    whyItMatters: 'Certain ARIA roles require specific attributes to function correctly. For instance, a `slider` must have `aria-valuenow`. Without these, screen readers cannot relay essential structural state.',
    fixExplanation: 'Provide all required ARIA attributes for the ARIA roles used on your elements.',
    exampleBefore: '<div role="slider"></div>',
    exampleAfter: '<div role="slider" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"></div>'
  },
  'duplicate-id': {
    whyItMatters: 'HTML `id` attributes must be unique on a page. When elements share an ID, screen readers and standard browser navigation can behave unpredictably, often focusing or referencing only the first instance.',
    fixExplanation: 'Ensure each `id` attribute value is used only once per document. Change duplicates to classes or use unique suffix numbers/letters.',
    exampleBefore: '<button id="submit">Save</button>\n<button id="submit">Cancel</button>',
    exampleAfter: '<button id="submit-save">Save</button>\n<button id="submit-cancel">Cancel</button>'
  },
  'heading-order': {
    whyItMatters: 'Screen reader users rely on headings to navigate long articles and understand page hierarchy. Skipping levels (e.g., `<h1>` followed directly by `<h3>`) ruins the outline structure, making it harder to comprehend.',
    fixExplanation: 'Structure headings in a sequential descending order. Do not skip heading levels (do not jump from `<h1>` to `<h3>` without an intermediate `<h2>`).',
    exampleBefore: '<h1>Main Heading</h1>\n<h3>Sub-section</h3>',
    exampleAfter: '<h1>Main Heading</h1>\n<h2>Sub-section</h2>'
  },
  'landmark-one-main': {
    whyItMatters: 'A main landmark allows screen reader users to skip navigation menus and headers directly to the page\'s primary content. Without this, users must manually navigate past repetitive headers on every page load.',
    fixExplanation: 'Ensure the document has exactly one `<main>` landmark element or a container marked with `role="main"`. Avoid wrapping multiple pages elements in nested main containers.',
    exampleBefore: '<body>\n  <header>...</header>\n  <div className="content">Primary Content</div>\n</body>',
    exampleAfter: '<body>\n  <header>...</header>\n  <main id="main-content">\n    <div className="content">Primary Content</div>\n  </main>\n</body>'
  },
  'region': {
    whyItMatters: 'Landmarks and sections organize the page layout. Screen readers can list regions to help users jump across key parts of the site. Unlabeled regions offer no hint as to what the section contains.',
    fixExplanation: 'Wrap significant sections of content in structural landmarks (like `<header>`, `<nav>`, `<main>`, `<footer>`) or give generic `<section>` tags an accessible name via `aria-label` or `aria-labelledby`.',
    exampleBefore: '<section>\n  <p>Article content...</p>\n</section>',
    exampleAfter: '<section aria-label="Recent Blog Posts">\n  <p>Article content...</p>\n</section>'
  }
};

/**
 * Utility to fetch suggestion for a given rule ID.
 * Returns default generic info if rule suggestion is not defined.
 * 
 * @param {string} ruleId 
 * @returns {object} { whyItMatters, fixExplanation, exampleBefore, exampleAfter }
 */
export function getRuleSuggestion(ruleId) {
  return ruleSuggestions[ruleId] || {
    whyItMatters: 'This rule is essential for maintaining standard WCAG accessibility criteria, helping users of assistive technology interact seamlessly.',
    fixExplanation: 'Inspect the affected elements and adjust their attributes, ARIA parameters, or structural nesting in compliance with WCAG standards.',
    exampleBefore: '<!-- Review element structure and attributes -->',
    exampleAfter: '<!-- Apply appropriate WCAG/ARIA fixes -->'
  };
}
