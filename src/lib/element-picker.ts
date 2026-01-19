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
 * Extract all meaningful computed styles from an element
 */
function extractAllComputedStyles(element: Element): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  // List of CSS properties we care about (skip internal/rarely-used ones)
  const relevantProperties = [
    // Box model
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'box-sizing',
    // Position & layout
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
    'float', 'clear',
    // Flexbox
    'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'justify-content', 'align-items', 'align-self', 'align-content', 'gap', 'row-gap', 'column-gap',
    'order',
    // Grid
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'grid-area', 'grid-auto-flow', 'grid-gap',
    // Typography
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
    'text-transform', 'text-indent', 'text-overflow', 'white-space', 'word-break', 'word-wrap',
    'vertical-align',
    // Colors & backgrounds
    'color', 'background', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'background-attachment',
    // Borders
    'border', 'border-width', 'border-style', 'border-color',
    'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-radius', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    // Outline
    'outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset',
    // Effects
    'opacity', 'visibility', 'overflow', 'overflow-x', 'overflow-y',
    'box-shadow', 'text-shadow',
    // Transforms
    'transform', 'transform-origin',
    // Transitions & animations
    'transition', 'animation',
    // Other
    'cursor', 'pointer-events', 'user-select', 'object-fit', 'object-position',
    'list-style', 'list-style-type', 'list-style-position',
    'table-layout', 'border-collapse', 'border-spacing',
    'content', 'quotes',
    // Filters & blend modes
    'filter', 'backdrop-filter', 'mix-blend-mode',
    // Clipping
    'clip-path', 'mask',
  ];

  for (const prop of relevantProperties) {
    const value = computed.getPropertyValue(prop);
    // Only include non-empty, non-default-looking values
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto' &&
        value !== '0px' && value !== '0s' && value !== 'rgba(0, 0, 0, 0)' &&
        value !== 'rgb(0, 0, 0)' && value !== 'start' && value !== 'baseline') {
      styles[prop] = value;
    }
  }

  return styles;
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

  // Get direct children (max 10, but only first 5 get full styles)
  const children: ElementSummary[] = [];
  for (let i = 0; i < Math.min(element.children.length, 10); i++) {
    const includeStyles = i < 5;  // First 5 children get full styles
    children.push(extractElementSummary(element.children[i], includeStyles));
  }

  // Get siblings (no styles for siblings to keep context smaller)
  const previousSiblings: ElementSummary[] = [];
  const nextSiblings: ElementSummary[] = [];

  let sibling = element.previousElementSibling;
  for (let i = 0; i < 2 && sibling; i++) {
    previousSiblings.unshift(extractElementSummary(sibling, false));
    sibling = sibling.previousElementSibling;
  }

  sibling = element.nextElementSibling;
  for (let i = 0; i < 2 && sibling; i++) {
    nextSiblings.push(extractElementSummary(sibling, false));
    sibling = sibling.nextElementSibling;
  }

  // Get ALL computed styles for the main element
  const computedStyles = extractAllComputedStyles(element);

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
function extractElementSummary(element: Element, includeStyles: boolean = false): ElementSummary {
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

  const summary: ElementSummary = {
    tag,
    id: element.id || undefined,
    classes: Array.from(element.classList).slice(0, 5),  // Max 5 classes
    text,
    childCount: element.children.length,
  };

  // Include full computed styles if requested
  if (includeStyles) {
    summary.computedStyles = extractAllComputedStyles(element);
  }

  return summary;
}
