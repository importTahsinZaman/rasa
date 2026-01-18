import { injectStyles, removeStyles } from '../lib/css-injector';
import { extractPageContext } from '../lib/dom-extractor';
import { getSiteStyles, extractDomain } from '../lib/storage';
import type { ExtensionMessage, ExtensionResponse, PageContext } from '../types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',

  async main() {
    const domain = extractDomain(window.location.href);

    // Load and apply saved styles on page load
    await loadSavedStyles(domain);

    // Set up MutationObserver for SPA navigation
    setupNavigationObserver(domain);

    // Listen for messages from background/sidepanel
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      handleMessage(message, domain)
        .then(sendResponse)
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Indicates async response
    });
  }
});

/**
 * Load and apply saved styles for the current domain
 */
async function loadSavedStyles(domain: string): Promise<void> {
  try {
    const styles = await getSiteStyles(domain);
    if (styles && styles.enabled && styles.css) {
      injectStyles(styles.css);
    }
  } catch (error) {
    console.error('Failed to load saved styles:', error);
  }
}

/**
 * Handle messages from background script or sidepanel
 */
async function handleMessage(
  message: ExtensionMessage,
  domain: string
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'APPLY_STYLES': {
      try {
        injectStyles(message.css);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    case 'GET_PAGE_CONTEXT': {
      try {
        const context: PageContext = extractPageContext();
        return { success: true, data: context };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    case 'TOGGLE_STYLES': {
      try {
        if (message.enabled) {
          const styles = await getSiteStyles(domain);
          if (styles?.css) {
            injectStyles(styles.css);
          }
        } else {
          removeStyles();
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    case 'CLEAR_STYLES': {
      try {
        removeStyles();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    case 'GET_CURRENT_DOMAIN': {
      return { success: true, data: domain };
    }

    case 'STYLES_UPDATED': {
      try {
        if (message.enabled) {
          injectStyles(message.css);
        } else {
          removeStyles();
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Set up observer to handle SPA navigation
 */
function setupNavigationObserver(domain: string): void {
  let currentUrl = window.location.href;

  // Observe URL changes for SPA navigation
  const observer = new MutationObserver(async () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      const newDomain = extractDomain(currentUrl);

      // If domain changed, reload styles for new domain
      if (newDomain !== domain) {
        await loadSavedStyles(newDomain);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', async () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      const newDomain = extractDomain(currentUrl);
      if (newDomain !== domain) {
        await loadSavedStyles(newDomain);
      }
    }
  });
}
