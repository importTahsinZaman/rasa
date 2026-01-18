import { useState } from 'react';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showCSS, setShowCSS] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.content.startsWith('Error:');

  const bubbleClass = isUser
    ? 'message message-user'
    : isError
      ? 'message message-error'
      : 'message message-assistant';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={bubbleClass}>
        <p className="text-small whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>

        {/* CSS Preview Expander */}
        {message.styles && (
          <div className="mt-3 pt-3 border-t border-subtle">
            <button
              onClick={() => setShowCSS(!showCSS)}
              className="flex items-center gap-2 text-xs transition-fast group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3.5 h-3.5 text-interactive transition-transform duration-150 ${showCSS ? 'rotate-90' : ''}`}
              >
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              <span className="text-interactive font-medium group-hover:text-interactive-hover">
                {showCSS ? 'Hide' : 'View'} CSS
              </span>
              <span className="text-ghost">
                {message.styles.selectors.length} selector{message.styles.selectors.length !== 1 ? 's' : ''}
              </span>
            </button>

            {showCSS && (
              <pre className="message-code animate-fadeInUp">
                {message.styles.css}
              </pre>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-2xs text-ghost mt-2 tabular-nums">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
