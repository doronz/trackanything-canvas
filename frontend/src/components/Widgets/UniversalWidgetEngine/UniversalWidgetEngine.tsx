/**
 * UniversalWidgetEngine - The core rendering engine for Universal Widget System v2.0
 *
 * This component replaces the hardcoded Core Engine approach with a flexible,
 * schema-driven system that can dynamically render any widget based on JSON blueprints.
 */

import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidget } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint, isUniversalBlueprint } from '@/types/universalWidget';

// Display Components
import {
  FormDisplay,
  TableDisplay,
  SpreadsheetDisplay,
  ListDisplay,
  CardsDisplay,
  KanbanDisplay,
  CalendarDisplay,
  ChartDisplay,
  GalleryDisplay,
  TextDisplay,
  ChatDisplay,
  NoteDisplay,
  TodoDisplay,
  IframeDisplay,
  VideoDisplay,
  WeatherDisplay,
  ClockDisplay,
  MarkdownDisplay,
  AudioDisplay,
  MapDisplay,
  TimelineDisplay,
  CustomDisplay,
} from './displays';

// Legacy support removed - Universal Widget System only

// Data Source Handlers
import { useDataSource } from './hooks/useDataSource';
import { useDataValidation } from './hooks/useDataValidation';

// Error Boundary
import ErrorBoundary from './ErrorBoundary';

interface UniversalWidgetEngineProps {
  widget: PluggableWidget;
  blueprint: any; // Can be universal or legacy blueprint
  isSelected?: boolean;
  styleProps: {
    textColor: string;
    fontSize: number;
  };
}

/**
 * Main Universal Widget Engine Component
 */
export default function UniversalWidgetEngine({
  widget,
  blueprint,
  isSelected = false,
  styleProps,
}: UniversalWidgetEngineProps) {
  // Check if this is a Universal Widget - Legacy support removed
  const isUniversal = isUniversalBlueprint(blueprint);

  // If it's not a recognized format, show error
  if (!isUniversal) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-red-600">Invalid Widget Blueprint</div>
          <p className="text-sm text-gray-500">
            This widget blueprint is not compatible with the Universal Widget System.
          </p>
          <div className="text-xs text-gray-400 mt-2">
            Widget ID: {widget.id} | Blueprint Version:{' '}
            {blueprint.widgetVersion || blueprint.widget_version || 'Unknown'}
          </div>
        </div>
      </div>
    );
  }

  // At this point we know it's a valid Universal Widget
  const universalBlueprint = blueprint as UniversalWidgetBlueprint;

  return (
    <ErrorBoundary widgetId={widget.id} blueprintName={universalBlueprint.name}>
      <UniversalWidgetRenderer
        widget={widget}
        blueprint={universalBlueprint}
        isSelected={isSelected}
        styleProps={styleProps}
      />
    </ErrorBoundary>
  );
}

/**
 * Internal renderer for Universal Widgets
 */
function UniversalWidgetRenderer({
  widget,
  blueprint,
  isSelected,
  styleProps,
}: {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  isSelected: boolean;
  styleProps: any;
}) {
  const dispatch = useDispatch<AppDispatch>();

  // Load data based on data source
  const { data, loading, error, refetch } = useDataSource(blueprint.dataSource, widget.content);

  // Validate data against schema
  const { validatedData, validationErrors } = useDataValidation(data, blueprint.dataSchema);

  // Get the display component
  const DisplayComponent = useMemo(() => {
    // Check if viewSchema exists and has displayComponent
    if (!blueprint.viewSchema || !blueprint.viewSchema.displayComponent) {
      console.warn('ViewSchema or displayComponent is missing:', blueprint.viewSchema);
      return CustomDisplay;
    }

    switch (blueprint.viewSchema.displayComponent) {
      case 'Form':
        return FormDisplay;
      case 'Table':
        return TableDisplay;
      case 'Spreadsheet':
        return SpreadsheetDisplay;
      case 'List':
        return ListDisplay;
      case 'Cards':
        return CardsDisplay;
      case 'Kanban':
        return KanbanDisplay;
      case 'Calendar':
        return CalendarDisplay;
      case 'Chart':
        return ChartDisplay;
      case 'Gallery':
        return GalleryDisplay;
      case 'Text':
        return TextDisplay;
      case 'Chat':
        return ChatDisplay;
      case 'Note':
        return NoteDisplay;
      case 'Todo':
        return TodoDisplay;
      case 'Iframe':
        return IframeDisplay;
      case 'Video':
        return VideoDisplay;
      case 'Weather':
        return WeatherDisplay;
      case 'Clock':
        return ClockDisplay;
      case 'Markdown':
        return MarkdownDisplay;
      case 'Audio':
        return AudioDisplay;
      case 'Map':
        return MapDisplay;
      case 'Timeline':
        return TimelineDisplay;
      case 'Custom':
        return CustomDisplay;
      default:
        console.warn(`Unknown display component: ${blueprint.viewSchema.displayComponent}`);
        return CustomDisplay;
    }
  }, [blueprint.viewSchema]);

  // Show loading state
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-red-600">Data Error</div>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refetch}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show validation errors
  if (validationErrors.length > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-orange-600">Data Validation Error</div>
          <div className="text-sm text-gray-500">
            {validationErrors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Prepare common props for all display components
  const displayProps = {
    widget,
    blueprint,
    data: validatedData,
    isSelected,
    styleProps,
    onDataChange: (newData: any) => {
      // Save data changes to the backend database
      const updatedContent = {
        ...widget.content,
        ...newData,
      };

      dispatch(
        updateWidget({
          id: widget.id,
          data: { content: updatedContent },
        })
      );
    },
    onRefresh: refetch,
  };

  // Render the display component
  // Note: For sticky notes, we don't apply wrapper styling to avoid white background issues
  const isNoteComponent = blueprint.viewSchema.displayComponent === 'Note';

  if (isNoteComponent) {
    // Sticky notes handle their own styling completely
    return <DisplayComponent {...displayProps} />;
  }

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: blueprint.settings.backgroundColor || styleProps.backgroundColor,
        color: blueprint.settings.textColor || styleProps.textColor,
        fontSize: blueprint.settings.fontSize || styleProps.fontSize,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <DisplayComponent {...displayProps} />
    </div>
  );
}
