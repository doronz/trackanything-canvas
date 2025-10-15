import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { zoomIn, zoomOut, resetView, setZoom } from '@/store/canvasSlice';
import { PlusIcon, MinusIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

export default function ZoomControls() {
  const dispatch = useDispatch<AppDispatch>();
  const { zoom } = useSelector((state: RootState) => state.canvas);
  const { showZoomControls } = useSelector((state: RootState) => state.ui);

  const [inputValue, setInputValue] = useState('');

  if (!showZoomControls) return null;

  const zoomPercentage = Math.round(zoom * 100);

  // Update input value when zoom changes externally
  useEffect(() => {
    setInputValue(zoomPercentage.toString());
  }, [zoomPercentage]);

  const handleZoomInClick = () => {
    dispatch(zoomIn(undefined));
  };

  const handleZoomOutClick = () => {
    dispatch(zoomOut(undefined));
  };

  const handleResetClick = () => {
    dispatch(resetView(undefined));
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleZoomInputSubmit = () => {
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      dispatch(setZoom(value / 100));
    } else {
      // Reset to current zoom if invalid
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
    <div className="fixed bottom-20 right-4 flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50">
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

      {/* Reset View */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
      <button
        onClick={handleResetClick}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors"
        title="Reset View"
      >
        <ArrowsPointingOutIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
