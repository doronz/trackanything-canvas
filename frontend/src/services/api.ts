/**
 * API service layer for Canvas MCP Client.
 * This module provides centralized API access with error handling and type safety.
 */

import {
  AIConfig,
  Dashboard,
  MCPServer,
  Widget,
  WidgetExportOptions,
  WidgetImportResult,
  WidgetStandard,
} from '@/types';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create axios instance with default configuration
const createAPIClient = (): AxiosInstance => {
  const getBaseURL = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:8081`;
    }
    return 'http://localhost:8081';
  };

  const baseURL = getBaseURL();

  const client = axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for auth/logging
  client.interceptors.request.use(
    config => {
      // Add auth headers if needed
      // config.headers.Authorization = `Bearer ${getToken()}`
      return config;
    },
    error => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        // Handle authentication errors
        console.error('Authentication error');
      } else if (error.response?.status >= 500) {
        // Handle server errors
        console.error('Server error:', error.response.data);
      }
      return Promise.reject(error);
    }
  );

  return client;
};

const api = createAPIClient();

// Generic API response type
interface APIResponse<T = any> {
  data: T;
  message?: string;
}

// Dashboard API
export const dashboardAPI = {
  list: (): Promise<AxiosResponse<Dashboard[]>> => api.get('/dashboards'),

  get: (id: number): Promise<AxiosResponse<Dashboard>> => api.get(`/dashboards/${id}`),

  create: (data: { name: string; description?: string }): Promise<AxiosResponse<Dashboard>> =>
    api.post('/dashboards', data),

  update: (id: number, data: Partial<Dashboard>): Promise<AxiosResponse<Dashboard>> =>
    api.put(`/dashboards/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/dashboards/${id}`),

  duplicate: (id: number): Promise<AxiosResponse<Dashboard>> =>
    api.post(`/dashboards/${id}/duplicate`),

  export: (id: number): Promise<AxiosResponse<any>> => api.post(`/dashboards/${id}/export`),

  import: (
    data: any
  ): Promise<AxiosResponse<{ message: string; dashboard_id: number; widget_count: number }>> =>
    api.post('/dashboards/import', data),
};

// Widget API
export const widgetAPI = {
  listByDashboard: (dashboardId: number): Promise<AxiosResponse<Widget[]>> =>
    api.get(`/widgets/dashboard/${dashboardId}`),

  get: (id: number): Promise<AxiosResponse<Widget>> => api.get(`/widgets/${id}`),

  create: (data: {
    dashboard_id: number;
    widget_blueprint_id: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
    title?: string;
    content?: Record<string, any>;
    settings?: Record<string, any>;
  }): Promise<AxiosResponse<Widget>> => api.post('/widgets', data),

  update: (id: number, data: Partial<Widget>): Promise<AxiosResponse<Widget>> =>
    api.put(`/widgets/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> => api.delete(`/widgets/${id}`),

  duplicate: (id: number): Promise<AxiosResponse<Widget>> => api.post(`/widgets/${id}/duplicate`),

  bulkUpdate: (
    updates: Array<{ id: number; data: Partial<Widget> }>
  ): Promise<AxiosResponse<{ message: string }>> => api.post('/widgets/bulk-update', updates),

  // Widget Standard import/export (Legacy)
  exportWidget: (
    id: number,
    options: WidgetExportOptions
  ): Promise<AxiosResponse<WidgetStandard>> => api.post(`/widgets/${id}/export`, options),

  importWidget: (
    data: WidgetStandard,
    dashboardId: number
  ): Promise<AxiosResponse<WidgetImportResult>> =>
    api.post(`/widgets/import`, { ...data, dashboard_id: dashboardId }),

  validateWidget: (
    data: WidgetStandard
  ): Promise<AxiosResponse<{ valid: boolean; errors?: string[]; warnings?: string[] }>> =>
    api.post('/widgets/validate', data),

  // New Pluggable Widget Export/Import
  exportPluggableWidget: (id: number): Promise<AxiosResponse<any>> =>
    api.post(`/widgets/${id}/export`),

  importPluggableWidget: (data: any): Promise<AxiosResponse<Widget>> =>
    api.post('/widgets/import', data),
};

// MCP Server API
export const mcpAPI = {
  list: (): Promise<AxiosResponse<MCPServer[]>> => api.get('/mcp-servers/'),

  get: (id: number): Promise<AxiosResponse<MCPServer>> => api.get(`/mcp-servers/${id}`),

  create: (data: {
    name: string;
    transport: 'stdio' | 'http' | 'sse';
    config: Record<string, any>;
  }): Promise<AxiosResponse<MCPServer>> => api.post('/mcp-servers/', data),

  update: (id: number, data: Partial<MCPServer>): Promise<AxiosResponse<MCPServer>> =>
    api.put(`/mcp-servers/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/mcp-servers/${id}`),

  connect: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/mcp-servers/${id}/connect`),

  disconnect: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/mcp-servers/${id}/disconnect`),

  getAllStatuses: (): Promise<AxiosResponse<any[]>> => api.get('/mcp-servers/status/all'),

  callTool: (
    serverName: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<AxiosResponse<{ result: any }>> =>
    api.post(`/mcp-servers/${serverName}/tools/${toolName}/call`, parameters),

  listResources: (serverName: string): Promise<AxiosResponse<{ resources: any[] }>> =>
    api.get(`/mcp-servers/${serverName}/resources`),

  readResource: (
    serverName: string,
    resourceUri: string
  ): Promise<AxiosResponse<{ content: any }>> =>
    api.get(`/mcp-servers/${serverName}/resources/${encodeURIComponent(resourceUri)}`),

  importConfig: (configData: Record<string, any>): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/mcp-servers/import-config', configData),

  exportConfig: (): Promise<AxiosResponse<Record<string, any>>> =>
    api.get('/mcp-servers/export/config'),

  testConfig: (data: {
    transport: 'stdio' | 'http' | 'sse';
    config: Record<string, any>;
  }): Promise<AxiosResponse<{ status: string; message: string }>> =>
    api.post('/mcp-servers/test-config', data),
};

// MCP Directory API
export const mcpDirectoryAPI = {
  search: (params?: {
    query?: string;
    category?: string;
    programming_language?: string;
    tags?: string;
    is_official?: boolean;
    min_stars?: number;
    server_type?: string;
    page?: number;
    per_page?: number;
  }): Promise<
    AxiosResponse<{
      servers: any[];
      total_count: number;
      page: number;
      per_page: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    }>
  > => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.append('query', params.query);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.programming_language)
      searchParams.append('programming_language', params.programming_language);
    if (params?.tags) searchParams.append('tags', params.tags);
    if (params?.is_official !== undefined)
      searchParams.append('is_official', params.is_official.toString());
    if (params?.min_stars) searchParams.append('min_stars', params.min_stars.toString());
    if (params?.server_type) searchParams.append('server_type', params.server_type);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());

    return api.get(`/mcp-directory/search?${searchParams.toString()}`);
  },

  get: (id: number): Promise<AxiosResponse<any>> => api.get(`/mcp-directory/${id}`),

  getCategories: (): Promise<AxiosResponse<string[]>> => api.get('/mcp-directory/categories'),

  getProgrammingLanguages: (): Promise<AxiosResponse<string[]>> =>
    api.get('/mcp-directory/programming-languages'),

  getTags: (): Promise<AxiosResponse<string[]>> => api.get('/mcp-directory/tags'),

  getStats: (): Promise<
    AxiosResponse<{
      total_servers: number;
      categories: Array<{ name: string; count: number }>;
      programming_languages: Array<{ name: string; count: number }>;
      popular_tags: Array<{ name: string; count: number }>;
      last_updated: string;
    }>
  > => api.get('/mcp-directory/stats'),

  refresh: (): Promise<
    AxiosResponse<{
      message: string;
      total_servers: number;
      last_updated: string;
      output: string;
    }>
  > => api.post('/mcp-directory/refresh'),

  getInstallConfig: (
    id: number
  ): Promise<
    AxiosResponse<{
      server_info: {
        name: string;
        github_url: string;
        description: string;
        programming_language: string;
        tags: string[];
      };
      installation: {
        commands: string[];
        instructions: string;
      };
      configuration: {
        suggested_config: Record<string, any>;
        required_env_vars: string[];
        optional_env_vars: string[];
      };
      capabilities: {
        tools: string[];
        resources: string[];
      };
    }>
  > => api.get(`/mcp-directory/${id}/install-config`),
};

// MCP Registry API (Official Anthropic Registry)
export const mcpRegistryAPI = {
  listServers: (params?: {
    category?: string;
    is_official?: boolean;
    verified_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<any[]>> => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.is_official !== undefined)
      searchParams.append('is_official', params.is_official.toString());
    if (params?.verified_only !== undefined)
      searchParams.append('verified_only', params.verified_only.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    return api.get(`/mcp-registry/servers?${searchParams.toString()}`);
  },

  getServer: (registryId: string): Promise<AxiosResponse<any>> =>
    api.get(`/mcp-registry/servers/${encodeURIComponent(registryId)}`),

  getServerDetails: (registryId: string): Promise<AxiosResponse<any>> =>
    api.get(`/mcp-registry/servers/${encodeURIComponent(registryId)}/details`),

  searchServers: (data: {
    query?: string;
    category?: string;
    tags?: string[];
    is_official?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<any[]>> => api.post('/mcp-registry/search', data),

  syncRegistry: (): Promise<
    AxiosResponse<{
      success: boolean;
      synced_count: number;
      updated_count: number;
      error_count: number;
      total_servers: number;
      error?: string;
    }>
  > => api.post('/mcp-registry/sync'),

  getStats: (): Promise<
    AxiosResponse<{
      total_servers: number;
      official_servers: number;
      verified_servers: number;
      categories: Array<{ name: string; count: number }>;
      top_tags: Array<{ name: string; count: number }>;
    }>
  > => api.get('/mcp-registry/stats'),

  getCategories: (): Promise<AxiosResponse<{ categories: string[] }>> =>
    api.get('/mcp-registry/categories'),

  getInstallConfig: (
    registryId: string
  ): Promise<
    AxiosResponse<{
      config: Record<string, any>;
      installation_command: string;
      package_name: string;
      package_manager: string;
      documentation_url: string;
      example_usage: Array<{ name: string; config: Record<string, any> }>;
    }>
  > => api.get(`/mcp-registry/servers/${registryId}/install-config`),

  installFromRegistry: (
    registryId: string,
    serverName?: string
  ): Promise<
    AxiosResponse<{
      message: string;
      server: any;
      registry_info: {
        registry_id: string;
        version: string;
        description: string;
        documentation_url: string;
      };
    }>
  > =>
    api.post('/mcp-servers/install-from-registry', {
      registry_id: registryId,
      server_name: serverName,
    }),
};

// AI Config API
export const aiConfigAPI = {
  list: (): Promise<AxiosResponse<AIConfig[]>> => api.get('/ai-configs'),

  get: (id: number): Promise<AxiosResponse<AIConfig>> => api.get(`/ai-configs/${id}`),

  create: (data: {
    name: string;
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
    model: string;
    api_key: string;
    api_endpoint?: string;
    parameters?: Record<string, any>;
    is_default?: boolean;
  }): Promise<AxiosResponse<AIConfig>> => api.post('/ai-configs', data),

  update: (id: number, data: Partial<AIConfig>): Promise<AxiosResponse<AIConfig>> =>
    api.put(`/ai-configs/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/ai-configs/${id}`),

  test: (id: number): Promise<AxiosResponse<any>> => api.post(`/ai-configs/${id}/test`),

  setDefault: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/ai-configs/${id}/set-default`),

  getDefault: (): Promise<AxiosResponse<AIConfig>> => api.get('/ai-configs/default/current'),

  getSupportedProviders: (): Promise<AxiosResponse<Record<string, any>>> =>
    api.get('/ai-configs/providers/list'),

  fetchProviderModels: (
    provider: string,
    apiKey?: string,
    apiEndpoint?: string
  ): Promise<AxiosResponse<{ provider: string; models: string[]; count: number }>> =>
    api.post(`/ai-configs/providers/${provider}/models`, {
      api_key: apiKey,
      api_endpoint: apiEndpoint,
    }),
};

// AI Chat API
export const aiChatAPI = {
  sendMessage: (data: {
    message: string;
    ai_config_id?: number;
    conversation_history: Array<{
      role: string;
      content: string;
      timestamp: string;
    }>;
  }): Promise<
    AxiosResponse<{
      message: string;
      role: string;
      timestamp: string;
      tools_used: Array<Record<string, any>>;
    }>
  > => api.post('/ai/chat', data),

  streamMessage: async function* (data: {
    message: string;
    ai_config_id?: number;
    conversation_history: Array<{
      role: string;
      content: string;
      timestamp: string;
    }>;
  }): AsyncGenerator<{
    type?: string;
    content?: string;
    error?: string;
    done?: boolean;
    tool_name?: string;
    result?: string;
  }> {
    const response = await fetch(`${api.defaults.baseURL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data;
              if (data.done) {
                return;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  getAvailableTools: (): Promise<
    AxiosResponse<{
      tools: Array<{
        server: string;
        name: string;
        description: string;
        full_name: string;
      }>;
    }>
  > => api.get('/ai/available-tools'),

  getToolSupportStatus: (): Promise<
    AxiosResponse<{
      configurations: Array<{
        id: number;
        name: string;
        provider: string;
        model: string;
        supports_tools: boolean;
        tool_support_note: string;
      }>;
    }>
  > => api.get('/ai/tool-support-status'),
};

// Widget Blueprint API
export const widgetBlueprintAPI = {
  list: (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    category?: string;
    engine?: string;
    public_only?: boolean;
  }): Promise<AxiosResponse<any[]>> => {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.engine) queryParams.append('engine', params.engine);
    if (params?.public_only !== undefined)
      queryParams.append('public_only', params.public_only.toString());

    return api.get(`/widget-blueprints/?${queryParams}`);
  },

  get: (id: number): Promise<AxiosResponse<any>> => api.get(`/widget-blueprints/${id}`),

  create: (data: {
    name: string;
    description?: string;
    // Universal Widget System v2.0 fields
    widget_version?: string;
    data_source?: any;
    data_schema?: any;
    view_schema?: any;
    // Legacy compatibility fields
    widgetEngine?: string;
    schema?: any;
    settings: any;
    widget_metadata?: any;
    is_public?: boolean;
  }): Promise<AxiosResponse<any>> => api.post('/widget-blueprints/', data),

  update: (
    id: number,
    data: {
      name?: string;
      description?: string;
      // Universal Widget System v2.0 fields
      widget_version?: string;
      data_source?: any;
      data_schema?: any;
      view_schema?: any;
      // Legacy compatibility fields
      widgetEngine?: string;
      schema?: any;
      settings?: any;
      widget_metadata?: any;
      is_public?: boolean;
    }
  ): Promise<AxiosResponse<any>> => api.put(`/widget-blueprints/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/widget-blueprints/${id}`),

  install: (id: number): Promise<AxiosResponse<{ message: string; install_count: number }>> =>
    api.post(`/widget-blueprints/${id}/install`),
};

// Webpage API
export const webpageAPI = {
  fetchMetadata: (
    url: string
  ): Promise<
    AxiosResponse<{
      metadata: {
        url: string;
        title?: string;
        description?: string;
        favicon?: string;
        og_title?: string;
        og_description?: string;
        og_image?: string;
        og_type?: string;
        og_site_name?: string;
        twitter_title?: string;
        twitter_description?: string;
        twitter_image?: string;
        twitter_card?: string;
        canonical_url?: string;
        content_type?: string;
        status_code: number;
        error?: string;
      };
      can_embed: boolean;
      screenshot_url?: string;
    }>
  > => api.post('/webpage/metadata', { url }),

  checkEmbedCapability: (
    url: string
  ): Promise<
    AxiosResponse<{
      url: string;
      can_embed: boolean;
      status_code: number;
      final_url: string;
      error?: string;
    }>
  > => api.get(`/webpage/check-embed?url=${encodeURIComponent(url)}`),

  captureScreenshot: (
    url: string
  ): Promise<
    AxiosResponse<{
      url: string;
      screenshot_url?: string;
      error?: string;
    }>
  > => api.post('/webpage/screenshot', { url }),
};

export default api;
