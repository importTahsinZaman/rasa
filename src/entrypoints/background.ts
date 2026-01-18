import { generateStyles } from '../lib/ai';
import {
  getApiKey,
  getSiteStyles,
  saveSiteStyles,
  toggleSiteStyles,
  clearSiteStyles,
  extractDomain
} from '../lib/storage';
import type { ExtensionMessage, ExtensionResponse, PageContext, AIResponse, ChatMessage } from '../types';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Set up side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Listen for messages from content scripts and sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch(error => {
        console.error('Background message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  });
});

interface GenerateStylesMessage {
  type: 'GENERATE_STYLES';
  prompt: string;
  tabId: number;
  conversationHistory: ChatMessage[];
}

interface ApplyAndSaveMessage {
  type: 'APPLY_AND_SAVE_STYLES';
  css: string;
  tabId: number;
}

interface ToggleStylesMessage {
  type: 'TOGGLE_SITE_STYLES';
  tabId: number;
  enabled: boolean;
}

interface ClearStylesMessage {
  type: 'CLEAR_SITE_STYLES';
  tabId: number;
}

interface GetCurrentTabMessage {
  type: 'GET_CURRENT_TAB';
}

interface GetSiteInfoMessage {
  type: 'GET_SITE_INFO';
  tabId: number;
}

type BackgroundMessage =
  | GenerateStylesMessage
  | ApplyAndSaveMessage
  | ToggleStylesMessage
  | ClearStylesMessage
  | GetCurrentTabMessage
  | GetSiteInfoMessage;

async function handleMessage(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GENERATE_STYLES': {
      return handleGenerateStyles(message.prompt, message.tabId, message.conversationHistory);
    }

    case 'APPLY_AND_SAVE_STYLES': {
      return handleApplyAndSaveStyles(message.css, message.tabId);
    }

    case 'TOGGLE_SITE_STYLES': {
      return handleToggleStyles(message.tabId, message.enabled);
    }

    case 'CLEAR_SITE_STYLES': {
      return handleClearStyles(message.tabId);
    }

    case 'GET_CURRENT_TAB': {
      return handleGetCurrentTab();
    }

    case 'GET_SITE_INFO': {
      return handleGetSiteInfo(message.tabId);
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Generate styles using AI and apply to the page
 */
async function handleGenerateStyles(
  prompt: string,
  tabId: number,
  conversationHistory: ChatMessage[] = []
): Promise<ExtensionResponse<AIResponse>> {
  try {
    // Get API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    // Get page context from content script
    const contextResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_PAGE_CONTEXT'
    }) as ExtensionResponse<PageContext>;

    if (!contextResponse.success || !contextResponse.data) {
      return { success: false, error: 'Failed to get page context' };
    }

    const pageContext = contextResponse.data;
    const domain = extractDomain(pageContext.url);

    // Get existing styles if any
    const existingStyles = await getSiteStyles(domain);

    // Generate new styles with AI (passing conversation history for context)
    const aiResponse = await generateStyles(
      apiKey,
      prompt,
      pageContext,
      conversationHistory,
      existingStyles?.css
    );

    // Combine with existing styles or replace
    const finalCSS = existingStyles?.css
      ? `${existingStyles.css}\n\n/* New styles */\n${aiResponse.css}`
      : aiResponse.css;

    // Save styles to storage
    await saveSiteStyles(domain, {
      css: finalCSS,
      enabled: true,
      createdAt: existingStyles?.createdAt || Date.now(),
      updatedAt: Date.now()
    });

    // Apply styles to the page
    await chrome.tabs.sendMessage(tabId, {
      type: 'STYLES_UPDATED',
      css: finalCSS,
      enabled: true
    });

    return {
      success: true,
      data: {
        ...aiResponse,
        css: finalCSS
      }
    };
  } catch (error) {
    console.error('Generate styles error:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Apply and save CSS styles
 */
async function handleApplyAndSaveStyles(
  css: string,
  tabId: number
): Promise<ExtensionResponse> {
  try {
    // Get tab URL to determine domain
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot get tab URL' };
    }

    const domain = extractDomain(tab.url);

    // Save styles
    await saveSiteStyles(domain, {
      css,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Apply to page
    await chrome.tabs.sendMessage(tabId, {
      type: 'STYLES_UPDATED',
      css,
      enabled: true
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Toggle styles on/off for a site
 */
async function handleToggleStyles(
  tabId: number,
  enabled: boolean
): Promise<ExtensionResponse> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot get tab URL' };
    }

    const domain = extractDomain(tab.url);
    const styles = await getSiteStyles(domain);

    if (!styles) {
      return { success: false, error: 'No styles saved for this site' };
    }

    // Update storage
    await toggleSiteStyles(domain, enabled);

    // Update page
    await chrome.tabs.sendMessage(tabId, {
      type: 'TOGGLE_STYLES',
      enabled
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Clear all styles for a site
 */
async function handleClearStyles(tabId: number): Promise<ExtensionResponse> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot get tab URL' };
    }

    const domain = extractDomain(tab.url);

    // Clear from storage
    await clearSiteStyles(domain);

    // Remove from page
    await chrome.tabs.sendMessage(tabId, {
      type: 'CLEAR_STYLES'
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get the current active tab
 */
async function handleGetCurrentTab(): Promise<ExtensionResponse<chrome.tabs.Tab>> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }
    return { success: true, data: tab };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get site info including saved styles
 */
async function handleGetSiteInfo(
  tabId: number
): Promise<ExtensionResponse<{ domain: string; styles: ReturnType<typeof getSiteStyles> extends Promise<infer T> ? T : never }>> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot get tab URL' };
    }

    const domain = extractDomain(tab.url);
    const styles = await getSiteStyles(domain);

    return {
      success: true,
      data: { domain, styles }
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
