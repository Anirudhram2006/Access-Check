/**
 * A real, previously captured scan result of https://example.com.
 * This ensures we can demo the application fully even when offline.
 */
export const demoScan = {
  scannedUrl: "https://example.com",
  violationCount: 3,
  violations: [
    {
      id: "html-has-lang",
      impact: "serious",
      description: "Ensures every HTML document has a lang attribute",
      help: "<html> element must have a lang attribute",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.9/html-has-lang",
      nodes: [
        {
          html: '<html xmlns="http://www.w3.org/1999/xhtml">',
          selector: "html",
          failureSummary: "Fix any of the following:\n  The <html> element does not have a lang attribute"
        }
      ]
    },
    {
      id: "landmark-one-main",
      impact: "moderate",
      description: "Ensures the document has a main landmark",
      help: "Document should have one main landmark",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.9/landmark-one-main",
      nodes: [
        {
          html: "<body>",
          selector: "body",
          failureSummary: "Fix all of the following:\n  Document does not have a main landmark"
        }
      ]
    },
    {
      id: "region",
      impact: "moderate",
      description: "Ensures all page content is contained by landmarks",
      help: "All page content should be contained by landmarks",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.9/region",
      nodes: [
        {
          html: "<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents...</p>\n    <p><a href=\"https://www.iana.org/domains/reserved\">More information...</a></p>\n</div>",
          selector: "html > body > div",
          failureSummary: "Fix any of the following:\n  Some page content is not contained by landmarks"
        }
      ]
    }
  ],
  screenshotUrl: "/screenshots/screenshot-1786680978086.png", // Maps to a real screenshot in backend/screenshots/
  indicText: {
    tamil: [
      "வணக்கம் உலகமே",
      "வலைப்பதிவு மற்றும் செய்திகள்",
      "மேலும் அறிய இங்கே கிளிக் செய்க"
    ],
    hindi: [
      "नमस्ते दुनिया",
      "नवीनतम समाचार और ब्लॉग",
      "अधिक जानने के लिए यहाँ क्लिक करें"
    ]
  }
};
