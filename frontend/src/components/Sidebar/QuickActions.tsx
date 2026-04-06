import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { openModal, toggleTheme } from '@/store/uiSlice';
import {
  ServerStackIcon,
  CpuChipIcon,
  MoonIcon,
  SunIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';

export default function QuickActions() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme } = useSelector((state: RootState) => state.ui);
  const { servers } = useSelector((state: RootState) => state.mcp);
  const { configs } = useSelector((state: RootState) => state.aiConfig);

  const connectedServers = servers.filter(s => s.status === 'connected').length;
  const totalServers = servers.length;

  const actions = [
    {
      id: 'mcp-servers',
      label: 'MCP Servers',
      icon: ServerStackIcon,
      onClick: () => dispatch(openModal('mcpServerConfig')),
      status: `${connectedServers}/${totalServers}`,
      statusColor:
        connectedServers === totalServers && totalServers > 0
          ? 'text-green-600'
          : 'text-yellow-600',
    },
    {
      id: 'ai-config',
      label: 'AI Config',
      icon: CpuChipIcon,
      onClick: () => dispatch(openModal('aiConfig')),
      status: `${configs.length} configured`,
      statusColor: configs.length > 0 ? 'text-green-600' : 'text-gray-400',
    },
    {
      id: 'import-export',
      label: 'Import/Export Dashboard',
      icon: DocumentArrowUpIcon,
      onClick: () => dispatch(openModal('importExport')),
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Quick Actions
      </h3>

      {/* Action Buttons */}
      <div className="space-y-1">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.onClick}
            className="w-full flex items-center justify-between p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <div className="flex items-center">
              <action.icon className="w-4 h-4 mr-2" />
              <span>{action.label}</span>
            </div>
            {action.status && (
              <span className={`text-xs ${action.statusColor}`}>{action.status}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => dispatch(toggleTheme())}
          className="w-full flex items-center p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          {theme === 'light' ? (
            <MoonIcon className="w-4 h-4 mr-2" />
          ) : (
            <SunIcon className="w-4 h-4 mr-2" />
          )}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </div>

      {/* Theme Toggle */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-600">
        TrackAnything &middot; Private Dashboard
      </div>
    </div>
  );
}
