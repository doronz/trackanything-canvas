import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { RootState, AppDispatch } from '@/store';
import { fetchDefaultAIConfig } from '@/store/aiConfigSlice';

export default function StatusBar() {
  const dispatch = useDispatch<AppDispatch>();
  const { zoom, pan } = useSelector((state: RootState) => state.canvas);
  const { widgets, selectedWidgetIds } = useSelector((state: RootState) => state.widget);
  const { servers } = useSelector((state: RootState) => state.mcp);
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const { defaultConfig } = useSelector((state: RootState) => state.aiConfig);

  const connectedServers = servers.filter(s => s.status === 'connected').length;
  const selectedCount = selectedWidgetIds.length;

  // Fetch default AI config on mount
  useEffect(() => {
    dispatch(fetchDefaultAIConfig());
  }, [dispatch]);

  // Calculate left margin based on sidebar state
  const leftMargin = sidebarCollapsed ? '40px' : '320px';

  return (
    <div
      className="fixed bottom-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 z-30"
      style={{ left: leftMargin }}
    >
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        {/* Left Side */}
        <div className="flex items-center space-x-4">
          <span>Widgets: {widgets.length}</span>
          {selectedCount > 0 && <span>Selected: {selectedCount}</span>}
        </div>

        {/* Center */}
        <div className="flex items-center space-x-4">
          <span>
            Position: {Math.round(pan.x)}, {Math.round(pan.y)}
          </span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          <span
            className={`flex items-center ${
              connectedServers > 0 ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                connectedServers > 0 ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            MCP: {connectedServers}/{servers.length}
          </span>
          <span
            className={`flex items-center ${defaultConfig ? 'text-blue-600' : 'text-gray-400'}`}
            title={
              defaultConfig
                ? `Provider: ${defaultConfig.provider} | Model: ${defaultConfig.model}`
                : 'No AI config set'
            }
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                defaultConfig ? 'bg-blue-500' : 'bg-gray-400'
              }`}
            />
            AI: {defaultConfig ? defaultConfig.name : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
