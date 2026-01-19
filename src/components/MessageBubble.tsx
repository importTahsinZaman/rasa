import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, StyleOperation } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onUndo?: () => void;
  showUndo?: boolean;
}

function formatOperation(op: StyleOperation): string {
  switch (op.op) {
    case 'add':
      return `+ Added: ${op.selector}${op.description ? ` (${op.description})` : ''}`;
    case 'edit':
      return `~ Edited: ${op.ruleId}${op.description ? ` (${op.description})` : ''}`;
    case 'delete':
      return `- Deleted: ${op.ruleId}`;
    default:
      return 'Unknown operation';
  }
}

export default function MessageBubble({ message, onUndo, showUndo }: MessageBubbleProps) {
  const [showOps, setShowOps] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.content.startsWith('Error:');

  const bubbleClass = isUser
    ? 'message message-user'
    : isError
      ? 'message message-error'
      : 'message message-assistant';

  const operations = message.operations || [];
  const hasOperations = operations.length > 0;

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div className={bubbleClass}>
        {/* Thinking Dropdown (for assistant messages with thinking) */}
        {!isUser && message.thinking && (
          <div className="mb-3 pb-3 border-b border-subtle">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-2 text-xs transition-fast group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3.5 h-3.5 text-amber transition-transform duration-150 ${showThinking ? 'rotate-90' : ''}`}
              >
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 text-amber"
              >
                <path d="M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1ZM10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM12.95 4.11a.75.75 0 1 0-1.06-1.06l-1.062 1.06a.75.75 0 0 0 1.061 1.062l1.06-1.061ZM15 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 15 8ZM11.89 12.95a.75.75 0 0 0 1.06-1.06l-1.06-1.062a.75.75 0 0 0-1.062 1.061l1.061 1.06ZM8 12a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 12ZM4.11 11.89a.75.75 0 1 0 1.06 1.06l1.062-1.06a.75.75 0 1 0-1.061-1.062l-1.06 1.061ZM1.75 8A.75.75 0 0 1 2 7.25h1.5a.75.75 0 0 1 0 1.5H2A.75.75 0 0 1 1.75 8ZM4.11 4.11a.75.75 0 1 0 1.06 1.06L6.23 4.11a.75.75 0 0 0-1.06-1.06l-1.06 1.06Z" />
              </svg>
              <span className="text-amber font-medium group-hover:text-amber-light">
                {showThinking ? 'Hide' : 'Show'} thinking
              </span>
            </button>

            {showThinking && (
              <div className="mt-2 p-3 bg-void/60 border border-subtle rounded-lg text-xs text-cloud leading-relaxed animate-fadeInUp prose prose-sm prose-invert prose-p:my-1.5 prose-headings:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-amber-light prose-code:bg-stone prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none max-w-none">
                <ReactMarkdown>{message.thinking}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {isUser ? (
          <p className="text-body whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div className="markdown-content text-body leading-relaxed prose prose-sm prose-invert prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:text-olive-light prose-code:bg-stone prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-stone prose-pre:text-snow max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Operations Preview Expander */}
        {hasOperations && (
          <div className="mt-3 pt-3 border-t border-subtle">
            <button
              onClick={() => setShowOps(!showOps)}
              className="flex items-center gap-2 text-xs transition-fast group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3.5 h-3.5 text-interactive transition-transform duration-150 ${showOps ? 'rotate-90' : ''}`}
              >
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              <span className="text-interactive font-medium group-hover:text-interactive-hover">
                {showOps ? 'Hide' : 'View'} changes
              </span>
              <span className="text-ghost">
                {operations.length} operation{operations.length !== 1 ? 's' : ''}
              </span>
            </button>

            {showOps && (
              <div className="message-code animate-fadeInUp text-xs space-y-1">
                {operations.map((op, i) => (
                  <div key={i} className={op.op === 'add' ? 'text-success' : op.op === 'delete' ? 'text-error' : 'text-warning'}>
                    {formatOperation(op)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp and Undo */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-2xs text-ghost tabular-nums">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {showUndo && onUndo && !isUser && (
            <button
              onClick={onUndo}
              className="text-2xs text-ghost hover:text-error transition-fast flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M2.22 4.22a.75.75 0 0 0 0 1.06l2.5 2.5a.75.75 0 0 0 1.06-1.06L4.56 5.5H8.5a3.5 3.5 0 1 1 0 7h-1a.75.75 0 0 0 0 1.5h1a5 5 0 1 0 0-10H4.56l1.22-1.22a.75.75 0 0 0-1.06-1.06l-2.5 2.5Z" clipRule="evenodd" />
              </svg>
              Undo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
