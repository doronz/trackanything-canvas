import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createWidget } from '@/store/widgetSlice';
import { centerOnWidget } from '@/store/canvasSlice';
import { WidgetBlueprint, DatabaseWidgetBlueprint } from '@/types';

export interface CreateWidgetParams {
  blueprint: WidgetBlueprint | DatabaseWidgetBlueprint;
  customPosition?: { x: number; y: number };
  customSize?: { width: number; height: number };
}

export function useWidgetCreation() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentDashboardId } = useSelector((state: RootState) => state.dashboard);
  const { zoom, pan, viewport } = useSelector((state: RootState) => state.canvas);
  const { widgets } = useSelector((state: RootState) => state.widget);

  // Helper function to get blueprint ID from either type
  const getBlueprintId = (
    blueprint: WidgetBlueprint | DatabaseWidgetBlueprint
  ): number | undefined => {
    return 'id' in blueprint ? blueprint.id : undefined;
  };

  const findOptimalPosition = (
    widgetWidth: number,
    widgetHeight: number,
    customPosition?: { x: number; y: number }
  ) => {
    // If custom position is provided, use it
    if (customPosition) {
      return customPosition;
    }

    // If no widgets exist, place at center
    if (widgets.length === 0) {
      const screenCenterX = viewport.width / 2;
      const screenCenterY = viewport.height / 2;
      return {
        x: (screenCenterX - pan.x) / zoom - widgetWidth / 2,
        y: (screenCenterY - pan.y) / zoom - widgetHeight / 2,
      };
    }

    // Find a position that doesn't overlap with existing widgets
    const checkOverlap = (x: number, y: number) => {
      return widgets.some(widget => {
        const right = x + widgetWidth;
        const bottom = y + widgetHeight;
        const widgetRight = widget.x + widget.width;
        const widgetBottom = widget.y + widget.height;

        return !(right <= widget.x || x >= widgetRight || bottom <= widget.y || y >= widgetBottom);
      });
    };

    // Try positions near existing widgets with padding
    const padding = 50;
    for (const existingWidget of widgets) {
      // Try to the right
      let testX = existingWidget.x + existingWidget.width + padding;
      let testY = existingWidget.y;
      if (!checkOverlap(testX, testY)) {
        return { x: testX, y: testY };
      }

      // Try below
      testX = existingWidget.x;
      testY = existingWidget.y + existingWidget.height + padding;
      if (!checkOverlap(testX, testY)) {
        return { x: testX, y: testY };
      }

      // Try to the left
      testX = existingWidget.x - widgetWidth - padding;
      testY = existingWidget.y;
      if (!checkOverlap(testX, testY)) {
        return { x: testX, y: testY };
      }

      // Try above
      testX = existingWidget.x;
      testY = existingWidget.y - widgetHeight - padding;
      if (!checkOverlap(testX, testY)) {
        return { x: testX, y: testY };
      }
    }

    // If no good position found, place at center offset
    const screenCenterX = viewport.width / 2;
    const screenCenterY = viewport.height / 2;
    return {
      x: (screenCenterX - pan.x) / zoom - widgetWidth / 2 + widgets.length * 20,
      y: (screenCenterY - pan.y) / zoom - widgetHeight / 2 + widgets.length * 20,
    };
  };

  const createWidgetFromBlueprint = async ({
    blueprint,
    customPosition,
    customSize,
  }: CreateWidgetParams): Promise<boolean> => {
    if (!currentDashboardId) {
      console.error('No dashboard selected');
      return false;
    }

    const blueprintId = getBlueprintId(blueprint);
    if (!blueprint || blueprintId === undefined) {
      console.error('Invalid blueprint provided');
      return false;
    }

    try {
      // Use blueprint default dimensions if available, otherwise use defaults
      const blueprintSettings = blueprint.settings || {};
      const defaultWidth = blueprintSettings.defaultWidth || 512;
      const defaultHeight = blueprintSettings.defaultHeight || 384;

      const widgetWidth = customSize?.width || defaultWidth;
      const widgetHeight = customSize?.height || defaultHeight;

      // Find optimal position
      const { x, y } = findOptimalPosition(widgetWidth, widgetHeight, customPosition);

      // Determine initial content based on Universal Widget System
      const getInitialContent = (blueprint: any) => {
        // Check if this is a Universal Widget (v2.0)
        if (blueprint.widget_version === '2.0' && blueprint.view_schema) {
          const displayComponent = blueprint.view_schema.displayComponent;

          switch (displayComponent) {
            case 'Note':
            case 'Text':
              // For text-based widgets, create object with content field
              return { content: '' };
            case 'Gallery':
            case 'Video':
            case 'Iframe':
              // For media widgets, create empty object (validation will handle required fields gracefully)
              return {};
            case 'Todo':
              // For Todo: object with items array that will hold items with {text, completed} fields
              return { items: [] };
            case 'Chat':
              // For Chat: object with messages array that will hold items with {message, role, timestamp} fields
              return { messages: [] };
            case 'Cards':
              // For Cards: object with cards array that will hold items with {front, back} fields
              return { cards: [] };
            case 'Spreadsheet':
              // For Spreadsheet: object with columns and rows arrays
              return {
                columns: ['Column 1', 'Column 2', 'Column 3'],
                rows: [
                  ['', '', ''],
                  ['', '', ''],
                ],
              };
            case 'Weather':
              // For Weather: object with weather settings
              return {
                city: 'New York, NY',
                units: 'celsius',
                refreshInterval: 10,
              };
            case 'Clock':
              // For Clock: object with timezone settings
              return {
                timezones: ['America/New_York', 'Europe/London', 'Asia/Tokyo'],
                timeFormat: '12-hour',
                showSeconds: true,
                showDate: true,
              };
            case 'Markdown':
              // For Markdown: object with markdown content
              return {
                markdown: '# Welcome to Markdown Editor\n\nStart writing your markdown here...',
                lastSaved: new Date().toISOString(),
              };
            case 'Kanban':
            case 'Table':
            case 'List':
            case 'Form':
              // For data-based widgets: object with data array that will hold data items
              return { data: [] };
            default:
              return [];
          }
        }

        // Legacy compatibility - use displayLayout from old schema
        const displayLayout = blueprint.schema?.displayLayout;
        switch (displayLayout) {
          case 'form':
          case 'note':
          case 'markdown':
          case 'image':
          case 'video':
          case 'weather':
          case 'timezone':
            return {};
          case 'todo':
            return { items: [] };
          case 'chat':
            return { messages: [] };
          case 'cards':
            return { cards: [] };
          case 'kanban':
            return { columns: [] };
          case 'table':
          case 'gallery':
          default:
            return { data: [] };
        }
      };

      // Create widget from blueprint
      const result = await dispatch(
        createWidget({
          dashboard_id: currentDashboardId,
          widget_blueprint_id: blueprintId,
          title: blueprint.name,
          x,
          y,
          width: widgetWidth,
          height: widgetHeight,
          content: getInitialContent(blueprint),
          settings: blueprint.settings,
        })
      );

      // Center the canvas on the newly created widget
      if (createWidget.fulfilled.match(result)) {
        dispatch(
          centerOnWidget({
            x: result.payload.x,
            y: result.payload.y,
            width: result.payload.width,
            height: result.payload.height,
          })
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to create widget:', error);
      return false;
    }
  };

  const installWidgetFromLibrary = async (blueprint: DatabaseWidgetBlueprint): Promise<boolean> => {
    try {
      // Increment install count on backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      await fetch(`${apiUrl}/api/widget-blueprints/${blueprint.id}/install`, {
        method: 'POST',
      });

      // Create the widget
      return await createWidgetFromBlueprint({ blueprint });
    } catch (error) {
      console.error('Failed to install widget from library:', error);
      return false;
    }
  };

  return {
    createWidgetFromBlueprint,
    installWidgetFromLibrary,
    canCreateWidget: !!currentDashboardId,
    findOptimalPosition,
  };
}
