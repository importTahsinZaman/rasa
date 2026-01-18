import type { PageContext, ElementInfo } from '../types';

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

  // Score and sort elements by importance
  const scoredElements = allElements
    .map(el => ({ element: el, score: scoreElement(el) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ELEMENTS);

  // Extract information from top elements
  const elements: ElementInfo[] = [];

  for (const { element } of scoredElements) {
    const info = extractElementInfo(element);
    if (info) {
      elements.push(info);
    }
  }

  return {
    url: window.location.href,
    title: document.title,
    elements
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
