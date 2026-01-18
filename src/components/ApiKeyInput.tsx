import { useState } from 'react';
import { saveApiKey } from '../lib/storage';
import { validateApiKey } from '../lib/ai';

interface ApiKeyInputProps {
  onApiKeySet: (key: string) => void;
}

export default function ApiKeyInput({ onApiKeySet }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('Please enter an API key');
      return;
    }

    if (!trimmedKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Claude API keys start with "sk-ant-"');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await validateApiKey(trimmedKey);

      if (!isValid) {
        setError('Invalid API key. Please check and try again.');
        return;
      }

      await saveApiKey(trimmedKey);
      onApiKeySet(trimmedKey);
    } catch (err) {
      setError('Failed to validate API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-5xl mb-6">🎨</div>
        <h1 className="text-xl font-bold mb-2">Welcome to Rasa</h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          Customize any website's UI with natural language powered by Claude AI.
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <label className="block text-sm font-medium mb-2">
            Claude API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-3"
            disabled={loading}
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Validating...' : 'Save API Key'}
          </button>
        </form>

        <p className="text-gray-500 text-xs mt-6 text-center">
          Your API key is stored locally and never sent to any server except Anthropic's API.
        </p>
      </div>

      <div className="text-center text-xs text-gray-500">
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          Get an API key from Anthropic
        </a>
      </div>
    </div>
  );
}
