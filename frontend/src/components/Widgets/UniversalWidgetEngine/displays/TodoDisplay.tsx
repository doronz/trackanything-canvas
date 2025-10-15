/**
 * TodoDisplay - Universal Widget System Display Component
 * Renders todo list with add, edit, delete, and completion functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidget } from '@/store/widgetSlice';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';

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

interface TodoDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export default function TodoDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: TodoDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();

  // Get current todos from widget content
  const content = widget.content || {};
  const initialItems = content.items || [];
  const [items, setItems] = useState<TodoItem[]>(initialItems);
  const [newItemText, setNewItemText] = useState('');

  // Debounced save to backend to avoid too frequent API calls
  const saveToBackend = useCallback(
    debounce((updatedItems: TodoItem[]) => {
      const updatedContent = {
        ...widget.content,
        items: updatedItems,
      };

      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: updatedContent },
        })
      );
    }, 1000), // Wait 1 second after last change before saving
    [dispatch, widget.id] // Removed widget.content to prevent infinite loop
  );

  // Save changes to store and backend when items change
  useEffect(() => {
    // Only save to backend if items actually exist (avoid saving empty initial state)
    const currentItems = content?.items || [];
    if (items.length > 0 || currentItems.length > 0) {
      saveToBackend(items);
    }
  }, [items, saveToBackend]); // Removed content?.items from dependencies to prevent infinite loop

  const addItem = () => {
    if (newItemText.trim()) {
      const newItem: TodoItem = {
        id: uuidv4(),
        text: newItemText.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setItems([...items, newItem]);
      setNewItemText('');
    }
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItemText = (id: string, text: string) => {
    setItems(items.map(item => (item.id === id ? { ...item, text } : item)));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addItem();
    }
  };

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;

  // Sort items to show incomplete first, then completed at the bottom
  const sortedItems = [...items].sort((a, b) => {
    if (a.completed === b.completed) {
      // If both have same completion status, sort by creation date (newest first for incomplete, oldest first for completed)
      return a.completed
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() // Completed: oldest first
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Incomplete: newest first
    }
    // Incomplete items first (false < true)
    return a.completed ? 1 : -1;
  });

  return (
    <div
      className="w-full h-full rounded-lg p-3 flex flex-col bg-white dark:bg-gray-800"
      style={{
        fontSize: `${styleProps?.fontSize || 14}px`,
        fontFamily: 'Poppins, sans-serif',
        backgroundColor: styleProps?.backgroundColor || undefined, // Let CSS classes handle default colors
        color: styleProps?.textColor || '#374151',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div
          className="text-sm text-gray-600 dark:text-gray-400"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {completedCount}/{totalCount} completed
        </div>
        {totalCount > 0 && (
          <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Todo Items */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedItems.map(item => (
          <div key={item.id} className="flex items-center space-x-2 group">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem(item.id)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <input
              type="text"
              value={item.text}
              onChange={e => updateItemText(item.id, e.target.value)}
              className={`flex-1 text-sm bg-transparent border-none outline-none ${
                item.completed
                  ? 'line-through text-gray-400 dark:text-gray-500'
                  : 'text-gray-900 dark:text-white'
              }`}
              style={{
                fontFamily: 'Poppins, sans-serif',
                color: item.completed ? undefined : '#111827', // Override inherited color for active items
              }}
            />
            <button
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Item */}
      <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={newItemText}
          onChange={e => setNewItemText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add new item..."
          className="flex-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          style={{
            fontFamily: 'Poppins, sans-serif',
            color: '#111827', // Override inherited color from parent
          }}
        />
        <button
          onClick={addItem}
          disabled={!newItemText.trim()}
          className="p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
