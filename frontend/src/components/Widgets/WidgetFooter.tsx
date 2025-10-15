import React from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { openWidgetImportExportModal, openWidgetSettingsPanel } from '@/store/uiSlice';
import { selectWidget } from '@/store/widgetSlice';
import { Widget } from '@/types';
import Tooltip from '@/components/UI/Tooltip';
import { PaintBrushIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';

interface WidgetFooterProps {
  widget: Widget;
  onDelete: (e: React.MouseEvent) => void;
}

export default function WidgetFooter({ widget, onDelete }: WidgetFooterProps) {
  const dispatch = useDispatch<AppDispatch>();

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const updatedAt = new Date(dateString);
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
  };

  const handleCustomizeAppearance = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectWidget(widget.id));
    dispatch(openWidgetSettingsPanel(widget.id));
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      openWidgetImportExportModal({
        widgetId: widget.id,
        referencePosition: { x: widget.x, y: widget.y },
        exportOnly: true,
      })
    );
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between text-xs rounded-b-lg"
      style={{ fontSize: '11px' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Left side - Last updated time */}
      <div className="text-gray-500 dark:text-gray-400">{formatTimeAgo(widget.updated_at)}</div>

      {/* Right side - Action buttons */}
      <div className="flex items-center space-x-1">
        {/* Customize Appearance Button */}
        <Tooltip content="Customize Appearance" position="top">
          <button
            onClick={handleCustomizeAppearance}
            onMouseDown={e => e.stopPropagation()}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <PaintBrushIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {/* Export Button */}
        <Tooltip content="Export Widget" position="top">
          <button
            onClick={handleExport}
            onMouseDown={e => e.stopPropagation()}
            className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {/* Delete Button */}
        <Tooltip content="Delete Widget" position="top">
          <button
            onClick={onDelete}
            onMouseDown={e => e.stopPropagation()}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
