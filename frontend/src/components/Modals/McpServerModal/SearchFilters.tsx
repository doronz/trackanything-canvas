import React from 'react';
import { DirectoryFilters } from './types';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

interface SearchFiltersProps {
  searchQuery: string;
  debouncedSearchQuery: string;
  filters: DirectoryFilters;
  showFilters: boolean;
  categories: string[];
  programmingLanguages: string[];
  onSearchChange: (query: string) => void;
  onFiltersChange: (filters: DirectoryFilters) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export default function SearchFilters({
  searchQuery,
  debouncedSearchQuery,
  filters,
  showFilters,
  categories,
  programmingLanguages,
  onSearchChange,
  onFiltersChange,
  onToggleFilters,
  onClearFilters,
}: SearchFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search servers by name or description..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
          {/* Search pending indicator */}
          {searchQuery !== debouncedSearchQuery && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <ClockIcon
                className="w-4 h-4 text-yellow-500 animate-pulse"
                title="Search pending..."
              />
            </div>
          )}
        </div>
        <button
          onClick={onToggleFilters}
          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium ${
            showFilters
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          <FunnelIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onClearFilters}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
          title="Clear all filters"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={e => onFiltersChange({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language
            </label>
            <select
              value={filters.programming_language}
              onChange={e => onFiltersChange({ ...filters, programming_language: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Languages</option>
              {programmingLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          {/* TODO: Add server type back in when we support remote MCP servers */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Server Type
            </label>
            <select
              value={filters.server_type}
              onChange={(e) => onFiltersChange({ ...filters, server_type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="remote">Remote</option>
              <option value="local">Local</option>
            </select>
          </div> */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.is_official}
                onChange={e => onFiltersChange({ ...filters, is_official: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Official only</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Stars
            </label>
            <input
              type="number"
              min="0"
              value={filters.min_stars || ''}
              onChange={e =>
                onFiltersChange({ ...filters, min_stars: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
