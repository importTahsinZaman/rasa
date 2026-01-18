import { useState, useEffect, useRef } from 'react';
import { generateStyles } from '../lib/messaging';
import { getChatHistory, saveChatHistory } from '../lib/storage';
import MessageBubble from './MessageBubble';
import type { ChatMessage } from '../types';

interface ChatInterfaceProps {
  tabId: number;
  domain: string;
  onStylesApplied: () => void;
}

const PROMPT_SUGGESTIONS = [
  'Make the background darker',
  'Increase the font size',
  'Hide the sidebar',
];

export default function ChatInterface({ tabId, domain, onStylesApplied }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadHistory() {
      const history = await getChatHistory(domain);
      setMessages(history);
    }
    loadHistory();
  }, [domain]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(domain, messages);
    }
  }, [messages, domain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await generateStyles(trimmedInput, tabId, messages);

      if (response.success && response.data) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.explanation,
          timestamp: Date.now(),
          styles: {
            css: response.data.css,
            selectors: response.data.selectors
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
        onStylesApplied();
      } else {
        const errorMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${response.error || 'Failed to generate styles'}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Message List */}
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <p className="text-body text-muted mb-6 text-center">
              Describe how you want to customize this page.
            </p>

            <div className="w-full space-y-2">
              <p className="text-caption text-center mb-3">Try</p>
              {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className={`prompt-suggestion animate-fadeInUp stagger-${index + 1}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {loading && (
          <div className="flex items-center gap-3 text-muted py-2">
            <div className="thinking-indicator">
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
            </div>
            <span className="text-small">Generating styles...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <form onSubmit={handleSubmit}>
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the changes you want..."
              className="input-chat flex-1 font-body"
              rows={1}
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="chat-send-btn"
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
