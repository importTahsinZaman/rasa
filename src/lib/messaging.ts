import type { ExtensionResponse, AIResponse, SiteStyles, ChatMessage, PickedElementContext } from '../types';

/**
 * Send a message to the background script
 */
async function sendToBackground<T>(message: object): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Generate styles using AI with conversation history for stateful interactions
 */
export async function generateStyles(
  prompt: string,
  tabId: number,
  conversationHistory: ChatMessage[] = []
): Promise<ExtensionResponse<AIResponse>> {
  return sendToBackground({
    type: 'GENERATE_STYLES',
    prompt,
    tabId,
    conversationHistory
  });
}

/**
 * Apply and save CSS styles
 */
export async function applyAndSaveStyles(
  css: string,
  tabId: number
): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'APPLY_AND_SAVE_STYLES',
    css,
    tabId
  });
}

/**
 * Toggle styles on/off for current site
 */
export async function toggleSiteStyles(
  tabId: number,
  enabled: boolean
): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'TOGGLE_SITE_STYLES',
    tabId,
    enabled
  });
}

/**
 * Clear all styles for current site
 */
export async function clearSiteStyles(tabId: number): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'CLEAR_SITE_STYLES',
    tabId
  });
}

/**
 * Get the current active tab
 */
export async function getCurrentTab(): Promise<ExtensionResponse<chrome.tabs.Tab>> {
  return sendToBackground({
    type: 'GET_CURRENT_TAB'
  });
}

/**
 * Get site info including saved styles
 */
export async function getSiteInfo(
  tabId: number
): Promise<ExtensionResponse<{ domain: string; styles: SiteStyles | null }>> {
  return sendToBackground({
    type: 'GET_SITE_INFO',
    tabId
  });
}

/**
 * Start the element picker on the page
 */
export async function startElementPicker(tabId: number): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'START_ELEMENT_PICKER',
    tabId
  });
}

/**
 * Cancel the element picker
 */
export async function cancelElementPicker(tabId: number): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'CANCEL_ELEMENT_PICKER',
    tabId
  });
}

/**
 * Undo operations by deleting rules that were added
 */
export async function undoOperations(
  tabId: number,
  selectors: string[]
): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'UNDO_OPERATIONS',
    tabId,
    selectors
  });
}

/**
 * Format picked element context for display/AI prompt
 */
export function formatPickedElementContext(context: PickedElementContext): string {
  const lines: string[] = [];

  // Breadcrumb path
  lines.push('LOCATION (path from body):');
  lines.push(`  ${context.breadcrumb.join(' > ')}`);
  lines.push('');

  // Selected element
  lines.push('SELECTED ELEMENT:');
  let elementLine = `  <${context.element.tag}`;
  if (context.element.id) elementLine += ` id="${context.element.id}"`;
  if (context.element.classes.length > 0) {
    elementLine += ` class="${context.element.classes.join(' ')}"`;
  }
  // Add other key attributes
  const skipAttrs = ['id', 'class', 'style'];
  for (const [key, value] of Object.entries(context.element.attributes)) {
    if (!skipAttrs.includes(key) && value.length < 50) {
      elementLine += ` ${key}="${value}"`;
    }
  }
  elementLine += '>';
  if (context.element.text) {
    elementLine += ` "${context.element.text}"`;
  }
  lines.push(elementLine);
  lines.push('');

  // Selector
  lines.push(`CSS SELECTOR: ${context.selector}`);
  lines.push('');

  // Children
  if (context.children.length > 0) {
    lines.push(`CHILDREN (${context.children.length} direct):`);
    for (const child of context.children) {
      let childLine = `  <${child.tag}`;
      if (child.id) childLine += `#${child.id}`;
      if (child.classes.length > 0) childLine += `.${child.classes.join('.')}`;
      childLine += '>';
      if (child.text) childLine += ` "${child.text}"`;
      if (child.childCount > 0) childLine += ` [${child.childCount} children]`;
      lines.push(childLine);
    }
    lines.push('');
  }

  // Siblings
  const hasSiblings = context.previousSiblings.length > 0 || context.nextSiblings.length > 0;
  if (hasSiblings) {
    lines.push('SIBLINGS:');
    for (const sib of context.previousSiblings) {
      lines.push(`  ← <${sib.tag}${sib.id ? `#${sib.id}` : ''}${sib.classes.length > 0 ? `.${sib.classes[0]}` : ''}>${sib.text ? ` "${sib.text}"` : ''}`);
    }
    lines.push('  ● [selected]');
    for (const sib of context.nextSiblings) {
      lines.push(`  → <${sib.tag}${sib.id ? `#${sib.id}` : ''}${sib.classes.length > 0 ? `.${sib.classes[0]}` : ''}>${sib.text ? ` "${sib.text}"` : ''}`);
    }
    lines.push('');
  }

  // Computed styles
  lines.push('CURRENT STYLES:');
  const styles = context.computedStyles;
  lines.push(`  size: ${styles.width} × ${styles.height}`);
  lines.push(`  padding: ${styles.padding}`);
  lines.push(`  margin: ${styles.margin}`);
  lines.push(`  background: ${styles.backgroundColor}`);
  lines.push(`  color: ${styles.color}`);
  lines.push(`  font: ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`);
  lines.push(`  line-height: ${styles.lineHeight}`);
  lines.push(`  letter-spacing: ${styles.letterSpacing}`);
  lines.push(`  text-align: ${styles.textAlign}`);
  if (styles.textTransform !== 'none') {
    lines.push(`  text-transform: ${styles.textTransform}`);
  }
  if (styles.textDecoration !== 'none' && !styles.textDecoration.startsWith('none')) {
    lines.push(`  text-decoration: ${styles.textDecoration}`);
  }
  lines.push(`  display: ${styles.display}, position: ${styles.position}`);
  if (styles.border !== 'none' && styles.border !== '0px none rgb(0, 0, 0)') {
    lines.push(`  border: ${styles.border}`);
  }
  if (styles.borderRadius !== '0px') {
    lines.push(`  border-radius: ${styles.borderRadius}`);
  }

  return lines.join('\n');
}
