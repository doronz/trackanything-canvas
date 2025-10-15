import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
  createMCPServer,
  updateMCPServer,
  deleteMCPServer,
  connectMCPServer,
  fetchServerStatuses,
} from '@/store/mcpSlice';
import { closeModal } from '@/store/uiSlice';
import BaseModal from './BaseModal';
import { mcpDirectoryAPI, mcpAPI, mcpRegistryAPI } from '@/services/api';
import { CogIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

// Component imports
import YourServersTab from './McpServerModal/YourServersTab';
import DirectoryTab from './McpServerModal/DirectoryTab';
import RegistryTab from './McpServerModal/RegistryTab';
import ConfirmationDialog from './McpServerModal/ConfirmationDialog';

// Types
import {
  McpServerModalProps,
  DirectoryServer,
  RegistryServer,
  ServerFormData,
  TestResult,
} from './McpServerModal/types';

export default function McpServerModal({ isOpen }: McpServerModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { servers, serverStatuses, loading } = useSelector((state: RootState) => state.mcp);

  // Tab management
  const [activeTab, setActiveTab] = useState<'your-servers' | 'directory' | 'registry'>(
    'your-servers'
  );

  // Your servers state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<number | null>(null);
  const [testingConfig, setTestingConfig] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestResult | null>(null);
  const [showFailedTestConfirmation, setShowFailedTestConfirmation] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});
  const [selectedDirectoryServer, setSelectedDirectoryServer] = useState<DirectoryServer | null>(
    null
  );
  const [formData, setFormData] = useState<ServerFormData>({
    name: '',
    url: '',
    type: 'local',
    command: '',
    args: '',
    env: '',
  });

  // Fetch server statuses when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchServerStatuses());
    }
  }, [isOpen, dispatch]);

  const handleClose = () => {
    dispatch(closeModal('mcpServerConfig'));
    setShowAddForm(false);
    setEditingServer(null);
    setTestingConfig(false);
    setExpandedServers({});
    setActiveTab('your-servers');
    setSelectedDirectoryServer(null);
    resetForm();
  };

  const toggleServerExpansion = (serverName: string) => {
    setExpandedServers(prev => ({
      ...prev,
      [serverName]: !prev[serverName],
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      type: 'local',
      command: '',
      args: '',
      env: '',
    });
    setEditingServer(null);
    setLastTestResult(null);
    setShowFailedTestConfirmation(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }

    // Check if configuration test failed and show confirmation
    if (!editingServer && lastTestResult && lastTestResult.status === 'error') {
      setShowFailedTestConfirmation(true);
      return;
    }

    await performServerAction();
  };

  const performServerAction = async () => {
    try {
      // Map frontend types to backend transport types
      const transportType = formData.type === 'local' ? 'stdio' : 'http';

      const serverData = {
        name: formData.name.trim(),
        transport: transportType as 'stdio' | 'http' | 'sse',
        config: {
          url: formData.url.trim(),
          command: formData.command.trim(),
          args: formData.args.trim().split(' ').filter(Boolean),
          env: formData.env.trim() ? JSON.parse(formData.env) : {},
        },
      };

      if (editingServer) {
        // Update existing server
        await dispatch(
          updateMCPServer({
            id: editingServer,
            data: serverData,
          })
        ).unwrap();
        toast.success('MCP server updated successfully!');
      } else {
        // Create new server
        await dispatch(createMCPServer(serverData)).unwrap();
        toast.success('MCP server added successfully!');
      }

      setShowAddForm(false);
      resetForm();
      setLastTestResult(null); // Clear test result after successful addition
    } catch (error) {
      toast.error(editingServer ? 'Failed to update MCP server' : 'Failed to add MCP server');
      console.error('Error with MCP server:', error);
    }
  };

  const handleConfirmFailedTest = async () => {
    setShowFailedTestConfirmation(false);
    await performServerAction();
  };

  const handleCancelFailedTest = () => {
    setShowFailedTestConfirmation(false);
  };

  const handleDelete = async (serverId: number) => {
    if (window.confirm('Are you sure you want to delete this MCP server?')) {
      try {
        await dispatch(deleteMCPServer(serverId)).unwrap();
        toast.success('MCP server deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete MCP server');
      }
    }
  };

  const handleEdit = (server: any) => {
    setFormData({
      name: server.name,
      url: server.config.url || '',
      type: server.transport,
      command: server.config.command || '',
      args: Array.isArray(server.config.args) ? server.config.args.join(' ') : '',
      env: server.config.env ? JSON.stringify(server.config.env, null, 2) : '',
    });
    setEditingServer(server.id);
    setShowAddForm(true);
  };

  const handleTestConfiguration = async () => {
    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }

    setTestingConfig(true);
    try {
      // Prepare configuration for testing
      const config: Record<string, any> = {};

      if (formData.type === 'local') {
        if (!formData.command.trim()) {
          toast.error('Command is required for local servers');
          return;
        }
        config.command = formData.command.trim();
        if (formData.args.trim()) {
          config.args = formData.args.trim().split(' ').filter(Boolean);
        }
      } else if (formData.type === 'remote') {
        if (!formData.url.trim()) {
          toast.error('URL is required for remote servers');
          return;
        }
        config.url = formData.url.trim();
      }

      if (formData.env.trim()) {
        try {
          config.env = JSON.parse(formData.env);
        } catch (e) {
          toast.error('Invalid JSON in environment variables');
          return;
        }
      }

      // Test the configuration using the new endpoint
      // Map frontend types to backend transport types
      const transportType = formData.type === 'local' ? 'stdio' : 'http';

      const response = await mcpAPI.testConfig({
        transport: transportType as 'stdio' | 'http' | 'sse',
        config,
      });

      const { status, message } = response.data;

      // Store test result for later reference
      setLastTestResult({ status, message });

      if (status === 'success') {
        toast.success(message);
      } else if (status === 'warning') {
        toast.success(`⚠️ ${message}`);
      } else {
        toast.error(message);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail || error.message || 'Configuration test failed';
      toast.error(errorMessage);
      console.error('Test error:', error);
    } finally {
      setTestingConfig(false);
    }
  };

  const handleTestConnection = async (serverId: number) => {
    try {
      await dispatch(connectMCPServer(serverId)).unwrap();
      toast.success('Connection test successful!');
    } catch (error) {
      toast.error('Connection test failed');
    }
  };

  const handleSelectDirectoryServer = async (server: DirectoryServer) => {
    try {
      const configResponse = await mcpDirectoryAPI.getInstallConfig(server.id);
      const configData = configResponse.data;

      // Pre-fill the form with server data including smart command detection
      const smartCommand = (configData.installation as any)?.recommended_command || {
        command: 'uvx',
        args: [configData.server_info.name],
      };

      // Check if this is a remote server (based on programming language)
      const isRemoteServer = server.programming_language === 'Remote';

      setFormData({
        name: configData.server_info.name,
        url: isRemoteServer ? server.github_url : '',
        type: isRemoteServer ? 'remote' : 'local',
        command: smartCommand.command,
        args: Array.isArray(smartCommand.args) ? smartCommand.args.join(' ') : smartCommand.args,
        env:
          configData.configuration.required_env_vars &&
          configData.configuration.required_env_vars.length > 0
            ? JSON.stringify(
                configData.configuration.required_env_vars.reduce(
                  (acc, envVar) => {
                    acc[envVar] = 'YOUR_' + envVar.toUpperCase();
                    return acc;
                  },
                  {} as Record<string, string>
                ),
                null,
                2
              )
            : '',
      });

      setSelectedDirectoryServer(server);
      setActiveTab('your-servers');
      setShowAddForm(true);

      // Show installation instructions
      if (configData.installation.commands.length > 0 || configData.installation.instructions) {
        const instructions = [
          configData.installation.instructions,
          ...configData.installation.commands.map(cmd => `Run: ${cmd}`),
        ]
          .filter(Boolean)
          .join('\n\n');

        toast.success(
          <div className="text-sm">
            <div className="font-medium mb-2">Server selected! Installation instructions:</div>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
              {instructions}
            </pre>
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error) {
      console.error('Failed to get server config:', error);
      toast.error('Failed to get server configuration');
    }
  };

  const handleInstallFromRegistry = async (server: RegistryServer, customName?: string) => {
    try {
      // Get detailed server info from the MCP Registry API
      const response = await mcpRegistryAPI.getServerDetails(server.registry_id);
      const serverDetails = response.data;

      // Parse the server data to pre-fill the form
      const packages = serverDetails.packages || [];
      const remotes = serverDetails.remotes || [];

      let connectionType = 'local';
      let command = '';
      let args = '';
      const envVars: Record<string, string> = {};

      if (packages.length > 0) {
        // Use the first package as primary
        const mainPackage = packages[0];
        const registryType = mainPackage.registry_type;
        const identifier = mainPackage.identifier;

        connectionType = 'local';

        if (registryType === 'npm') {
          command = 'npx';
          args = identifier;
        } else if (registryType === 'pypi') {
          command = 'python';
          args = `-m ${identifier}`;
        } else if (registryType === 'oci') {
          command = 'docker';
          args = `run --rm -i ${identifier}`;
        } else {
          command = identifier;
          args = '';
        }

        // Extract environment variables
        const envVarsList = mainPackage.environment_variables || [];
        envVarsList.forEach((envVar: any) => {
          if (envVar.name) {
            // Use the description as a placeholder value for required vars
            const placeholder = envVar.is_required
              ? `<REQUIRED: ${envVar.description || envVar.name}>`
              : `<OPTIONAL: ${envVar.description || envVar.name}>`;
            envVars[envVar.name] = placeholder;
          }
        });
      } else if (remotes.length > 0) {
        // Use remote connection
        connectionType = 'remote';
        const mainRemote = remotes[0];
        command = '';
        args = mainRemote.url || '';
      }

      // Pre-fill the form data
      setFormData({
        name: customName || server.name,
        url: connectionType === 'remote' ? args : '',
        type: connectionType as 'local' | 'remote',
        command: command,
        args: connectionType === 'local' ? args : '',
        env: Object.keys(envVars).length > 0 ? JSON.stringify(envVars, null, 2) : '',
      });

      // Switch to your servers tab and show the form
      setActiveTab('your-servers');
      setShowAddForm(true);
      setEditingServer(null); // Ensure we're in add mode

      // Show success message with installation guide
      toast.success(
        <div className="text-sm">
          <div className="font-medium mb-2">📋 Server configuration pre-filled!</div>
          <div className="text-xs text-gray-600">
            Review the settings and click "Add Server" to install.
            <br />
            <strong>{server.name}</strong> v{server.version}
          </div>
        </div>,
        { duration: 6000 }
      );
    } catch (error: any) {
      console.error('Failed to get server details:', error);

      // Fallback: use basic info from the server object
      setFormData({
        name: customName || server.name,
        url: '',
        type: 'local',
        command: server.package_manager === 'npm' ? 'npx' : 'python',
        args: server.package_manager === 'npm' ? server.package_name : `-m ${server.package_name}`,
        env: '',
      });

      setActiveTab('your-servers');
      setShowAddForm(true);
      setEditingServer(null);

      toast(
        <div className="text-sm">
          <div className="font-medium mb-2">⚠️ Basic configuration pre-filled</div>
          <div className="text-xs text-gray-600">
            Could not fetch detailed settings. Please review and configure manually.
          </div>
        </div>,
        {
          duration: 5000,
          icon: '⚠️',
        }
      );
    }
  };

  const handleFormCancel = () => {
    setShowAddForm(false);
    resetForm();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="MCP Server Management"
      description="Local (STDIO) MCP servers should work out of the box, just like any other MCP client. We do not support oAuth yet, so remote MCP servers will be in our roadmap. Anthropic's MCP Registry is also in our roadmap. For now, you can use https://github.com/geelen/mcp-remote to install remote MCP servers."
      size="xl"
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('your-servers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'your-servers'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CogIcon className="w-4 h-4" />
                <span>Your Servers</span>
                {servers.length > 0 && (
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs rounded-full px-2 py-0.5">
                    {servers.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'directory'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ServerStackIcon className="w-4 h-4" />
                <span>Server Directory</span>
              </div>
            </button>
            {/* TODO: Add official Anthropic MCP Registry */}
            {/* <button
              onClick={() => setActiveTab('registry')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'registry'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <StarIconSolid className="w-4 h-4" />
                <span>Official Registry</span>
              </div>
            </button> */}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'your-servers' && (
          <YourServersTab
            servers={servers}
            serverStatuses={serverStatuses}
            showAddForm={showAddForm}
            editingServer={editingServer}
            selectedDirectoryServer={selectedDirectoryServer}
            expandedServers={expandedServers}
            formData={formData}
            testingConfig={testingConfig}
            loading={loading}
            lastTestResult={lastTestResult}
            onShowAddForm={setShowAddForm}
            onToggleServerExpansion={toggleServerExpansion}
            onTestConnection={handleTestConnection}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFormSubmit={handleSubmit}
            onTestConfiguration={handleTestConfiguration}
            onFormCancel={handleFormCancel}
            setFormData={setFormData}
          />
        )}

        {activeTab === 'directory' && (
          <DirectoryTab
            isOpen={isOpen}
            activeTab={activeTab}
            onSelectDirectoryServer={handleSelectDirectoryServer}
          />
        )}

        {activeTab === 'registry' && (
          <RegistryTab
            isOpen={isOpen}
            activeTab={activeTab}
            onInstallFromRegistry={handleInstallFromRegistry}
          />
        )}
      </div>

      {/* Failed Test Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showFailedTestConfirmation}
        lastTestResult={lastTestResult}
        onConfirm={handleConfirmFailedTest}
        onCancel={handleCancelFailedTest}
      />
    </BaseModal>
  );
}
