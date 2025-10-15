import React from 'react';
import { ServerStackIcon, PlusIcon } from '@heroicons/react/24/outline';
import ServerCard from './ServerCard';
import ServerForm from './ServerForm';
import { DirectoryServer, ServerFormData, TestResult } from './types';

interface Server {
  id: number;
  name: string;
  transport: string;
  status: string;
  config?: any;
}

interface ServerStatus {
  name: string;
  status: string;
  error?: string;
  tools?: Array<{ name: string; description: string }>;
  resources?: Array<{ name?: string; uri: string; description?: string }>;
}

interface YourServersTabProps {
  servers: Server[];
  serverStatuses: ServerStatus[];
  showAddForm: boolean;
  editingServer: number | null;
  selectedDirectoryServer: DirectoryServer | null;
  expandedServers: Record<string, boolean>;
  formData: ServerFormData;
  testingConfig: boolean;
  loading: boolean;
  lastTestResult: TestResult | null;
  onShowAddForm: (show: boolean) => void;
  onToggleServerExpansion: (serverName: string) => void;
  onTestConnection: (serverId: number) => void;
  onEdit: (server: Server) => void;
  onDelete: (serverId: number) => void;
  onFormSubmit: (e: React.FormEvent) => void;
  onTestConfiguration: () => void;
  onFormCancel: () => void;
  setFormData: React.Dispatch<React.SetStateAction<ServerFormData>>;
}

export default function YourServersTab({
  servers,
  serverStatuses,
  showAddForm,
  editingServer,
  selectedDirectoryServer,
  expandedServers,
  formData,
  testingConfig,
  loading,
  lastTestResult,
  onShowAddForm,
  onToggleServerExpansion,
  onTestConnection,
  onEdit,
  onDelete,
  onFormSubmit,
  onTestConfiguration,
  onFormCancel,
  setFormData,
}: YourServersTabProps) {
  const getServerStatus = (serverName: string) => {
    return serverStatuses.find(status => status.name === serverName);
  };

  return (
    <div className="space-y-6">
      {/* Server List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Connected Servers</h3>
          <button
            onClick={() => onShowAddForm(!showAddForm)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Server
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-8">
            <ServerStackIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No MCP servers configured yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add your first server to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map(server => (
              <ServerCard
                key={server.id}
                server={server}
                serverStatus={getServerStatus(server.name)}
                isExpanded={expandedServers[server.name]}
                loading={loading}
                onToggleExpansion={onToggleServerExpansion}
                onTestConnection={onTestConnection}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <ServerForm
          formData={formData}
          setFormData={setFormData}
          editingServer={editingServer}
          selectedDirectoryServer={selectedDirectoryServer}
          testingConfig={testingConfig}
          loading={loading}
          lastTestResult={lastTestResult}
          onSubmit={onFormSubmit}
          onTestConfiguration={onTestConfiguration}
          onCancel={onFormCancel}
        />
      )}
    </div>
  );
}
