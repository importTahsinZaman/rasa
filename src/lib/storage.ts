import type { SiteStyles, ChatMessage } from '../types';

// API Key management - stored locally for security (not synced)
export async function saveApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ apiKey: key });
}

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

export async function removeApiKey(): Promise<void> {
  await chrome.storage.local.remove('apiKey');
}

// Site styles management - stored locally (sync has 8KB limit per item)
export async function saveSiteStyles(domain: string, styles: Omit<SiteStyles, 'domain'>): Promise<void> {
  const allStyles = await getAllStyles();
  allStyles[domain] = {
    ...styles,
    domain,
    updatedAt: Date.now()
  };
  await chrome.storage.local.set({ siteStyles: allStyles });
}

export async function getSiteStyles(domain: string): Promise<SiteStyles | null> {
  const allStyles = await getAllStyles();
  return allStyles[domain] || null;
}

export async function getAllStyles(): Promise<Record<string, SiteStyles>> {
  const result = await chrome.storage.local.get('siteStyles');
  return result.siteStyles || {};
}

export async function toggleSiteStyles(domain: string, enabled: boolean): Promise<void> {
  const styles = await getSiteStyles(domain);
  if (styles) {
    await saveSiteStyles(domain, { ...styles, enabled });
  }
}

export async function clearSiteStyles(domain: string): Promise<void> {
  const allStyles = await getAllStyles();
  delete allStyles[domain];
  await chrome.storage.local.set({ siteStyles: allStyles });
}

// Chat history management
export async function getChatHistory(domain: string): Promise<ChatMessage[]> {
  const result = await chrome.storage.local.get('chatHistory');
  const history = result.chatHistory || {};
  return history[domain] || [];
}

export async function saveChatHistory(domain: string, messages: ChatMessage[]): Promise<void> {
  const result = await chrome.storage.local.get('chatHistory');
  const history = result.chatHistory || {};
  history[domain] = messages;
  await chrome.storage.local.set({ chatHistory: history });
}

export async function clearChatHistory(domain: string): Promise<void> {
  const result = await chrome.storage.local.get('chatHistory');
  const history = result.chatHistory || {};
  delete history[domain];
  await chrome.storage.local.set({ chatHistory: history });
}

// Utility to extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}
