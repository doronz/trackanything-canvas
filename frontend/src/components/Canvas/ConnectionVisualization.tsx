import { AppDispatch, RootState } from '@/store';
import { Widget, WidgetConnection } from '@/types';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';

interface ConnectionVisualizationProps {
  connections: WidgetConnection[];
  widgets: Widget[];
  zoom: number;
  pan: { x: number; y: number };
}

interface ConnectionLine {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'straight' | 'curved';
  hasAiTransformation?: boolean;
  aiPrompt?: string;
}

// Calculate connection point on widget edge based on direction
const getConnectionPoint = (
  widget: Widget,
  targetPoint: { x: number; y: number },
  preferredDirection?: 'right' | 'left' | 'top' | 'bottom'
) => {
  const centerX = widget.x + widget.width / 2;
  const centerY = widget.y + widget.height / 2;

  // Offset connection points slightly upward to avoid plus icons
  const verticalOffset = -36; // Move 12px upward from center

  // If we have a preferred direction, use it
  if (preferredDirection) {
    switch (preferredDirection) {
      case 'right':
        return { x: widget.x + widget.width, y: centerY + verticalOffset };
      case 'left':
        return { x: widget.x, y: centerY + verticalOffset };
      case 'top':
        return { x: centerX, y: widget.y };
      case 'bottom':
        return { x: centerX, y: widget.y + widget.height };
    }
  }

  // Fallback to automatic calculation
  const dx = targetPoint.x - centerX;
  const dy = targetPoint.y - centerY;
  const angle = Math.atan2(dy, dx);

  // Determine which edge the line should connect to
  const absAngle = Math.abs(angle);
  const isHorizontal = absAngle < Math.PI / 4 || absAngle > (3 * Math.PI) / 4;

  if (isHorizontal) {
    // Connect to left or right edge (with vertical offset to avoid plus icons)
    const x =
      angle > -Math.PI / 2 && angle < Math.PI / 2
        ? widget.x + widget.width // Right edge
        : widget.x; // Left edge
    return { x, y: centerY + verticalOffset };
  } else {
    // Connect to top or bottom edge (no vertical offset needed for these)
    const y =
      angle > 0
        ? widget.y + widget.height // Bottom edge
        : widget.y; // Top edge
    return { x: centerX, y };
  }
};

// Helper function to truncate text for display
const truncateText = (text: string, maxLength: number = 25): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default function ConnectionVisualization({
  connections,
  widgets,
  zoom,
  pan,
}: ConnectionVisualizationProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { lastUpdated } = useSelector((state: RootState) => state.connection);

  // Tooltip state - array to support multiple tooltips
  const [hoveredConnections, setHoveredConnections] = useState<
    Array<{
      id: number;
      prompt: string;
      x: number;
      y: number;
    }>
  >([]);

  // Force refresh when widget count changes (indicates new widgets were added)
  React.useEffect(() => {
    // Small delay to ensure widgets are fully loaded
    const timer = setTimeout(() => {
      dispatch({ type: 'connections/forceRefreshConnections' });
    }, 100);
    return () => clearTimeout(timer);
  }, [widgets.length, dispatch]);

  // Calculate connection lines
  const connectionLines = useMemo(() => {
    const lines: ConnectionLine[] = [];

    // Debug logging for troubleshooting (development only)
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('ConnectionVisualization: Recalculating lines', {
    //     connectionsCount: connections.length,
    //     widgetsCount: widgets.length,
    //     connections: connections.map(c => ({ id: c.id, source: c.source_widget_id, target: c.target_widget_id, active: c.is_active }))
    //   })
    // }

    connections.forEach(connection => {
      // More permissive filtering - show all connections unless explicitly inactive
      if (connection.is_active === false) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Skipping inactive connection ${connection.id}`);
        }
        return;
      }

      const sourceWidget = widgets.find(w => w.id === connection.source_widget_id);
      const targetWidget = widgets.find(w => w.id === connection.target_widget_id);

      if (!sourceWidget || !targetWidget) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Missing widgets for connection ${connection.id}:`, {
            sourceFound: !!sourceWidget,
            targetFound: !!targetWidget,
            sourceId: connection.source_widget_id,
            targetId: connection.target_widget_id,
            availableWidgetIds: widgets.map(w => w.id),
          });
        }
        return;
      }

      // Ensure widget dimensions are valid
      const sourceWidth = Math.max(sourceWidget.width || 300, 100);
      const sourceHeight = Math.max(sourceWidget.height || 200, 100);
      const targetWidth = Math.max(targetWidget.width || 300, 100);
      const targetHeight = Math.max(targetWidget.height || 200, 100);

      // Debug widget coordinates
      // if (process.env.NODE_ENV === 'development') {
      //   console.log(`Widget coordinates for connection ${connection.id}:`, {
      //     sourceWidget: { id: sourceWidget.id, x: sourceWidget.x, y: sourceWidget.y, width: sourceWidth, height: sourceHeight },
      //     targetWidget: { id: targetWidget.id, x: targetWidget.x, y: targetWidget.y, width: targetWidth, height: targetHeight }
      //   })
      // }

      // Apply canvas transformations to widget positions
      const transformedSourceX = sourceWidget.x * zoom + pan.x;
      const transformedSourceY = sourceWidget.y * zoom + pan.y;
      const transformedSourceWidth = sourceWidth * zoom;
      const transformedSourceHeight = sourceHeight * zoom;

      const transformedTargetX = targetWidget.x * zoom + pan.x;
      const transformedTargetY = targetWidget.y * zoom + pan.y;
      const transformedTargetWidth = targetWidth * zoom;
      const transformedTargetHeight = targetHeight * zoom;

      // Calculate actual widget centers in screen coordinates
      const sourceCenter = {
        x: transformedSourceX + transformedSourceWidth / 2,
        y: transformedSourceY + transformedSourceHeight / 2,
      };

      const targetCenter = {
        x: transformedTargetX + transformedTargetWidth / 2,
        y: transformedTargetY + transformedTargetHeight / 2,
      };

      // Create widgets with transformed coordinates for getConnectionPoint
      const validatedSourceWidget = {
        ...sourceWidget,
        x: transformedSourceX,
        y: transformedSourceY,
        width: transformedSourceWidth,
        height: transformedSourceHeight,
      };

      const validatedTargetWidget = {
        ...targetWidget,
        x: transformedTargetX,
        y: transformedTargetY,
        width: transformedTargetWidth,
        height: transformedTargetHeight,
      };

      // Calculate proper connection points on widget edges
      const sourcePoint = getConnectionPoint(validatedSourceWidget, targetCenter);
      const targetPoint = getConnectionPoint(validatedTargetWidget, sourceCenter);

      // Validate connection points
      if (
        !isFinite(sourcePoint.x) ||
        !isFinite(sourcePoint.y) ||
        !isFinite(targetPoint.x) ||
        !isFinite(targetPoint.y)
      ) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Invalid connection points for connection ${connection.id}`, {
            sourcePoint,
            targetPoint,
            sourceWidget: validatedSourceWidget,
            targetWidget: validatedTargetWidget,
          });
        }
        return;
      }

      // Use text color for connection lines (black in light mode, white in dark mode)
      const textColor = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';

      // Check if connection has AI transformation prompt
      // Look for transformation prompts in the AI conversion prompt field
      const hasAiTransformation = !!(
        connection.ai_conversion_prompt &&
        (connection.ai_conversion_prompt.includes('Transform:') ||
          connection.ai_conversion_prompt.includes('transformation_prompt:') ||
          connection.mapping_config?.transformation_prompt)
      );

      // Extract the actual transformation prompt from various possible formats
      let aiPrompt: string | undefined;
      if (hasAiTransformation) {
        if (connection.mapping_config?.transformation_prompt) {
          aiPrompt = connection.mapping_config.transformation_prompt;
        } else if (connection.ai_conversion_prompt?.includes('Transform:')) {
          aiPrompt = connection.ai_conversion_prompt.split('Transform:')[1]?.trim();
        } else if (connection.ai_conversion_prompt?.includes('transformation_prompt:')) {
          aiPrompt = connection.ai_conversion_prompt.split('transformation_prompt:')[1]?.trim();
        }
      }

      // Use same color for all connections (black/white based on theme)
      const connectionColor = connection.visual_config?.color || textColor;

      lines.push({
        id: connection.id,
        x1: sourcePoint.x,
        y1: sourcePoint.y,
        x2: targetPoint.x,
        y2: targetPoint.y,
        color: connectionColor,
        width: connection.visual_config?.width || 2,
        style: connection.visual_config?.line_style || 'curved',
        hasAiTransformation,
        aiPrompt,
      });
    });

    // if (process.env.NODE_ENV === 'development') {
    //   console.log(`ConnectionVisualization: Generated ${lines.length} lines`)
    // }
    return lines;
  }, [connections, widgets, zoom, pan, lastUpdated]);

  // Expose window.revealAllPrompts() function for browser console access (development only)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Define the global function
      (window as any).revealAllPrompts = () => {
        // Find all AI transformation connections and trigger their tooltips
        const aiConnections = connectionLines
          .filter(line => line.hasAiTransformation && line.aiPrompt)
          .map(line => {
            const midX = (line.x1 + line.x2) / 2;
            const midY = (line.y1 + line.y2) / 2;

            // Convert canvas coordinates to screen coordinates for tooltip positioning
            return {
              id: line.id,
              prompt: line.aiPrompt!,
              x: midX,
              y: midY,
            };
          });

        setHoveredConnections(aiConnections);
        console.log(`✅ Revealing ${aiConnections.length} AI transformation tooltips`);

        // Auto-hide after 10 seconds
        setTimeout(() => {
          setHoveredConnections([]);
          console.log(
            'ℹ️ Tooltips auto-hidden after 10 seconds. Call window.revealAllPrompts() to show again.'
          );
        }, 30000);

        return `Revealing ${aiConnections.length} AI transformation tooltips for 10 seconds...`;
      };

      // Cleanup on unmount
      return () => {
        delete (window as any).revealAllPrompts;
      };
    }
  }, [connectionLines]);

  // Generate SVG path for curved line
  const getCurvedPath = (line: ConnectionLine) => {
    const { x1, y1, x2, y2 } = line;

    // Calculate control points for a smooth curve
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Curve intensity based on distance
    const curvature = Math.min(distance * 0.3, 100);

    // Control points
    const cp1x = x1 + (dx > 0 ? curvature : -curvature);
    const cp1y = y1;
    const cp2x = x2 + (dx > 0 ? -curvature : curvature);
    const cp2y = y2;

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  // Get arrow marker path
  const getArrowPath = (line: ConnectionLine) => {
    const { x1, y1, x2, y2 } = line;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    const arrowLength = 8;
    const arrowWidth = 4;

    const arrowX1 = x2 - arrowLength * Math.cos(angle - Math.PI / 6);
    const arrowY1 = y2 - arrowLength * Math.sin(angle - Math.PI / 6);
    const arrowX2 = x2 - arrowLength * Math.cos(angle + Math.PI / 6);
    const arrowY2 = y2 - arrowLength * Math.sin(angle + Math.PI / 6);

    return `M ${x2} ${y2} L ${arrowX1} ${arrowY1} M ${x2} ${y2} L ${arrowX2} ${arrowY2}`;
  };

  if (connectionLines.length === 0) {
    return null;
  }

  return (
    <>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          zIndex: 40, // Above widgets (1-10) but below modals (z-50)
        }}
      >
        {/* Define gradients and markers */}
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>

          {/* AI indicator gradient */}
          <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="33%" stopColor="#FF5A78" />
            <stop offset="100%" stopColor="#FFC850" />
          </linearGradient>
        </defs>

        {/* Render connection lines */}
        {connectionLines.map(line => (
          <g key={line.id}>
            {/* Connection line - render first (bottom layer) */}
            <path
              d={
                line.style === 'curved'
                  ? getCurvedPath(line)
                  : `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`
              }
              stroke={line.color}
              strokeWidth={line.width}
              fill="none"
              markerEnd="url(#arrowhead)"
              style={{ pointerEvents: 'none' }}
            />

            {/* Connection points */}
            <circle cx={line.x1} cy={line.y1} r="3" fill={line.color} opacity="0.7" />
            <circle cx={line.x2} cy={line.y2} r="3" fill={line.color} opacity="0.7" />

            {/* Click area for connection line */}
            <path
              d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
              stroke="transparent"
              strokeWidth="10"
              fill="none"
              style={{
                pointerEvents: line.hasAiTransformation ? 'none' : 'stroke',
                cursor: 'pointer',
              }}
              onClick={() => console.log('Connection clicked:', line.id)}
            />

            {/* AI transformation indicator - render last (top layer) */}
            {line.hasAiTransformation && (
              <g>
                {/* AI indicator circle with gradient */}
                <circle
                  cx={(line.x1 + line.x2) / 2}
                  cy={(line.y1 + line.y2) / 2}
                  r="12"
                  fill="url(#aiGradient)"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ cursor: 'help', pointerEvents: 'all' }}
                  onMouseEnter={e => {
                    const rect = (e.target as SVGCircleElement).getBoundingClientRect();
                    setHoveredConnections([
                      {
                        id: line.id,
                        prompt: line.aiPrompt || 'AI Transformation',
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      },
                    ]);
                  }}
                  onMouseLeave={() => setHoveredConnections([])}
                />

                {/* AI text label */}
                <text
                  x={(line.x1 + line.x2) / 2}
                  y={(line.y1 + line.y2) / 2}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  ⛓︎
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip portals - show all hovered connections */}
      {typeof document !== 'undefined' &&
        hoveredConnections.map(connection =>
          createPortal(
            <div
              key={connection.id}
              className="fixed z-[60] px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none transition-opacity duration-200 max-w-md"
              style={{
                left: connection.x,
                top: connection.y - 8,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="whitespace-pre-wrap break-words">{connection.prompt}</div>

              {/* Arrow */}
              <div className="absolute w-2 h-2 bg-gray-900 rotate-45 bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2" />
            </div>,
            document.body
          )
        )}
    </>
  );
}

// Hook to get connections for current dashboard
export function useConnectionVisualization() {
  const { connections } = useSelector((state: RootState) => state.connection);
  const { widgets } = useSelector((state: RootState) => state.widget);
  const { zoom, pan } = useSelector((state: RootState) => state.canvas);

  return {
    connections,
    widgets,
    zoom,
    pan,
  };
}
