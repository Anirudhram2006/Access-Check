/**
 * Backend mirror of frontend rule suggestions for PDF report generation.
 * Reuses the same rule-description data to avoid a second conflicting system.
 */

const ruleSuggestions = {
  'color-contrast': {
    whyItMatters: 'Users with visual impairments or low contrast sensitivity cannot read text that does not stand out sufficiently from the background. Proper contrast ensures legibility in various lighting conditions for all users.',
    fixExplanation: 'Increase the contrast between the foreground text color and the background color. Web Content Accessibility Guidelines (WCAG) AAA requires a ratio of at least 4.5:1 for normal text and 3:1 for large text.'
  },
  'image-alt': {
    whyItMatters: 'Screen readers read alternative (alt) text to convey the meaning of images to users who are blind or low vision. Without alt text, screen readers may read the file name instead, which is confusing.',
    fixExplanation: 'Add a descriptive `alt` attribute to the `<img>` tag. For decorative images that don\'t convey meaning, use an empty alt attribute (`alt=""`) so screen readers skip them.'
  },
  'label': {
    whyItMatters: 'Form labels give users context and help screen reader users know what information is expected in a form field. When clicking a label, focus is automatically set to the field, aiding users with motor difficulties.',
    fixExplanation: 'Associate the `<label>` element with its `<input>` element using matching `for` and `id` attributes, or wrap the input inside the label.'
  },
  'link-name': {
    whyItMatters: 'Screen readers read link text aloud. Generic text like "click here" or "more" provides no context about where the link goes, making navigation difficult for screen reader users browsing links in a list.',
    fixExplanation: 'Ensure all links contain meaningful text that describes their destination. If using an icon-only link, provide description via an `aria-label` or hidden screen-reader text.'
  },
  'button-name': {
    whyItMatters: 'Buttons represent interactive triggers. Screen readers rely on button text or accessible names to announce what action will occur when the button is pressed.',
    fixExplanation: 'Ensure buttons contain text, or use `aria-label` or `aria-labelledby` to describe the action, particularly for icon-only buttons.'
  },
  'html-has-lang': {
    whyItMatters: 'Screen readers use the HTML `lang` attribute to load the correct pronunciation dictionaries and voice engines. If not set, the browser defaults to the system\'s language, mispronouncing content.',
    fixExplanation: 'Add the `lang` attribute to the root `<html>` element with the appropriate language code (e.g., "en" for English, "es" for Spanish).'
  },
  'document-title': {
    whyItMatters: 'The page title is the first thing announced by a screen reader. It helps users understand what website and page they are on and lets them quickly orient themselves among multiple open tabs.',
    fixExplanation: 'Add a non-empty `<title>` element containing descriptive text to the `<head>` section of your HTML document.'
  },
  'aria-allowed-attr': {
    whyItMatters: 'Applying disallowed ARIA attributes can confuse screen readers and cause them to announce incorrect information or ignore elements entirely.',
    fixExplanation: 'Remove unsupported ARIA attributes or change the element\'s role to one that allows the attribute. Always refer to WAI-ARIA standards for valid attribute matching.'
  },
  'aria-roles': {
    whyItMatters: 'Screen readers use ARIA roles to understand the purpose and interactive behavior of elements. An invalid or misspelled role prevents assistive technologies from communicating the element\'s purpose correctly.',
    fixExplanation: 'Ensure all `role` attribute values are valid WAI-ARIA roles (e.g., `button`, `dialog`, `main`, `navigation`, `tab`). Check for typographical errors.'
  },
  'aria-valid-attr': {
    whyItMatters: 'Browsers ignore invalid or misspelled ARIA attributes. Assistive technologies rely on these attributes to understand state, properties, and relationships between elements.',
    fixExplanation: 'Correct the spelling of any invalid ARIA attributes (e.g., changing `aria-labeledby` to `aria-labelledby`) and ensure they are recognized in the ARIA specifications.'
  },
  'aria-required-attr': {
    whyItMatters: 'Certain ARIA roles require specific attributes to function correctly. Without these, screen readers cannot relay essential structural state.',
    fixExplanation: 'Provide all required ARIA attributes for the ARIA roles used on your elements.'
  },
  'duplicate-id': {
    whyItMatters: 'HTML `id` attributes must be unique on a page. When elements share an ID, screen readers and standard browser navigation can behave unpredictably.',
    fixExplanation: 'Ensure each `id` attribute value is used only once per document. Change duplicates to classes or use unique suffix numbers/letters.'
  },
  'heading-order': {
    whyItMatters: 'Screen reader users rely on headings to navigate long articles and understand page hierarchy. Skipping levels ruins the outline structure.',
    fixExplanation: 'Structure headings in a sequential descending order. Do not skip heading levels (do not jump from `<h1>` to `<h3>` without an intermediate `<h2>`).'
  },
  'landmark-one-main': {
    whyItMatters: 'A main landmark allows screen reader users to skip navigation menus and headers directly to the page\'s primary content.',
    fixExplanation: 'Ensure the document has exactly one `<main>` landmark element or a container marked with `role="main"`.'
  },
  'region': {
    whyItMatters: 'Landmarks and sections organize the page layout. Screen readers can list regions to help users jump across key parts of the site.',
    fixExplanation: 'Wrap significant sections of content in structural landmarks (like `<header>`, `<nav>`, `<main>`, `<footer>`) or give generic `<section>` tags an accessible name via `aria-label`.'
  }
};

const defaultSuggestion = {
  whyItMatters: 'This rule is essential for maintaining standard WCAG accessibility criteria, helping users of assistive technology interact seamlessly.',
  fixExplanation: 'Inspect the affected elements and adjust their attributes, ARIA parameters, or structural nesting in compliance with WCAG standards.'
};

/**
 * Get suggestion for a given rule ID.
 * Returns default generic info if rule suggestion is not defined.
 */
function getRuleSuggestion(ruleId) {
  return ruleSuggestions[ruleId] || defaultSuggestion;
}

module.exports = { getRuleSuggestion };
