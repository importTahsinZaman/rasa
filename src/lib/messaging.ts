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
  conversationHistory: ChatMessage[] = [],
  snapshotId: string
): Promise<ExtensionResponse<AIResponse>> {
  return sendToBackground({
    type: 'GENERATE_STYLES',
    prompt,
    tabId,
    conversationHistory,
    snapshotId
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
 * Undo operations by restoring to a snapshot
 */
export async function undoOperations(
  tabId: number,
  snapshotId: string,
  snapshotIdsToRemove: string[]
): Promise<ExtensionResponse> {
  return sendToBackground({
    type: 'UNDO_OPERATIONS',
    tabId,
    snapshotId,
    snapshotIdsToRemove
  });
}

/**
 * Format computed styles as CSS-like block
 */
function formatStyles(styles: Record<string, string>, indent: string = '  '): string[] {
  const lines: string[] = [];
  for (const [prop, value] of Object.entries(styles)) {
    lines.push(`${indent}${prop}: ${value};`);
  }
  return lines;
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

  // Computed styles for selected element (all styles)
  lines.push('COMPUTED STYLES:');
  lines.push(`${context.selector} {`);
  lines.push(...formatStyles(context.computedStyles));
  lines.push('}');
  lines.push('');

  // Children with styles (first 5 have full styles)
  if (context.children.length > 0) {
    lines.push(`CHILDREN (${context.children.length} direct):`);
    for (let i = 0; i < context.children.length; i++) {
      const child = context.children[i];
      let childSelector = child.tag;
      if (child.id) childSelector = `#${child.id}`;
      else if (child.classes.length > 0) childSelector = `.${child.classes[0]}`;

      let childLine = `  <${child.tag}`;
      if (child.id) childLine += ` id="${child.id}"`;
      if (child.classes.length > 0) childLine += ` class="${child.classes.join(' ')}"`;
      childLine += '>';
      if (child.text) childLine += ` "${child.text}"`;
      if (child.childCount > 0) childLine += ` [${child.childCount} children]`;
      lines.push(childLine);

      // Include styles for first 5 children
      if (child.computedStyles && Object.keys(child.computedStyles).length > 0) {
        lines.push(`  ${context.selector} > ${childSelector} {`);
        lines.push(...formatStyles(child.computedStyles, '    '));
        lines.push('  }');
      }
    }
    lines.push('');
  }

  // Siblings (no styles, just structure)
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

  return lines.join('\n');
}
