const STYLE_ELEMENT_ID = 'rasa-ui-customizer-styles';

// Dangerous CSS patterns that should be sanitized
const DANGEROUS_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /-moz-binding\s*:/gi,
  /behavior\s*:/gi,
];

/**
 * Sanitize CSS to prevent XSS and other security issues
 */
export function sanitizeCSS(css: string): string {
  let sanitized = css;

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* blocked */');
  }

  return sanitized;
}

/**
 * Inject CSS into the current page using a style element
 * This is called from the content script
 */
export function injectStyles(css: string): void {
  // Remove existing styles first
  removeStyles();

  if (!css || css.trim() === '') {
    return;
  }

  const sanitizedCSS = sanitizeCSS(css);

  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = sanitizedCSS;

  // Append to head to ensure highest specificity with USER origin
  document.head.appendChild(styleElement);
}

/**
 * Remove injected styles from the current page
 */
export function removeStyles(): void {
  const existingStyle = document.getElementById(STYLE_ELEMENT_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
}

/**
 * Check if styles are currently injected
 */
export function hasInjectedStyles(): boolean {
  return document.getElementById(STYLE_ELEMENT_ID) !== null;
}

/**
 * Update existing styles without removing and re-adding
 */
export function updateStyles(css: string): void {
  const existingStyle = document.getElementById(STYLE_ELEMENT_ID);

  if (existingStyle) {
    existingStyle.textContent = sanitizeCSS(css);
  } else {
    injectStyles(css);
  }
}

/**
 * Inject CSS using Chrome scripting API (for background script)
 */
export async function injectStylesViaScripting(tabId: number, css: string): Promise<void> {
  const sanitizedCSS = sanitizeCSS(css);

  try {
    // First remove any existing injected CSS
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: sanitizedCSS,
      origin: 'USER'
    }).catch(() => {
      // Ignore errors if CSS wasn't previously injected
    });

    // Inject new CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: sanitizedCSS,
      origin: 'USER'
    });
  } catch (error) {
    console.error('Failed to inject CSS via scripting API:', error);
    throw error;
  }
}

/**
 * Remove CSS using Chrome scripting API (for background script)
 */
export async function removeStylesViaScripting(tabId: number, css: string): Promise<void> {
  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: sanitizeCSS(css),
      origin: 'USER'
    });
  } catch (error) {
    console.error('Failed to remove CSS via scripting API:', error);
  }
}
