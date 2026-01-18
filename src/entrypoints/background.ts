import { generateStyles } from '../lib/ai';
import {
  getApiKey,
  getSiteStyles,
  saveSiteStyles,
  toggleSiteStyles,
  clearSiteStyles,
  extractDomain,
  compileRulesToCSS,
  addRule
} from '../lib/storage';
import type { ExtensionMessage, ExtensionResponse, PageContext, AIResponse, ChatMessage, StyleOperation, PickedElementContext } from '../types';

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

interface StartElementPickerMessage {
  type: 'START_ELEMENT_PICKER';
  tabId: number;
}

interface CancelElementPickerMessage {
  type: 'CANCEL_ELEMENT_PICKER';
  tabId: number;
}

interface ElementPickedMessage {
  type: 'ELEMENT_PICKED';
  context: PickedElementContext;
}

interface ElementPickerCancelledMessage {
  type: 'ELEMENT_PICKER_CANCELLED';
}

type BackgroundMessage =
  | GenerateStylesMessage
  | ApplyAndSaveMessage
  | ToggleStylesMessage
  | ClearStylesMessage
  | GetCurrentTabMessage
  | GetSiteInfoMessage
  | StartElementPickerMessage
  | CancelElementPickerMessage
  | ElementPickedMessage
  | ElementPickerCancelledMessage;

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

    case 'START_ELEMENT_PICKER': {
      return handleStartElementPicker(message.tabId);
    }

    case 'CANCEL_ELEMENT_PICKER': {
      return handleCancelElementPicker(message.tabId);
    }

    case 'ELEMENT_PICKED': {
      // Forward to sidepanel - it will be received via chrome.runtime.onMessage
      // The sidepanel listens for this message type
      return { success: true, data: message.context };
    }

    case 'ELEMENT_PICKER_CANCELLED': {
      // Forward to sidepanel
      return { success: true };
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

    // Generate styles with AI (tool-based approach)
    // AI will read/write rules directly via tools
    const aiResponse = await generateStyles(
      apiKey,
      prompt,
      pageContext,
      domain,
      conversationHistory
    );

    // Get the updated styles after AI has made changes
    const updatedStyles = await getSiteStyles(domain);

    // Compile rules to CSS and apply to the page
    if (updatedStyles) {
      const compiledCSS = compileRulesToCSS(updatedStyles);

      await chrome.tabs.sendMessage(tabId, {
        type: 'STYLES_UPDATED',
        css: compiledCSS,
        enabled: updatedStyles.enabled
      });
    }

    return {
      success: true,
      data: aiResponse
    };
  } catch (error) {
    console.error('Generate styles error:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Apply and save CSS styles (creates a single rule from raw CSS)
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

    // Add as a manual rule (selector-based ID will be "(manual)")
    await addRule(domain, {
      selector: '(manual)',
      css,
      description: 'Manually applied CSS',
      createdBy: 'user'
    });

    // Get compiled CSS and apply to page
    const styles = await getSiteStyles(domain);
    const compiledCSS = styles ? compileRulesToCSS(styles) : css;

    await chrome.tabs.sendMessage(tabId, {
      type: 'STYLES_UPDATED',
      css: compiledCSS,
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

/**
 * Start the element picker on the page
 */
async function handleStartElementPicker(tabId: number): Promise<ExtensionResponse> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_ELEMENT_PICKER'
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Cancel the element picker on the page
 */
async function handleCancelElementPicker(tabId: number): Promise<ExtensionResponse> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CANCEL_ELEMENT_PICKER'
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
