import React from 'react';
import ConnectionVisualization from '@/components/Canvas/ConnectionVisualization';
import { Widget, WidgetConnection } from '@/types';

// Test page with sample widgets and connections
export default function Test() {
  // Sample test widgets
  const testWidgets: Widget[] = [
    {
      id: 1,
      dashboard_id: 1,
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      z_index: 1,
      shape: 'rectangle',
      widget_blueprint_id: 1,
      content: { text: 'Test Widget 1' },
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      dashboard_id: 1,
      x: 500,
      y: 200,
      width: 300,
      height: 200,
      z_index: 1,
      shape: 'rectangle',
      widget_blueprint_id: 2,
      content: { text: 'Test Widget 2' },
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      dashboard_id: 1,
      x: 300,
      y: 400,
      width: 300,
      height: 200,
      z_index: 1,
      shape: 'rectangle',
      widget_blueprint_id: 3,
      content: { text: 'Test Widget 3' },
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Sample test connections
  const testConnections: WidgetConnection[] = [
    {
      id: 1,
      source_widget_id: 1,
      target_widget_id: 2,
      connection_type: 'data_flow',
      is_active: true,
      mapping_config: {},
      visual_config: {
        color: '#3b82f6',
        width: 2,
        line_style: 'curved',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      source_widget_id: 2,
      target_widget_id: 3,
      connection_type: 'data_flow',
      is_active: true,
      mapping_config: {},
      visual_config: {
        color: '#ef4444',
        width: 3,
        line_style: 'straight',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#f3f4f6' }}>
      <h1 style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000 }}>
        Connection Visualization Test
      </h1>

      {/* Render test widgets */}
      {testWidgets.map(widget => (
        <div
          key={widget.id}
          style={{
            position: 'absolute',
            left: widget.x,
            top: widget.y,
            width: widget.width,
            height: widget.height,
            background: 'white',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
            Widget {widget.id} (Blueprint: {widget.widget_blueprint_id})
          </h3>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
            Position: ({widget.x}, {widget.y})
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
            Size: {widget.width} × {widget.height}
          </p>
        </div>
      ))}

      {/* Connection Visualization */}
      <ConnectionVisualization
        connections={testConnections}
        widgets={testWidgets}
        zoom={1}
        pan={{ x: 0, y: 0 }}
      />
    </div>
  );
}
