import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MarkdownMessageProps {
  content: string;
  theme?: 'light' | 'dark';
}

function CodeBlock({ children, className, theme }: { children: string; className?: string; theme: 'light' | 'dark' }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!language) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[12px] font-mono text-gray-800 dark:text-gray-200">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-label="Copy code"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={theme === 'dark' ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.8rem',
        }}
        PreTag="div"
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownMessage({ content, theme = 'dark' }: MarkdownMessageProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const value = String(children).replace(/\n$/, '');
            const isInline = !className;
            
            return isInline ? (
              <code
                className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[12px] font-mono text-gray-800 dark:text-gray-200"
                {...rest}
              >
                {value}
              </code>
            ) : (
              <CodeBlock className={className} theme={theme}>
                {value}
              </CodeBlock>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-[13px]">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                className="text-primary-600 dark:text-primary-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
