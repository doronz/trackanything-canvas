import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
  selectWidget,
  startDragging,
  updateDragPosition,
  stopDragging,
  startResizing,
  updateResizeSize,
  stopResizing,
  updateWidget,
  deleteWidget,
} from '@/store/widgetSlice';
import { Widget, PluggableWidget, WidgetBlueprint } from '@/types';
import UniversalWidgetEngine from './UniversalWidgetEngine/UniversalWidgetEngine';
import WidgetFooter from './WidgetFooter';
import ConnectionButton from './ConnectionButton';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface WidgetRendererProps {
  widget: Widget | PluggableWidget;
  isSelected: boolean;
  zoom: number;
  snapToGrid: boolean;
  gridSize: number;
}

export default function WidgetRenderer({
  widget,
  isSelected,
  zoom,
  snapToGrid,
  gridSize,
}: WidgetRendererProps) {
  const dispatch = useDispatch<AppDispatch>();
  const resizeState = useSelector((state: RootState) => state.widget.resizeState);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(widget.title || '');
  const [initialPosition, setInitialPosition] = useState({ x: widget.x, y: widget.y });
  const [initialSize, setInitialSize] = useState({ width: widget.width, height: widget.height });

  const handleWidgetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectWidget(widget.id));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Don't start dragging if user is interacting with editable elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"], [contenteditable]')
    ) {
      // Still select the widget but don't start dragging
      e.stopPropagation();
      dispatch(selectWidget(widget.id));
      return;
    }

    e.stopPropagation();
    dispatch(selectWidget(widget.id));

    const parentRect = widgetRef.current?.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    // Store initial position and size for change detection
    setInitialPosition({ x: widget.x, y: widget.y });
    setInitialSize({ width: widget.width, height: widget.height });

    // Calculate offset from mouse position to widget's position in world coordinates
    const offsetX = (e.clientX - parentRect.left) / zoom - widget.x;
    const offsetY = (e.clientY - parentRect.top) / zoom - widget.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);

    dispatch(
      startDragging({
        widgetId: widget.id,
        offset: { x: offsetX, y: offsetY },
      })
    );
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();

    // Store initial position and size for change detection
    setInitialPosition({ x: widget.x, y: widget.y });
    setInitialSize({ width: widget.width, height: widget.height });

    setIsResizing(true);

    dispatch(
      startResizing({
        widgetId: widget.id,
        handle,
        startSize: { width: widget.width, height: widget.height },
        startPosition: { x: widget.x, y: widget.y },
      })
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dispatch(deleteWidget(widget.id));
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingTitle(true);
  };

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    dispatch(
      updateWidget({
        id: widget.id,
        data: { title: titleValue },
      })
    );
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
      setTitleValue(widget.title || '');
    }
  };

  // Update local title value when widget title changes
  useEffect(() => {
    setTitleValue(widget.title || '');
  }, [widget.title]);

  // Global mouse event handlers for smooth dragging and resizing
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;

      e.preventDefault();
      const parentRect = widgetRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      if (isDragging) {
        // Calculate new position based on mouse position and drag offset
        let newX = (e.clientX - parentRect.left) / zoom - dragOffset.x;
        let newY = (e.clientY - parentRect.top) / zoom - dragOffset.y;

        // Snap to grid if enabled
        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        dispatch(updateDragPosition({ x: newX, y: newY }));
      } else if (isResizing && resizeState.isResizing) {
        // Handle resize based on the resize handle direction
        const currentX = (e.clientX - parentRect.left) / zoom;
        const currentY = (e.clientY - parentRect.top) / zoom;

        const { handle, startSize, startPosition } = resizeState;
        let newWidth = startSize.width;
        let newHeight = startSize.height;
        let newX = startPosition.x;
        let newY = startPosition.y;

        // Calculate new dimensions and position based on resize handle
        // Each handle keeps the opposite corner fixed while moving the dragged corner
        const fixedTopLeft = { x: startPosition.x, y: startPosition.y };
        const fixedTopRight = { x: startPosition.x + startSize.width, y: startPosition.y };
        const fixedBottomLeft = { x: startPosition.x, y: startPosition.y + startSize.height };
        const fixedBottomRight = {
          x: startPosition.x + startSize.width,
          y: startPosition.y + startSize.height,
        };

        switch (handle) {
          case 'nw': // Top-left - keep bottom-right fixed
            newWidth = Math.max(100, fixedBottomRight.x - currentX);
            newHeight = Math.max(80, fixedBottomRight.y - currentY);
            newX = fixedBottomRight.x - newWidth;
            newY = fixedBottomRight.y - newHeight;
            break;
          case 'ne': // Top-right - keep bottom-left fixed
            newWidth = Math.max(100, currentX - fixedBottomLeft.x);
            newHeight = Math.max(80, fixedBottomLeft.y - currentY);
            newX = fixedBottomLeft.x;
            newY = fixedBottomLeft.y - newHeight;
            break;
          case 'sw': // Bottom-left - keep top-right fixed
            newWidth = Math.max(100, fixedTopRight.x - currentX);
            newHeight = Math.max(80, currentY - fixedTopRight.y);
            newX = fixedTopRight.x - newWidth;
            newY = fixedTopRight.y;
            break;
          case 'se': // Bottom-right - keep top-left fixed
            newWidth = Math.max(100, currentX - fixedTopLeft.x);
            newHeight = Math.max(80, currentY - fixedTopLeft.y);
            newX = fixedTopLeft.x;
            newY = fixedTopLeft.y;
            break;
        }

        // Apply grid snapping if enabled
        if (snapToGrid) {
          // Snap the mouse position to grid first, then recalculate
          const snappedX = Math.round(currentX / gridSize) * gridSize;
          const snappedY = Math.round(currentY / gridSize) * gridSize;

          // Recalculate with snapped mouse position
          switch (handle) {
            case 'nw': // Top-left - keep bottom-right fixed
              newWidth = Math.max(100, fixedBottomRight.x - snappedX);
              newHeight = Math.max(80, fixedBottomRight.y - snappedY);
              newX = fixedBottomRight.x - newWidth;
              newY = fixedBottomRight.y - newHeight;
              break;
            case 'ne': // Top-right - keep bottom-left fixed
              newWidth = Math.max(100, snappedX - fixedBottomLeft.x);
              newHeight = Math.max(80, fixedBottomLeft.y - snappedY);
              newX = fixedBottomLeft.x;
              newY = fixedBottomLeft.y - newHeight;
              break;
            case 'sw': // Bottom-left - keep top-right fixed
              newWidth = Math.max(100, fixedTopRight.x - snappedX);
              newHeight = Math.max(80, snappedY - fixedTopRight.y);
              newX = fixedTopRight.x - newWidth;
              newY = fixedTopRight.y;
              break;
            case 'se': // Bottom-right - keep top-left fixed
              newWidth = Math.max(100, snappedX - fixedTopLeft.x);
              newHeight = Math.max(80, snappedY - fixedTopLeft.y);
              newX = fixedTopLeft.x;
              newY = fixedTopLeft.y;
              break;
          }
        }

        dispatch(
          updateResizeSize({
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY,
          })
        );
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dispatch(stopDragging());

        // Only save position to backend if it actually changed
        const positionChanged = widget.x !== initialPosition.x || widget.y !== initialPosition.y;
        if (positionChanged) {
          console.log('Saving position to backend', widget.id);
          dispatch(
            updateWidget({
              id: widget.id,
              data: { x: widget.x, y: widget.y },
            })
          );
        }
      }

      if (isResizing) {
        setIsResizing(false);
        dispatch(stopResizing());

        // Check if size or position changed during resize
        const sizeChanged =
          widget.width !== initialSize.width || widget.height !== initialSize.height;
        const positionChanged = widget.x !== initialPosition.x || widget.y !== initialPosition.y;

        if (sizeChanged || positionChanged) {
          console.log('Saving resize changes to backend', widget.id);
          const updateData: any = {};

          if (sizeChanged) {
            updateData.width = widget.width;
            updateData.height = widget.height;
          }

          if (positionChanged) {
            updateData.x = widget.x;
            updateData.y = widget.y;
          }

          dispatch(
            updateWidget({
              id: widget.id,
              data: updateData,
            })
          );
        }
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, zoom, snapToGrid, gridSize, widget, dispatch]);

  const renderWidgetContent = () => {
    // Create style props that widgets can use to override hard-coded colors
    // Note: backgroundColor is intentionally removed - widgets should use their own default backgrounds
    const widgetStyleProps = {
      textColor: widget.settings?.textColor || '#000000',
      fontSize: widget.settings?.fontSize || 14,
    };

    const pluggableWidget = widget as PluggableWidget;

    // Check if this is a pluggable widget with a blueprint
    if (pluggableWidget.widget_blueprint) {
      // All widgets now use the Universal Widget Engine system
      return (
        <UniversalWidgetEngine
          widget={pluggableWidget}
          blueprint={pluggableWidget.widget_blueprint}
          isSelected={isSelected}
          styleProps={widgetStyleProps}
        />
      );
    }

    // For any widget without a blueprint, show an error message
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-gray-900">Missing Widget Blueprint</div>
          <p className="text-sm text-gray-500">This widget is missing its blueprint data.</p>
          <div className="text-xs text-gray-400 mt-2">Widget ID: {widget.id}</div>
        </div>
      </div>
    );
  };

  const widgetStyle = {
    position: 'absolute' as const,
    left: widget.x,
    top: widget.y,
    width: widget.width,
    height: widget.height,
    zIndex: widget.z_index,
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    borderColor: widget.color || '#e5e7eb',
    borderWidth: `${widget.settings?.borderWidth || 1}px`,
    borderStyle: 'solid',
    borderRadius:
      widget.shape === 'circle'
        ? '50%'
        : widget.shape === 'rounded'
          ? `${widget.settings?.borderRadius || 8}px`
          : '0px',
    opacity: (widget.settings?.opacity || 100) / 100,
    boxShadow:
      widget.settings?.shadow === 'sm'
        ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        : widget.settings?.shadow === 'md'
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          : widget.settings?.shadow === 'lg'
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            : widget.settings?.shadow === 'xl'
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              : 'none',
  };

  // Special handling for sticky notes (check blueprint name)
  const pluggableWidget = widget as PluggableWidget;
  const isStickyNote = pluggableWidget.widget_blueprint?.name === 'Sticky Note';

  // Title header styles
  const titleHeaderStyle = {
    backgroundColor:
      widget.settings?.titleBackgroundColor ||
      widget.settings?.backgroundColor ||
      (isStickyNote ? 'transparent' : '#ffffff'),
    color: widget.settings?.textColor || '#374151',
    fontSize: `${widget.settings?.fontSize || 14}px`,
    fontFamily: 'Poppins, sans-serif',
  };

  const borderColor = widget.color || '#e5e7eb';
  const shapeClass =
    widget.shape === 'circle'
      ? 'rounded-full'
      : widget.shape === 'rounded'
        ? 'rounded-lg'
        : 'rounded';

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={
        isStickyNote
          ? 'widget-container sticky-note-widget'
          : `widget-container ${shapeClass} ${isSelected ? 'selected' : ''}`
      }
      data-widget-id={widget.id}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header - only for non-sticky notes */}
      {!isStickyNote && (
        <div
          className={`widget-header ${shapeClass === 'rounded-full' ? 'rounded-t-full' : 'rounded-t-lg'}`}
          style={titleHeaderStyle}
        >
          {editingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyPress}
              onMouseDown={e => e.stopPropagation()}
              className="bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 mr-2"
              style={{
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: '500',
                color: 'inherit',
                minWidth: '120px',
                maxWidth: 'calc(100% - 40px)',
              }}
              autoFocus
              placeholder="Enter widget title..."
            />
          ) : (
            <h3
              className="cursor-pointer hover:opacity-80 transition-opacity mr-2"
              onClick={handleTitleClick}
              onMouseDown={e => e.stopPropagation()}
              title="Click to edit title"
              style={{
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: '500',
                color: 'inherit',
                maxWidth: 'calc(100% - 40px)',
              }}
            >
              {titleValue || 'Untitled Widget'}
            </h3>
          )}
          <button
            onClick={handleDelete}
            className={`p-1 rounded text-gray-400 hover:text-red-500 transition-opacity duration-200 ml-auto ${
              isSelected || isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Widget Content */}
      <div
        className={
          isStickyNote
            ? 'widget-content w-full h-full'
            : `widget-content ${widget.title ? '' : shapeClass}`
        }
        onMouseDown={isStickyNote ? undefined : e => e.stopPropagation()}
        onClick={handleWidgetClick}
        style={{
          cursor: 'default',
        }}
      >
        {renderWidgetContent()}
      </div>

      {/* Resize Handles - All 4 corners */}
      {(isSelected || isHovered) && widget.shape !== 'circle' && (
        <>
          {/* Top-left */}
          <div
            className="absolute w-3 h-3 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border-2 border-white rounded-sm cursor-nw-resize shadow-md hover:shadow-lg transition-shadow"
            style={{ top: '-6px', left: '-6px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'nw')}
          />
          {/* Top-right */}
          <div
            className="absolute w-3 h-3 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border-2 border-white rounded-sm cursor-ne-resize shadow-md hover:shadow-lg transition-shadow"
            style={{ top: '-6px', right: '-6px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'ne')}
          />
          {/* Bottom-left */}
          <div
            className="absolute w-3 h-3 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border-2 border-white rounded-sm cursor-sw-resize shadow-md hover:shadow-lg transition-shadow"
            style={{ bottom: '-6px', left: '-6px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'sw')}
          />
          {/* Bottom-right */}
          <div
            className="absolute w-3 h-3 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border-2 border-white rounded-sm cursor-se-resize shadow-md hover:shadow-lg transition-shadow"
            style={{ bottom: '-6px', right: '-6px' }}
            onMouseDown={e => handleResizeMouseDown(e, 'se')}
          />
        </>
      )}

      {/* Connection Buttons - show on hover or selection */}
      <ConnectionButton widgetId={widget.id} isVisible={isSelected || isHovered} position="right" />
      <ConnectionButton widgetId={widget.id} isVisible={isSelected || isHovered} position="left" />
      <ConnectionButton widgetId={widget.id} isVisible={isSelected || isHovered} position="top" />
      <ConnectionButton
        widgetId={widget.id}
        isVisible={isSelected || isHovered}
        position="bottom"
      />

      {/* Widget Footer - only for non-sticky notes */}
      {!isStickyNote && <WidgetFooter widget={widget} onDelete={handleDelete} />}
    </div>
  );
}
