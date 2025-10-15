import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CanvasState } from '@/types';

interface CanvasSliceState extends CanvasState {
  isDragging: boolean;
  isSelecting: boolean;
  selectionBox?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  cursor: 'default' | 'grab' | 'grabbing' | 'crosshair';
}

const initialState: CanvasSliceState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  viewport: { width: 1920, height: 1080 },
  isDragging: false,
  isSelecting: false,
  cursor: 'default',
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.1, Math.min(5, action.payload));
    },

    zoomIn: (state, _action) => {
      state.zoom = Math.min(5, state.zoom * 1.2);
    },

    zoomOut: (state, _action) => {
      state.zoom = Math.max(0.1, state.zoom / 1.2);
    },

    zoomToFit: (state, action: PayloadAction<{ width: number; height: number }>) => {
      const { width, height } = action.payload;
      const scaleX = state.viewport.width / width;
      const scaleY = state.viewport.height / height;
      state.zoom = Math.min(scaleX, scaleY, 1);
      state.pan = { x: 0, y: 0 };
    },

    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },

    panBy: (state, action: PayloadAction<{ deltaX: number; deltaY: number }>) => {
      state.pan.x += action.payload.deltaX;
      state.pan.y += action.payload.deltaY;
    },

    setViewport: (state, action: PayloadAction<{ width: number; height: number }>) => {
      state.viewport = action.payload;
    },

    resetView: (state, _action) => {
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
    },

    setDragging: (state, action: PayloadAction<boolean>) => {
      state.isDragging = action.payload;
      state.cursor = action.payload ? 'grabbing' : 'grab';
    },

    setSelecting: (state, action: PayloadAction<boolean>) => {
      state.isSelecting = action.payload;
      if (!action.payload) {
        state.selectionBox = undefined;
      }
    },

    setSelectionBox: (
      state,
      action: PayloadAction<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      }>
    ) => {
      state.selectionBox = action.payload;
    },

    setCursor: (state, action: PayloadAction<CanvasSliceState['cursor']>) => {
      state.cursor = action.payload;
    },

    // Zoom to specific point (mouse position)
    zoomToPoint: (
      state,
      action: PayloadAction<{
        zoom: number;
        clientX: number;
        clientY: number;
      }>
    ) => {
      const { zoom, clientX, clientY } = action.payload;

      // Calculate the world position before zoom
      const worldX = (clientX - state.viewport.width / 2 - state.pan.x) / state.zoom;
      const worldY = (clientY - state.viewport.height / 2 - state.pan.y) / state.zoom;

      // Update zoom
      const newZoom = Math.max(0.1, Math.min(5, zoom));

      // Calculate new pan to keep the same world position under the mouse
      const newPanX = clientX - state.viewport.width / 2 - worldX * newZoom;
      const newPanY = clientY - state.viewport.height / 2 - worldY * newZoom;

      state.zoom = newZoom;
      state.pan = { x: newPanX, y: newPanY };
    },

    // Center view on a specific widget or world position
    centerOnWidget: (
      state,
      action: PayloadAction<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    ) => {
      const { x, y, width, height } = action.payload;

      // Calculate the center of the widget
      const widgetCenterX = x + width / 2;
      const widgetCenterY = y + height / 2;

      // Calculate the pan needed to center the widget in the viewport
      state.pan = {
        x: state.viewport.width / 2 - widgetCenterX * state.zoom,
        y: state.viewport.height / 2 - widgetCenterY * state.zoom,
      };
    },
  },
});

export const {
  setZoom,
  zoomIn,
  zoomOut,
  zoomToFit,
  setPan,
  panBy,
  setViewport,
  resetView,
  setDragging,
  setSelecting,
  setSelectionBox,
  setCursor,
  zoomToPoint,
  centerOnWidget,
} = canvasSlice.actions;

// Utility functions for coordinate transformation
export const screenToWorld = (
  screenX: number,
  screenY: number,
  {
    zoom,
    pan,
    viewport,
  }: { zoom: number; pan: { x: number; y: number }; viewport: { width: number; height: number } }
) => ({
  x: (screenX - viewport.width / 2 - pan.x) / zoom,
  y: (screenY - viewport.height / 2 - pan.y) / zoom,
});

export const worldToScreen = (
  worldX: number,
  worldY: number,
  {
    zoom,
    pan,
    viewport,
  }: { zoom: number; pan: { x: number; y: number }; viewport: { width: number; height: number } }
) => ({
  x: worldX * zoom + pan.x + viewport.width / 2,
  y: worldY * zoom + pan.y + viewport.height / 2,
});

export default canvasSlice.reducer;
