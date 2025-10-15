import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MCPServer, MCPServerStatus } from '@/types';
import { mcpAPI } from '@/services/api';

interface MCPState {
  servers: MCPServer[];
  serverStatuses: MCPServerStatus[];
  loading: boolean;
  error: string | null;
  connecting: Record<number, boolean>;
}

const initialState: MCPState = {
  servers: [],
  serverStatuses: [],
  loading: false,
  error: null,
  connecting: {},
};

// Async thunks
export const fetchMCPServers = createAsyncThunk('mcp/fetchServers', async () => {
  const response = await mcpAPI.list();
  return response.data;
});

export const createMCPServer = createAsyncThunk(
  'mcp/createServer',
  async (data: {
    name: string;
    transport: 'stdio' | 'http' | 'sse';
    config: Record<string, any>;
  }) => {
    const response = await mcpAPI.create(data);
    return response.data;
  }
);

export const updateMCPServer = createAsyncThunk(
  'mcp/updateServer',
  async ({ id, data }: { id: number; data: Partial<MCPServer> }) => {
    const response = await mcpAPI.update(id, data);
    return response.data;
  }
);

export const deleteMCPServer = createAsyncThunk('mcp/deleteServer', async (id: number) => {
  await mcpAPI.delete(id);
  return id;
});

export const connectMCPServer = createAsyncThunk('mcp/connectServer', async (id: number) => {
  const response = await mcpAPI.connect(id);
  return { id, message: response.data.message };
});

export const disconnectMCPServer = createAsyncThunk('mcp/disconnectServer', async (id: number) => {
  const response = await mcpAPI.disconnect(id);
  return { id, message: response.data.message };
});

export const fetchServerStatuses = createAsyncThunk('mcp/fetchServerStatuses', async () => {
  const response = await mcpAPI.getAllStatuses();
  return response.data;
});

export const callMCPTool = createAsyncThunk(
  'mcp/callTool',
  async ({
    serverName,
    toolName,
    parameters,
  }: {
    serverName: string;
    toolName: string;
    parameters: Record<string, any>;
  }) => {
    const response = await mcpAPI.callTool(serverName, toolName, parameters);
    return response.data;
  }
);

export const listMCPResources = createAsyncThunk(
  'mcp/listResources',
  async (serverName: string) => {
    const response = await mcpAPI.listResources(serverName);
    return { serverName, resources: response.data.resources };
  }
);

export const readMCPResource = createAsyncThunk(
  'mcp/readResource',
  async ({ serverName, resourceUri }: { serverName: string; resourceUri: string }) => {
    const response = await mcpAPI.readResource(serverName, resourceUri);
    return { serverName, resourceUri, content: response.data.content };
  }
);

export const importMCPConfig = createAsyncThunk(
  'mcp/importConfig',
  async (configData: Record<string, any>) => {
    const response = await mcpAPI.importConfig(configData);
    return response.data;
  }
);

export const exportMCPConfig = createAsyncThunk('mcp/exportConfig', async () => {
  const response = await mcpAPI.exportConfig();
  return response.data;
});

const mcpSlice = createSlice({
  name: 'mcp',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },

    updateServerStatus: (
      state,
      action: PayloadAction<{
        serverId: number;
        status: 'connected' | 'disconnected' | 'error';
      }>
    ) => {
      const { serverId, status } = action.payload;
      const server = state.servers.find(s => s.id === serverId);
      if (server) {
        server.status = status;
        if (status === 'connected') {
          server.last_connected = new Date().toISOString();
        }
      }
    },

    setConnecting: (state, action: PayloadAction<{ serverId: number; connecting: boolean }>) => {
      const { serverId, connecting } = action.payload;
      state.connecting[serverId] = connecting;
    },

    addToolResult: (
      state,
      action: PayloadAction<{
        serverName: string;
        toolName: string;
        result: any;
        timestamp: string;
      }>
    ) => {
      // TODO: Store tool call results for history/debugging
    },

    updateServerConfig: (
      state,
      action: PayloadAction<{
        serverId: number;
        config: Record<string, any>;
      }>
    ) => {
      const { serverId, config } = action.payload;
      const server = state.servers.find(s => s.id === serverId);
      if (server) {
        server.config = { ...server.config, ...config };
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch servers
      .addCase(fetchMCPServers.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMCPServers.fulfilled, (state, action) => {
        state.loading = false;
        state.servers = action.payload;
      })
      .addCase(fetchMCPServers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch MCP servers';
      })

      // Create server
      .addCase(createMCPServer.fulfilled, (state, action) => {
        state.servers.push(action.payload);
      })
      .addCase(createMCPServer.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create MCP server';
      })

      // Update server
      .addCase(updateMCPServer.fulfilled, (state, action) => {
        const index = state.servers.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.servers[index] = action.payload;
        }
      })
      .addCase(updateMCPServer.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update MCP server';
      })

      // Delete server
      .addCase(deleteMCPServer.fulfilled, (state, action) => {
        state.servers = state.servers.filter(s => s.id !== action.payload);
      })

      // Connect server
      .addCase(connectMCPServer.pending, (state, action) => {
        const serverId = action.meta.arg;
        state.connecting[serverId] = true;
      })
      .addCase(connectMCPServer.fulfilled, (state, action) => {
        const { id } = action.payload;
        state.connecting[id] = false;
        const server = state.servers.find(s => s.id === id);
        if (server) {
          server.status = 'connected';
          server.last_connected = new Date().toISOString();
        }
      })
      .addCase(connectMCPServer.rejected, (state, action) => {
        const serverId = action.meta.arg;
        state.connecting[serverId] = false;
        state.error = action.error.message || 'Failed to connect to MCP server';
      })

      // Disconnect server
      .addCase(disconnectMCPServer.fulfilled, (state, action) => {
        const { id } = action.payload;
        const server = state.servers.find(s => s.id === id);
        if (server) {
          server.status = 'disconnected';
        }
      })

      // Fetch server statuses
      .addCase(fetchServerStatuses.fulfilled, (state, action) => {
        state.serverStatuses = action.payload;

        // Update server statuses in the servers array
        action.payload.forEach(status => {
          const server = state.servers.find(s => s.name === status.name);
          if (server) {
            server.status = status.status as any;
          }
        });
      })

      // Import config
      .addCase(importMCPConfig.fulfilled, (state, action) => {
        // Refresh servers after import
        state.loading = true;
      })
      .addCase(importMCPConfig.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to import MCP configuration';
      })

      // Tool calls and resource operations
      .addCase(callMCPTool.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to call MCP tool';
      })

      .addCase(listMCPResources.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to list MCP resources';
      })

      .addCase(readMCPResource.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to read MCP resource';
      });
  },
});

export const { clearError, updateServerStatus, setConnecting, addToolResult, updateServerConfig } =
  mcpSlice.actions;

// Async thunks are already exported individually above

export default mcpSlice.reducer;
