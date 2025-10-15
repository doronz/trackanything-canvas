import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Dashboard, CanvasState } from '@/types';
import { dashboardAPI } from '@/services/api';

interface DashboardState {
  dashboards: Dashboard[];
  currentDashboardId: number | null;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  dashboards: [],
  currentDashboardId: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchDashboards = createAsyncThunk('dashboard/fetchDashboards', async () => {
  const response = await dashboardAPI.list();
  return response.data;
});

export const createDashboard = createAsyncThunk(
  'dashboard/createDashboard',
  async (data: { name: string; description?: string }) => {
    const response = await dashboardAPI.create(data);
    return response.data;
  }
);

export const updateDashboard = createAsyncThunk(
  'dashboard/updateDashboard',
  async ({ id, data }: { id: number; data: Partial<Dashboard> }) => {
    const response = await dashboardAPI.update(id, data);
    return response.data;
  }
);

export const deleteDashboard = createAsyncThunk('dashboard/deleteDashboard', async (id: number) => {
  await dashboardAPI.delete(id);
  return id;
});

export const duplicateDashboard = createAsyncThunk(
  'dashboard/duplicateDashboard',
  async (id: number) => {
    const response = await dashboardAPI.duplicate(id);
    return response.data;
  }
);

export const updateCanvasState = createAsyncThunk(
  'dashboard/updateCanvasState',
  async ({ id, canvasState }: { id: number; canvasState: CanvasState }) => {
    const response = await dashboardAPI.update(id, { canvas_state: canvasState });
    return { id, canvasState };
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setCurrentDashboard: (state, action: PayloadAction<number>) => {
      state.currentDashboardId = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    reorderDashboards: (state, action: PayloadAction<number[]>) => {
      const orderedDashboards = action.payload
        .map(id => state.dashboards.find(d => d.id === id))
        .filter(Boolean) as Dashboard[];
      state.dashboards = orderedDashboards;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch dashboards
      .addCase(fetchDashboards.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboards.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboards = action.payload;
      })
      .addCase(fetchDashboards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch dashboards';
      })

      // Create dashboard
      .addCase(createDashboard.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboards.unshift(action.payload);
        state.currentDashboardId = action.payload.id;
      })
      .addCase(createDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create dashboard';
      })

      // Update dashboard
      .addCase(updateDashboard.fulfilled, (state, action) => {
        const index = state.dashboards.findIndex(d => d.id === action.payload.id);
        if (index !== -1) {
          state.dashboards[index] = action.payload;
        }
      })

      // Delete dashboard
      .addCase(deleteDashboard.fulfilled, (state, action) => {
        state.dashboards = state.dashboards.filter(d => d.id !== action.payload);
        if (state.currentDashboardId === action.payload) {
          state.currentDashboardId = state.dashboards.length > 0 ? state.dashboards[0].id : null;
        }
      })

      // Duplicate dashboard
      .addCase(duplicateDashboard.fulfilled, (state, action) => {
        state.dashboards.unshift(action.payload);
        state.currentDashboardId = action.payload.id;
      })

      // Update canvas state
      .addCase(updateCanvasState.fulfilled, (state, action) => {
        const { id, canvasState } = action.payload;
        const dashboard = state.dashboards.find(d => d.id === id);
        if (dashboard) {
          dashboard.canvas_state = canvasState;
        }
      });
  },
});

export const { setCurrentDashboard, clearError, reorderDashboards } = dashboardSlice.actions;
export default dashboardSlice.reducer;
