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

  const refreshSiteInfo = async () => {
    if (currentTab?.id) {
      const siteResponse = await getSiteInfo(currentTab.id);
      if (siteResponse.success && siteResponse.data) {
        setSiteStyles(siteResponse.data.styles);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-base">
        <div className="thinking-indicator">
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
        </div>
      </div>
    );
  }

  // Onboarding - API key required
  if (!apiKey) {
    return <ApiKeyInput onApiKeySet={(key) => setApiKey(key)} />;
  }

  // Invalid page state
  if (!currentTab?.url || currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
    return (
      <div className="flex flex-col h-full bg-base">
        <div className="empty-state flex-1">
          <div className="empty-state__icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7"
            >
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="empty-state__title">Cannot customize this page</h2>
          <p className="empty-state__description">
            Navigate to a website to start customizing its interface.
          </p>
        </div>
      </div>
    );
  }

  // Main app view
  return (
    <div className="flex flex-col h-full bg-base">
      {/* Style Preview Panel */}
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
