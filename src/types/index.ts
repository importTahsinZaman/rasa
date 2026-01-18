// Site styles stored per domain
export interface SiteStyles {
  domain: string;
  css: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// Page context extracted from DOM for AI
export interface PageContext {
  url: string;
  title: string;
  elements: ElementInfo[];
}

export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  role?: string;
  text?: string;
  childCount: number;
  computedStyles?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
  };
}

// AI response structure
export interface AIResponse {
  css: string;
  selectors: string[];
  explanation: string;
}

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  styles?: {
    css: string;
    selectors: string[];
  };
}

// Message types for extension communication
export type ExtensionMessage =
  | { type: 'GENERATE_STYLES'; prompt: string }
  | { type: 'APPLY_STYLES'; css: string }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'TOGGLE_STYLES'; enabled: boolean }
  | { type: 'CLEAR_STYLES' }
  | { type: 'GET_CURRENT_DOMAIN' }
  | { type: 'STYLES_UPDATED'; css: string; enabled: boolean };

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Storage schema
export interface StorageSchema {
  apiKey: string | null;
  siteStyles: Record<string, SiteStyles>;
  chatHistory: Record<string, ChatMessage[]>;
}
