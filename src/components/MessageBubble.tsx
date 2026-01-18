import { useState } from 'react';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showCSS, setShowCSS] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.content.startsWith('Error:');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 ${
          isUser
            ? 'bg-purple-600 text-white'
            : isError
              ? 'bg-red-900/50 text-red-200'
              : 'bg-gray-800 text-gray-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Show CSS preview for assistant messages with styles */}
        {message.styles && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => setShowCSS(!showCSS)}
              className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-4 h-4 transition-transform ${showCSS ? 'rotate-90' : ''}`}
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                  clipRule="evenodd"
                />
              </svg>
              {showCSS ? 'Hide CSS' : 'Show CSS'}
              <span className="text-gray-500 ml-1">
                ({message.styles.selectors.length} selector{message.styles.selectors.length !== 1 ? 's' : ''})
              </span>
            </button>

            {showCSS && (
              <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto text-gray-300 font-mono">
                {message.styles.css}
              </pre>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
