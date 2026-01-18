import { useState } from 'react';
import type { ChatMessage, StyleOperation } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
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

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showOps, setShowOps] = useState(false);
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
        <p className="text-body whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>

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

        {/* Thinking Tokens & Timestamp */}
        <div className="flex items-center gap-2 mt-2">
          {message.thinkingTokens && (
            <span className="text-2xs text-ghost bg-surface-secondary px-1.5 py-0.5 rounded tabular-nums">
              {message.thinkingTokens.toLocaleString()} thinking tokens
            </span>
          )}
          <p className="text-2xs text-ghost tabular-nums">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
