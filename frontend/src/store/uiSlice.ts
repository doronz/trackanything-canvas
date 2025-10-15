import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarCollapsed: boolean;
  selectedWidgetId?: number;
  theme: 'light' | 'dark';
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showRulers: boolean;
  showZoomControls: boolean;
  showMinimap: boolean;

  // Modal states
  modals: {
    createDashboard: boolean;
    editDashboard: boolean;
    dashboardSettings: boolean;
    widgetSettings: boolean;
    mcpServerConfig: boolean;
    aiConfig: boolean;
    templateManager: boolean;
    importExport: boolean;
    widgetImportExport: boolean;
    widgetBuilder: boolean;
    widgetLibrary: boolean;
  };

  // Edit dashboard state
  editDashboard: {
    dashboardId?: number;
  };

  // Widget import/export state
  widgetImportExport: {
    widgetId?: number;
    referencePosition?: { x: number; y: number };
    exportOnly?: boolean;
  };

  // Toast notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  }>;

  // Loading states
  loading: {
    global: boolean;
    dashboard: boolean;
    widgets: boolean;
    mcp: boolean;
  };

  // Tool states
  activeTool: 'hand' | 'select' | 'pan' | 'zoom' | 'add-widget';
  widgetLibraryOpen: boolean;
  propertyPanelOpen: boolean;

  // Widget settings panel
  widgetSettingsPanel: {
    open: boolean;
    widgetId?: number;
  };

  // Keyboard shortcuts
  keyboardShortcuts: boolean;

  // Performance settings
  performanceMode: boolean;
  maxWidgetsVisible: number;
}

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: 'light',
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,
  showRulers: false,
  showZoomControls: true,
  showMinimap: false,

  modals: {
    createDashboard: false,
    editDashboard: false,
    dashboardSettings: false,
    widgetSettings: false,
    mcpServerConfig: false,
    aiConfig: false,
    templateManager: false,
    importExport: false,
    widgetImportExport: false,
    widgetBuilder: false,
    widgetLibrary: false,
  },

  editDashboard: {},

  widgetImportExport: {},

  notifications: [],

  loading: {
    global: false,
    dashboard: false,
    widgets: false,
    mcp: false,
  },

  activeTool: 'hand',
  widgetLibraryOpen: false,
  propertyPanelOpen: false,

  widgetSettingsPanel: {
    open: false,
    widgetId: undefined,
  },

  keyboardShortcuts: true,
  performanceMode: false,
  maxWidgetsVisible: 100,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sidebar
    toggleSidebar: state => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    // Theme
    toggleTheme: state => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },

    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },

    // Grid and snapping
    toggleGrid: state => {
      state.showGrid = !state.showGrid;
    },

    setShowGrid: (state, action: PayloadAction<boolean>) => {
      state.showGrid = action.payload;
    },

    toggleSnapToGrid: state => {
      state.snapToGrid = !state.snapToGrid;
    },

    setSnapToGrid: (state, action: PayloadAction<boolean>) => {
      state.snapToGrid = action.payload;
    },

    setGridSize: (state, action: PayloadAction<number>) => {
      state.gridSize = Math.max(10, Math.min(50, action.payload));
    },

    // Tools and panels
    setActiveTool: (state, action: PayloadAction<UIState['activeTool']>) => {
      state.activeTool = action.payload;
    },

    toggleWidgetLibrary: state => {
      state.widgetLibraryOpen = !state.widgetLibraryOpen;
    },

    setWidgetLibraryOpen: (state, action: PayloadAction<boolean>) => {
      state.widgetLibraryOpen = action.payload;
    },

    togglePropertyPanel: state => {
      state.propertyPanelOpen = !state.propertyPanelOpen;
    },

    setPropertyPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.propertyPanelOpen = action.payload;
    },

    // Widget Settings Panel
    openWidgetSettingsPanel: (state, action: PayloadAction<number>) => {
      state.widgetSettingsPanel.open = true;
      state.widgetSettingsPanel.widgetId = action.payload;
    },

    closeWidgetSettingsPanel: state => {
      state.widgetSettingsPanel.open = false;
      state.widgetSettingsPanel.widgetId = undefined;
    },

    // Modals
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true;
    },

    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false;
    },

    closeAllModals: state => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key as keyof UIState['modals']] = false;
      });
    },

    // Widget Import/Export
    openWidgetImportExportModal: (
      state,
      action: PayloadAction<
        | { widgetId?: number; referencePosition?: { x: number; y: number }; exportOnly?: boolean }
        | number
        | undefined
      >
    ) => {
      state.modals.widgetImportExport = true;
      if (typeof action.payload === 'number' || action.payload === undefined) {
        // Backward compatibility: if payload is just a number or undefined
        state.widgetImportExport.widgetId = action.payload;
        state.widgetImportExport.referencePosition = undefined;
        state.widgetImportExport.exportOnly = false;
      } else {
        // New format with position information
        state.widgetImportExport.widgetId = action.payload.widgetId;
        state.widgetImportExport.referencePosition = action.payload.referencePosition;
        state.widgetImportExport.exportOnly = action.payload.exportOnly || false;
      }
    },

    closeWidgetImportExportModal: state => {
      state.modals.widgetImportExport = false;
      state.widgetImportExport = {};
    },

    // Edit Dashboard
    openEditDashboardModal: (state, action: PayloadAction<number>) => {
      state.modals.editDashboard = true;
      state.editDashboard.dashboardId = action.payload;
    },

    closeEditDashboardModal: state => {
      state.modals.editDashboard = false;
      state.editDashboard = {};
    },

    // Notifications
    addNotification: (
      state,
      action: PayloadAction<{
        type: 'success' | 'error' | 'warning' | 'info';
        message: string;
        duration?: number;
      }>
    ) => {
      const notification = {
        id: Date.now().toString(),
        duration: 4000,
        ...action.payload,
      };
      state.notifications.push(notification);
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },

    clearNotifications: state => {
      state.notifications = [];
    },

    // Loading states
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },

    setDashboardLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.dashboard = action.payload;
    },

    setWidgetsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.widgets = action.payload;
    },

    setMcpLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.mcp = action.payload;
    },

    // View options
    toggleRulers: state => {
      state.showRulers = !state.showRulers;
    },

    setShowRulers: (state, action: PayloadAction<boolean>) => {
      state.showRulers = action.payload;
    },

    toggleZoomControls: state => {
      state.showZoomControls = !state.showZoomControls;
    },

    setShowZoomControls: (state, action: PayloadAction<boolean>) => {
      state.showZoomControls = action.payload;
    },

    toggleMinimap: state => {
      state.showMinimap = !state.showMinimap;
    },

    setShowMinimap: (state, action: PayloadAction<boolean>) => {
      state.showMinimap = action.payload;
    },

    // Settings
    toggleKeyboardShortcuts: state => {
      state.keyboardShortcuts = !state.keyboardShortcuts;
    },

    setKeyboardShortcuts: (state, action: PayloadAction<boolean>) => {
      state.keyboardShortcuts = action.payload;
    },

    togglePerformanceMode: state => {
      state.performanceMode = !state.performanceMode;
    },

    setPerformanceMode: (state, action: PayloadAction<boolean>) => {
      state.performanceMode = action.payload;
    },

    setMaxWidgetsVisible: (state, action: PayloadAction<number>) => {
      state.maxWidgetsVisible = Math.max(10, action.payload);
    },

    // Presets
    applyLightThemePreset: state => {
      state.theme = 'light';
      state.showGrid = true;
      state.gridSize = 20;
    },

    applyDarkThemePreset: state => {
      state.theme = 'dark';
      state.showGrid = true;
      state.gridSize = 20;
    },

    applyMinimalUIPreset: state => {
      state.showRulers = false;
      state.showZoomControls = false;
      state.showMinimap = false;
      state.sidebarCollapsed = true;
    },

    applyFullUIPreset: state => {
      state.showRulers = true;
      state.showZoomControls = true;
      state.showMinimap = true;
      state.sidebarCollapsed = false;
      state.propertyPanelOpen = true;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleTheme,
  setTheme,
  toggleGrid,
  setShowGrid,
  toggleSnapToGrid,
  setSnapToGrid,
  setGridSize,
  setActiveTool,
  toggleWidgetLibrary,
  setWidgetLibraryOpen,
  togglePropertyPanel,
  setPropertyPanelOpen,
  openWidgetSettingsPanel,
  closeWidgetSettingsPanel,
  openModal,
  closeModal,
  closeAllModals,
  openWidgetImportExportModal,
  closeWidgetImportExportModal,
  openEditDashboardModal,
  closeEditDashboardModal,
  addNotification,
  removeNotification,
  clearNotifications,
  setGlobalLoading,
  setDashboardLoading,
  setWidgetsLoading,
  setMcpLoading,
  toggleRulers,
  setShowRulers,
  toggleZoomControls,
  setShowZoomControls,
  toggleMinimap,
  setShowMinimap,
  toggleKeyboardShortcuts,
  setKeyboardShortcuts,
  togglePerformanceMode,
  setPerformanceMode,
  setMaxWidgetsVisible,
  applyLightThemePreset,
  applyDarkThemePreset,
  applyMinimalUIPreset,
  applyFullUIPreset,
} = uiSlice.actions;

export default uiSlice.reducer;
