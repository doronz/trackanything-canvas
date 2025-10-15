import React from 'react';
import { DirectoryServer, ServerFormData, TestResult } from './types';
import {
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

interface ServerFormProps {
  formData: ServerFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServerFormData>>;
  editingServer: number | null;
  selectedDirectoryServer: DirectoryServer | null;
  testingConfig: boolean;
  loading: boolean;
  lastTestResult: TestResult | null;
  onSubmit: (e: React.FormEvent) => void;
  onTestConfiguration: () => void;
  onCancel: () => void;
}

export default function ServerForm({
  formData,
  setFormData,
  editingServer,
  selectedDirectoryServer,
  testingConfig,
  loading,
  lastTestResult,
  onSubmit,
  onTestConfiguration,
  onCancel,
}: ServerFormProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {editingServer
          ? 'Edit MCP Server'
          : selectedDirectoryServer
            ? `Configure ${selectedDirectoryServer.name}`
            : 'Add New MCP Server'}
      </h3>

      {/* Configuration Instructions */}
      {!editingServer && !selectedDirectoryServer && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-6">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">Need help with configuration?</p>
              <p className="mb-2">
                Visit the MCP server's GitHub repository or documentation page for specific setup
                instructions, including required commands, arguments, and environment variables.
              </p>
              <p className="text-blue-600 dark:text-blue-300">
                💡 <strong>Tip:</strong> Use the "Server Directory" tab above to browse popular MCP
                servers with pre-filled configurations.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedDirectoryServer && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Selected from directory:</strong>{' '}
                {selectedDirectoryServer.short_description}
              </p>
              <a
                href={selectedDirectoryServer.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center mt-1"
              >
                View on GitHub <ArrowTopRightOnSquareIcon className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My MCP Server"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Connection Type
            </label>
            <select
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="local">Local</option>
              <option value="remote">Remote</option>
            </select>
          </div>
        </div>

        {formData.type === 'local' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Command
              </label>
              <input
                type="text"
                value={formData.command}
                onChange={e => setFormData(prev => ({ ...prev, command: e.target.value }))}
                placeholder="node server.js"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Arguments
              </label>
              <input
                type="text"
                value={formData.args}
                onChange={e => setFormData(prev => ({ ...prev, args: e.target.value }))}
                placeholder="--port 3000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://localhost:3000/mcp"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Environment Variables (JSON)
          </label>
          <textarea
            value={formData.env}
            onChange={e => setFormData(prev => ({ ...prev, env: e.target.value }))}
            placeholder='{"API_KEY": "your-key"}'
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
          />
        </div>

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onTestConfiguration}
            disabled={testingConfig || !formData.name.trim()}
            className="flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon className="w-4 h-4 mr-2" />
            {testingConfig ? 'Testing...' : 'Test Configuration'}
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border border-transparent rounded-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? editingServer
                  ? 'Updating...'
                  : 'Adding...'
                : editingServer
                  ? 'Update Server'
                  : 'Add Server'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
