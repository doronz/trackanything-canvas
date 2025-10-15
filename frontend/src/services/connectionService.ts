import {
    ConnectionCreationResult,
    CreateConnectionRequest,
    CreateConnectionWithAIRequest,
    WidgetConnection,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

class ConnectionService {
  /**
   * Get all connections for a dashboard
   */
  async getDashboardConnections(dashboardId: number): Promise<WidgetConnection[]> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/dashboard/${dashboardId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard connections');
    }
    return response.json();
  }

  /**
   * Create a new widget connection
   */
  async createConnection(request: CreateConnectionRequest): Promise<WidgetConnection> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create connection');
    }

    return response.json();
  }

  /**
   * Check AI configuration status for widget connections
   */
  async getAIConfigStatus(): Promise<{
    available: boolean;
    message: string;
    has_configs?: boolean;
    config_name?: string;
    provider?: string;
    model?: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/ai-config-status`);
    if (!response.ok) {
      throw new Error('Failed to fetch AI config status');
    }
    return response.json();
  }

  /**
   * Create a connection with AI-powered widget generation
   */
  async createConnectionWithAI(
    request: CreateConnectionWithAIRequest
  ): Promise<ConnectionCreationResult> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/create-with-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create AI-powered connection');
    }

    return response.json();
  }

  /**
   * Create a connection with an empty widget
   */
  async createConnectionWithEmptyWidget(request: {
    source_widget_id: number;
    target_widget_type: string;
    position: { x: number; y: number };
    direction?: string;
  }): Promise<ConnectionCreationResult> {
    const response = await fetch(
      `${API_BASE_URL}/api/widget-connections/create-with-empty-widget`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create empty widget connection');
    }

    return response.json();
  }

  /**
   * Create a connection with simple content copy (no AI required)
   */
  async createConnectionWithContentCopy(
    request: CreateConnectionWithAIRequest
  ): Promise<ConnectionCreationResult> {
    const response = await fetch(
      `${API_BASE_URL}/api/widget-connections/create-with-content-copy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create content copy connection');
    }

    return response.json();
  }

  /**
   * Update a widget connection
   */
  async updateConnection(
    connectionId: number,
    updates: Partial<WidgetConnection>
  ): Promise<WidgetConnection> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/${connectionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update connection');
    }

    return response.json();
  }

  /**
   * Delete a widget connection
   */
  async deleteConnection(connectionId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/widget-connections/${connectionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete connection');
    }
  }

  /**
   * Sync data between connected widgets
   */
  async syncConnectionData(connectionId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/widget-connections/${connectionId}/sync-data`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to sync connection data');
    }
  }

  /**
   * Extract text content from a widget for AI conversion
   * All widgets should now be Universal Widget System v2.0
   */
  extractWidgetText(widget: any): string {
    if (!widget.content) return '';

    // Get the blueprint to determine display component
    const blueprint = widget.widget_blueprint;
    const displayComponent =
      widget.view_schema?.displayComponent || blueprint?.view_schema?.displayComponent;

    // Extract text based on display component type
    if (displayComponent) {
      switch (displayComponent) {
        case 'Note':
          return widget.content.content || widget.content.text || '';

        case 'Text':
        case 'Markdown':
          return widget.content.content || widget.content.markdown || widget.content.text || '';

        case 'Chat':
          // Extract the last AI response
          const messages = widget.content.messages || [];
          const lastAIMessage = messages.filter((m: any) => m.role === 'assistant').pop();
          return lastAIMessage?.content || '';

        case 'Todo':
          // Extract all todo items as text
          const items = widget.content.items || [];
          return items.map((item: any) => item.text).join('\n');

        case 'Table':
        case 'Spreadsheet':
        case 'List':
        case 'Kanban':
        case 'Form':
          // Extract data entries as text
          const data = widget.content.data || [];
          return data
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.text) return item.text;
              if (item.name) return item.name;
              if (item.title) return item.title;
              if (item.value) return item.value;
              return Object.values(item)
                .filter(v => typeof v === 'string')
                .join(' ');
            })
            .join('\n');

        case 'Cards':
          // Extract card data as text
          const cards = widget.content.cards || widget.content.data || [];
          return cards
            .map((card: any) => {
              const parts = [];
              if (card.front) parts.push(card.front);
              if (card.back) parts.push(card.back);
              if (card.title) parts.push(card.title);
              if (card.content) parts.push(card.content);
              return parts.join(' - ');
            })
            .join('\n');

        case 'Iframe':
          // For webpage widgets, send the URL directly so backend can fetch full content
          if (widget.content && widget.content.url) {
            const url = widget.content.url;
            // Send the URL in a format that backend can recognize and fetch
            return `<url>${url}</url>`;
          }

          // Fallback to metadata extraction if no URL
          const metadata = widget.content.metadata || {};
          const parts = [];

          // Add title
          if (metadata.ogTitle || metadata.title) {
            parts.push(`<h1>${metadata.ogTitle || metadata.title}</h1>`);
          }

          // Add description
          if (metadata.ogDescription || metadata.description) {
            parts.push(`<p>${metadata.ogDescription || metadata.description}</p>`);
          }

          // If no metadata, provide a default message
          if (parts.length === 0) {
            parts.push(`<h1>Webpage</h1><p>No content available</p>`);
          }

          return parts.join('\n');

        default:
          // Fall through to generic extraction
          break;
      }
    }

    // Generic text extraction fallback for unknown display components
    if (Array.isArray(widget.content)) {
      return widget.content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.text) return item.text;
          if (item.name) return item.name;
          if (item.title) return item.title;
          return JSON.stringify(item);
        })
        .join('\n');
    }

    if (typeof widget.content === 'object') {
      const textValues = [];
      if (widget.content.text) textValues.push(widget.content.text);
      if (widget.content.markdown) textValues.push(widget.content.markdown);
      if (widget.content.content) textValues.push(widget.content.content);
      if (widget.content.value) textValues.push(widget.content.value);

      if (textValues.length > 0) {
        return textValues.join('\n');
      }

      // Check if this is a webpage widget with URL content
      if (widget.content?.url && typeof widget.content.url === 'string') {
        return `<url>${widget.content.url}</url>`;
      }
    }

    return JSON.stringify(widget.content);
  }

  /**
   * Get available widget types for connections
   */
  getAvailableTargetWidgetTypes(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'Data Table',
        label: 'Data Table',
        description: 'Convert text to structured table with rows and columns',
      },
      {
        value: 'To-Do List',
        label: 'Todo List',
        description: 'Convert text to actionable todo items',
      },
      {
        value: 'Kanban Board',
        label: 'Kanban Board',
        description: 'Convert text to kanban cards organized in columns',
      },
      {
        value: 'Sticky Note',
        label: 'Sticky Note',
        description: 'Copy text to a new sticky note',
      },
      {
        value: 'Markdown Editor',
        label: 'Markdown Document',
        description: 'Convert text to a markdown document',
      },
      {
        value: 'Flash Cards',
        label: 'Flash Cards',
        description: 'Convert text to study flash cards',
      },
      {
        value: 'Image Widget',
        label: 'Image Gallery',
        description: 'Convert text to image references',
      },
      {
        value: 'AI Chat',
        label: 'AI Chat',
        description: 'Start an AI conversation with the text as context',
      },
    ];
  }

  /**
   * Calculate the position for a new connected widget
   */
  calculateNewWidgetPosition(
    sourceWidget: any,
    canvasState?: any,
    direction: 'right' | 'left' | 'top' | 'bottom' = 'right'
  ): { x: number; y: number } {
    const spacing = 50;
    let x = sourceWidget.x;
    let y = sourceWidget.y;

    switch (direction) {
      case 'right':
        x = sourceWidget.x + sourceWidget.width + spacing;
        y = sourceWidget.y;
        break;
      case 'left':
        x = sourceWidget.x - 300 - spacing; // Assuming default widget width of 300
        y = sourceWidget.y;
        break;
      case 'top':
        x = sourceWidget.x;
        y = sourceWidget.y - 200 - spacing; // Assuming default widget height of 200
        break;
      case 'bottom':
        x = sourceWidget.x;
        y = sourceWidget.y + sourceWidget.height + spacing;
        break;
    }

    return { x, y };
  }
}

export const connectionService = new ConnectionService();
export default connectionService;
