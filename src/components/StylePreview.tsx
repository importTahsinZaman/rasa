import { useState, useMemo } from 'react';
import { toggleSiteStyles, clearSiteStyles } from '../lib/messaging';
import { compileRulesToCSS } from '../lib/storage';
import type { SiteStyles } from '../types';

interface StylePreviewProps {
  styles: SiteStyles;
  tabId: number;
  onStylesChange: () => void;
}

export default function StylePreview({ styles, tabId, onStylesChange }: StylePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Compile rules to CSS for display
  const compiledCSS = useMemo(() => compileRulesToCSS(styles), [styles]);
  const ruleCount = styles.rules.length;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await toggleSiteStyles(tabId, !styles.enabled);
      onStylesChange();
    } catch (error) {
      console.error('Failed to toggle styles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all custom styles for this site?')) {
      return;
    }

    setLoading(true);
    try {
      await clearSiteStyles(tabId);
      onStylesChange();
    } catch (error) {
      console.error('Failed to clear styles:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="style-panel">
      <div className="style-panel__header" onClick={() => setExpanded(!expanded)}>
        <button className="style-panel__toggle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-4 h-4 style-panel__chevron ${expanded ? 'style-panel__chevron--open' : ''}`}
          >
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
          <span className="style-panel__label">Custom Styles</span>
          <span className="style-panel__meta">{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
        </button>

        <div className="style-panel__actions" onClick={(e) => e.stopPropagation()}>
          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`toggle ${loading ? 'opacity-50' : ''}`}
            data-state={styles.enabled ? 'checked' : 'unchecked'}
            title={styles.enabled ? 'Disable styles' : 'Enable styles'}
          />

          {/* Clear */}
          <button
            onClick={handleClear}
            disabled={loading}
            className="btn-icon btn-icon--danger"
            title="Clear all styles"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="style-panel__content">
          <pre className="message-code max-h-48 overflow-y-auto">
            {compiledCSS || '/* No styles */'}
          </pre>
          <p className="text-caption mt-3">
            Updated {new Date(styles.updatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
