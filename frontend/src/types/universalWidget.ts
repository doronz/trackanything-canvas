/**
 * Universal Widget System Type Definitions
 *
 * This file defines the JSON schema for the Universal Widget System (UWS) v2.0
 * which replaces the hardcoded Core Engine approach with a flexible,
 * schema-driven system.
 */

// =============================================================================
// DATA SOURCE DEFINITIONS
// =============================================================================

export type DataSourceType =
  | 'userInput' // User manually enters data
  | 'api' // External API endpoint
  | 'database' // Database query
  | 'static' // Static predefined data
  | 'realtime'; // Real-time data (webhooks, live updates, etc.)

export interface UserInputDataSource {
  type: 'userInput';
  // No additional config needed - data comes from user interaction
}

export interface ApiDataSource {
  type: 'api';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  refreshInterval?: number; // Auto-refresh every X seconds
  authentication?: {
    type: 'bearer' | 'apiKey' | 'basic';
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
  };
}

export interface DatabaseDataSource {
  type: 'database';
  query: string;
  parameters?: Record<string, any>;
  refreshInterval?: number;
}

export interface StaticDataSource {
  type: 'static';
  data: any[]; // Predefined static data
}

export interface RealtimeDataSource {
  type: 'realtime';
  // For realtime data sources (clocks, live data, webhooks)
  // Widget component manages its own real-time updates
}

export type UniversalDataSource =
  | UserInputDataSource
  | ApiDataSource
  | DatabaseDataSource
  | StaticDataSource
  | RealtimeDataSource;

// =============================================================================
// DATA SCHEMA DEFINITIONS
// =============================================================================

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'color'
  | 'file'
  | 'image'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'richtext'
  | 'json';

export interface UniversalField {
  id: string; // Unique field identifier
  name: string; // Human-readable field name
  type: FieldType; // Data type
  required?: boolean; // Whether field is required
  defaultValue?: any; // Default value
  options?: string[]; // For select/multiselect types
  validation?: {
    min?: number; // Min value/length
    max?: number; // Max value/length
    pattern?: string; // Regex pattern
    message?: string; // Custom validation message
  };
  placeholder?: string; // Placeholder text
  description?: string; // Field description/help text
}

export interface UniversalDataSchema {
  fields: UniversalField[];
  primaryKey?: string; // Which field serves as primary key
  relationships?: {
    // Relationships to other data sources
    [fieldId: string]: {
      type: 'oneToOne' | 'oneToMany' | 'manyToMany';
      target: string; // Target data source
      foreignKey: string; // Foreign key field
    };
  };
}

// =============================================================================
// VIEW SCHEMA DEFINITIONS
// =============================================================================

export type DisplayComponent =
  | 'Form' // Form input/editing interface
  | 'Table' // Tabular data display
  | 'Spreadsheet' // Spreadsheet-like interface
  | 'List' // Simple list display
  | 'Cards' // Card-based layout
  | 'Kanban' // Kanban board
  | 'Calendar' // Calendar view
  | 'Chart' // Charts and graphs
  | 'Gallery' // Image/media gallery
  | 'Text' // Simple text display
  | 'Chat' // Chat/messaging interface
  | 'Note' // Note-taking interface
  | 'Todo' // Todo list interface
  | 'Iframe' // Embedded content
  | 'Video' // Video player
  | 'Weather' // Weather display
  | 'Clock' // Clock/time display
  | 'Markdown' // Markdown editor/viewer
  | 'Audio' // Audio player
  | 'Map' // Geographic map
  | 'Timeline' // Timeline view
  | 'Custom'; // Custom component (fallback)

export interface FieldMapping {
  [componentSlot: string]: string; // Maps component slots to data field paths
}

export interface UniversalViewSchema {
  displayComponent: DisplayComponent;
  mappings: FieldMapping;
  layout?: {
    columns?: number; // Grid columns
    gap?: number; // Gap between items
    direction?: 'row' | 'column'; // Layout direction
  };
  styling?: {
    theme?: string; // Color theme
    size?: 'sm' | 'md' | 'lg'; // Component size
    variant?: string; // Component variant
  };
  // TODO: implement this and apply for collaborator permissions
  interactions?: {
    allowAdd?: boolean; // Allow adding new items
    allowEdit?: boolean; // Allow editing items
    allowDelete?: boolean; // Allow deleting items
    allowSort?: boolean; // Allow sorting
    allowFilter?: boolean; // Allow filtering
    allowSearch?: boolean; // Allow searching
  };
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    showSizeSelector?: boolean;
  };
}

// =============================================================================
// COMPLETE UNIVERSAL WIDGET BLUEPRINT
// =============================================================================

export interface UniversalWidgetBlueprint {
  // Metadata
  widgetVersion: string; // "2.0" for Universal Widget System
  name: string; // Widget name
  description?: string; // Widget description

  // Core schemas
  dataSource: UniversalDataSource; // Where data comes from
  dataSchema: UniversalDataSchema; // Structure of the data
  viewSchema: UniversalViewSchema; // How to display the data

  // Configuration
  settings: {
    title?: string; // Default widget title
    width?: number; // Default width
    height?: number; // Default height
    backgroundColor?: string; // Default background color
    textColor?: string; // Default text color
    fontSize?: number; // Default font size
    fontFamily?: string; // Default font family
    [key: string]: any; // Additional custom settings
  };

  // Metadata
  widget_metadata?: {
    category?: string; // Widget category
    tags?: string[]; // Search tags
    author?: string; // Widget author
    version?: string; // Widget version
    icon?: string; // Widget icon (emoji or URL)
    thumbnail?: string; // Preview thumbnail URL
    created_at?: string; // Creation timestamp
    updated_at?: string; // Last update timestamp
  };
}

// =============================================================================
// EXAMPLE BLUEPRINTS
// =============================================================================

// Example: Kanban Board Widget (as described in the user story)
export const exampleKanbanBlueprint: UniversalWidgetBlueprint = {
  widgetVersion: '2.0',
  name: 'Project Task Board',
  description: 'A Kanban board to track project tasks.',

  dataSource: {
    type: 'userInput',
  },

  dataSchema: {
    fields: [
      { id: 'fld_1', name: 'Task', type: 'text', required: true },
      {
        id: 'fld_2',
        name: 'Status',
        type: 'select',
        options: ['To Do', 'In Progress', 'Done'],
        defaultValue: 'To Do',
      },
      { id: 'fld_3', name: 'Assignee', type: 'text' },
      { id: 'fld_4', name: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
      { id: 'fld_5', name: 'Due Date', type: 'date' },
    ],
    primaryKey: 'fld_1',
  },

  viewSchema: {
    displayComponent: 'Kanban',
    mappings: {
      cardTitle: 'data.Task',
      cardSubtitle: 'data.Assignee',
      groupBy: 'data.Status',
      cardMeta: 'data.Due Date',
      cardPriority: 'data.Priority',
    },
    interactions: {
      allowAdd: true,
      allowEdit: true,
      allowDelete: true,
    },
  },

  settings: {
    title: 'Project Tasks',
    width: 400,
    height: 300,
    backgroundColor: '#ffffff',
  },
};

// Example: Simple Contact Form
export const exampleContactFormBlueprint: UniversalWidgetBlueprint = {
  widgetVersion: '2.0',
  name: 'Contact Form',
  description: 'A simple contact form for collecting user information.',

  dataSource: {
    type: 'userInput',
  },

  dataSchema: {
    fields: [
      { id: 'name', name: 'Full Name', type: 'text', required: true },
      { id: 'email', name: 'Email', type: 'email', required: true },
      { id: 'phone', name: 'Phone', type: 'text' },
      { id: 'message', name: 'Message', type: 'textarea', required: true },
    ],
  },

  viewSchema: {
    displayComponent: 'Form',
    mappings: {
      formFields: 'schema.fields',
    },
    interactions: {
      allowAdd: true,
    },
  },

  settings: {
    title: 'Contact Us',
    backgroundColor: '#f9fafb',
  },
};

// Example: Weather API Widget
export const exampleWeatherWidgetBlueprint: UniversalWidgetBlueprint = {
  widgetVersion: '2.0',
  name: 'Weather Widget',
  description: 'Display current weather data from an API.',

  dataSource: {
    type: 'api',
    endpoint: 'https://api.openweathermap.org/data/2.5/weather',
    method: 'GET',
    refreshInterval: 300, // Refresh every 5 minutes
    authentication: {
      type: 'apiKey',
      apiKey: 'YOUR_API_KEY',
    },
  },

  dataSchema: {
    fields: [
      { id: 'location', name: 'Location', type: 'text' },
      { id: 'temperature', name: 'Temperature', type: 'number' },
      { id: 'humidity', name: 'Humidity', type: 'number' },
      { id: 'description', name: 'Description', type: 'text' },
      { id: 'icon', name: 'Weather Icon', type: 'image' },
    ],
  },

  viewSchema: {
    displayComponent: 'Cards',
    mappings: {
      cardTitle: 'data.location',
      cardContent: 'data.temperature',
      cardSubtitle: 'data.description',
      cardImage: 'data.icon',
    },
  },

  settings: {
    title: 'Current Weather',
  },
};

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * Legacy blueprint structure for backward compatibility
 * This will be used during the migration period
 */
export interface LegacyWidgetBlueprint {
  widgetVersion?: string; // Missing or "1.0" for legacy
  name: string;
  description?: string;
  widget_engine: string; // Legacy engine name
  schema: {
    displayLayout: string;
    fields: any[];
  };
  settings: Record<string, any>;
  widget_metadata?: Record<string, any>;
}

/**
 * Type guard to check if a blueprint is using the Universal System
 */
export function isUniversalBlueprint(blueprint: any): blueprint is UniversalWidgetBlueprint {
  // Check for both camelCase (frontend) and snake_case (backend) field names
  const version = blueprint.widgetVersion || blueprint.widget_version;
  const dataSource = blueprint.dataSource || blueprint.data_source;
  const dataSchema = blueprint.dataSchema || blueprint.data_schema;
  const viewSchema = blueprint.viewSchema || blueprint.view_schema;

  return version === '2.0' && dataSource && dataSchema && viewSchema;
}

/**
 * Type guard to check if a blueprint is legacy
 */
export function isLegacyBlueprint(blueprint: any): blueprint is LegacyWidgetBlueprint {
  // Check for both camelCase (frontend) and snake_case (backend) field names
  const version = blueprint.widgetVersion || blueprint.widget_version;
  const widgetEngine = blueprint.widgetEngine || blueprint.widget_engine;

  return widgetEngine && (!version || version === '1.0');
}
