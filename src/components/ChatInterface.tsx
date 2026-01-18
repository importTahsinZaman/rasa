import { useState, useEffect, useRef, useCallback } from 'react';
import { generateStyles, startElementPicker, cancelElementPicker, formatPickedElementContext } from '../lib/messaging';
import { getChatHistory, saveChatHistory } from '../lib/storage';
import MessageBubble from './MessageBubble';
import type { ChatMessage, PickedElementContext } from '../types';

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
  const [pickedElements, setPickedElements] = useState<PickedElementContext[]>([]);
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

  // Listen for element picker messages
  useEffect(() => {
    const handleMessage = (message: { type: string; context?: PickedElementContext }) => {
      console.log('[Rasa Sidepanel] Received message:', message.type);
      if (message.type === 'ELEMENT_PICKED' && message.context) {
        console.log('[Rasa Sidepanel] Element picked:', message.context.selector);
        // Add to array if not already picked (by selector)
        setPickedElements(prev => {
          const exists = prev.some(el => el.selector === message.context!.selector);
          if (exists) return prev;
          return [...prev, message.context!];
        });
        // Picker stays active automatically now - no need to restart
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [tabId]);

  // Listen for ESC in sidepanel to close picker on page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelElementPicker(tabId).catch(() => {
          // Ignore errors - picker might not be active
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabId]);

  // Start the element picker
  const handleStartPicker = useCallback(async () => {
    try {
      await startElementPicker(tabId);
    } catch (error) {
      console.error('Failed to start picker:', error);
    }
  }, [tabId]);

  // Remove a specific picked element
  const handleRemoveElement = useCallback((selector: string) => {
    setPickedElements(prev => prev.filter(el => el.selector !== selector));
  }, []);

  // Clear all picked elements
  const handleClearAll = useCallback(() => {
    setPickedElements([]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    // Build the full prompt with picked element context if available
    let fullPrompt = trimmedInput;
    let displayContent = trimmedInput;

    if (pickedElements.length > 0) {
      const elementContexts = pickedElements.map(el => formatPickedElementContext(el)).join('\n\n---\n\n');
      const selectorList = pickedElements.map(el => el.selector).join(', ');
      fullPrompt = `[User selected ${pickedElements.length} element(s) on the page]\n\n${elementContexts}\n\nUser request: ${trimmedInput}`;
      displayContent = `[Selected: ${selectorList}]\n${trimmedInput}`;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setPickedElements([]);  // Clear picked elements after submit
    setLoading(true);

    try {
      const response = await generateStyles(fullPrompt, tabId, messages);

      if (response.success && response.data) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.explanation,
          timestamp: Date.now(),
          operations: response.data.operations
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
        {/* Picked Elements List */}
        {pickedElements.length > 0 && (
          <div className="picked-elements-list">
            <div className="picked-elements-header">
              <span className="text-caption">{pickedElements.length} element{pickedElements.length > 1 ? 's' : ''} selected</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="picked-elements-clear-all"
              >
                Clear all
              </button>
            </div>
            <div className="picked-elements-chips">
              {pickedElements.map((el) => (
                <div key={el.selector} className="picked-element-chip">
                  <span className="picked-element-chip__selector">{el.selector}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveElement(el.selector)}
                    className="picked-element-chip__remove"
                    aria-label={`Remove ${el.selector}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        <form onSubmit={handleSubmit}>
          <div className="chat-input-wrapper">
            {/* Element Picker Button */}
            <button
              type="button"
              onClick={handleStartPicker}
              disabled={loading}
              className="picker-btn"
              aria-label="Select element on page"
              title="Select an element on the page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8ZM14 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8ZM7.172 13.828a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM10 11a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 11ZM10 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" clipRule="evenodd" />
              </svg>
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pickedElements.length > 0 ? "What do you want to change?" : "Describe the changes you want..."}
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
