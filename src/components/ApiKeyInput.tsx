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
    <div className="onboarding">
      <div className="onboarding__content">
        {/* Animated Logo */}
        <div className="onboarding__logo">
          <div className="logo-mark logo-mark--large">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7"
            >
              <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Title with serif font */}
        <h1 className="animate-fadeInUp onboarding__title stagger-1">
          Welcome to Rasa
        </h1>

        <p className="animate-fadeInUp onboarding__subtitle stagger-2">
          Transform any website's interface with natural language.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="animate-fadeInUp onboarding__form stagger-3">
          <label className="onboarding__label">
            Claude API Key
          </label>

          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="mb-3 input"
            disabled={loading}
            autoFocus
          />

          {error && (
            <div className="onboarding__error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 btn btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="thinking-indicator">
                  <span className="thinking-dot" style={{ width: 4, height: 4 }}></span>
                  <span className="thinking-dot" style={{ width: 4, height: 4 }}></span>
                  <span className="thinking-dot" style={{ width: 4, height: 4 }}></span>
                </span>
                Validating
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <p className="animate-fadeInUp onboarding__hint stagger-4">
          Your API key is stored locally and never sent anywhere except Anthropic's API.
        </p>
      </div>

      <div className="animate-fadeInUp onboarding__footer stagger-5">
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="onboarding__link"
        >
          Get an API key from Anthropic
        </a>
      </div>
    </div>
  );
}
