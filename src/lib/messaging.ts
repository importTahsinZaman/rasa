import type { ExtensionResponse, AIResponse, SiteStyles, ChatMessage } from '../types';

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
