/**
 * Converts HTML DOM to a compact shorthand format for AI consumption.
 *
 * Format:
 * - Elements: tagname#id.class1.class2@attr=value
 * - Text content: > text (inline) or | text (block)
 * - Comments: // comment
 * - Indentation shows nesting
 */

// Self-closing tags that don't need explicit closing
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Elements to skip entirely
const SKIP_ELEMENTS = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'path'
]);

// Attributes to skip (noise for styling purposes)
const SKIP_ATTRIBUTES = new Set([
  'data-reactid', 'data-reactroot', 'data-react-checksum',
  'data-v-', 'data-testid', 'data-test', 'data-cy',
  'aria-describedby', 'aria-labelledby', 'aria-owns', 'aria-controls',
  'tabindex', 'draggable', 'contenteditable'
]);

// Max length for inline text
const MAX_INLINE_TEXT = 60;

// Max length for inline attribute values
const MAX_INLINE_ATTR = 60;

interface ShorthandOptions {
  maxDepth?: number;
  skipHidden?: boolean;
  includeComments?: boolean;
}

/**
 * Convert a DOM element to shorthand notation
 */
export function htmlToShorthand(
  root: Element | Document,
  options: ShorthandOptions = {}
): string {
  const {
    maxDepth = 50,
    skipHidden = true,
    includeComments = false
  } = options;

  const lines: string[] = [];

  function shouldSkipAttribute(name: string): boolean {
    if (SKIP_ATTRIBUTES.has(name)) return true;
    // Skip data-* attributes that look like framework noise
    if (name.startsWith('data-v-')) return true;
    if (name.startsWith('data-react')) return true;
    if (name.startsWith('ng-')) return true;
    return false;
  }

  function isHidden(el: Element): boolean {
    if (!skipHidden) return false;
    try {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden';
    } catch {
      return false;
    }
  }

  function processNode(node: Node, depth: number): void {
    if (depth > maxDepth) return;

    const indent = '  '.repeat(depth);

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      // Skip certain elements
      if (SKIP_ELEMENTS.has(tag)) return;
      if (el.id === 'rasa-styles' || el.id === 'rasa-root') return;
      if (el.getAttribute('data-rasa') === 'true') return;
      if (isHidden(el)) return;

      // Build the element line
      let line = `${indent}${tag}`;

      // Add id with #
      if (el.id) {
        line += `#${el.id}`;
      }

      // Add classes with .
      if (el.classList.length > 0) {
        const classes = Array.from(el.classList)
          .filter(c => !c.startsWith('__') && c.length < 50)
          .slice(0, 5); // Limit to 5 classes
        line += classes.map(c => `.${c}`).join('');
      }

      // Add important attributes
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        const name = attr.name.toLowerCase();
        const value = attr.value;

        // Skip id/class (already handled) and noise attributes
        if (name === 'id' || name === 'class') continue;
        if (shouldSkipAttribute(name)) continue;

        // Keep important attributes
        const importantAttrs = ['href', 'src', 'alt', 'title', 'type', 'name', 'placeholder', 'value', 'role', 'aria-label'];
        if (!importantAttrs.includes(name) && !name.startsWith('aria-')) continue;

        if (value === '') {
          // Boolean attribute
          line += `@${name}`;
        } else if (value.length < MAX_INLINE_ATTR && !value.includes('\n')) {
          // Short attribute
          if (value.includes(' ') || value.includes('"') || value.includes('@')) {
            line += `@${name}="${value.replace(/"/g, '\\"')}"`;
          } else {
            line += `@${name}=${value}`;
          }
        }
        // Skip very long attributes
      }

      lines.push(line);

      // Process children
      if (!VOID_ELEMENTS.has(tag)) {
        const children = el.childNodes;
        let textContent = '';

        for (let i = 0; i < children.length; i++) {
          const child = children[i];

          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim() || '';
            if (text) {
              textContent += (textContent ? ' ' : '') + text;
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            // Flush accumulated text first
            if (textContent) {
              addText(textContent, depth + 1);
              textContent = '';
            }
            processNode(child, depth + 1);
          } else if (child.nodeType === Node.COMMENT_NODE && includeComments) {
            const comment = child.textContent?.trim() || '';
            if (comment && comment.length < 80) {
              lines.push(`${indent}  // ${comment}`);
            }
          }
        }

        // Handle remaining text
        if (textContent) {
          // Try to append inline if short and element has no child elements
          if (textContent.length < MAX_INLINE_TEXT && el.children.length === 0) {
            // Append to the element line
            const lastIdx = lines.length - 1;
            if (lines[lastIdx] === line) {
              lines[lastIdx] = `${line} > ${textContent}`;
            } else {
              addText(textContent, depth + 1);
            }
          } else {
            addText(textContent, depth + 1);
          }
        }
      }
    }
  }

  function addText(text: string, depth: number): void {
    const indent = '  '.repeat(depth);
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (!cleaned) return;

    if (cleaned.length < MAX_INLINE_TEXT) {
      lines.push(`${indent}| ${cleaned}`);
    } else {
      // Multi-line text block
      lines.push(`${indent}|"`);
      // Split into chunks
      const words = cleaned.split(' ');
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).length > 70) {
          if (currentLine) lines.push(`${indent}  ${currentLine}`);
          currentLine = word;
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      if (currentLine) lines.push(`${indent}  ${currentLine}`);
      lines.push(`${indent}"|`);
    }
  }

  // Start processing from root
  if (root instanceof Document) {
    const body = root.body;
    if (body) {
      for (const child of Array.from(body.childNodes)) {
        processNode(child, 0);
      }
    }
  } else {
    for (const child of Array.from(root.childNodes)) {
      processNode(child, 0);
    }
  }

  return lines.join('\n');
}

/**
 * Convert HTML string to shorthand (for use with innerHTML)
 */
export function htmlStringToShorthand(html: string, options?: ShorthandOptions): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return htmlToShorthand(doc, options);
}
