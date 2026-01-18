import type { PageContext, AIResponse, ChatMessage } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-5-20251101';

const SYSTEM_PROMPT = `You are a CSS expert assistant helping users customize webpage appearances. You have memory of the conversation history, so you can reference previous requests and build upon earlier changes.

Given page context, conversation history, and the user's latest request, generate CSS that achieves their goal.

Rules:
1. Use specific selectors to avoid breaking the page (prefer class/ID selectors)
2. Use !important sparingly, only when necessary to override existing styles
3. Prefer class selectors over generic tag selectors when possible
4. Consider dark mode compatibility
5. Keep CSS concise and focused on the user's request
6. Return valid CSS only - no explanatory comments in the CSS itself
7. When the user references previous changes (e.g., "make it darker", "undo that"), refer to the conversation history
8. Generate ONLY the new/modified CSS rules, not the entire stylesheet

You MUST respond with valid JSON in exactly this format:
{
  "css": "/* your NEW CSS rules here */",
  "selectors": ["list", "of", "modified", "selectors"],
  "explanation": "Brief description of what changes were made"
}

Do not include any text outside the JSON object.`;

/**
 * Build the initial context message with page info
 */
function buildContextMessage(pageContext: PageContext, existingStyles?: string): string {
  let context = `Page URL: ${pageContext.url}
Page Title: ${pageContext.title}

Key Page Elements:
`;

  // Add element information
  for (const el of pageContext.elements.slice(0, 50)) {
    let line = `<${el.tag}`;
    if (el.id) line += ` id="${el.id}"`;
    if (el.classes.length > 0) line += ` class="${el.classes.slice(0, 3).join(' ')}"`;
    if (el.role) line += ` role="${el.role}"`;
    line += '>';
    if (el.text) line += ` "${el.text}"`;
    context += line + '\n';
  }

  if (existingStyles) {
    context += `\nCurrently applied custom styles:\n\`\`\`css\n${existingStyles}\n\`\`\``;
  }

  return context;
}

/**
 * Convert chat history to API message format
 */
function buildMessages(
  userPrompt: string,
  pageContext: PageContext,
  conversationHistory: ChatMessage[],
  existingStyles?: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // First message: page context
  const contextMessage = buildContextMessage(pageContext, existingStyles);

  // If there's conversation history, include it
  if (conversationHistory.length > 0) {
    // Add context as the first user message
    messages.push({
      role: 'user',
      content: `${contextMessage}\n\nUser Request: ${conversationHistory[0].content}`
    });

    // Add the rest of the conversation history (skip the first user message as we combined it)
    for (let i = 1; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (msg.role === 'assistant') {
        // For assistant messages, include the JSON response they gave
        if (msg.styles) {
          messages.push({
            role: 'assistant',
            content: JSON.stringify({
              css: msg.styles.css,
              selectors: msg.styles.selectors,
              explanation: msg.content
            })
          });
        } else {
          messages.push({
            role: 'assistant',
            content: msg.content
          });
        }
      } else {
        messages.push({
          role: 'user',
          content: msg.content
        });
      }
    }

    // Add the new user prompt
    messages.push({
      role: 'user',
      content: userPrompt
    });
  } else {
    // No history - just send context + request
    messages.push({
      role: 'user',
      content: `${contextMessage}\n\nUser Request: ${userPrompt}`
    });
  }

  return messages;
}

/**
 * Parse the AI response JSON
 */
function parseAIResponse(content: string): AIResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.css !== 'string') {
      throw new Error('Missing or invalid "css" field');
    }

    return {
      css: parsed.css,
      selectors: Array.isArray(parsed.selectors) ? parsed.selectors : [],
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : 'Styles applied'
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in AI response');
    }
    throw error;
  }
}

/**
 * Generate CSS styles using Claude API with conversation history
 */
export async function generateStyles(
  apiKey: string,
  userPrompt: string,
  pageContext: PageContext,
  conversationHistory: ChatMessage[] = [],
  existingStyles?: string
): Promise<AIResponse> {
  const messages = buildMessages(userPrompt, pageContext, conversationHistory, existingStyles);

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
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages
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
    if (response.status === 400) {
      throw new Error(`Bad request: ${errorMessage}`);
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Extract text content from the response
  const textContent = data.content?.find((block: { type: string }) => block.type === 'text');
  if (!textContent?.text) {
    throw new Error('No text content in AI response');
  }

  return parseAIResponse(textContent.text);
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
