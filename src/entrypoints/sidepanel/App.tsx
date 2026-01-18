import { useState, useEffect } from 'react';
import { getApiKey } from '../../lib/storage';
import { getCurrentTab, getSiteInfo } from '../../lib/messaging';
import ApiKeyInput from '../../components/ApiKeyInput';
import ChatInterface from '../../components/ChatInterface';
import StylePreview from '../../components/StylePreview';
import type { SiteStyles } from '../../types';

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
  const [domain, setDomain] = useState<string>('');
  const [siteStyles, setSiteStyles] = useState<SiteStyles | null>(null);

  // Load API key and current tab info on mount
  useEffect(() => {
    async function init() {
      try {
        const [key, tabResponse] = await Promise.all([
          getApiKey(),
          getCurrentTab()
        ]);

        setApiKey(key);

        if (tabResponse.success && tabResponse.data) {
          setCurrentTab(tabResponse.data);

          // Get site info
          if (tabResponse.data.id) {
            const siteResponse = await getSiteInfo(tabResponse.data.id);
            if (siteResponse.success && siteResponse.data) {
              setDomain(siteResponse.data.domain);
              setSiteStyles(siteResponse.data.styles);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Refresh site info when styles change
  const refreshSiteInfo = async () => {
    if (currentTab?.id) {
      const siteResponse = await getSiteInfo(currentTab.id);
      if (siteResponse.success && siteResponse.data) {
        setSiteStyles(siteResponse.data.styles);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show API key input if not configured
  if (!apiKey) {
    return (
      <ApiKeyInput
        onApiKeySet={(key) => setApiKey(key)}
      />
    );
  }

  // Check if we're on a valid page
  if (!currentTab?.url || currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h2 className="text-lg font-semibold mb-2">Cannot customize this page</h2>
        <p className="text-gray-400 text-sm">
          Navigate to a website to start customizing its UI.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎨</span>
          <span className="font-semibold">Rasa</span>
        </div>
        <div className="text-xs text-gray-400 truncate max-w-[150px]" title={domain}>
          {domain}
        </div>
      </header>

      {/* Style Preview */}
      {siteStyles && (
        <StylePreview
          styles={siteStyles}
          tabId={currentTab.id!}
          onStylesChange={refreshSiteInfo}
        />
      )}

      {/* Chat Interface */}
      <ChatInterface
        tabId={currentTab.id!}
        domain={domain}
        onStylesApplied={refreshSiteInfo}
      />
    </div>
  );
}
