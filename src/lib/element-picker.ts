/**
 * Element Picker Module
 * Allows users to click on elements to select them for styling
 */

import { generateSelector, generateBreadcrumb } from './selector-generator';
import type { PickedElementContext, ElementSummary } from '../types';

// Picker state
let isActive = false;
let overlay: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let currentTarget: Element | null = null;
let onPickCallback: ((context: PickedElementContext) => void) | null = null;
let onCancelCallback: (() => void) | null = null;

// Styles for the overlay
const OVERLAY_STYLES = `
  position: fixed;
  pointer-events: none;
  background: rgba(122, 148, 88, 0.25);
  border: 2px solid rgba(122, 148, 88, 0.8);
  border-radius: 4px;
  z-index: 2147483647;
  transition: all 100ms ease-out;
  box-shadow: 0 0 0 4px rgba(122, 148, 88, 0.1);
`;

const TOOLTIP_STYLES = `
  position: fixed;
  pointer-events: none;
  background: rgba(15, 15, 18, 0.95);
  color: #f0f0f4;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 6px;
  z-index: 2147483647;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
`;

const INSTRUCTIONS_STYLES = `
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 15, 18, 0.95);
  color: #f0f0f4;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  padding: 10px 20px;
  border-radius: 8px;
  z-index: 2147483647;
  border: 1px solid rgba(122, 148, 88, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  gap: 12px;
`;

let instructionsEl: HTMLDivElement | null = null;

/**
 * Start the element picker mode
 */
export function startPicker(
  onPick: (context: PickedElementContext) => void,
  onCancel: () => void
): void {
  if (isActive) {
    console.log('[Rasa Picker] Already active');
    return;
  }

  console.log('[Rasa Picker] Starting picker mode');
  isActive = true;
  onPickCallback = onPick;
  onCancelCallback = onCancel;

  // Create overlay element
  overlay = document.createElement('div');
  overlay.id = 'rasa-picker-overlay';
  overlay.style.cssText = OVERLAY_STYLES;
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  // Create tooltip element
  tooltip = document.createElement('div');
  tooltip.id = 'rasa-picker-tooltip';
  tooltip.style.cssText = TOOLTIP_STYLES;
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  // Create instructions
  instructionsEl = document.createElement('div');
  instructionsEl.id = 'rasa-picker-instructions';
  instructionsEl.style.cssText = INSTRUCTIONS_STYLES;
  instructionsEl.innerHTML = `
    <span style="color: #9fb87a;">●</span>
    <span>Click elements to select them</span>
    <span style="color: #5c5c6a;">|</span>
    <span style="color: #8b8b9a;">ESC to finish</span>
  `;
  document.body.appendChild(instructionsEl);

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Change cursor
  document.body.style.cursor = 'crosshair';
}

/**
 * Stop the element picker mode
 */
export function stopPicker(): void {
  if (!isActive) return;

  isActive = false;
  currentTarget = null;
  onPickCallback = null;
  onCancelCallback = null;

  // Remove overlay
  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  // Remove tooltip
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }

  // Remove instructions
  if (instructionsEl) {
    instructionsEl.remove();
    instructionsEl = null;
  }

  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  // Reset cursor
  document.body.style.cursor = '';
}

/**
 * Check if picker is currently active
 */
export function isPickerActive(): boolean {
  return isActive;
}

/**
 * Handle mouse movement - update overlay position
 */
function handleMouseMove(event: MouseEvent): void {
  if (!isActive || !overlay || !tooltip) return;

  try {
    // Get element under cursor (excluding our overlay elements)
    const target = getElementAtPoint(event.clientX, event.clientY);

    if (!target || target === document.body || target === document.documentElement) {
      overlay.style.display = 'none';
      tooltip.style.display = 'none';
      currentTarget = null;
      return;
    }

    currentTarget = target;

    // Update overlay position
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // Update tooltip
    const selector = generateSelector(target);
    tooltip.textContent = selector;
    tooltip.style.display = 'block';

    // Position tooltip below the element (or above if not enough space)
    const tooltipTop = rect.bottom + 8;
    const tooltipLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 400));

    if (tooltipTop + 30 > window.innerHeight) {
      tooltip.style.top = `${rect.top - 30}px`;
    } else {
      tooltip.style.top = `${tooltipTop}px`;
    }
    tooltip.style.left = `${tooltipLeft}px`;
  } catch (error) {
    console.error('[Rasa Picker] mousemove error:', error);
  }
}

/**
 * Get element at point, excluding picker UI elements
 */
function getElementAtPoint(x: number, y: number): Element | null {
  // Temporarily hide our elements
  const elements = [overlay, tooltip, instructionsEl].filter(Boolean) as HTMLElement[];
  elements.forEach(el => el.style.display = 'none');

  const target = document.elementFromPoint(x, y);

  // Restore visibility
  if (overlay && currentTarget) overlay.style.display = 'block';
  if (tooltip && currentTarget) tooltip.style.display = 'block';
  if (instructionsEl) instructionsEl.style.display = 'block';

  return target;
}

/**
 * Handle click - select the element
 */
function handleClick(event: MouseEvent): void {
  if (!isActive) return;

  // Prevent the click from doing anything else
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  // If no target yet, try to get one at click position
  if (!currentTarget) {
    currentTarget = getElementAtPoint(event.clientX, event.clientY);
  }

  if (!currentTarget || currentTarget === document.body || currentTarget === document.documentElement) {
    console.log('[Rasa Picker] No valid element at click position');
    return;
  }

  try {
    // Extract context for the picked element
    const context = extractElementContext(currentTarget);

    // Flash the overlay to indicate selection
    if (overlay) {
      overlay.style.background = 'rgba(122, 148, 88, 0.5)';
      setTimeout(() => {
        if (overlay) {
          overlay.style.background = 'rgba(122, 148, 88, 0.25)';
        }
      }, 150);
    }

    // Call the callback (picker stays active for more selections)
    if (onPickCallback) {
      onPickCallback(context);
    }
  } catch (error) {
    console.error('[Rasa Picker] click error:', error);
  }
}

/**
 * Handle keydown - ESC to cancel
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!isActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    stopPicker();
    if (onCancelCallback) {
      onCancelCallback();
    }
  }
}

/**
 * Extract full context for a picked element
 */
function extractElementContext(element: Element): PickedElementContext {
  const tag = element.tagName.toLowerCase();

  // Get all attributes
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    // Skip very long attributes
    if (attr.value.length < 200) {
      attributes[attr.name] = attr.value;
    }
  }

  // Get text content (truncated)
  let text: string | undefined;
  const textContent = element.textContent?.trim();
  if (textContent && textContent.length < 100) {
    text = textContent;
  }

  // Get direct children (max 10)
  const children: ElementSummary[] = [];
  for (let i = 0; i < Math.min(element.children.length, 10); i++) {
    children.push(extractElementSummary(element.children[i]));
  }

  // Get siblings
  const previousSiblings: ElementSummary[] = [];
  const nextSiblings: ElementSummary[] = [];

  let sibling = element.previousElementSibling;
  for (let i = 0; i < 2 && sibling; i++) {
    previousSiblings.unshift(extractElementSummary(sibling));
    sibling = sibling.previousElementSibling;
  }

  sibling = element.nextElementSibling;
  for (let i = 0; i < 2 && sibling; i++) {
    nextSiblings.push(extractElementSummary(sibling));
    sibling = sibling.nextElementSibling;
  }

  // Get computed styles
  const computed = window.getComputedStyle(element);
  const computedStyles = {
    width: computed.width,
    height: computed.height,
    padding: computed.padding,
    margin: computed.margin,
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily.split(',')[0].trim(),  // Just first font
    fontWeight: computed.fontWeight,
    display: computed.display,
    position: computed.position,
    border: computed.border,
    borderRadius: computed.borderRadius,
    // Text properties (for text replacement tasks)
    lineHeight: computed.lineHeight,
    letterSpacing: computed.letterSpacing,
    textTransform: computed.textTransform,
    textDecoration: computed.textDecoration,
    textAlign: computed.textAlign,
  };

  return {
    selector: generateSelector(element),
    breadcrumb: generateBreadcrumb(element),
    element: {
      tag,
      id: element.id || undefined,
      classes: Array.from(element.classList),
      attributes,
      text,
    },
    children,
    previousSiblings,
    nextSiblings,
    computedStyles,
  };
}

/**
 * Extract a summary of an element (for siblings/children)
 */
function extractElementSummary(element: Element): ElementSummary {
  const tag = element.tagName.toLowerCase();
  let text: string | undefined;

  // Get direct text content (not from descendants)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (directText && directText.length < 50) {
    text = directText;
  } else {
    // Fallback to textContent for elements like buttons
    const fullText = element.textContent?.trim();
    if (fullText && fullText.length < 50) {
      text = fullText;
    }
  }

  return {
    tag,
    id: element.id || undefined,
    classes: Array.from(element.classList).slice(0, 3),  // Max 3 classes
    text,
    childCount: element.children.length,
  };
}
