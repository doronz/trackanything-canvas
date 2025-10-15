import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createWidget } from '@/store/widgetSlice';
import { Widget, PluggableWidgetExportData, PluggableWidgetImportData } from '@/types';
import { widgetAPI } from '@/services/api';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface WidgetImportExportProps {
  widget?: Widget;
  onImportSuccess?: (widget: Widget) => void;
  onClose?: () => void;
  referencePosition?: { x: number; y: number };
  exportOnly?: boolean;
}

const findPositionNextToWidget = (
  widgets: any[],
  referencePosition: { x: number; y: number },
  widgetWidth: number,
  widgetHeight: number
) => {
  const padding = 20;

  // Try to find a spot next to the reference position
  const checkOverlap = (x: number, y: number) => {
    return widgets.some(widget => {
      const right = x + widgetWidth;
      const bottom = y + widgetHeight;
      const widgetRight = widget.x + widget.width;
      const widgetBottom = widget.y + widget.height;

      return !(right <= widget.x || x >= widgetRight || bottom <= widget.y || y >= widgetBottom);
    });
  };

  // Try different positions around the reference position
  const positions = [
    // To the right
    { x: referencePosition.x + 300 + padding, y: referencePosition.y },
    // Below
    { x: referencePosition.x, y: referencePosition.y + 200 + padding },
    // To the left
    { x: referencePosition.x - widgetWidth - padding, y: referencePosition.y },
    // Above
    { x: referencePosition.x, y: referencePosition.y - widgetHeight - padding },
    // Diagonal positions
    { x: referencePosition.x + 300 + padding, y: referencePosition.y + 200 + padding },
    { x: referencePosition.x - widgetWidth - padding, y: referencePosition.y + 200 + padding },
  ];

  for (const pos of positions) {
    if (!checkOverlap(pos.x, pos.y)) {
      return pos;
    }
  }

  // If no good position found, use offset from reference
  return {
    x: referencePosition.x + 20,
    y: referencePosition.y + 20,
  };
};

export default function WidgetImportExport({
  widget,
  onImportSuccess,
  onClose,
  referencePosition,
  exportOnly = false,
}: WidgetImportExportProps) {
  const dispatch = useDispatch<AppDispatch>();
  const currentDashboardId = useSelector((state: RootState) => state.dashboard.currentDashboardId);
  const dashboards = useSelector((state: RootState) => state.dashboard.dashboards);
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);
  const { widgets } = useSelector((state: RootState) => state.widget);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportType, setExportType] = useState<'template' | 'instance'>('instance');
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'validating' | 'importing' | 'success' | 'error';
    message?: string;
    errors?: string[];
    warnings?: string[];
  }>({ status: 'idle' });

  // Helper function to create a filename-safe slug from widget title
  const createSlug = (title: string): string => {
    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') || // Remove leading/trailing hyphens
      'untitled-widget'
    ); // Fallback if title becomes empty
  };

  const handleExport = async (type: 'template' | 'instance') => {
    if (!widget) return;

    try {
      // Use new pluggable widget export API
      const response = await widgetAPI.exportPluggableWidget(widget.id);
      const exportedData: PluggableWidgetExportData = response.data;

      // Generate filename based on widget title
      const baseFilename = widget.title
        ? createSlug(widget.title)
        : createSlug(exportedData.widget_blueprint.name);
      const filename = `${baseFilename}-${type}.json`;

      // Create export data with type information
      const exportDataWithType = {
        ...exportedData,
        export_type: type, // Add export type for import reference
        export_metadata: {
          exportedBy: 'Canvas MCP Client',
          exportedAt: new Date().toISOString(),
          originalWidget: {
            id: widget.id,
            dashboard_id: widget.dashboard_id,
          },
        },
      };

      // For template export, remove instance-specific data
      if (type === 'template') {
        // Keep structure but clear content for template
        exportDataWithType.content = {};
        exportDataWithType.title = undefined;
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(exportDataWithType, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setImportStatus({
        status: 'error',
        message: 'Failed to export widget',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        setImportStatus({ status: 'validating' });

        // Basic validation for new pluggable widget format
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!data.export_version) {
          errors.push('Missing export version - this may be an old format');
        }
        if (!data.widget_blueprint) {
          errors.push('Missing widget blueprint data');
        }
        if (data.export_version === '1.0') {
          warnings.push(
            'This appears to be a legacy widget format - import may not work correctly'
          );
        }

        if (errors.length > 0) {
          setImportStatus({
            status: 'error',
            message: 'Invalid widget format',
            errors,
            warnings,
          });
          return;
        }

        setImportStatus({ status: 'importing' });

        // Import the widget
        if (!currentDashboard) {
          setImportStatus({
            status: 'error',
            message: 'No dashboard selected for import',
          });
          return;
        }

        const widgetWidth = data.width || 300;
        const widgetHeight = data.height || 200;

        let position = { x: 100, y: 100 }; // Default position

        if (referencePosition) {
          // Find optimal position next to the reference widget
          position = findPositionNextToWidget(
            widgets,
            referencePosition,
            widgetWidth,
            widgetHeight
          );
        }

        // Prepare import data for new API
        const importData: PluggableWidgetImportData = {
          dashboard_id: currentDashboard.id,
          title: data.title,
          x: position.x,
          y: position.y,
          width: widgetWidth,
          height: widgetHeight,
          color: data.color || '#ffffff',
          shape: data.shape || 'rectangle',
          content: data.content || {},
          settings: data.settings || {},
          widget_blueprint_id: data.widget_blueprint_id,
          widget_blueprint: data.widget_blueprint,
        };

        // Use new pluggable widget import API
        const result = await widgetAPI.importPluggableWidget(importData);

        setImportStatus({
          status: 'success',
          message: `Successfully imported "${data.widget_blueprint?.name || 'Widget'}"`,
          warnings,
        });
        onImportSuccess?.(result.data);
      } catch (error) {
        setImportStatus({
          status: 'error',
          message: 'Failed to parse widget file',
          errors: [error instanceof Error ? error.message : 'Invalid JSON format'],
        });
      }
    };

    reader.readAsText(file);
  };

  const StatusIcon = () => {
    switch (importStatus.status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'validating':
      case 'importing':
        return (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Export Section */}
      {widget && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
            Export Widget
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="template"
                    checked={exportType === 'template'}
                    onChange={e => setExportType(e.target.value as 'template')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    <strong>Template</strong> - Structure and settings only (no personal data)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="instance"
                    checked={exportType === 'instance'}
                    onChange={e => setExportType(e.target.value as 'instance')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    <strong>Instance</strong> - Complete widget with all data (for backups)
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={() => handleExport(exportType)}
              className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] hover:shadow-lg text-white rounded-lg transition-shadow"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export as {exportType === 'template' ? 'Template' : 'Instance'}
            </button>
          </div>
        </div>
      )}

      {/* Import Section - Only show if not exportOnly */}
      {!exportOnly && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            Import Widget
          </h3>

          <div className="space-y-3">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  importStatus.status === 'validating' || importStatus.status === 'importing'
                }
                className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                {importStatus.status === 'validating'
                  ? 'Validating...'
                  : importStatus.status === 'importing'
                    ? 'Importing...'
                    : 'Choose Widget File (.json)'}
              </button>
            </div>

            {/* Status Messages */}
            {importStatus.status !== 'idle' && (
              <div
                className={`p-3 rounded-lg border ${
                  importStatus.status === 'success'
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : importStatus.status === 'error'
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start">
                  <StatusIcon />
                  <div className="ml-3 flex-1">
                    {importStatus.message && (
                      <p
                        className={`text-sm font-medium ${
                          importStatus.status === 'success'
                            ? 'text-green-800 dark:text-green-200'
                            : importStatus.status === 'error'
                              ? 'text-red-800 dark:text-red-200'
                              : 'text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {importStatus.message}
                      </p>
                    )}

                    {importStatus.errors && importStatus.errors.length > 0 && (
                      <ul className="mt-2 text-sm text-red-600 dark:text-red-400 space-y-1">
                        {importStatus.errors.map((error, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-1">•</span>
                            {error}
                          </li>
                        ))}
                      </ul>
                    )}

                    {importStatus.warnings && importStatus.warnings.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center text-amber-600 dark:text-amber-400">
                          <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                          <span className="text-sm font-medium">Warnings:</span>
                        </div>
                        <ul className="mt-1 text-sm text-amber-600 dark:text-amber-400 space-y-1">
                          {importStatus.warnings.map((warning, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-1">•</span>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Button */}
      {onClose && (
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
