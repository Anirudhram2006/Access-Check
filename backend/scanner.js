const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Validates whether the given string is a valid HTTP/HTTPS URL.
 * @param {string} urlString 
 * @returns {boolean}
 */
function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Runs accessibility audit and captures a screenshot of the page.
 * @param {string} targetUrl The website URL to audit
 * @returns {Promise<object>} Audit results containing violations and screenshot info
 */
async function runAudit(targetUrl) {
  // 1. Validate the URL before launching the browser
  if (!isValidUrl(targetUrl)) {
    throw new Error('Invalid URL format. Please provide a valid URL starting with http:// or https://');
  }

  let browser;
  try {
    // 2. Launch Puppeteer in headless mode
    // We pass useful args for performance and safety inside CLI/restricted environments
    browser = await puppeteer.launch({
      headless: 'new', // compatible with both puppeteer old/new versions
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set a reasonable viewport size to capture standard desktop layouts
    await page.setViewport({ width: 1280, height: 800 });

    // 3. Navigate to target URL with a reasonable page load timeout (30 seconds)
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2', // Wait until network activity is mostly idle
      timeout: 30000             // 30 seconds timeout
    });

    // Ensure the screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // 4. Capture a full-page screenshot
    const screenshotFilename = `screenshot-${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    console.log(`Capturing full-page screenshot to: ${screenshotPath}`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    // 5. Run axe-core audit inside the page context
    console.log('Running axe-core accessibility audit...');
    const axeBuilder = new AxePuppeteer(page);
    const results = await axeBuilder.analyze();

    // 5.5 Extract visible Tamil/Hindi text from page context
    let indicText = { tamil: [], hindi: [] };
    try {
      console.log('Extracting visible Indian-script text...');
      indicText = await page.evaluate(() => {
        const tamilRegex = /[\u0B80-\u0BFF]/;
        const hindiRegex = /[\u0900-\u097F]/;
        
        const tamilPhrases = new Set();
        const hindiPhrases = new Set();
        
        function traverse(node) {
          if (!node) return;
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            const ignoredTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'input', 'textarea', 'select', 'option', 'meta', 'link', 'head', 'title'];
            if (ignoredTags.includes(tagName)) {
              return;
            }
            
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
              return;
            }
          }
          
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
              const parent = node.parentElement;
              if (parent) {
                const rect = parent.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  if (tamilRegex.test(text)) {
                    tamilPhrases.add(text);
                  }
                  if (hindiRegex.test(text)) {
                    hindiPhrases.add(text);
                  }
                }
              }
            }
            return;
          }
          
          let child = node.firstChild;
          while (child) {
            traverse(child);
            child = child.nextSibling;
          }
        }
        
        if (document.body) {
          traverse(document.body);
        }
        
        return {
          tamil: Array.from(tamilPhrases),
          hindi: Array.from(hindiPhrases)
        };
      });
    } catch (evalError) {
      console.error('Failed to extract visible Indian-script text:', evalError);
    }

    // 6. Format the results for our client application
    // We map only the fields required by our specifications to keep payload lean and focused
    const formattedViolations = results.violations.map(violation => {
      return {
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        // Map the affected DOM elements and CSS selectors
        nodes: violation.nodes.map(node => ({
          html: node.html,
          selector: node.target.join(' > '), // join nested target selectors for easy selection
          failureSummary: node.failureSummary
        }))
      };
    });

    return {
      scannedUrl: targetUrl,
      violationCount: formattedViolations.length,
      violations: formattedViolations,
      screenshotUrl: `/screenshots/${screenshotFilename}`, // Return relative path served by Express
      indicText
    };

  } catch (error) {
    // Re-throw errors with clean, meaningful messages for the Express router
    console.error('Audit failed with error:', error);
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      throw new Error('Navigation timeout. The page took too long to load.');
    }
    throw new Error(`Accessibility audit failed: ${error.message}`);
  } finally {
    // 7. Ensure browser is closed under all circumstances
    if (browser) {
      console.log('Closing Puppeteer browser...');
      await browser.close();
    }
  }
}

module.exports = {
  isValidUrl,
  runAudit
};
