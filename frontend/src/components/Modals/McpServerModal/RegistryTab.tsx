import React from 'react';
import { ArrowPathIcon, ServerStackIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import RegistryServerCard from './RegistryServerCard';
import { useRegistryServers } from './useRegistryServers';
import { RegistryServer } from './types';

interface RegistryTabProps {
  isOpen: boolean;
  activeTab: string;
  onInstallFromRegistry: (server: RegistryServer) => void;
}

export default function RegistryTab({
  isOpen,
  activeTab,
  onInstallFromRegistry,
}: RegistryTabProps) {
  const {
    registryServers,
    registryStats,
    registryLoading,
    syncing,
    registrySearchQuery,
    registryFilters,
    setRegistrySearchQuery,
    setRegistryFilters,
    handleSyncRegistry,
    clearRegistryFilters,
  } = useRegistryServers(isOpen, activeTab);

  return (
    <div className="space-y-6">
      {/* Registry Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            🌟 Official MCP Registry
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <p>
              Discover and install official MCP servers from{' '}
              <a
                href="https://github.com/modelcontextprotocol/registry"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500"
              >
                Anthropic's registry
              </a>
              . This is experimental so please checkout the MCP servers information before
              installing.
            </p>
            {registryStats && (
              <span className="ml-2 text-green-600 dark:text-green-400">
                • {registryStats.total_servers} servers • {registryStats.official_servers} official
                • {registryStats.verified_servers} verified
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSyncRegistry}
          disabled={syncing}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Registry'}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search registry servers..."
                value={registrySearchQuery}
                onChange={e => setRegistrySearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={clearRegistryFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Clear Filters
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={registryFilters.category}
              onChange={e => setRegistryFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All Categories</option>
              <option value="System">System</option>
              <option value="Search">Search</option>
              <option value="Development">Development</option>
              <option value="AI">AI</option>
              <option value="Productivity">Productivity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={registryFilters.is_official?.toString() || ''}
              onChange={e =>
                setRegistryFilters(prev => ({
                  ...prev,
                  is_official: e.target.value === '' ? undefined : e.target.value === 'true',
                }))
              }
            >
              <option value="">All Servers</option>
              <option value="true">Official Only</option>
              <option value="false">Community</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                checked={registryFilters.verified_only}
                onChange={e =>
                  setRegistryFilters(prev => ({ ...prev, verified_only: e.target.checked }))
                }
              />
              <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Verified only</label>
            </div>
          </div>
        </div>
      </div>

      {/* Registry Servers List */}
      <div className="space-y-4">
        {registryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Loading servers...</span>
            </div>
          </div>
        ) : registryServers.length === 0 ? (
          <div className="text-center py-12">
            <ServerStackIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No servers found matching your criteria
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          registryServers.map(server => (
            <RegistryServerCard
              key={server.registry_id}
              server={server}
              onInstall={onInstallFromRegistry}
            />
          ))
        )}
      </div>
    </div>
  );
}
