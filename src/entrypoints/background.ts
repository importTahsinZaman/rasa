import { generateStyles } from '../lib/ai';
import {
  getApiKey,
  getSiteStyles,
  saveSiteStyles,
  toggleSiteStyles,
  clearSiteStyles,
  extractDomain,
  compileRulesToCSS,
  addRule,
  deleteRule
} from '../lib/storage';
import type { ExtensionMessage, ExtensionResponse, PageContext, AIResponse, ChatMessage, StyleOperation, PickedElementContext, StyleRule } from '../types';

// In-memory snapshot store: domain -> messageId -> rules snapshot
const snapshotStore = new Map<string, Map<string, StyleRule[]>>();
const MAX_SNAPSHOTS_PER_DOMAIN = 20;

/**
 * Save a snapshot of the current rules before an operation
 */
function saveSnapshot(domain: string, messageId: string, rules: StyleRule[]): void {
  if (!snapshotStore.has(domain)) {
    snapshotStore.set(domain, new Map());
  }
  const domainSnapshots = snapshotStore.get(domain)!;

  // Deep clone the rules to avoid reference issues
  domainSnapshots.set(messageId, JSON.parse(JSON.stringify(rules)));

  // Prune old snapshots if we exceed the limit
  if (domainSnapshots.size > MAX_SNAPSHOTS_PER_DOMAIN) {
    const keys = Array.from(domainSnapshots.keys());
    const toDelete = keys.slice(0, keys.length - MAX_SNAPSHOTS_PER_DOMAIN);
    for (const key of toDelete) {
      domainSnapshots.delete(key);
    }
  }
}

/**
 * Get a snapshot for restoring
 */
function getSnapshot(domain: string, messageId: string): StyleRule[] | null {
  const domainSnapshots = snapshotStore.get(domain);
  if (!domainSnapshots) return null;
  return domainSnapshots.get(messageId) || null;
}

/**
 * Clear snapshots for a domain from a certain message onwards
 */
function clearSnapshotsFrom(domain: string, messageIds: string[]): void {
  const domainSnapshots = snapshotStore.get(domain);
  if (!domainSnapshots) return;
  for (const id of messageIds) {
    domainSnapshots.delete(id);
  }
}

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
  snapshotId: string; // ID to key the pre-operation snapshot
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

interface UndoOperationsMessage {
  type: 'UNDO_OPERATIONS';
  tabId: number;
  snapshotId: string; // ID of the snapshot to restore to
  snapshotIdsToRemove: string[]; // IDs of snapshots to clear after undo
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
  | ElementPickerCancelledMessage
  | UndoOperationsMessage;

async function handleMessage(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GENERATE_STYLES': {
      return handleGenerateStyles(message.prompt, message.tabId, message.conversationHistory, message.snapshotId);
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
      // Forward to sidepanel by re-broadcasting
      chrome.runtime.sendMessage(message).catch(() => {
        // Sidepanel might not be open, ignore error
      });
      return { success: true, data: message.context };
    }

    case 'ELEMENT_PICKER_CANCELLED': {
      // Forward to sidepanel by re-broadcasting
      chrome.runtime.sendMessage(message).catch(() => {
        // Sidepanel might not be open, ignore error
      });
      return { success: true };
    }

    case 'UNDO_OPERATIONS': {
      return handleUndoOperations(message.tabId, message.snapshotId, message.snapshotIdsToRemove);
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
  conversationHistory: ChatMessage[] = [],
  snapshotId: string
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

    // Save snapshot of current rules BEFORE AI makes changes
    const currentStyles = await getSiteStyles(domain);
    const currentRules = currentStyles?.rules || [];
    saveSnapshot(domain, snapshotId, currentRules);

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

/**
 * Undo operations by restoring from a snapshot
 */
async function handleUndoOperations(
  tabId: number,
  snapshotId: string,
  snapshotIdsToRemove: string[]
): Promise<ExtensionResponse> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot get tab URL' };
    }

    const domain = extractDomain(tab.url);

    // Get the snapshot to restore to
    const snapshot = getSnapshot(domain, snapshotId);
    if (snapshot === null) {
      return { success: false, error: 'Snapshot not found - undo unavailable' };
    }

    // Get current styles to preserve enabled state and metadata
    const currentStyles = await getSiteStyles(domain);
    const enabled = currentStyles?.enabled ?? true;

    // Restore the rules from snapshot
    if (snapshot.length > 0) {
      await saveSiteStyles(domain, {
        rules: snapshot,
        enabled,
        createdAt: currentStyles?.createdAt || Date.now(),
        updatedAt: Date.now()
      });

      const compiledCSS = compileRulesToCSS({ domain, rules: snapshot, enabled, createdAt: 0, updatedAt: 0 });
      await chrome.tabs.sendMessage(tabId, {
        type: 'STYLES_UPDATED',
        css: compiledCSS,
        enabled
      });
    } else {
      // Snapshot was empty, clear all styles
      await clearSiteStyles(domain);
      await chrome.tabs.sendMessage(tabId, {
        type: 'CLEAR_STYLES'
      });
    }

    // Clean up snapshots for undone messages
    clearSnapshotsFrom(domain, snapshotIdsToRemove);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
