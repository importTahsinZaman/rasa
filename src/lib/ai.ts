import type { PageContext, AIResponse, ChatMessage, StyleOperation, ToolDefinition, RuleSummary, StyleRule } from '../types';
import {
  getSiteStyles,
  getRuleSummaries,
  addRule,
  editRule,
  deleteRule,
  getRules,
  generateRuleId
} from './storage';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ITERATIONS = 10;

// Tool definitions for Claude
const TOOLS: ToolDefinition[] = [
  {
    name: 'list_rules',
    description: 'Get a summary of all CSS rules currently saved for this site. Returns id, selector, description, and who created/modified each rule. Use this first to understand what styles exist.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_rules',
    description: 'Get the full CSS content for specific rules by their IDs. Use this when you need to see the actual CSS to modify it.',
    input_schema: {
      type: 'object',
      properties: {
        rule_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of rule IDs to read'
        }
      },
      required: ['rule_ids']
    }
  },
  {
    name: 'add_rule',
    description: 'Add a new CSS rule. The css should be a complete CSS block including the selector and braces.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'The CSS selector (e.g., "header", ".nav-link", "#main-content")'
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
    description: 'Modify an existing CSS rule by its ID. Use list_rules first to get the IDs.',
    input_schema: {
      type: 'object',
      properties: {
        rule_id: {
          type: 'string',
          description: 'The ID of the rule to edit'
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
      required: ['rule_id', 'css']
    }
  },
  {
    name: 'delete_rule',
    description: 'Delete a CSS rule by its ID. Use this to remove styles that are no longer needed.',
    input_schema: {
      type: 'object',
      properties: {
        rule_id: {
          type: 'string',
          description: 'The ID of the rule to delete'
        }
      },
      required: ['rule_id']
    }
  },
  {
    name: 'finish',
    description: 'Call this when you have completed the user\'s request. Provide a brief explanation of what was done.',
    input_schema: {
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
];

const SYSTEM_PROMPT = `You are a CSS expert assistant helping users customize webpage appearances. You have tools to read, add, edit, and delete CSS rules for the current site.

WORKFLOW:
1. First, call list_rules to see what CSS rules already exist
2. Based on the user's request, decide whether to add new rules, edit existing ones, or delete rules
3. If you need to see the actual CSS content of existing rules, use read_rules
4. Make your changes using add_rule, edit_rule, or delete_rule
5. When done, call finish with an explanation

RULES FOR WRITING CSS:
- Use specific selectors (prefer class/ID over generic tags)
- Use !important sparingly, only when necessary to override site styles
- Keep CSS concise and focused on the user's request
- Consider dark mode compatibility
- Each rule should be a complete CSS block with selector and braces

IMPORTANT:
- If the user asks to "undo" or "revert", delete the relevant rules
- If the user asks to modify existing styles, edit them rather than adding duplicates
- If the user's request is unclear, add new rules (they can always ask you to modify later)
- Always call finish when you're done to provide an explanation to the user`;

/**
 * Build the context message with page info
 */
function buildContextMessage(pageContext: PageContext): string {
  let context = `Page URL: ${pageContext.url}
Page Title: ${pageContext.title}

Key Page Elements:
`;

  for (const el of pageContext.elements.slice(0, 50)) {
    let line = `<${el.tag}`;
    if (el.id) line += ` id="${el.id}"`;
    if (el.classes.length > 0) line += ` class="${el.classes.slice(0, 3).join(' ')}"`;
    if (el.role) line += ` role="${el.role}"`;
    line += '>';
    if (el.text) line += ` "${el.text}"`;
    context += line + '\n';
  }

  return context;
}

/**
 * Build messages for the API call
 */
function buildMessages(
  userPrompt: string,
  pageContext: PageContext,
  conversationHistory: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const contextMessage = buildContextMessage(pageContext);

  if (conversationHistory.length > 0) {
    // Include conversation history
    messages.push({
      role: 'user',
      content: `${contextMessage}\n\nUser Request: ${conversationHistory[0].content}`
    });

    for (let i = 1; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt
    });
  } else {
    messages.push({
      role: 'user',
      content: `${contextMessage}\n\nUser Request: ${userPrompt}`
    });
  }

  return messages;
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
      const ruleIds = toolInput.rule_ids as string[];
      const rules = await getRules(domain, ruleIds);
      if (rules.length === 0) {
        return { result: 'No rules found with the specified IDs.' };
      }
      const ruleData = rules.map(r => ({
        id: r.id,
        selector: r.selector,
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
        selector,
        css,
        description
      });

      return {
        result: `Rule added successfully with ID: ${newRule.id}`
      };
    }

    case 'edit_rule': {
      const ruleId = toolInput.rule_id as string;
      const css = toolInput.css as string;
      const description = toolInput.description as string | undefined;

      const updatedRule = await editRule(domain, ruleId, {
        css,
        description,
        updatedBy: 'ai'
      });

      if (!updatedRule) {
        return { result: `Error: Rule with ID ${ruleId} not found.` };
      }

      operations.push({
        op: 'edit',
        ruleId,
        css,
        description
      });

      return { result: `Rule ${ruleId} updated successfully.` };
    }

    case 'delete_rule': {
      const ruleId = toolInput.rule_id as string;
      const success = await deleteRule(domain, ruleId);

      if (!success) {
        return { result: `Error: Rule with ID ${ruleId} not found.` };
      }

      operations.push({
        op: 'delete',
        ruleId
      });

      return { result: `Rule ${ruleId} deleted successfully.` };
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
 * Generate CSS styles using Claude API with tool use
 */
export async function generateStyles(
  apiKey: string,
  userPrompt: string,
  pageContext: PageContext,
  domain: string,
  conversationHistory: ChatMessage[] = []
): Promise<AIResponse> {
  const messages = buildMessages(userPrompt, pageContext, conversationHistory);
  const operations: StyleOperation[] = [];

  let currentMessages: Array<{ role: 'user' | 'assistant'; content: unknown }> = messages;
  let iteration = 0;
  let finalExplanation = 'Styles updated.';

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: currentMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Claude API key.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const stopReason = data.stop_reason;

    // Check if Claude wants to use tools
    if (stopReason === 'tool_use') {
      const toolUseBlocks = data.content.filter((block: { type: string }) => block.type === 'tool_use');
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      let finished = false;

      for (const toolUse of toolUseBlocks) {
        const { result, finished: isFinished, explanation } = await executeTool(
          toolUse.name,
          toolUse.input,
          domain,
          operations
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result
        });

        if (isFinished && explanation) {
          finished = true;
          finalExplanation = explanation;
        }
      }

      if (finished) {
        break;
      }

      // Add assistant's response and tool results to messages for next iteration
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults }
      ];
    } else {
      // Claude finished without calling finish tool - extract explanation from text
      const textBlock = data.content.find((block: { type: string }) => block.type === 'text');
      if (textBlock?.text) {
        finalExplanation = textBlock.text;
      }
      break;
    }
  }

  return {
    explanation: finalExplanation,
    operations
  };
}

/**
 * Validate an API key by making a minimal test request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "ok"'
          }
        ]
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}
