import React from 'react';
import { ArrowPathIcon, ServerStackIcon, ClockIcon } from '@heroicons/react/24/outline';
import DirectoryServerCard from './DirectoryServerCard';
import SearchFilters from './SearchFilters';
import Pagination from './Pagination';
import { useDirectoryServers } from './useDirectoryServers';
import { DirectoryServer } from './types';

interface DirectoryTabProps {
  isOpen: boolean;
  activeTab: string;
  onSelectDirectoryServer: (server: DirectoryServer) => void;
}

export default function DirectoryTab({
  isOpen,
  activeTab,
  onSelectDirectoryServer,
}: DirectoryTabProps) {
  const {
    directoryServers,
    directoryStats,
    directoryLoading,
    refreshingDirectory,
    searchQuery,
    debouncedSearchQuery,
    filters,
    showFilters,
    categories,
    programmingLanguages,
    pagination,
    searchCache,
    setSearchQuery,
    setFilters,
    setShowFilters,
    handlePageChange,
    handleNextPage,
    handlePrevPage,
    handleClearFilters,
    handleRefreshDirectory,
  } = useDirectoryServers(isOpen, activeTab);

  return (
    <div className="space-y-6">
      {/* Directory Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            MCP Server Directory
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Discover and install MCP servers from the community
            {directoryStats && (
              <span className="ml-2">• {directoryStats.total_servers} servers available</span>
            )}
            {process.env.NODE_ENV === 'development' && (
              <span className="ml-2 text-xs">• {searchCache.size} cached queries</span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefreshDirectory}
          disabled={refreshingDirectory}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 mr-2 ${refreshingDirectory ? 'animate-spin' : ''}`} />
          {refreshingDirectory ? 'Refreshing...' : 'Refresh Directory'}
        </button>
      </div>

      {/* Search and Filters */}
      <SearchFilters
        searchQuery={searchQuery}
        debouncedSearchQuery={debouncedSearchQuery}
        filters={filters}
        showFilters={showFilters}
        categories={categories}
        programmingLanguages={programmingLanguages}
        onSearchChange={setSearchQuery}
        onFiltersChange={setFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearFilters={handleClearFilters}
      />

      {/* Directory Servers List */}
      <div className="space-y-3">
        {directoryLoading ? (
          <div className="text-center py-8">
            <ClockIcon className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading servers...</p>
          </div>
        ) : directoryServers.length === 0 ? (
          <div className="text-center py-8">
            <ServerStackIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No servers found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          directoryServers.map(server => (
            <DirectoryServerCard
              key={server.id}
              server={server}
              onSelect={onSelectDirectoryServer}
            />
          ))
        )}

        {/* Pagination Controls */}
        {!directoryLoading && directoryServers.length > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
          />
        )}
      </div>
    </div>
  );
}
