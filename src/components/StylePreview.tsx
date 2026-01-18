import { useState } from 'react';
import { toggleSiteStyles, clearSiteStyles } from '../lib/messaging';
import type { SiteStyles } from '../types';

interface StylePreviewProps {
  styles: SiteStyles;
  tabId: number;
  onStylesChange: () => void;
}

export default function StylePreview({ styles, tabId, onStylesChange }: StylePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const cssLineCount = styles.css.split('\n').length;

  return (
    <div className="border-b border-gray-800 p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Custom Styles</span>
          <span className="text-xs text-gray-500">({cssLineCount} lines)</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              styles.enabled ? 'bg-purple-600' : 'bg-gray-700'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={styles.enabled ? 'Disable styles' : 'Enable styles'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                styles.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          {/* Clear button */}
          <button
            onClick={handleClear}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all styles"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3">
          <pre className="p-3 bg-gray-900 rounded-lg text-xs overflow-x-auto text-gray-300 font-mono max-h-48 overflow-y-auto">
            {styles.css}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(styles.updatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
