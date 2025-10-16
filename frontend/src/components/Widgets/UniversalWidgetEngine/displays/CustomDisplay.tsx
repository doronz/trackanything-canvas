/**
 * CustomDisplay - Universal Widget System Display Component
 * Fallback component for unknown display types or custom implementations
 */

import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';

interface CustomDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

export default function CustomDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: CustomDisplayProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-white dark:bg-gray-800">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">🔧</div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Custom Display Component
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This widget uses a custom display component (
            {blueprint.viewSchema?.displayComponent || 'Unknown'}) that hasn't been implemented yet.
          </p>
        </div>

        {/* Widget Info */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Widget Information</h4>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <strong>Name:</strong> {blueprint.name}
            </div>
            <div>
              <strong>Version:</strong>{' '}
              {blueprint.widgetVersion || (blueprint as any).widget_version || 'Unknown'}
            </div>
            <div>
              <strong>Display Component:</strong>{' '}
              {blueprint.viewSchema?.displayComponent || 'Unknown'}
            </div>
            <div>
              <strong>Data Items:</strong> {data?.length || 0}
            </div>
            <div>
              <strong>Fields:</strong> {blueprint.dataSchema?.fields?.length || 0}
            </div>
          </div>
        </div>

        {/* Data Preview */}
        {data && data.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Raw Data Preview</h4>
            <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(data.slice(0, 3), null, 2)}
              {data.length > 3 && '\n... and ' + (data.length - 3) + ' more items'}
            </pre>
          </div>
        )}

        {/* Schema Preview */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Data Schema</h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {blueprint.dataSchema?.fields?.map(field => (
              <div key={field.id} className="flex justify-between">
                <span>{field.name}</span>
                <span className="text-gray-500 dark:text-gray-500">{field.type}</span>
              </div>
            )) || <div>No schema fields available</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onRefresh}
            className="w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700"
          >
            Refresh Data
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            To implement this display component, create a file at:
            <br />
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
              displays/{blueprint.viewSchema?.displayComponent || 'Unknown'}Display.tsx
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
