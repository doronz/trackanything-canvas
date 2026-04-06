/**
 * MarkdownDisplay - Universal Widget System Markdown Display Component
 * Full-featured markdown editor with live preview, formatting toolbar, and multiple view modes
 */

import React, { useState, useEffect, useRef } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidgetContent, updateWidget } from '@/store/widgetSlice';
import {
  EyeIcon,
  PencilIcon,
  DocumentTextIcon,
  BoltIcon,
  ItalicIcon,
  ListBulletIcon,
  LinkIcon,
  CodeBracketIcon,
  Bars2Icon,
} from '@heroicons/react/24/outline';

interface MarkdownDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface MarkdownEditorContent {
  markdown: string;
  lastSaved: string;
}

export default function MarkdownDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: MarkdownDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as any; // Allow both old and new formats
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Support both Universal Widget System 'content' field and legacy 'markdown' field
  const initialMarkdown =
    content?.content ||
    content?.markdown ||
    '# Welcome to Markdown Editor\n\nStart writing your markdown here...';
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [lastSaved, setLastSaved] = useState(content?.lastSaved || new Date().toISOString());

  // Update local state when widget content changes externally (e.g., from AI generation)
  useEffect(() => {
    const externalMarkdown = content?.content || content?.markdown || '';
    if (externalMarkdown && externalMarkdown !== markdown) {
      setMarkdown(externalMarkdown);
    }
  }, [content?.content, content?.markdown]);

  // Save content when it changes (debounced)
  useEffect(() => {
    // Only save if markdown actually changed from widget content
    const currentMarkdown = content?.content || content?.markdown || '';
    if (markdown === currentMarkdown) return;

    const timeoutId = setTimeout(() => {
      // Save to both new 'content' field (Universal Widget System) and legacy 'markdown' field
      const newContent = {
        content: markdown, // New Universal Widget System field
        markdown, // Legacy field for backward compatibility
        lastSaved: new Date().toISOString(),
      };

      // Update both local Redux state and backend database
      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: newContent,
        })
      );

      // Save to backend database
      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: newContent },
        })
      );

      onDataChange(newContent);
      setLastSaved(newContent.lastSaved);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [markdown, dispatch, widget.id, onDataChange]);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);

    let newText: string;
    let newCursorPosition: number;

    if (after) {
      // Wrap selected text with before and after (e.g., **text**)
      newText =
        markdown.substring(0, start) + before + selectedText + after + markdown.substring(end);
      newCursorPosition = start + before.length + selectedText.length;
    } else {
      // Insert before text at start of line or before selection for headers (e.g., ## )
      if (selectedText) {
        // For headers, replace selected text with header + selected text
        newText = markdown.substring(0, start) + before + selectedText + markdown.substring(end);
        newCursorPosition = start + before.length + selectedText.length;
      } else {
        // No selection, just insert the before text
        newText = markdown.substring(0, start) + before + markdown.substring(end);
        newCursorPosition = start + before.length;
      }
    }

    setMarkdown(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown renderer - in a real app, you'd use a library like marked or react-markdown
    return text
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">$1</h1>'
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-xl font-semibold mb-3 text-gray-900 dark:text-white">$1</h2>'
      )
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">$1</h3>'
      )
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm font-mono">$1</code>'
      )
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono overflow-x-auto"><code>$1</code></pre>'
      )
      .replace(/^\* (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(
        /\[([^\]]+)\]\(([^\)]+)\)/g,
        '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/\n/g, '<br>');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toolbarButtons = [
    {
      icon: () => <span className="font-bold text-sm">B</span>,
      action: () => insertMarkdown('**', '**'),
      title: 'Bold (Ctrl+B)',
    },
    {
      icon: () => <span className="italic text-sm">I</span>,
      action: () => insertMarkdown('*', '*'),
      title: 'Italic (Ctrl+I)',
    },
    {
      icon: () => <ListBulletIcon className="w-4 h-4" />,
      action: () => insertMarkdown('* '),
      title: 'List (Ctrl+L)',
    },
    {
      icon: () => <LinkIcon className="w-4 h-4" />,
      action: () => insertMarkdown('[', '](url)'),
      title: 'Link (Ctrl+K)',
    },
    {
      icon: () => <CodeBracketIcon className="w-4 h-4" />,
      action: () => insertMarkdown('`', '`'),
      title: 'Code (Ctrl+E)',
    },
  ];

  return (
    <div
      className="w-full h-full bg-white dark:bg-gray-800 rounded-lg flex flex-col"
      style={{
        backgroundColor: styleProps?.backgroundColor || '#ffffff',
        color: styleProps?.textColor || '#374151',
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium">
            {blueprint.settings?.title || blueprint.name || 'Markdown Editor'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Saved {formatTime(lastSaved)}
          </span>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('edit')}
              className={`px-2 py-1 text-xs rounded ${
                mode === 'edit'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <PencilIcon className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMode('split')}
              className={`px-2 py-1 text-xs rounded ${
                mode === 'split'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Bars2Icon className="w-3 h-3 transform rotate-90" />
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-2 py-1 text-xs rounded ${
                mode === 'preview'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <EyeIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {(mode === 'edit' || mode === 'split') && (
        <div className="flex items-center space-x-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          {toolbarButtons.map((button, index) => (
            <button
              key={index}
              onClick={button.action}
              title={button.title}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              {button.icon()}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-2" />
          <button
            onClick={() => insertMarkdown('# ')}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          >
            H1
          </button>
          <button
            onClick={() => insertMarkdown('## ')}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          >
            H2
          </button>
          <button
            onClick={() => insertMarkdown('### ')}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          >
            H3
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        {(mode === 'edit' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              placeholder="Start writing your markdown here..."
              className="flex-1 p-4 resize-none border-none focus:outline-none text-sm text-gray-900 dark:text-white dark:bg-gray-800 leading-relaxed"
              style={{
                tabSize: 2,
                fontFamily: 'Poppins, sans-serif', // Force Poppins font
              }}
            />
          </div>
        )}

        {/* Divider for split mode */}
        {mode === 'split' && <div className="w-px bg-gray-200 dark:bg-gray-700" />}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto`}>
            <div
              className="p-4 prose prose-sm max-w-none text-gray-900 dark:text-white"
              style={{
                fontFamily: 'Poppins, sans-serif', // Force Poppins font
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Lines: {markdown.split('\n').length}</span>
          <span>Characters: {markdown.length}</span>
          <span>Words: {markdown.trim() ? markdown.trim().split(/\s+/).length : 0}</span>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">Markdown</div>
      </div>
    </div>
  );
}
