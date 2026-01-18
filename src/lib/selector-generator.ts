/**
 * CSS Selector Generator
 * Generates unique, stable CSS selectors for DOM elements
 */

/**
 * Generate a unique CSS selector for an element
 * Priority: ID > unique attribute > unique class combo > nth-child chain
 */
export function generateSelector(element: Element): string {
  // Don't select html or body
  if (element.tagName === 'HTML' || element.tagName === 'BODY') {
    return element.tagName.toLowerCase();
  }

  // Try ID first (most specific)
  if (element.id && isUniqueSelector(`#${CSS.escape(element.id)}`)) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try unique class combination
  const classSelector = getUniqueClassSelector(element);
  if (classSelector) {
    return classSelector;
  }

  // Try tag + classes
  const tagClassSelector = getTagClassSelector(element);
  if (tagClassSelector && isUniqueSelector(tagClassSelector)) {
    return tagClassSelector;
  }

  // Try with data attributes
  const attrSelector = getAttributeSelector(element);
  if (attrSelector && isUniqueSelector(attrSelector)) {
    return attrSelector;
  }

  // Fallback: build path with nth-child
  return buildNthChildPath(element);
}

/**
 * Check if a selector matches exactly one element
 */
function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Try to find a unique class or combination of classes
 */
function getUniqueClassSelector(element: Element): string | null {
  const classes = Array.from(element.classList);
  if (classes.length === 0) return null;

  // Try single classes first
  for (const cls of classes) {
    // Skip likely generated/utility classes
    if (isLikelyGeneratedClass(cls)) continue;

    const selector = `.${CSS.escape(cls)}`;
    if (isUniqueSelector(selector)) {
      return selector;
    }
  }

  // Try combinations of 2 classes
  if (classes.length >= 2) {
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        if (isLikelyGeneratedClass(classes[i]) || isLikelyGeneratedClass(classes[j])) continue;

        const selector = `.${CSS.escape(classes[i])}.${CSS.escape(classes[j])}`;
        if (isUniqueSelector(selector)) {
          return selector;
        }
      }
    }
  }

  return null;
}

/**
 * Check if a class name looks auto-generated (hashed, etc.)
 */
function isLikelyGeneratedClass(className: string): boolean {
  // Hashed classes (e.g., "css-1a2b3c", "sc-bdVaJa")
  if (/^[a-z]{2,4}-[a-z0-9]{5,}$/i.test(className)) return true;
  // Tailwind-style atomic classes are fine, but very long hashes aren't
  if (/^[a-zA-Z0-9_-]{20,}$/.test(className)) return true;
  // Starts with underscore and has hash
  if (/^_[a-z0-9]{6,}$/i.test(className)) return true;
  return false;
}

/**
 * Get tag + class selector
 */
function getTagClassSelector(element: Element): string | null {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList)
    .filter(c => !isLikelyGeneratedClass(c))
    .slice(0, 2);  // Max 2 classes

  if (classes.length === 0) return null;

  return `${tag}.${classes.map(c => CSS.escape(c)).join('.')}`;
}

/**
 * Try to use data attributes or other unique attributes
 */
function getAttributeSelector(element: Element): string | null {
  const tag = element.tagName.toLowerCase();

  // Priority attributes to check
  const attrPriority = ['data-testid', 'data-id', 'name', 'aria-label', 'title', 'href', 'src'];

  for (const attr of attrPriority) {
    const value = element.getAttribute(attr);
    if (value && value.length < 50) {  // Skip very long values
      const selector = `${tag}[${attr}="${CSS.escape(value)}"]`;
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }
  }

  return null;
}

/**
 * Build a selector path using nth-child
 */
function buildNthChildPath(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const parent = current.parentElement;
    if (!parent) break;

    // Try to use a simple selector for this level
    let segmentSelector = getSimpleSelector(current);

    // If not unique among siblings, add nth-child
    if (!segmentSelector) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      const tag = current.tagName.toLowerCase();
      segmentSelector = `${tag}:nth-child(${index})`;
    }

    path.unshift(segmentSelector);

    // Check if current path is unique
    const fullSelector = path.join(' > ');
    if (isUniqueSelector(fullSelector)) {
      return fullSelector;
    }

    current = parent;
  }

  return path.join(' > ');
}

/**
 * Get a simple selector for an element (without nth-child)
 */
function getSimpleSelector(element: Element): string | null {
  const tag = element.tagName.toLowerCase();

  // Try ID
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try tag + first meaningful class
  const meaningfulClass = Array.from(element.classList)
    .find(c => !isLikelyGeneratedClass(c));

  if (meaningfulClass) {
    const selector = `${tag}.${CSS.escape(meaningfulClass)}`;
    const parent = element.parentElement;
    if (parent) {
      // Check if unique among siblings
      const matches = parent.querySelectorAll(`:scope > ${selector}`);
      if (matches.length === 1) {
        return selector;
      }
    }
  }

  return null;
}

/**
 * Generate breadcrumb path from body to element
 */
export function generateBreadcrumb(element: Element): string[] {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    let segment = tag;

    if (current.id) {
      segment = `${tag}#${current.id}`;
    } else {
      const mainClass = Array.from(current.classList)
        .find(c => !isLikelyGeneratedClass(c));
      if (mainClass) {
        segment = `${tag}.${mainClass}`;
      }
    }

    path.unshift(segment);
    current = current.parentElement;
  }

  return path;
}
