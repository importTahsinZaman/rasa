import type { SiteStyles, StyleRule, LegacySiteStyles, ChatMessage, RuleSummary } from '../types';

// Generate unique rule ID
export function generateRuleId(): string {
  return 'r_' + Math.random().toString(36).substring(2, 10);
}

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

// Migrate legacy CSS string format to rule-based format
function migrateLegacyStyles(legacy: LegacySiteStyles): SiteStyles {
  const rules: StyleRule[] = [];

  if (legacy.css && legacy.css.trim()) {
    // Create a single rule from the legacy CSS
    rules.push({
      id: generateRuleId(),
      selector: '(migrated)',
      css: legacy.css,
      description: 'Migrated from legacy format',
      createdBy: 'user',
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt
    });
  }

  return {
    domain: legacy.domain,
    rules,
    enabled: legacy.enabled,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt
  };
}

// Check if styles are in legacy format
function isLegacyFormat(styles: SiteStyles | LegacySiteStyles): styles is LegacySiteStyles {
  return 'css' in styles && typeof styles.css === 'string' && !('rules' in styles);
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
  const styles = allStyles[domain];

  if (!styles) return null;

  // Migrate if needed
  if (isLegacyFormat(styles)) {
    const migrated = migrateLegacyStyles(styles);
    await saveSiteStyles(domain, migrated);
    return migrated;
  }

  return styles;
}

export async function getAllStyles(): Promise<Record<string, SiteStyles | LegacySiteStyles>> {
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

// Rule-level operations

export async function addRule(domain: string, rule: Omit<StyleRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<StyleRule> {
  const styles = await getSiteStyles(domain);
  const now = Date.now();

  const newRule: StyleRule = {
    ...rule,
    id: generateRuleId(),
    createdAt: now,
    updatedAt: now
  };

  if (styles) {
    styles.rules.push(newRule);
    await saveSiteStyles(domain, styles);
  } else {
    await saveSiteStyles(domain, {
      rules: [newRule],
      enabled: true,
      createdAt: now,
      updatedAt: now
    });
  }

  return newRule;
}

export async function editRule(domain: string, ruleId: string, updates: { css?: string; description?: string; updatedBy?: 'ai' | 'user' }): Promise<StyleRule | null> {
  const styles = await getSiteStyles(domain);
  if (!styles) return null;

  const ruleIndex = styles.rules.findIndex(r => r.id === ruleId);
  if (ruleIndex === -1) return null;

  const rule = styles.rules[ruleIndex];
  const updatedRule: StyleRule = {
    ...rule,
    ...updates,
    updatedAt: Date.now()
  };

  styles.rules[ruleIndex] = updatedRule;
  await saveSiteStyles(domain, styles);

  return updatedRule;
}

export async function deleteRule(domain: string, ruleId: string): Promise<boolean> {
  const styles = await getSiteStyles(domain);
  if (!styles) return false;

  const ruleIndex = styles.rules.findIndex(r => r.id === ruleId);
  if (ruleIndex === -1) return false;

  styles.rules.splice(ruleIndex, 1);
  await saveSiteStyles(domain, styles);

  return true;
}

export async function getRule(domain: string, ruleId: string): Promise<StyleRule | null> {
  const styles = await getSiteStyles(domain);
  if (!styles) return null;

  return styles.rules.find(r => r.id === ruleId) || null;
}

export async function getRules(domain: string, ruleIds: string[]): Promise<StyleRule[]> {
  const styles = await getSiteStyles(domain);
  if (!styles) return [];

  return styles.rules.filter(r => ruleIds.includes(r.id));
}

export function getRuleSummaries(styles: SiteStyles): RuleSummary[] {
  return styles.rules.map(r => ({
    id: r.id,
    selector: r.selector,
    description: r.description,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy
  }));
}

// Compile all rules into a single CSS string for injection
export function compileRulesToCSS(styles: SiteStyles): string {
  return styles.rules.map(r => r.css).join('\n\n');
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
