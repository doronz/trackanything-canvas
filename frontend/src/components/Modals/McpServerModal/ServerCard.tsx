import React from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface ServerStatus {
  name: string;
  status: string;
  error?: string;
  tools?: Array<{ name: string; description: string }>;
  resources?: Array<{ name?: string; uri: string; description?: string }>;
}

interface Server {
  id: number;
  name: string;
  transport: string;
  status: string;
  config?: any;
}

interface ServerCardProps {
  server: Server;
  serverStatus?: ServerStatus;
  isExpanded: boolean;
  loading: boolean;
  onToggleExpansion: (serverName: string) => void;
  onTestConnection: (serverId: number) => void;
  onEdit: (server: Server) => void;
  onDelete: (serverId: number) => void;
}

export default function ServerCard({
  server,
  serverStatus,
  isExpanded,
  loading,
  onToggleExpansion,
  onTestConnection,
  onEdit,
  onDelete,
}: ServerCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'connecting':
        return <ClockIcon className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <XCircleIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const toolCount = serverStatus?.tools?.length || 0;
  const resourceCount = serverStatus?.resources?.length || 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
      {/* Main Server Info */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3 flex-1">
          {getStatusIcon(server.status)}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">{server.name}</h4>
              {toolCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <WrenchScrewdriverIcon className="w-3 h-3 mr-1" />
                  {toolCount} tools
                </span>
              )}
              {resourceCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {resourceCount} resources
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {server.transport} • {server.status}
              {serverStatus?.error && (
                <span className="text-red-500 ml-2">• {serverStatus.error}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Info Toggle Button */}
          {(toolCount > 0 || resourceCount > 0) && (
            <button
              onClick={() => onToggleExpansion(server.name)}
              className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="Show Details"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            onClick={() => onTestConnection(server.id)}
            disabled={loading}
            className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 disabled:opacity-50"
          >
            Test
          </button>
          <button
            onClick={() => onEdit(server)}
            disabled={loading}
            className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
            title="Edit Configuration"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(server.id)}
            disabled={loading}
            className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && serverStatus && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
          {/* Tools Section */}
          {serverStatus.tools && serverStatus.tools.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <WrenchScrewdriverIcon className="w-3 h-3 mr-1" />
                Available Tools ({serverStatus.tools.length})
              </h5>
              <div className="grid grid-cols-1 gap-2">
                {serverStatus.tools.map((tool, index) => (
                  <div
                    key={index}
                    className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                          {tool.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources Section */}
          {serverStatus.resources && serverStatus.resources.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <InformationCircleIcon className="w-3 h-3 mr-1" />
                Available Resources ({serverStatus.resources.length})
              </h5>
              <div className="grid grid-cols-1 gap-2">
                {serverStatus.resources.map((resource, index) => (
                  <div
                    key={index}
                    className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                  >
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {resource.name || resource.uri}
                    </p>
                    {resource.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {resource.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Tools or Resources */}
          {(!serverStatus.tools || serverStatus.tools.length === 0) &&
            (!serverStatus.resources || serverStatus.resources.length === 0) && (
              <div className="mt-3 text-center py-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No tools or resources available
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
