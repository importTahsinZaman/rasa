import type { PageContext, AIResponse, ChatMessage, StyleOperation } from '../types';
import {
  getSiteStyles,
  getRuleSummaries,
  addRule,
  editRule,
  deleteRule,
  getRules,
  selectorToId
} from './storage';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
const MAX_TOOL_ITERATIONS = 10;

// Tool definitions for Gemini (functionDeclarations format)
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'list_rules',
      description: 'Get a summary of all CSS rules currently saved for this site. Returns id (which is the normalized selector), description, and who created/modified each rule. Use this first to understand what styles exist.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'read_rules',
      description: 'Get the full CSS content for specific rules. Use this when you need to see the actual CSS to modify it.',
      parameters: {
        type: 'object',
        properties: {
          selectors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of selectors to read (e.g., ["header", ".nav-link"])'
          }
        },
        required: ['selectors']
      }
    },
    {
      name: 'add_rule',
      description: 'Add a new CSS rule. If a rule for this selector already exists, it will be updated instead. The css should be a complete CSS block including the selector and braces.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'The CSS selector (e.g., "header", ".nav-link", "#main-content"). This becomes the rule ID.'
          },
          css: {
            type: 'string',
            description: 'Complete CSS block including selector and braces (e.g., "header { background: blue; }")'
          },
          description: {
            type: 'string',
            description: 'Brief description of what this rule does'
          }
        },
        required: ['selector', 'css']
      }
    },
    {
      name: 'edit_rule',
      description: 'Modify an existing CSS rule by its selector. Use list_rules first to see existing selectors.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'The selector of the rule to edit (e.g., "header", ".nav-link")'
          },
          css: {
            type: 'string',
            description: 'The new complete CSS block including selector and braces'
          },
          description: {
            type: 'string',
            description: 'Updated description (optional)'
          }
        },
        required: ['selector', 'css']
      }
    },
    {
      name: 'delete_rule',
      description: 'Delete a CSS rule by its selector. Use this to remove styles that are no longer needed.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'The selector of the rule to delete (e.g., "header", ".nav-link")'
          }
        },
        required: ['selector']
      }
    },
    {
      name: 'finish',
      description: 'Call this when you have completed the user\'s request. Provide a brief explanation of what was done.',
      parameters: {
        type: 'object',
        properties: {
          explanation: {
            type: 'string',
            description: 'Brief explanation of what changes were made'
          }
        },
        required: ['explanation']
      }
    }
  ]
}];

const SYSTEM_PROMPT = `<role>
CSS expert that customizes webpage appearances using tools to manage CSS rules and answers questions about the page.
</role>

<html_shorthand_format>
The page HTML is provided in shorthand notation:
- tag#id.class1.class2@attr=value > inline text
- Indentation shows nesting depth
- | text = block text content
- Use the selectors directly (e.g., #id, .class, tag)
</html_shorthand_format>

<workflow>
1. Call list_rules to see existing rules
2. Add, edit, or delete rules based on request
3. Call finish with brief explanation
</workflow>

<tool_usage>
Before each tool call, state what you're doing and why.
</tool_usage>

<css_rules>
- Use class/ID selectors over generic tags
- Use !important only to override site styles
- Check CURRENT STYLES in context before writing CSS
- Use inherit to preserve typography (font-weight, color, font-family, line-height)
</css_rules>

<patterns>
TEXT REPLACEMENT: Set font-size: 0, use ::before/::after with content, inherit all typography except font-size.

HIDING: display: none (remove), visibility: hidden (keep space), opacity: 0 (interactive).

AMBIGUOUS REQUESTS:
- "get rid of [text]" → replace text, keep element
- "remove [element]" → hide entirely
- "undo/revert" → delete relevant rules
</patterns>`;

// Gemini message format types
interface GeminiPart {
  text?: string;
  thought?: boolean;  // True if this is thinking content
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: { result: string };
  };
  thoughtSignature?: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: GeminiPart[];
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
}

/**
 * Build the context message with page info
 */
function buildContextMessage(pageContext: PageContext): string {
  let context = `Page URL: ${pageContext.url}
Page Title: ${pageContext.title}

`;

  // Include CSS variables if present
  const cssVars = Object.entries(pageContext.cssVariables || {});
  if (cssVars.length > 0) {
    context += `=== CSS VARIABLES (from :root - override these to change site theme) ===\n`;
    for (const [name, value] of cssVars) {
      context += `${name}: ${value}\n`;
    }
    context += '\n';
  }

  // Include site stylesheets
  if (pageContext.stylesheets) {
    context += `=== SITE STYLESHEETS ===\n`;
    context += pageContext.stylesheets;
    context += '\n\n';
  }

  // Include page HTML in shorthand format
  if (pageContext.html) {
    context += `=== PAGE STRUCTURE (shorthand: tag#id.class@attr > text) ===\n`;
    context += pageContext.html;
    context += '\n';
  }

  return context;
}

/**
 * Build Gemini contents from conversation history
 */
function buildContents(
  userPrompt: string,
  pageContext: PageContext,
  conversationHistory: ChatMessage[]
): GeminiContent[] {
  const contents: GeminiContent[] = [];
  const contextMessage = buildContextMessage(pageContext);

  if (conversationHistory.length > 0) {
    // Include conversation history
    contents.push({
      role: 'user',
      parts: [{ text: `${contextMessage}\n\nUser Request: ${conversationHistory[0].content}` }]
    });

    for (let i = 1; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: `${contextMessage}\n\nUser Request: ${userPrompt}` }]
    });
  }

  return contents;
}

/**
 * Execute a tool call and return the result
 */
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  domain: string,
  operations: StyleOperation[]
): Promise<{ result: string; finished?: boolean; explanation?: string }> {
  switch (toolName) {
    case 'list_rules': {
      const styles = await getSiteStyles(domain);
      if (!styles || styles.rules.length === 0) {
        return { result: 'No CSS rules currently saved for this site.' };
      }
      const summaries = getRuleSummaries(styles);
      return {
        result: JSON.stringify(summaries, null, 2)
      };
    }

    case 'read_rules': {
      const selectors = (toolInput.selectors as string[]) || [];
      if (selectors.length === 0) {
        return { result: 'No selectors provided.' };
      }
      // Convert selectors to normalized IDs for lookup
      const ruleIds = selectors.map(s => selectorToId(s));
      const rules = await getRules(domain, ruleIds);
      if (rules.length === 0) {
        return { result: 'No rules found with the specified selectors.' };
      }
      const ruleData = rules.map(r => ({
        id: r.id,
        css: r.css,
        description: r.description
      }));
      return { result: JSON.stringify(ruleData, null, 2) };
    }

    case 'add_rule': {
      const selector = toolInput.selector as string;
      const css = toolInput.css as string;
      const description = toolInput.description as string | undefined;

      const newRule = await addRule(domain, {
        selector,
        css,
        description,
        createdBy: 'ai'
      });

      operations.push({
        op: 'add',
        selector: newRule.id, // Use normalized ID
        css,
        description
      });

      return {
        result: `Rule added/updated for selector: ${newRule.id}`
      };
    }

    case 'edit_rule': {
      const selector = toolInput.selector as string;
      const css = toolInput.css as string;
      const description = toolInput.description as string | undefined;
      const ruleId = selectorToId(selector);

      const updatedRule = await editRule(domain, ruleId, {
        css,
        description,
        updatedBy: 'ai'
      });

      if (!updatedRule) {
        return { result: `Error: No rule found for selector "${selector}".` };
      }

      operations.push({
        op: 'edit',
        ruleId,
        css,
        description
      });

      return { result: `Rule "${ruleId}" updated successfully.` };
    }

    case 'delete_rule': {
      const selector = toolInput.selector as string;
      const ruleId = selectorToId(selector);
      const success = await deleteRule(domain, ruleId);

      if (!success) {
        return { result: `Error: No rule found for selector "${selector}".` };
      }

      operations.push({
        op: 'delete',
        ruleId
      });

      return { result: `Rule "${ruleId}" deleted successfully.` };
    }

    case 'finish': {
      const explanation = toolInput.explanation as string;
      return {
        result: 'Completed.',
        finished: true,
        explanation
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}

/**
 * Generate CSS styles using Gemini API with function calling
 */
export async function generateStyles(
  apiKey: string,
  userPrompt: string,
  pageContext: PageContext,
  domain: string,
  conversationHistory: ChatMessage[] = []
): Promise<AIResponse> {
  const contents = buildContents(userPrompt, pageContext, conversationHistory);
  const operations: StyleOperation[] = [];

  let currentContents: GeminiContent[] = contents;
  let iteration = 0;
  let retryCount = 0;
  let finalExplanation = 'Styles updated.';
  const thinkingParts: string[] = [];

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const requestBody: Record<string, unknown> = {
      contents: currentContents,
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      tools: TOOLS
    };

    console.log('[Rasa AI] Request iteration', iteration, requestBody);

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Rasa AI] API Error:', response.status, JSON.stringify(errorData, null, 2));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your Google AI API key.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      // Retry once on 500 errors (transient Gemini issues)
      if (response.status === 500 && retryCount < 2) {
        retryCount++;
        console.log('[Rasa AI] Retrying after 500 error (attempt', retryCount, ')...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        iteration--; // Don't count this as an iteration
        continue;
      }

      throw new Error(errorMessage);
    }

    const data: GeminiResponse = await response.json();

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response candidates from Gemini');
    }

    const parts = candidate.content?.parts || [];

    // Extract thinking text from parts marked as thoughts
    for (const part of parts) {
      if (part.thought && part.text) {
        thinkingParts.push(part.text);
      }
    }

    // Check for function calls
    const functionCalls = parts.filter(p => p.functionCall);

    if (functionCalls.length > 0) {
      const functionResponses: GeminiPart[] = [];
      let finished = false;

      for (const part of functionCalls) {
        const functionCall = part.functionCall!;
        const { result, finished: isFinished, explanation } = await executeTool(
          functionCall.name,
          functionCall.args || {},
          domain,
          operations
        );

        functionResponses.push({
          functionResponse: {
            name: functionCall.name,
            response: { result }
          }
        });

        if (isFinished && explanation) {
          finished = true;
          finalExplanation = explanation;
        }
      }

      if (finished) {
        break;
      }

      // Add model's response and function results to contents for next iteration
      currentContents = [
        ...currentContents,
        {
          role: 'model',
          parts: parts
        },
        {
          role: 'user',
          parts: functionResponses
        }
      ];
    } else {
      // No function calls - extract text response
      const textPart = parts.find(p => p.text);
      if (textPart?.text) {
        finalExplanation = textPart.text;
      }
      break;
    }
  }

  return {
    explanation: finalExplanation,
    operations,
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n\n') : undefined
  };
}

/**
 * Validate an API key by making a minimal test request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: 'Say "ok"' }]
        }],
        generationConfig: {
          maxOutputTokens: 10
        }
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}
