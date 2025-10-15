import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Widget } from '@/types';
import { widgetAPI } from '@/services/api';

interface WidgetState {
  widgets: Widget[];
  selectedWidgetIds: number[];
  loading: boolean;
  error: string | null;
  dragState: {
    isDragging: boolean;
    draggedWidgetId?: number;
    offset: { x: number; y: number };
  };
  resizeState: {
    isResizing: boolean;
    resizedWidgetId?: number;
    handle: string;
    startSize: { width: number; height: number };
    startPosition: { x: number; y: number };
  };
}

const initialState: WidgetState = {
  widgets: [],
  selectedWidgetIds: [],
  loading: false,
  error: null,
  dragState: {
    isDragging: false,
    offset: { x: 0, y: 0 },
  },
  resizeState: {
    isResizing: false,
    handle: '',
    startSize: { width: 0, height: 0 },
    startPosition: { x: 0, y: 0 },
  },
};

// Async thunks
export const fetchWidgets = createAsyncThunk('widget/fetchWidgets', async (dashboardId: number) => {
  const response = await widgetAPI.listByDashboard(dashboardId);
  return response.data;
});

export const createWidget = createAsyncThunk(
  'widget/createWidget',
  async (data: {
    dashboard_id: number;
    widget_blueprint_id: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
    title?: string;
    content?: Record<string, any>;
    settings?: Record<string, any>;
  }) => {
    const response = await widgetAPI.create(data);
    return response.data;
  }
);

export const updateWidget = createAsyncThunk(
  'widget/updateWidget',
  async ({
    id,
    data,
    skipBackend,
    currentWidget,
  }: {
    id: number;
    data: Partial<Widget>;
    skipBackend?: boolean;
    currentWidget?: Widget;
  }) => {
    if (skipBackend && currentWidget) {
      // Return the complete widget with updates merged in for real-time preview
      return { ...currentWidget, ...data, id };
    }
    const response = await widgetAPI.update(id, data);
    return response.data;
  }
);

export const deleteWidget = createAsyncThunk('widget/deleteWidget', async (id: number) => {
  await widgetAPI.delete(id);
  return id;
});

export const duplicateWidget = createAsyncThunk('widget/duplicateWidget', async (id: number) => {
  const response = await widgetAPI.duplicate(id);
  return response.data;
});

export const bulkUpdateWidgets = createAsyncThunk(
  'widget/bulkUpdateWidgets',
  async (updates: Array<{ id: number; data: Partial<Widget> }>) => {
    const response = await widgetAPI.bulkUpdate(updates);
    return updates; // Return the updates for optimistic UI
  }
);

const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    // Selection management
    selectWidget: (state, action: PayloadAction<number>) => {
      const widgetId = action.payload;
      if (!state.selectedWidgetIds.includes(widgetId)) {
        state.selectedWidgetIds = [widgetId];
      }
    },

    toggleWidgetSelection: (state, action: PayloadAction<number>) => {
      const widgetId = action.payload;
      const index = state.selectedWidgetIds.indexOf(widgetId);
      if (index === -1) {
        state.selectedWidgetIds.push(widgetId);
      } else {
        state.selectedWidgetIds.splice(index, 1);
      }
    },

    selectMultipleWidgets: (state, action: PayloadAction<number[]>) => {
      state.selectedWidgetIds = action.payload;
    },

    clearSelection: state => {
      state.selectedWidgetIds = [];
    },

    selectWidgetsInArea: (
      state,
      action: PayloadAction<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      }>
    ) => {
      const { startX, startY, endX, endY } = action.payload;
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const selectedIds = state.widgets
        .filter(widget => {
          const widgetLeft = widget.x;
          const widgetRight = widget.x + widget.width;
          const widgetTop = widget.y;
          const widgetBottom = widget.y + widget.height;

          return widgetLeft < maxX && widgetRight > minX && widgetTop < maxY && widgetBottom > minY;
        })
        .map(widget => widget.id);

      state.selectedWidgetIds = selectedIds;
    },

    // Drag and drop
    startDragging: (
      state,
      action: PayloadAction<{
        widgetId: number;
        offset: { x: number; y: number };
      }>
    ) => {
      state.dragState = {
        isDragging: true,
        draggedWidgetId: action.payload.widgetId,
        offset: action.payload.offset,
      };
    },

    updateDragPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      if (state.dragState.isDragging && state.dragState.draggedWidgetId) {
        const widget = state.widgets.find(w => w.id === state.dragState.draggedWidgetId);
        if (widget) {
          widget.x = action.payload.x;
          widget.y = action.payload.y;
        }
      }
    },

    stopDragging: state => {
      state.dragState = {
        isDragging: false,
        offset: { x: 0, y: 0 },
      };
    },

    // Resize
    startResizing: (
      state,
      action: PayloadAction<{
        widgetId: number;
        handle: string;
        startSize: { width: number; height: number };
        startPosition: { x: number; y: number };
      }>
    ) => {
      state.resizeState = {
        isResizing: true,
        resizedWidgetId: action.payload.widgetId,
        handle: action.payload.handle,
        startSize: action.payload.startSize,
        startPosition: action.payload.startPosition,
      };
    },

    updateResizeSize: (
      state,
      action: PayloadAction<{
        width: number;
        height: number;
        x?: number;
        y?: number;
      }>
    ) => {
      if (state.resizeState.isResizing && state.resizeState.resizedWidgetId) {
        const widget = state.widgets.find(w => w.id === state.resizeState.resizedWidgetId);
        if (widget) {
          widget.width = Math.max(100, action.payload.width);
          widget.height = Math.max(80, action.payload.height);
          if (action.payload.x !== undefined) widget.x = action.payload.x;
          if (action.payload.y !== undefined) widget.y = action.payload.y;
        }
      }
    },

    stopResizing: state => {
      state.resizeState = {
        isResizing: false,
        handle: '',
        startSize: { width: 0, height: 0 },
        startPosition: { x: 0, y: 0 },
      };
    },

    // Z-index management
    bringToFront: (state, action: PayloadAction<number>) => {
      const widgetId = action.payload;
      const maxZIndex = Math.max(...state.widgets.map(w => w.z_index));
      const widget = state.widgets.find(w => w.id === widgetId);
      if (widget && widget.z_index < maxZIndex) {
        widget.z_index = maxZIndex + 1;
      }
    },

    sendToBack: (state, action: PayloadAction<number>) => {
      const widgetId = action.payload;
      const minZIndex = Math.min(...state.widgets.map(w => w.z_index));
      const widget = state.widgets.find(w => w.id === widgetId);
      if (widget && widget.z_index > minZIndex) {
        widget.z_index = minZIndex - 1;
      }
    },

    // Content updates
    updateWidgetContent: (
      state,
      action: PayloadAction<{
        widgetId: number;
        content: Record<string, any>;
      }>
    ) => {
      const widget = state.widgets.find(w => w.id === action.payload.widgetId);
      if (widget) {
        widget.content = { ...widget.content, ...action.payload.content };
      }
    },

    updateWidgetSettings: (
      state,
      action: PayloadAction<{
        widgetId: number;
        settings: Record<string, any>;
      }>
    ) => {
      const widget = state.widgets.find(w => w.id === action.payload.widgetId);
      if (widget) {
        widget.settings = { ...widget.settings, ...action.payload.settings };
      }
    },

    // Clear all widgets (when switching dashboards)
    clearWidgets: state => {
      state.widgets = [];
      state.selectedWidgetIds = [];
    },

    // Add a widget to the state (for externally created widgets)
    addWidget: (state, action: PayloadAction<Widget>) => {
      state.widgets.push(action.payload);
      state.selectedWidgetIds = [action.payload.id];
    },
  },
  extraReducers: builder => {
    builder
      // Fetch widgets
      .addCase(fetchWidgets.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWidgets.fulfilled, (state, action) => {
        state.loading = false;
        state.widgets = action.payload;
        state.selectedWidgetIds = [];
      })
      .addCase(fetchWidgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch widgets';
      })

      // Create widget
      .addCase(createWidget.fulfilled, (state, action) => {
        state.widgets.push(action.payload);
        state.selectedWidgetIds = [action.payload.id];
      })

      // Update widget
      .addCase(updateWidget.fulfilled, (state, action) => {
        const index = state.widgets.findIndex(w => w.id === action.payload.id);
        if (index !== -1) {
          state.widgets[index] = action.payload;
        }
      })

      // Delete widget
      .addCase(deleteWidget.fulfilled, (state, action) => {
        state.widgets = state.widgets.filter(w => w.id !== action.payload);
        state.selectedWidgetIds = state.selectedWidgetIds.filter(id => id !== action.payload);
      })

      // Duplicate widget
      .addCase(duplicateWidget.fulfilled, (state, action) => {
        state.widgets.push(action.payload);
        state.selectedWidgetIds = [action.payload.id];
      })

      // Bulk update widgets
      .addCase(bulkUpdateWidgets.fulfilled, (state, action) => {
        action.payload.forEach(update => {
          const widget = state.widgets.find(w => w.id === update.id);
          if (widget) {
            Object.assign(widget, update.data);
          }
        });
      });
  },
});

export const {
  selectWidget,
  toggleWidgetSelection,
  selectMultipleWidgets,
  clearSelection,
  selectWidgetsInArea,
  startDragging,
  updateDragPosition,
  stopDragging,
  startResizing,
  updateResizeSize,
  stopResizing,
  bringToFront,
  sendToBack,
  updateWidgetContent,
  updateWidgetSettings,
  clearWidgets,
  addWidget,
} = widgetSlice.actions;

// Async thunks are already exported individually above

export default widgetSlice.reducer;
