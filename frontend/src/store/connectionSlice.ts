import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WidgetConnection, CreateConnectionRequest, CreateConnectionWithAIRequest } from '@/types';
import connectionService from '@/services/connectionService';
import { deleteWidget } from './widgetSlice';

interface ConnectionState {
  connections: WidgetConnection[];
  loading: boolean;
  error: string | null;
  creatingConnection: boolean;
  showConnectionModal: boolean;
  selectedSourceWidget: number | null;
  selectedConnectionDirection: 'right' | 'left' | 'top' | 'bottom' | null;
  selectedConnectionId: number | null;
  lastUpdated: number; // Timestamp for forcing re-renders
}

const initialState: ConnectionState = {
  connections: [],
  loading: false,
  error: null,
  creatingConnection: false,
  showConnectionModal: false,
  selectedSourceWidget: null,
  selectedConnectionDirection: null,
  selectedConnectionId: null,
  lastUpdated: Date.now(),
};

// Async thunks
export const fetchDashboardConnections = createAsyncThunk(
  'connections/fetchDashboard',
  async (dashboardId: number) => {
    return await connectionService.getDashboardConnections(dashboardId);
  }
);

export const createConnection = createAsyncThunk(
  'connections/create',
  async (request: CreateConnectionRequest) => {
    return await connectionService.createConnection(request);
  }
);

export const createConnectionWithAI = createAsyncThunk(
  'connections/createWithAI',
  async (request: CreateConnectionWithAIRequest) => {
    const result = await connectionService.createConnectionWithAI(request);
    return result;
  }
);

export const updateConnection = createAsyncThunk(
  'connections/update',
  async ({ id, updates }: { id: number; updates: Partial<WidgetConnection> }) => {
    return await connectionService.updateConnection(id, updates);
  }
);

export const deleteConnection = createAsyncThunk(
  'connections/delete',
  async (connectionId: number) => {
    await connectionService.deleteConnection(connectionId);
    return connectionId;
  }
);

export const syncConnectionData = createAsyncThunk(
  'connections/syncData',
  async (connectionId: number) => {
    await connectionService.syncConnectionData(connectionId);
    return connectionId;
  }
);

const connectionSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    showConnectionModal: (
      state,
      action: PayloadAction<{ widgetId: number; direction: 'right' | 'left' | 'top' | 'bottom' }>
    ) => {
      state.showConnectionModal = true;
      state.selectedSourceWidget = action.payload.widgetId;
      state.selectedConnectionDirection = action.payload.direction;
    },
    hideConnectionModal: state => {
      state.showConnectionModal = false;
      state.selectedSourceWidget = null;
      state.selectedConnectionDirection = null;
    },
    setSelectedSourceWidget: (state, action: PayloadAction<number | null>) => {
      state.selectedSourceWidget = action.payload;
    },
    selectConnection: (state, action: PayloadAction<number>) => {
      state.selectedConnectionId = action.payload;
    },
    deselectConnection: state => {
      state.selectedConnectionId = null;
    },
    forceRefreshConnections: state => {
      state.lastUpdated = Date.now();
    },
  },
  extraReducers: builder => {
    builder
      // Fetch dashboard connections
      .addCase(fetchDashboardConnections.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardConnections.fulfilled, (state, action) => {
        state.loading = false;
        state.connections = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchDashboardConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch connections';
      })

      // Create connection
      .addCase(createConnection.pending, state => {
        state.creatingConnection = true;
        state.error = null;
      })
      .addCase(createConnection.fulfilled, (state, action) => {
        state.creatingConnection = false;
        state.connections.push(action.payload);
        state.lastUpdated = Date.now();
      })
      .addCase(createConnection.rejected, (state, action) => {
        state.creatingConnection = false;
        state.error = action.error.message || 'Failed to create connection';
      })

      // Create connection with AI
      .addCase(createConnectionWithAI.pending, state => {
        state.creatingConnection = true;
        state.error = null;
      })
      .addCase(createConnectionWithAI.fulfilled, (state, action) => {
        state.creatingConnection = false;
        state.connections.push(action.payload.connection);
        state.lastUpdated = Date.now();
        // The widget creation will be handled by the widget slice
      })
      .addCase(createConnectionWithAI.rejected, (state, action) => {
        state.creatingConnection = false;
        state.error = action.error.message || 'Failed to create AI connection';
      })

      // Update connection
      .addCase(updateConnection.fulfilled, (state, action) => {
        const index = state.connections.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.connections[index] = action.payload;
          state.lastUpdated = Date.now();
        }
      })

      // Delete connection
      .addCase(deleteConnection.fulfilled, (state, action) => {
        state.connections = state.connections.filter(c => c.id !== action.payload);
        state.lastUpdated = Date.now();
      })

      // Sync connection data
      .addCase(syncConnectionData.pending, state => {
        state.error = null;
      })
      .addCase(syncConnectionData.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to sync connection data';
      })

      // Handle widget deletion - remove related connections
      .addCase(deleteWidget.fulfilled, (state, action) => {
        const deletedWidgetId = action.payload;
        // Remove connections where the deleted widget is either source or target
        const oldConnectionsCount = state.connections.length;
        state.connections = state.connections.filter(
          connection =>
            connection.source_widget_id !== deletedWidgetId &&
            connection.target_widget_id !== deletedWidgetId
        );
        // Only update timestamp if connections were actually removed
        if (state.connections.length !== oldConnectionsCount) {
          state.lastUpdated = Date.now();
        }
        // Clear selection if deleted widget connection was selected
        if (state.selectedConnectionId) {
          const selectedConnection = state.connections.find(
            c => c.id === state.selectedConnectionId
          );
          if (!selectedConnection) {
            state.selectedConnectionId = null;
          }
        }
      });
  },
});

export const {
  clearError,
  showConnectionModal,
  hideConnectionModal,
  setSelectedSourceWidget,
  selectConnection,
  deselectConnection,
  forceRefreshConnections,
} = connectionSlice.actions;

export default connectionSlice.reducer;
