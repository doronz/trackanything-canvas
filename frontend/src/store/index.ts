import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from './dashboardSlice';
import widgetReducer from './widgetSlice';
import canvasReducer from './canvasSlice';
import mcpReducer from './mcpSlice';
import aiConfigReducer from './aiConfigSlice';
import uiReducer from './uiSlice';
import connectionReducer from './connectionSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    widget: widgetReducer,
    canvas: canvasReducer,
    mcp: mcpReducer,
    aiConfig: aiConfigReducer,
    ui: uiReducer,
    connection: connectionReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
