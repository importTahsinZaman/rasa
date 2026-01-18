// Individual CSS rule with metadata
export interface StyleRule {
  id: string;
  selector: string;
  css: string;  // Full CSS block including selector and braces
  description?: string;
  createdBy: 'ai' | 'user';
  createdAt: number;
  updatedBy?: 'ai' | 'user';
  updatedAt: number;
}

// Site styles stored per domain (rule-based)
export interface SiteStyles {
  domain: string;
  rules: StyleRule[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// Legacy format for migration
export interface LegacySiteStyles {
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

// AI response structure (updated for tool-based approach)
export interface AIResponse {
  explanation: string;
  operations: StyleOperation[];
}

// Operations the AI can perform
export type StyleOperation =
  | { op: 'add'; selector: string; css: string; description?: string }
  | { op: 'edit'; ruleId: string; css: string; description?: string }
  | { op: 'delete'; ruleId: string };

// Tool definitions for Claude
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool call from Claude
export interface ToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Tool result to send back
export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

// Rule summary for list_rules tool (id IS the normalized selector)
export interface RuleSummary {
  id: string;  // The normalized selector, e.g., "header", ".nav-link, .nav-item"
  description?: string;
  createdBy: 'ai' | 'user';
  updatedBy?: 'ai' | 'user';
}

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  operations?: StyleOperation[];  // Operations performed (for assistant messages)
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
