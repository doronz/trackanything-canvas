import { useRef, useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import {
  setZoom,
  setPan,
  setViewport,
  zoomToPoint,
  setDragging,
  resetView,
  screenToWorld,
  worldToScreen,
} from '@/store/canvasSlice';
import { clearSelection, selectWidgetsInArea } from '@/store/widgetSlice';
import { setSelecting, setSelectionBox } from '@/store/canvasSlice';
import { fetchWidgets } from '@/store/widgetSlice';
import { fetchDashboardConnections, deselectConnection } from '@/store/connectionSlice';
import { setActiveTool } from '@/store/uiSlice';
import WidgetRenderer from '../Widgets/WidgetRenderer';
import CanvasGrid from './CanvasGrid';
import ConnectionVisualization from './ConnectionVisualization';

export default function Canvas() {
  const dispatch = useDispatch<AppDispatch>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);

  const { zoom, pan, viewport, isDragging } = useSelector((state: RootState) => state.canvas);
  const { widgets, selectedWidgetIds } = useSelector((state: RootState) => state.widget);
  const { connections } = useSelector((state: RootState) => state.connection);
  const { currentDashboardId } = useSelector((state: RootState) => state.dashboard);
  const { showGrid, snapToGrid, gridSize, activeTool } = useSelector(
    (state: RootState) => state.ui
  );

  // Load widgets and connections when dashboard changes
  useEffect(() => {
    if (currentDashboardId) {
      dispatch(fetchWidgets(currentDashboardId));
      dispatch(fetchDashboardConnections(currentDashboardId));
    }
  }, [currentDashboardId, dispatch]);

  // Update viewport size
  useEffect(() => {
    const updateViewport = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        dispatch(setViewport({ width: rect.width, height: rect.height }));
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [dispatch]);

  // Canvas state for coordinate transformation
  const canvasState = { zoom, pan, viewport };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    setIsMouseDown(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });

    // Check if clicking on empty canvas (not on a widget)
    const target = e.target as HTMLElement;
    const isClickingWidget = target.closest('.widget-container');

    // Start panning/selection if clicking on canvas background or the main canvas area
    if (!isClickingWidget) {
      // Deselect any selected connections
      dispatch(deselectConnection());

      // Start selection or panning
      if (e.shiftKey) {
        // Start selection
        setIsSelecting(true);
        setSelectionStart({ x: clientX, y: clientY });
        dispatch(setSelecting(true));
      } else {
        // Start panning
        setIsCanvasPanning(true);
        dispatch(setDragging(true));
        dispatch(clearSelection());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (isSelecting) {
      // Update selection box
      dispatch(
        setSelectionBox({
          startX: selectionStart.x,
          startY: selectionStart.y,
          endX: clientX,
          endY: clientY,
        })
      );
      setLastMousePos({ x: clientX, y: clientY });
    }
    // Canvas panning is handled by global mouse events
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      // Complete selection
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const startWorld = screenToWorld(selectionStart.x, selectionStart.y, canvasState);
        const endWorld = screenToWorld(lastMousePos.x, lastMousePos.y, canvasState);

        dispatch(
          selectWidgetsInArea({
            startX: Math.min(startWorld.x, endWorld.x),
            startY: Math.min(startWorld.y, endWorld.y),
            endX: Math.max(startWorld.x, endWorld.x),
            endY: Math.max(startWorld.y, endWorld.y),
          })
        );
      }
      setIsSelecting(false);
      dispatch(setSelecting(false));
    }

    setIsMouseDown(false);
    setIsCanvasPanning(false);
    dispatch(setDragging(false));
  };

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Check if the wheel event is happening over a widget
      const target = e.target as HTMLElement;
      const widgetContainer = target.closest('.widget-container');

      // Check widget scrolling logic
      if (widgetContainer) {
        // Find the widget ID from the container to check if it's selected
        const widgetId = (widgetContainer as HTMLElement).dataset.widgetId
          ? parseInt((widgetContainer as HTMLElement).dataset.widgetId!)
          : null;
        const isWidgetSelected = widgetId ? selectedWidgetIds.includes(widgetId) : false;

        // Cross-platform modifier key detection (Cmd on Mac, Ctrl on Windows/Linux)
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKeyPressed = isMac ? e.metaKey : e.ctrlKey;

        if (activeTool === 'hand') {
          // Hand tool ACTIVE: Only allow widget scrolling if widget is selected OR modifier key is held
          if (isWidgetSelected || modifierKeyPressed) {
            // Check if we can actually scroll the widget content
            // Check the element where the wheel event occurred and its ancestors
            let currentElement = target;
            while (currentElement && widgetContainer.contains(currentElement)) {
              const computedStyle = window.getComputedStyle(currentElement);
              const overflowY = computedStyle.overflowY;
              const overflowX = computedStyle.overflowX;

              const {
                scrollTop,
                scrollLeft,
                scrollHeight,
                scrollWidth,
                clientHeight,
                clientWidth,
              } = currentElement;

              // Check if this element can scroll vertically
              if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
                const canScrollDown = scrollTop < scrollHeight - clientHeight - 1; // -1 for rounding
                const canScrollUp = scrollTop > 1; // 1 for rounding

                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                  if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
                    // Let the widget handle the scroll
                    return;
                  }
                }
              }

              // Check if this element can scroll horizontally
              if ((overflowX === 'auto' || overflowX === 'scroll') && scrollWidth > clientWidth) {
                const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1; // -1 for rounding
                const canScrollLeft = scrollLeft > 1; // 1 for rounding

                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                  if ((e.deltaX > 0 && canScrollRight) || (e.deltaX < 0 && canScrollLeft)) {
                    // Let the widget handle the scroll
                    return;
                  }
                }
              }

              // Move up to parent element
              currentElement = currentElement.parentElement as HTMLElement;
            }
          }
          // If hand tool is active but widget not selected/no modifier key, or widget can't scroll → do canvas operations
        } else {
          // Hand tool is INACTIVE - restore original widget scrolling behavior
          // Check the element where the wheel event occurred and its ancestors
          let currentElement = target;
          while (currentElement && widgetContainer.contains(currentElement)) {
            const computedStyle = window.getComputedStyle(currentElement);
            const overflowY = computedStyle.overflowY;
            const overflowX = computedStyle.overflowX;

            const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } =
              currentElement;

            // Check if this element can scroll vertically
            if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
              const canScrollDown = scrollTop < scrollHeight - clientHeight - 1; // -1 for rounding
              const canScrollUp = scrollTop > 1; // 1 for rounding

              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
                  // Let the widget handle the scroll
                  return;
                }
              }
            }

            // Check if this element can scroll horizontally
            if ((overflowX === 'auto' || overflowX === 'scroll') && scrollWidth > clientWidth) {
              const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1; // -1 for rounding
              const canScrollLeft = scrollLeft > 1; // 1 for rounding

              if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                if ((e.deltaX > 0 && canScrollRight) || (e.deltaX < 0 && canScrollLeft)) {
                  // Let the widget handle the scroll
                  return;
                }
              }
            }

            // Move up to parent element
            currentElement = currentElement.parentElement as HTMLElement;
          }

          // If we reach here, the widget can't handle the scroll, so prevent it from bubbling
          // and don't handle it as canvas operation either to avoid conflicting behavior
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // No widget involved or hand tool is active - handle as canvas operation
      e.preventDefault();

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Detect pinch zoom vs 2-finger scroll on macOS trackpad
      // Pinch zoom typically has ctrlKey set to true on macOS
      // 2-finger scroll should be treated as panning
      const isPinchZoom = e.ctrlKey;

      if (isPinchZoom) {
        // Handle zoom
        const zoomSpeed = 0.05;
        const deltaZoom = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.max(0.1, Math.min(5, zoom + deltaZoom));

        dispatch(
          zoomToPoint({
            zoom: newZoom,
            clientX,
            clientY,
          })
        );
      } else {
        // Handle 2-finger scroll as panning
        const panSpeed = 1.0;
        dispatch(
          setPan({
            x: pan.x - e.deltaX * panSpeed,
            y: pan.y - e.deltaY * panSpeed,
          })
        );
      }
    },
    [zoom, pan, dispatch, activeTool]
  );

  // Global mouse event handlers for canvas panning
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isCanvasPanning || !isMouseDown) return;

      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      dispatch(
        setPan({
          x: pan.x + deltaX,
          y: pan.y + deltaY,
        })
      );

      setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleGlobalMouseUp = () => {
      if (isCanvasPanning) {
        setIsMouseDown(false);
        setIsCanvasPanning(false);
        dispatch(setDragging(false));
      }
    };

    if (isCanvasPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isCanvasPanning, isMouseDown, lastMousePos, pan, dispatch]);

  // Setup wheel event listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Keyboard shortcut for hand tool (spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're not typing in an input/textarea
      const activeElement = document.activeElement;
      const isTyping =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (!isTyping && e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        // Toggle between hand and select tools
        dispatch(setActiveTool(activeTool === 'hand' ? 'select' : 'hand'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, activeTool]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Reset view on double click
    if (e.target === canvasRef.current || (e.target as HTMLElement).closest('.canvas-background')) {
      dispatch(resetView(undefined));
    }
  };

  const canvasStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
  };

  return (
    <div
      ref={canvasRef}
      className="w-full h-full overflow-hidden relative bg-gray-50 dark:bg-gray-900 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Canvas Background */}
      <div className="canvas-background absolute inset-0">
        {showGrid && <CanvasGrid gridSize={gridSize} zoom={zoom} pan={pan} />}
      </div>

      {/* Canvas Content */}
      <div className="absolute inset-0 pointer-events-none" style={canvasStyle}>
        {/* Widgets */}
        {widgets.map(widget => (
          <div key={widget.id} className="pointer-events-auto">
            <WidgetRenderer
              widget={widget}
              isSelected={selectedWidgetIds.includes(widget.id)}
              zoom={zoom}
              snapToGrid={snapToGrid}
              gridSize={gridSize}
            />
          </div>
        ))}
      </div>

      {/* Widget Connections - Outside transformed container to avoid clipping */}
      <ConnectionVisualization connections={connections} widgets={widgets} zoom={zoom} pan={pan} />

      {/* Selection Box */}
      {isSelecting && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-100 dark:bg-blue-900 bg-opacity-20 pointer-events-none"
          style={{
            left: Math.min(selectionStart.x, lastMousePos.x),
            top: Math.min(selectionStart.y, lastMousePos.y),
            width: Math.abs(lastMousePos.x - selectionStart.x),
            height: Math.abs(lastMousePos.y - selectionStart.y),
          }}
        />
      )}
    </div>
  );
}
