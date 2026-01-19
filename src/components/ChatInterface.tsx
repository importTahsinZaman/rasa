import { useState, useEffect, useRef, useCallback } from 'react';
import { generateStyles, startElementPicker, cancelElementPicker, formatPickedElementContext, undoOperations } from '../lib/messaging';
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
  const [isPickerActive, setIsPickerActive] = useState(false);
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
      } else if (message.type === 'ELEMENT_PICKER_CANCELLED') {
        console.log('[Rasa Sidepanel] Picker cancelled');
        setIsPickerActive(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [tabId]);

  // Listen for ESC in sidepanel to close picker on page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickerActive(false);
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
      setIsPickerActive(true);
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

  // Undo a message and all following messages by restoring to a snapshot
  // Also removes the user message that triggered the assistant response
  const handleUndo = useCallback(async (messageIndex: number) => {
    const messageToUndo = messages[messageIndex];

    // The snapshotId on this message points to the state BEFORE this message's changes
    if (!messageToUndo.snapshotId) {
      console.error('No snapshot available for undo');
      return;
    }

    // Collect snapshotIds from this message and all following messages (to clean up)
    const snapshotIdsToRemove: string[] = [];
    for (let i = messageIndex; i < messages.length; i++) {
      if (messages[i].snapshotId) {
        snapshotIdsToRemove.push(messages[i].snapshotId!);
      }
    }

    // Restore to the snapshot
    await undoOperations(tabId, messageToUndo.snapshotId, snapshotIdsToRemove);

    // Find the start index - include the user message that triggered this response
    // The user message should be right before the assistant message
    const startIndex = messageIndex > 0 && messages[messageIndex - 1].role === 'user'
      ? messageIndex - 1
      : messageIndex;

    // Remove messages from startIndex onwards
    const newMessages = messages.slice(0, startIndex);
    setMessages(newMessages);

    // Save the updated history
    saveChatHistory(domain, newMessages);

    onStylesApplied();
  }, [messages, tabId, domain, onStylesApplied]);

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

    // Generate a unique snapshot ID for this operation
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const response = await generateStyles(fullPrompt, tabId, messages, snapshotId);

      if (response.success && response.data) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.explanation || 'Done.',
          timestamp: Date.now(),
          operations: Array.isArray(response.data.operations) ? response.data.operations : [],
          thinking: response.data.thinking,
          snapshotId  // Store the snapshot ID for undo
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
          <div className="flex flex-col flex-1 justify-center items-center py-8">
            <p className="mb-6 font-semibold text-body text-primary text-center">
              Describe how you want to customize this page.
            </p>

            <div className="space-y-2 w-full">
              <p className="mb-3 text-caption text-center">Try</p>
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
          messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              onUndo={() => handleUndo(index)}
              showUndo={message.role === 'assistant' && !loading}
            />
          ))
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2 text-muted">
            <div className="thinking-indicator">
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
            </div>
            <span className="text-small">Cooking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — Floating Input Bar */}
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
          <div className="chat-input-container">
            {/* Textarea — 2 lines */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pickedElements.length > 0 ? "What do you want to change?" : "Describe the changes you want..."}
              className="chat-input-textarea"
              rows={2}
              disabled={loading}
              autoFocus
            />

            {/* Bottom row — picker left, send right */}
            <div className="chat-input-actions">
              <button
                type="button"
                onClick={handleStartPicker}
                disabled={loading}
                className={`picker-btn ${isPickerActive ? 'picker-btn--active' : ''}`}
                aria-label="Select element on page"
                title="Select an element on the page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" />
                </svg>
                <span>Attach Element</span>
              </button>

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="chat-send-btn"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
