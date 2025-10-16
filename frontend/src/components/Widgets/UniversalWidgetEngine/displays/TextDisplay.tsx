/**
 * TextDisplay - Universal Widget System Display Component
 * Renders markdown/rich text with preview and editing modes
 */

import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { DocumentTextIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch } from 'react-redux';
import remarkGfm from 'remark-gfm';

interface TextDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface TextContent {
  content: string;
  mode?: 'edit' | 'preview';
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export default function TextDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: TextDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  // Find the content field in the schema
  const contentField =
    blueprint.dataSchema.fields.find(
      field => field.type === 'richtext' || field.type === 'textarea' || field.id === 'content'
    ) || blueprint.dataSchema.fields[0];

  // Get current content from widget
  const currentContent =
    widget.content?.[contentField?.id || 'content'] ||
    widget.content?.text ||
    widget.content?.markdown ||
    '';

  const [content, setContent] = useState(currentContent);
  const [mode, setMode] = useState<'edit' | 'preview'>(currentContent ? 'preview' : 'edit');
  const [isHovered, setIsHovered] = useState(false);

  // Debounced save to backend
  const saveToBackend = useCallback(
    debounce((newContent: string) => {
      const contentData = {
        [contentField?.id || 'content']: newContent,
        text: newContent, // For backward compatibility
        markdown: newContent, // For backward compatibility
      };

      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: contentData,
        })
      );
    }, 500),
    [dispatch, widget.id, contentField]
  );

  // Save changes when content changes
  useEffect(() => {
    if (content !== currentContent) {
      saveToBackend(content);
    }
  }, [content, currentContent, saveToBackend]);

  // Update local state when widget content changes
  useEffect(() => {
    setContent(currentContent);
  }, [currentContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const toggleMode = () => {
    setMode(mode === 'edit' ? 'preview' : 'edit');
  };

  const interactions = blueprint.viewSchema.interactions || {};
  const canEdit = interactions.allowEdit !== false;

  // Custom markdown components for better styling
  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mb-4 text-gray-900">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold mb-3 text-gray-900">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-medium mb-2 text-gray-900">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-base font-medium mb-2 text-gray-900">{children}</h4>
    ),
    h5: ({ children }: any) => (
      <h5 className="text-sm font-medium mb-1 text-gray-900">{children}</h5>
    ),
    h6: ({ children }: any) => (
      <h6 className="text-xs font-medium mb-1 text-gray-900">{children}</h6>
    ),
    p: ({ children }: any) => <p className="mb-3 text-gray-700 leading-relaxed">{children}</p>,
    ul: ({ children }: any) => <ul className="mb-3 ml-4 list-disc">{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-3 ml-4 list-decimal">{children}</ol>,
    li: ({ children }: any) => <li className="mb-1 text-gray-700">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 mb-3 italic text-gray-600">
        {children}
      </blockquote>
    ),
    code: ({ children, className }: any) => {
      const isInline = !className;
      return isInline ? (
        <code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-gray-800">{children}</code>
      ) : (
        <code className="block bg-gray-100 p-3 rounded text-sm text-gray-800 overflow-x-auto">
          {children}
        </code>
      );
    },
    pre: ({ children }: any) => (
      <pre className="bg-gray-100 p-3 rounded mb-3 overflow-x-auto">{children}</pre>
    ),
    a: ({ children, href }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {children}
      </a>
    ),
    table: ({ children }: any) => (
      <div className="mb-3 overflow-x-auto">
        <table className="min-w-full border border-gray-300">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr className="border-b border-gray-200">{children}</tr>,
    th: ({ children }: any) => (
      <th className="px-3 py-2 text-left font-medium text-gray-900 border-r border-gray-300 last:border-r-0">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-3 py-2 text-gray-700 border-r border-gray-300 last:border-r-0">
        {children}
      </td>
    ),
  };

  if (!content && mode === 'preview') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No content yet</p>
          {canEdit && (
            <button
              onClick={() => setMode('edit')}
              className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
            >
              Start Writing
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-gray-800"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with mode toggle */}
      {canEdit && (isHovered || isSelected || mode === 'edit') && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {blueprint.settings.title || 'Text Document'}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMode}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs transition-colors ${
                mode === 'edit'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
              }`}
            >
              {mode === 'edit' ? (
                <>
                  <EyeIcon className="w-3 h-3" />
                  <span>Preview</span>
                </>
              ) : (
                <>
                  <PencilIcon className="w-3 h-3" />
                  <span>Edit</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'edit' ? (
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder={contentField?.placeholder || 'Start writing... (Supports Markdown)'}
            className="w-full h-full resize-none border-none focus:outline-none p-4 text-sm leading-relaxed bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            style={{
              fontSize: styleProps.fontSize || 14,
              fontFamily: 'Poppins, sans-serif',
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content || 'No content to display'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Character counter for edit mode */}
      {mode === 'edit' && (isHovered || isSelected) && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {content.length.toLocaleString()} characters
          {content.split('\n').length > 1 && (
            <span className="ml-2">• {content.split('\n').length} lines</span>
          )}
          {content.split(/\s+/).filter((w: string) => w.length > 0).length > 0 && (
            <span className="ml-2">
              • {content.split(/\s+/).filter((w: string) => w.length > 0).length} words
            </span>
          )}
        </div>
      )}
    </div>
  );
}
