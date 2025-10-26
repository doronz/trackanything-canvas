// Core application types

export interface Dashboard {
  id: number;
  name: string;
  description?: string;
  thumbnail?: string;
  canvas_state?: CanvasState;
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: number;
  dashboard_id: number;
  title?: string;
  init_prompt?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  color?: string;
  shape: WidgetShape;
  content: Record<string, any>;
  settings: Record<string, any>;
  widget_blueprint_id: number;
  widget_blueprint?: DatabaseWidgetBlueprint;
  created_at: string;
  updated_at: string;
}

export type WidgetType =
  | 'sticky_note'
  | 'todo_list'
  | 'ai_chat'
  | 'image'
  | 'flash_card'
  | 'video'
  | 'kanban'
  | 'table'
  | 'markdown_editor';

export type WidgetShape = 'rectangle' | 'rounded' | 'circle';

export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  viewport: { width: number; height: number };
}

export interface MCPServer {
  id: number;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  config: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  last_connected?: string;
  created_at: string;
  updated_at: string;
}

export interface MCPServerStatus {
  name: string;
  status: string;
  tools: MCPTool[];
  resources: MCPResource[];
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface AIConfig {
  id: number;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
  model: string;
  api_endpoint?: string;
  parameters: Record<string, any>;
  is_default: boolean;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIConfigUpdateData {
  name?: string;
  provider?: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
  model?: string;
  api_key?: string;
  api_endpoint?: string;
  parameters?: Record<string, any>;
  is_default?: boolean;
}

// Widget-specific content types

export interface StickyNoteContent {
  text: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface TodoListContent {
  items: TodoItem[];
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface AIChatContent {
  messages: ChatMessage[];
  aiConfigId?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ImageContent {
  url: string;
  alt?: string;
  caption?: string;
}

export interface FlashCardContent {
  cards: FlashCard[];
  currentIndex: number;
}

export interface FlashCard {
  id: string;
  front: string;
  back: string;
}

export interface VideoContent {
  url: string;
  title?: string;
  autoplay?: boolean;
  controls?: boolean;
}

export interface KanbanContent {
  columns: KanbanColumn[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  labels?: string[];
}

export interface TableContent {
  headers: string[];
  rows: string[][];
}

export interface MarkdownContent {
  text: string;
  preview?: boolean;
}

// API Response types

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// UI State types

export interface UIState {
  sidebarCollapsed: boolean;
  selectedWidgetId?: number;
  draggedWidget?: Widget;
  theme: 'light' | 'dark';
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

// Widget Standard types for import/export

export interface WidgetSchemaField {
  name: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea' | 'date' | 'color' | 'url' | 'email';
  required?: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface WidgetStandardTemplate {
  widgetVersion: string;
  type: 'template';
  name: string;
  description?: string;
  schema: {
    fields: WidgetSchemaField[];
  };
  settings: Record<string, any>;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
    icon?: string;
  };
}

export interface WidgetStandardInstance {
  widgetVersion: string;
  type: 'instance';
  name: string;
  description?: string;
  schema: {
    fields: WidgetSchemaField[];
  };
  settings: Record<string, any>;
  data: Array<Record<string, any>>;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
    icon?: string;
    exportedAt?: string;
    widgetId?: number;
    dashboardId?: number;
  };
}

export type WidgetStandard = WidgetStandardTemplate | WidgetStandardInstance;

export interface WidgetImportResult {
  success: boolean;
  widget?: Widget;
  errors?: string[];
  warnings?: string[];
}

// New Pluggable Widget Export/Import Types
export interface PluggableWidgetExportData {
  // Widget instance data
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  color?: string;
  shape: string;
  content: Record<string, any>;
  settings: Record<string, any>;

  // Blueprint data for fallback
  widget_blueprint_id: number;
  widget_blueprint: DatabaseWidgetBlueprint; // Full blueprint data

  // Export metadata
  export_version: string;
  exported_at: string;
  exported_by: string;
}

export interface PluggableWidgetImportData {
  // Widget instance data
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  shape: string;
  content: Record<string, any>;
  settings: Record<string, any>;

  // Blueprint data
  widget_blueprint_id?: number; // If blueprint exists
  widget_blueprint?: DatabaseWidgetBlueprint; // Fallback blueprint data

  // Target dashboard
  dashboard_id: number;
}

export interface WidgetExportOptions {
  type: 'template' | 'instance';
  includePosition?: boolean;
  includeDashboardInfo?: boolean;
  customMetadata?: Record<string, any>;
}

// Pluggable Widget System Types

// Database Widget Blueprint (from backend) - Universal Widget System
export interface DatabaseWidgetBlueprint {
  id: number;
  name: string;
  description?: string;
  widget_version?: string; // "2.0" for Universal, "1.0" for Legacy
  // Universal Widget System fields
  data_source?: Record<string, any>;
  data_schema?: Record<string, any>;
  view_schema?: Record<string, any>;
  // Legacy compatibility fields
  widget_engine?: string; // For backward compatibility
  schema?: Record<string, any>; // For backward compatibility
  settings: Record<string, any>;
  widget_metadata?: Record<string, any>;
  is_public: boolean;
  install_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WidgetBlueprintField {
  id: string;
  name: string;
  type:
    | 'text'
    | 'number'
    | 'checkbox'
    | 'select'
    | 'textarea'
    | 'date'
    | 'color'
    | 'url'
    | 'email'
    | 'file'
    | 'rich_text';
  required?: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  placeholder?: string;
  description?: string;
}

// Legacy WidgetBlueprint interface - deprecated, use UniversalWidgetBlueprint instead
export interface WidgetBlueprint {
  widgetVersion: string;
  type: 'template' | 'instance';
  name: string;
  description?: string;
  widgetEngine: string; // Legacy field - no longer using Core*Engine
  schema: {
    displayLayout:
      | 'list'
      | 'table'
      | 'gallery'
      | 'kanban'
      | 'note'
      | 'chat'
      | 'markdown'
      | 'image'
      | 'video'
      | 'cards'
      | 'form';
    fields: WidgetBlueprintField[];
  };
  settings: Record<string, any>;
  widget_metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
    icon?: string;
    thumbnail?: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface WidgetTemplateBlueprint extends WidgetBlueprint {
  type: 'template';
  id?: number;
  user_id?: number;
  is_public?: boolean;
  install_count?: number;
}

export interface PluggableWidget extends Widget {
  widget_blueprint?: DatabaseWidgetBlueprint;
}

// Widget Engine Types
export interface WidgetEngineProps {
  widget: PluggableWidget;
  blueprint: DatabaseWidgetBlueprint;
  isSelected?: boolean;
  styleProps?: {
    backgroundColor?: string; // Optional - widgets should use their own default backgrounds
    textColor: string;
    fontSize: number;
    fontFamily: string;
  };
}

export interface WidgetEngineContext {
  data: Array<Record<string, any>>;
  updateData: (data: Array<Record<string, any>>) => void;
  addRecord: (record: Record<string, any>) => void;
  updateRecord: (index: number, record: Record<string, any>) => void;
  deleteRecord: (index: number) => void;
  settings: Record<string, any>;
}

// Widget Connection types

export interface WidgetConnection {
  id: number;
  source_widget_id: number;
  target_widget_id: number;
  connection_type: string;
  mapping_config?: Record<string, any>;
  ai_conversion_prompt?: string;
  is_active: boolean;
  visual_config?: {
    line_style?: 'straight' | 'curved';
    color?: string;
    width?: number;
    source_direction?: 'right' | 'left' | 'top' | 'bottom';
  };
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionRequest {
  source_widget_id: number;
  target_widget_id: number;
  connection_type?: string;
  mapping_config?: Record<string, any>;
  ai_conversion_prompt?: string;
  visual_config?: Record<string, any>;
}

export interface CreateConnectionWithAIRequest {
  source_widget_id: number;
  target_widget_type: string;
  source_data: string;
  ai_config_id?: number;
  transformation_prompt?: string;
  position: { x: number; y: number };
  direction?: string;
}

export interface ConnectionCreationResult {
  target_widget: Widget;
  connection: WidgetConnection;
}

// Event types

export interface WidgetDragEvent {
  widgetId: number;
  x: number;
  y: number;
}

export interface WidgetResizeEvent {
  widgetId: number;
  width: number;
  height: number;
}

export interface CanvasEvent {
  type: 'pan' | 'zoom' | 'click' | 'select';
  data: any;
}
