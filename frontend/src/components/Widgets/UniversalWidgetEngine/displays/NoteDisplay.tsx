/**
 * NoteDisplay - Universal Widget System Display Component
 * Renders note/sticky note widgets with textarea input and auto-save
 */

import Tooltip from '@/components/UI/Tooltip';
import { AppDispatch } from '@/store';
import { openWidgetImportExportModal, openWidgetSettingsPanel } from '@/store/uiSlice';
import { deleteWidget, selectWidget, updateWidget } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { XMarkIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

interface NoteDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
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

export default function NoteDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: NoteDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  // Find the content field in the schema
  const contentField =
    blueprint.dataSchema.fields.find(
      field => field.type === 'textarea' || field.type === 'richtext' || field.id === 'content'
    ) || blueprint.dataSchema.fields[0];

  // Get current text from widget content
  const currentText = widget.content?.[contentField?.id || 'content'] || widget.content?.text || '';

  const [text, setText] = useState(currentText);
  const [isHovered, setIsHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(widget.title || '');

  // Debounced save to backend - use useRef to avoid circular dependencies
  const saveToBackendRef = useRef<((newText: string) => void) | null>(null);

  // Update the ref whenever dependencies change, but don't include it in useEffect deps
  useEffect(() => {
    saveToBackendRef.current = debounce((newText: string) => {
      const content = {
        ...widget.content,
        [contentField?.id || 'content']: newText,
      };

      // Use updateWidget to persist to backend instead of just local state
      dispatch(
        updateWidget({
          id: widget.id,
          data: { content },
        })
      );
    }, 500);
  }, [dispatch, widget.id, contentField, widget.content]);

  // Save changes when text changes - avoid including the callback in dependencies
  useEffect(() => {
    if (text !== currentText && saveToBackendRef.current) {
      saveToBackendRef.current(text);
    }
  }, [text, currentText]);

  // Update local state when widget content changes
  useEffect(() => {
    setText(currentText);
  }, [currentText]);

  // Update local title value when widget title changes
  useEffect(() => {
    setTitleValue(widget.title || '');
  }, [widget.title]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Title editing handlers
  const handleTitleClick = () => {
    setEditingTitle(true);
  };

  const handleTitleSubmit = () => {
    if (titleValue.trim() !== widget.title) {
      dispatch(
        updateWidget({
          id: widget.id,
          data: { title: titleValue.trim() },
        })
      );
    }
    setEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
      setTitleValue(widget.title || '');
    }
  };

  const handleDelete = () => {
    dispatch(deleteWidget(widget.id));
  };

  // Calculate character count and show warning if approaching limit
  const charCount = text.length;
  const maxChars = 5000; // Reasonable limit for sticky notes
  const isNearLimit = charCount > maxChars * 0.8;
  const isOverLimit = charCount > maxChars;

  // Get background color from settings or use default sticky note color
  const backgroundColor = blueprint.settings.backgroundColor || '#fef3c7';
  const textColor = blueprint.settings.textColor || styleProps.textColor || '#374151';

  // Calculate sticky note styling
  const stickyStyle = {
    borderRadius:
      widget.shape === 'circle'
        ? '50%'
        : widget.shape === 'rounded'
          ? `${widget.settings?.borderRadius || 8}px`
          : '4px',
    boxShadow: isSelected
      ? '0 0 0 2px #3B82F6, 0 4px 6px rgba(0,0,0,0.1)'
      : widget.settings?.shadow === 'sm'
        ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        : widget.settings?.shadow === 'md'
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          : widget.settings?.shadow === 'lg'
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            : widget.settings?.shadow === 'xl'
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              : '0 1px 3px rgba(0,0,0,0.1)',
    fontFamily: 'Poppins, sans-serif',
    fontSize: `${widget.settings?.fontSize || 14}px`,
    backgroundColor: widget.settings?.noteBackgroundColor || backgroundColor,
    borderColor: widget.color || '#f59e0b',
    borderWidth: `${widget.settings?.borderWidth || 1}px`,
    color: widget.settings?.textColor || textColor,
  };

  return (
    <div
      className="w-full h-full relative flex flex-col"
      style={{
        ...stickyStyle,
        border: `${stickyStyle.borderWidth} solid ${stickyStyle.borderColor}`,
        boxShadow: stickyStyle.boxShadow,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header with title and close button */}
      <div
        className="flex items-center justify-between p-2 border-b border-opacity-30 gap-3"
        style={{
          cursor: 'move',
          borderBottomColor: widget.color || '#f59e0b',
        }}
      >
        {editingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyPress}
            onMouseDown={e => e.stopPropagation()}
            className="bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 font-medium"
            style={{
              fontSize: 'inherit',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
            autoFocus
            placeholder="Enter title..."
          />
        ) : (
          <h3
            className="font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              fontSize: 'inherit',
              color: 'inherit',
            }}
            onClick={handleTitleClick}
            onMouseDown={e => e.stopPropagation()}
            title="Click to edit title"
          >
            {titleValue || 'Click to add title'}
          </h3>
        )}
        {(isSelected || isHovered) && (
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:text-red-600 dark:hover:text-red-400 hover:bg-black dark:hover:bg-white hover:bg-opacity-10 dark:hover:bg-opacity-10 transition-all flex-shrink-0"
            style={{
              width: '24px',
              height: '24px',
              color: 'inherit',
            }}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Main textarea */}
        <textarea
          value={text}
          onChange={handleTextChange}
          placeholder={contentField?.placeholder || 'Add your note...'}
          className="w-full h-full resize-none border-none focus:outline-none p-4 text-sm leading-relaxed bg-transparent"
          style={{
            color: 'inherit',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          }}
          maxLength={maxChars}
          onClick={handleClick}
        />

        {/* Character counter */}
        {(isHovered || isSelected || isNearLimit) && (
          <div
            className={`absolute bottom-2 right-2 text-xs px-2 py-1 rounded-md transition-all duration-200 ${
              isOverLimit
                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                : isNearLimit
                  ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                  : 'bg-black bg-opacity-10 dark:bg-opacity-20 text-gray-600 dark:text-gray-400'
            }`}
          >
            {charCount.toLocaleString()}
            {maxChars && ` / ${maxChars.toLocaleString()}`}
          </div>
        )}
      </div>

      {/* Footer with proper controls matching other widgets - always visible */}
      <div className="bg-black dark:bg-white bg-opacity-20 dark:bg-opacity-10 px-3 py-1.5 flex justify-between items-center text-xs border-t border-black dark:border-white border-opacity-20 dark:border-opacity-10 backdrop-blur-sm">
        {/* Left side - Last updated */}
        <div
          className="text-gray-700 dark:text-gray-300 font-medium"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {(() => {
            const updatedAt = new Date(widget.updated_at);
            const now = new Date();
            const diffInSeconds = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);

            if (diffInSeconds < 60) {
              return 'just now';
            } else if (diffInSeconds < 3600) {
              const minutes = Math.floor(diffInSeconds / 60);
              return `${minutes}m ago`;
            } else if (diffInSeconds < 86400) {
              const hours = Math.floor(diffInSeconds / 3600);
              return `${hours}h ago`;
            } else if (diffInSeconds < 2592000) {
              const days = Math.floor(diffInSeconds / 86400);
              return `${days}d ago`;
            } else {
              const months = Math.floor(diffInSeconds / 2592000);
              return `${months}mo ago`;
            }
          })()}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center space-x-1">
          {/* Customize Appearance Button */}
          <Tooltip content="Customize Appearance" position="top">
            <button
              onClick={e => {
                e.stopPropagation();
                dispatch(selectWidget(widget.id));
                dispatch(openWidgetSettingsPanel(widget.id));
              }}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-black dark:hover:bg-white hover:bg-opacity-10 dark:hover:bg-opacity-10 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
                />
              </svg>
            </button>
          </Tooltip>

          {/* Import/Export Button */}
          <Tooltip content="Import/Export Widget" position="top">
            <button
              onClick={e => {
                e.stopPropagation();
                dispatch(openWidgetImportExportModal(widget.id));
              }}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-black dark:hover:bg-white hover:bg-opacity-10 dark:hover:bg-opacity-10 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </button>
          </Tooltip>

          {/* Delete Button */}
          <Tooltip content="Delete Widget" position="top">
            <button
              onClick={e => {
                e.stopPropagation();
                dispatch(deleteWidget(widget.id));
              }}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-black dark:hover:bg-white hover:bg-opacity-10 dark:hover:bg-opacity-10 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
