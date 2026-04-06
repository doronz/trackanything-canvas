import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { closeWidgetSettingsPanel } from '@/store/uiSlice';
import { updateWidget } from '@/store/widgetSlice';
import { PaintBrushIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface WidgetSettingsPanelProps {
  isOpen: boolean;
  widgetId?: number;
}

export default function WidgetSettingsPanel({ isOpen, widgetId }: WidgetSettingsPanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const widgets = useSelector((state: RootState) => state.widget.widgets);

  const widget = widgets.find(w => w.id === widgetId);
  const currentWidgetIdRef = useRef(widgetId);

  // Settings state
  const [title, setTitle] = useState('');
  const [titleBackgroundColor, setTitleBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [borderColor, setBorderColor] = useState('#e5e7eb');
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderRadius, setBorderRadius] = useState(8);
  const [opacity, setOpacity] = useState(100);
  const [shape, setShape] = useState<'rectangle' | 'rounded' | 'circle'>('rounded');
  const [fontSize, setFontSize] = useState(14);
  const [shadow, setShadow] = useState('none');
  const [hideTitle, setHideTitle] = useState(false);

  // Initialize settings from widget
  useEffect(() => {
    if (widget?.settings) {
      currentWidgetIdRef.current = widget.id;
      setTitle(widget.title || '');
      setHideTitle(!!widget.settings.hideTitle);
      setTitleBackgroundColor(
        widget.settings.titleBackgroundColor || widget.settings.backgroundColor || '#ffffff'
      );
      setTextColor(widget.settings.textColor || '#000000');
      setBorderColor(widget.color || '#e5e7eb');
      setBorderWidth(widget.settings.borderWidth || 1);
      setBorderRadius(widget.settings.borderRadius || 8);
      setOpacity(widget.settings.opacity || 100);
      setShape(widget.shape || 'rounded');
      setFontSize(widget.settings.fontSize || 14);
      setShadow(widget.settings.shadow || 'none');
    }
  }, [widget]);

  // Real-time preview: Update widget settings immediately as user changes them
  // Note: Removed 'widget' from dependency array to prevent infinite loops
  useEffect(() => {
    if (!widget || currentWidgetIdRef.current !== widget.id) return;

    const newSettings = {
      titleBackgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      opacity,
      fontSize,
      shadow,
      hideTitle,
    };

    // Apply changes and persist to backend immediately
    dispatch(
      updateWidget({
        id: widget.id,
        data: {
          title: title,
          color: borderColor,
          shape: shape,
          settings: {
            ...widget.settings,
            ...newSettings,
          },
        },
      })
    );
  }, [
    title,
    titleBackgroundColor,
    textColor,
    borderColor,
    borderWidth,
    borderRadius,
    opacity,
    shape,
    fontSize,
    shadow,
    hideTitle,
    dispatch,
  ]);

  const handleClose = () => {
    dispatch(closeWidgetSettingsPanel());
  };

  const handleSave = () => {
    if (!widget) return;

    const newSettings = {
      titleBackgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      opacity,
      fontSize,
      shadow,
      hideTitle,
    };

    // Save changes to backend
    dispatch(
      updateWidget({
        id: widget.id,
        data: {
          title: title,
          color: borderColor,
          shape: shape,
          settings: {
            ...widget.settings,
            ...newSettings,
          },
        },
      })
    );

    handleClose();
  };

  const handleReset = () => {
    setTitle('Untitled Widget');
    setTitleBackgroundColor('#ffffff');
    setTextColor('#000000');
    setBorderColor('#e5e7eb');
    setBorderWidth(1);
    setBorderRadius(8);
    setOpacity(100);
    setShape('rounded');
    setFontSize(14);
    setShadow('none');
  };

  if (!isOpen || !widget) {
    return null;
  }

  const shadowOptions = [
    { value: 'none', label: 'None' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra Large' },
  ];

  return (
    <div className="fixed top-0 right-0 w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Widget Settings</h2>
        <button
          onClick={handleClose}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Widget Info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {widget.title || 'Untitled Widget'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {widget.widget_blueprint?.name ? widget.widget_blueprint.name.toUpperCase() : 'WIDGET'}
          </p>
        </div>

        {/* Widget Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Widget Title
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter widget title..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="flex items-center space-x-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideTitle}
              onChange={e => setHideTitle(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Hide title bar</span>
          </label>
        </div>

        {/* Appearance Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <PaintBrushIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Appearance</h3>
          </div>

          {/* Colors */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title Background Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={titleBackgroundColor}
                  onChange={e => setTitleBackgroundColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={titleBackgroundColor}
                  onChange={e => setTitleBackgroundColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {widget.widget_blueprint?.name === 'Sticky Note'
                  ? 'Text Color'
                  : 'Title Text Color'}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#000000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Border Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={borderColor}
                  onChange={e => setBorderColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={borderColor}
                  onChange={e => setBorderColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#e5e7eb"
                />
              </div>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Opacity: {opacity}%
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Layout Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Squares2X2Icon className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Layout</h3>
          </div>

          {/* Shape - TODO: Currently I'm disabling this. Will implement later. */}
          <div style={{ display: 'none' }}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Shape
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['rectangle', 'rounded', 'circle'] as const).map(shapeOption => (
                <button
                  key={shapeOption}
                  onClick={() => setShape(shapeOption)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    shape === shapeOption
                      ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {shapeOption.charAt(0).toUpperCase() + shapeOption.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Border Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Border Width: {borderWidth}px
            </label>
            <input
              type="range"
              min="0"
              max="5"
              value={borderWidth}
              onChange={e => setBorderWidth(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Border Radius */}
          {shape !== 'circle' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Border Radius: {borderRadius}px
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={borderRadius}
                onChange={e => setBorderRadius(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Shadow */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Shadow
            </label>
            <select
              value={shadow}
              onChange={e => setShadow(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {shadowOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Typography */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Font Size: {fontSize}px
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 border border-transparent rounded-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-shadow"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
