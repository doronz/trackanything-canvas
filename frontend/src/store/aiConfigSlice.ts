import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AIConfig, AIConfigUpdateData } from '@/types';
import { aiConfigAPI } from '@/services/api';

interface AIConfigState {
  configs: AIConfig[];
  defaultConfig?: AIConfig;
  loading: boolean;
  error: string | null;
  testing: Record<number, boolean>;
}

const initialState: AIConfigState = {
  configs: [],
  loading: false,
  error: null,
  testing: {},
};

// Async thunks
export const fetchAIConfigs = createAsyncThunk('aiConfig/fetchConfigs', async () => {
  const response = await aiConfigAPI.list();
  return response.data;
});

export const createAIConfig = createAsyncThunk(
  'aiConfig/createConfig',
  async (data: {
    name: string;
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
    model: string;
    api_key: string;
    api_endpoint?: string;
    parameters?: Record<string, any>;
    is_default?: boolean;
  }) => {
    const response = await aiConfigAPI.create(data);
    return response.data;
  }
);

export const updateAIConfig = createAsyncThunk(
  'aiConfig/updateConfig',
  async ({ id, data }: { id: number; data: AIConfigUpdateData }) => {
    const response = await aiConfigAPI.update(id, data);
    return response.data;
  }
);

export const deleteAIConfig = createAsyncThunk('aiConfig/deleteConfig', async (id: number) => {
  await aiConfigAPI.delete(id);
  return id;
});

export const testAIConfig = createAsyncThunk('aiConfig/testConfig', async (id: number) => {
  const response = await aiConfigAPI.test(id);
  return { id, result: response.data };
});

export const setDefaultAIConfig = createAsyncThunk('aiConfig/setDefault', async (id: number) => {
  const response = await aiConfigAPI.setDefault(id);
  return { id, message: response.data.message };
});

export const fetchDefaultAIConfig = createAsyncThunk('aiConfig/fetchDefault', async () => {
  const response = await aiConfigAPI.getDefault();
  return response.data;
});

export const fetchSupportedProviders = createAsyncThunk('aiConfig/fetchProviders', async () => {
  const response = await aiConfigAPI.getSupportedProviders();
  return response.data;
});

export const fetchProviderModels = createAsyncThunk(
  'aiConfig/fetchProviderModels',
  async ({
    provider,
    apiKey,
    apiEndpoint,
  }: {
    provider: string;
    apiKey?: string;
    apiEndpoint?: string;
  }) => {
    const response = await aiConfigAPI.fetchProviderModels(provider, apiKey, apiEndpoint);
    return response.data;
  }
);

const aiConfigSlice = createSlice({
  name: 'aiConfig',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },

    setTesting: (state, action: PayloadAction<{ configId: number; testing: boolean }>) => {
      const { configId, testing } = action.payload;
      state.testing[configId] = testing;
    },

    updateConfigParameters: (
      state,
      action: PayloadAction<{
        configId: number;
        parameters: Record<string, any>;
      }>
    ) => {
      const { configId, parameters } = action.payload;
      const config = state.configs.find(c => c.id === configId);
      if (config) {
        config.parameters = { ...config.parameters, ...parameters };
      }
    },

    updateConfigModel: (
      state,
      action: PayloadAction<{
        configId: number;
        model: string;
      }>
    ) => {
      const { configId, model } = action.payload;
      const config = state.configs.find(c => c.id === configId);
      if (config) {
        config.model = model;
      }
    },

    toggleDefault: (state, action: PayloadAction<number>) => {
      const configId = action.payload;

      // Unset all other defaults
      state.configs.forEach(config => {
        config.is_default = config.id === configId;
      });

      // Update the default config reference
      state.defaultConfig = state.configs.find(c => c.id === configId);
    },
  },
  extraReducers: builder => {
    builder
      // Fetch configs
      .addCase(fetchAIConfigs.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAIConfigs.fulfilled, (state, action) => {
        state.loading = false;
        state.configs = action.payload;
        state.defaultConfig = action.payload.find(c => c.is_default);
      })
      .addCase(fetchAIConfigs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch AI configurations';
      })

      // Create config
      .addCase(createAIConfig.fulfilled, (state, action) => {
        state.configs.push(action.payload);

        // If this is set as default, update default config
        if (action.payload.is_default) {
          // Unset other defaults
          state.configs.forEach(config => {
            if (config.id !== action.payload.id) {
              config.is_default = false;
            }
          });
          state.defaultConfig = action.payload;
        }
      })
      .addCase(createAIConfig.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create AI configuration';
      })

      // Update config
      .addCase(updateAIConfig.fulfilled, (state, action) => {
        const index = state.configs.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.configs[index] = action.payload;

          // Update default if this config is default
          if (action.payload.is_default) {
            state.defaultConfig = action.payload;
          }
        }
      })
      .addCase(updateAIConfig.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update AI configuration';
      })

      // Delete config
      .addCase(deleteAIConfig.fulfilled, (state, action) => {
        state.configs = state.configs.filter(c => c.id !== action.payload);

        // Clear default if deleted config was default
        if (state.defaultConfig?.id === action.payload) {
          state.defaultConfig = undefined;
        }
      })

      // Test config
      .addCase(testAIConfig.pending, (state, action) => {
        const configId = action.meta.arg;
        state.testing[configId] = true;
      })
      .addCase(testAIConfig.fulfilled, (state, action) => {
        const { id } = action.payload;
        state.testing[id] = false;
      })
      .addCase(testAIConfig.rejected, (state, action) => {
        const configId = action.meta.arg;
        state.testing[configId] = false;
        state.error = action.error.message || 'AI configuration test failed';
      })

      // Set default
      .addCase(setDefaultAIConfig.fulfilled, (state, action) => {
        const { id } = action.payload;

        // Update all configs
        state.configs.forEach(config => {
          config.is_default = config.id === id;
        });

        // Update default config reference
        state.defaultConfig = state.configs.find(c => c.id === id);
      })

      // Fetch default
      .addCase(fetchDefaultAIConfig.fulfilled, (state, action) => {
        state.defaultConfig = action.payload;
      });
  },
});

export const { clearError, setTesting, updateConfigParameters, updateConfigModel, toggleDefault } =
  aiConfigSlice.actions;

export default aiConfigSlice.reducer;
