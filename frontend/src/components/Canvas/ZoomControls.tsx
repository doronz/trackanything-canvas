import { AppDispatch, RootState } from '@/store';
import { resetView, setZoom, setPan, zoomIn, zoomOut } from '@/store/canvasSlice';
import {
  ArrowsPointingOutIcon,
  MinusIcon,
  PlusIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Tooltip from '@/components/UI/Tooltip';

export default function ZoomControls() {
  const dispatch = useDispatch<AppDispatch>();
  const { zoom, viewport } = useSelector((state: RootState) => state.canvas);
  const { widgets } = useSelector((state: RootState) => state.widget);
  const { showZoomControls } = useSelector((state: RootState) => state.ui);

  const [inputValue, setInputValue] = useState('');
  const zoomPercentage = Math.round(zoom * 100);

  useEffect(() => {
    setInputValue(zoomPercentage.toString());
  }, [zoomPercentage]);

  if (!showZoomControls) return null;

  const handleZoomInClick = () => {
    dispatch(zoomIn(undefined));
  };

  const handleZoomOutClick = () => {
    dispatch(zoomOut(undefined));
  };

  const handleResetClick = () => {
    dispatch(resetView(undefined));
  };

  const handleCenterOnWidgets = () => {
    if (widgets.length === 0) {
      dispatch(resetView(undefined));
      return;
    }

    // Calculate bounding box of all widgets
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of widgets) {
      minX = Math.min(minX, w.x);
      minY = Math.min(minY, w.y);
      maxX = Math.max(maxX, w.x + w.width);
      maxY = Math.max(maxY, w.y + w.height);
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    // Calculate zoom to fit all widgets with padding
    const padding = 100; // px padding around widgets
    const scaleX = (viewport.width - padding * 2) / contentWidth;
    const scaleY = (viewport.height - padding * 2) / contentHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1.5); // Cap at 150% so it doesn't zoom in too much
    const clampedZoom = Math.max(0.1, Math.min(5, fitZoom));

    // Center pan
    const panX = viewport.width / 2 - centerX * clampedZoom;
    const panY = viewport.height / 2 - centerY * clampedZoom;

    dispatch(setZoom(clampedZoom));
    dispatch(setPan({ x: panX, y: panY }));
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleZoomInputSubmit = () => {
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      dispatch(setZoom(value / 100));
    } else {
      setInputValue(zoomPercentage.toString());
    }
  };

  const handleZoomInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomInputSubmit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputValue(zoomPercentage.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="fixed bottom-6 right-4 flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50">
      {/* Zoom Out */}
      <button
        onClick={handleZoomOutClick}
        disabled={zoom <= 0.1}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        title="Zoom Out"
      >
        <MinusIcon className="w-4 h-4" />
      </button>

      {/* Zoom Percentage */}
      <div className="flex items-center">
        <input
          type="number"
          value={inputValue}
          onChange={handleZoomInputChange}
          onBlur={handleZoomInputSubmit}
          onKeyDown={handleZoomInputKeyPress}
          min="10"
          max="500"
          className="w-16 text-center text-sm border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">%</span>
      </div>

      {/* Zoom In */}
      <button
        onClick={handleZoomInClick}
        disabled={zoom >= 5}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        title="Zoom In"
      >
        <PlusIcon className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

      {/* Center on Widgets */}
      <Tooltip content="Center on widgets" position="top">
        <button
          onClick={handleCenterOnWidgets}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors"
        >
          <ViewfinderCircleIcon className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* Reset View */}
      <Tooltip content="Reset to 100%" position="top">
        <button
          onClick={handleResetClick}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors"
        >
          <ArrowsPointingOutIcon className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );
}
