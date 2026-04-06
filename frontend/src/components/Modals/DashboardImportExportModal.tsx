import { dashboardAPI } from '@/services/api';
import { AppDispatch, RootState } from '@/store';
import { fetchDashboards, setCurrentDashboard } from '@/store/dashboardSlice';
import { closeModal } from '@/store/uiSlice';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BaseModal from './BaseModal';

interface DashboardImportExportModalProps {
  isOpen: boolean;
}

export default function DashboardImportExportModal({ isOpen }: DashboardImportExportModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { currentDashboardId, dashboards } = useSelector((state: RootState) => state.dashboard);
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportType, setExportType] = useState<'template' | 'instance'>('instance');
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'validating' | 'importing' | 'success' | 'error';
    message?: string;
    errors?: string[];
    warnings?: string[];
  }>({ status: 'idle' });

  const handleClose = () => {
    dispatch(closeModal('importExport'));
    // Reset status after a delay to allow modal animation
    setTimeout(() => {
      setImportStatus({ status: 'idle' });
    }, 300);
  };

  // Helper function to create a filename-safe slug from dashboard name
  const createSlug = (name: string): string => {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') || // Remove leading/trailing hyphens
      'untitled-dashboard'
    ); // Fallback if name becomes empty
  };

  const handleExport = async () => {
    if (!currentDashboard) {
      setImportStatus({
        status: 'error',
        message: 'No dashboard selected for export',
      });
      return;
    }

    try {
      // Export the dashboard
      const response = await dashboardAPI.export(currentDashboard.id);
      let exportedData = response.data;

      // For template export, remove widget content
      if (exportType === 'template') {
        exportedData = {
          ...exportedData,
          export_type: 'template',
          widgets: exportedData.widgets.map((widget: any) => ({
            ...widget,
            content: {}, // Clear content for template
            title: undefined, // Clear title for template
          })),
        };
      } else {
        exportedData = {
          ...exportedData,
          export_type: 'instance',
        };
      }

      // Generate filename based on dashboard name
      const baseFilename = createSlug(currentDashboard.name);
      const filename = `${baseFilename}-${exportType}.json`;

      // Create and download file
      const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
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

      setImportStatus({
        status: 'success',
        message: `Successfully exported "${currentDashboard.name}" as ${exportType}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      setImportStatus({
        status: 'error',
        message: 'Failed to export dashboard',
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

        // Basic validation
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!data.export_version) {
          errors.push('Missing export version - this may be an old format');
        }
        if (!data.dashboard) {
          errors.push('Missing dashboard data');
        }
        if (!data.widgets || !Array.isArray(data.widgets)) {
          warnings.push('No widgets found in dashboard export');
        }

        if (errors.length > 0) {
          setImportStatus({
            status: 'error',
            message: 'Invalid dashboard format',
            errors,
            warnings,
          });
          return;
        }

        setImportStatus({ status: 'importing' });

        // Prepare import data
        const importData = {
          name: data.dashboard.name + ' (Imported)',
          description: data.dashboard.description,
          canvas_state: data.dashboard.canvas_state,
          widgets: data.widgets || [],
          connections: data.connections || [],
        };

        // Import the dashboard
        const result = await dashboardAPI.import(importData);

        const connectionCount = 0; // Connection count not returned by API
        const widgetCount = result.data.widget_count || 0;
        const successMessage =
          connectionCount > 0
            ? `Successfully imported "${data.dashboard.name}" with ${widgetCount} widgets and ${connectionCount} connections`
            : `Successfully imported "${data.dashboard.name}" with ${widgetCount} widgets`;

        setImportStatus({
          status: 'success',
          message: successMessage,
          warnings,
        });

        // Refresh dashboards list
        dispatch(fetchDashboards());

        // Optionally switch to the imported dashboard
        setTimeout(() => {
          dispatch(setCurrentDashboard(result.data.dashboard_id));
          handleClose();
        }, 2000);
      } catch (error) {
        setImportStatus({
          status: 'error',
          message: 'Failed to parse dashboard file',
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
    <BaseModal isOpen={isOpen} onClose={handleClose} title="Dashboard Import & Export" size="lg">
      <div className="p-6 space-y-6">
        {/* Export Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
            Export Dashboard
          </h3>

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Export the current dashboard with all its widgets and settings. Choose between
              template (structure only) or instance (complete snapshot with data).
            </p>

            {currentDashboard && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Current Dashboard: {currentDashboard.name}
                </p>
                {currentDashboard.description && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {currentDashboard.description}
                  </p>
                )}
              </div>
            )}

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
                    <strong>Template</strong> - Structure and layout only (no widget content)
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
                    <strong>Instance</strong> - Complete dashboard with all data (for backups)
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={!currentDashboard}
              className="w-full flex items-center justify-center px-4 py-2 bg-violet-600 hover:bg-violet-700 hover:shadow-lg text-white rounded-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export as {exportType === 'template' ? 'Template' : 'Instance'}
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Import Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            Import Dashboard
          </h3>

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Import a dashboard from a previously exported JSON file. This will create a new
              dashboard with all its widgets.
            </p>

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
                    : 'Choose Dashboard File (.json)'}
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

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
