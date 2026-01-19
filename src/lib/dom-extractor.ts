import type { PageContext, ElementInfo } from '../types';

// Maximum number of CSS variables to extract
const MAX_CSS_VARIABLES = 100;

// Maximum characters for HTML/CSS extraction
const MAX_HTML_LENGTH = 150000;  // ~150KB
const MAX_CSS_LENGTH = 150000;   // ~150KB

/**
 * Extract all CSS from stylesheets on the page
 * Excludes Rasa-injected styles
 */
function extractStylesheets(): string {
  const cssChunks: string[] = [];
  let totalLength = 0;

  try {
    for (const sheet of document.styleSheets) {
      // Skip our injected styles
      if (sheet.ownerNode instanceof Element) {
        if (sheet.ownerNode.id === 'rasa-styles' ||
            sheet.ownerNode.getAttribute('data-rasa') === 'true') {
          continue;
        }
      }

      try {
        // Try to read cssRules (may fail due to CORS)
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (const rule of rules) {
            const ruleText = rule.cssText;
            if (totalLength + ruleText.length > MAX_CSS_LENGTH) {
              cssChunks.push('\n/* ... CSS truncated due to size ... */');
              return cssChunks.join('\n');
            }
            cssChunks.push(ruleText);
            totalLength += ruleText.length;
          }
        }
      } catch {
        // CORS error - can't read this stylesheet
        // Try to get the href at least
        if (sheet.href) {
          cssChunks.push(`/* External stylesheet (CORS blocked): ${sheet.href} */`);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return cssChunks.join('\n');
}

/**
 * Extract the page HTML, cleaned up for AI consumption
 * Removes scripts, Rasa elements, and excessive whitespace
 */
function extractHTML(): string {
  try {
    // Clone the body to avoid modifying the actual DOM
    const bodyClone = document.body.cloneNode(true) as HTMLElement;

    // Remove elements we don't want to send
    const removeSelectors = [
      'script',
      'style',
      'noscript',
      'iframe[src*="rasa"]',
      '[data-rasa]',
      '#rasa-styles',
      '#rasa-root'
    ];

    for (const selector of removeSelectors) {
      bodyClone.querySelectorAll(selector).forEach(el => el.remove());
    }

    // Get the HTML and clean it up
    let html = bodyClone.innerHTML;

    // Collapse excessive whitespace
    html = html.replace(/\s+/g, ' ');
    // Remove empty class attributes
    html = html.replace(/\s*class=""\s*/g, ' ');
    // Trim
    html = html.trim();

    // Truncate if too long
    if (html.length > MAX_HTML_LENGTH) {
      html = html.slice(0, MAX_HTML_LENGTH) + '\n<!-- ... HTML truncated due to size ... -->';
    }

    return html;
  } catch {
    return '<!-- Error extracting HTML -->';
  }
}

/**
 * Extract CSS custom properties (variables) from :root/documentElement
 */
function extractCSSVariables(): Record<string, string> {
  const variables: Record<string, string> = {};

  try {
    const styles = getComputedStyle(document.documentElement);
    let count = 0;

    for (const prop of styles) {
      if (prop.startsWith('--') && count < MAX_CSS_VARIABLES) {
        const value = styles.getPropertyValue(prop).trim();
        if (value) {
          variables[prop] = value;
          count++;
        }
      }
    }
  } catch {
    // Ignore extraction errors
  }

  return variables;
}

// Important tags to prioritize
const PRIORITY_TAGS = new Set([
  'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'a', 'input', 'textarea', 'select',
  'form', 'table', 'ul', 'ol', 'li',
  'div', 'span', 'p', 'img'
]);

// Maximum number of elements to extract
const MAX_ELEMENTS = 100;

// Reserve slots for elements with IDs (these are most useful for CSS targeting)
const MAX_ID_ELEMENTS = 50;

// Maximum text length to capture
const MAX_TEXT_LENGTH = 50;

/**
 * Check if an element is visible in the viewport
 */
function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * Extract relevant information from a single element
 */
function extractElementInfo(element: Element): ElementInfo | null {
  const tag = element.tagName.toLowerCase();

  // Skip script, style, and other non-visual elements
  if (['script', 'style', 'meta', 'link', 'noscript', 'template'].includes(tag)) {
    return null;
  }

  // Skip hidden elements
  if (!isVisible(element)) {
    return null;
  }

  const info: ElementInfo = {
    tag,
    classes: Array.from(element.classList).slice(0, 5), // Limit classes
    childCount: element.children.length
  };

  // Add ID if present
  if (element.id) {
    info.id = element.id;
  }

  // Add role if present
  const role = element.getAttribute('role');
  if (role) {
    info.role = role;
  }

  // Add text content for important elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label', 'p'].includes(tag)) {
    const text = element.textContent?.trim();
    if (text) {
      info.text = text.slice(0, MAX_TEXT_LENGTH);
    }
  }

  // Add computed styles for key properties
  try {
    const computed = window.getComputedStyle(element);
    info.computedStyles = {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize
    };
  } catch {
    // Ignore style extraction errors
  }

  return info;
}

/**
 * Score an element's importance for extraction priority
 */
function scoreElement(element: Element): number {
  let score = 0;
  const tag = element.tagName.toLowerCase();

  // Priority tags get higher scores
  if (PRIORITY_TAGS.has(tag)) {
    score += 10;
  }

  // Elements with IDs are more useful for CSS targeting
  if (element.id) {
    score += 5;
  }

  // Elements with classes are useful for targeting
  if (element.classList.length > 0) {
    score += 3;
  }

  // Semantic elements score higher
  if (['header', 'nav', 'main', 'footer', 'article', 'section'].includes(tag)) {
    score += 15;
  }

  // Interactive elements score higher
  if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
    score += 8;
  }

  // Headings score higher
  if (tag.match(/^h[1-6]$/)) {
    score += 12;
  }

  return score;
}

/**
 * Extract page context for AI processing
 */
export function extractPageContext(): PageContext {
  const allElements = Array.from(document.querySelectorAll('*'));
  const elements: ElementInfo[] = [];
  const includedElements = new Set<Element>();

  // PRIORITY 1: Elements with IDs (most useful for CSS targeting)
  // These are guaranteed to be included first
  const elementsWithIds = allElements.filter(el => el.id && isVisible(el));

  // Sort ID elements by importance (semantic elements first, then by DOM order)
  const scoredIdElements = elementsWithIds
    .map(el => ({ element: el, score: scoreElement(el) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ID_ELEMENTS);

  for (const { element } of scoredIdElements) {
    const info = extractElementInfo(element);
    if (info) {
      elements.push(info);
      includedElements.add(element);
    }
  }

  // PRIORITY 2: Fill remaining slots with other important elements
  const remainingSlots = MAX_ELEMENTS - elements.length;

  if (remainingSlots > 0) {
    const otherElements = allElements
      .filter(el => !includedElements.has(el))
      .map(el => ({ element: el, score: scoreElement(el) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, remainingSlots);

    for (const { element } of otherElements) {
      const info = extractElementInfo(element);
      if (info) {
        elements.push(info);
      }
    }
  }

  return {
    url: window.location.href,
    title: document.title,
    elements,
    cssVariables: extractCSSVariables(),
    html: extractHTML(),
    stylesheets: extractStylesheets()
  };
}

/**
 * Extract a simplified summary of the page structure
 */
export function extractPageSummary(): string {
  const context = extractPageContext();

  const lines: string[] = [
    `URL: ${context.url}`,
    `Title: ${context.title}`,
    '',
    'Key Elements:'
  ];

  for (const el of context.elements.slice(0, 50)) {
    let line = `  <${el.tag}`;
    if (el.id) line += ` id="${el.id}"`;
    if (el.classes.length > 0) line += ` class="${el.classes.join(' ')}"`;
    if (el.role) line += ` role="${el.role}"`;
    line += '>';
    if (el.text) line += ` "${el.text}"`;
    lines.push(line);
  }

  return lines.join('\n');
}
