import { useState, useEffect, useCallback } from 'react';
import { mcpRegistryAPI } from '@/services/api';
import { RegistryServer, RegistryStats, RegistryFilters } from './types';
import toast from 'react-hot-toast';

export function useRegistryServers(isOpen: boolean, activeTab: string) {
  // Registry state
  const [registryServers, setRegistryServers] = useState<RegistryServer[]>([]);
  const [registryStats, setRegistryStats] = useState<RegistryStats | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Search and filters
  const [registrySearchQuery, setRegistrySearchQuery] = useState('');
  const [registryFilters, setRegistryFilters] = useState<RegistryFilters>({
    category: '',
    is_official: undefined,
    verified_only: false,
  });

  // Load registry data
  const loadRegistryData = useCallback(async () => {
    try {
      const [statsResponse, categoriesResponse] = await Promise.all([
        mcpRegistryAPI.getStats(),
        mcpRegistryAPI.getCategories(),
      ]);

      setRegistryStats(statsResponse.data);
      // TODO: Handle categories for registry if needed
    } catch (error) {
      console.error('Failed to load registry data:', error);
      toast.error('Failed to load registry data');
    }
  }, []);

  // Search registry servers
  const searchRegistryServers = useCallback(async () => {
    setRegistryLoading(true);
    try {
      const searchData = {
        query: registrySearchQuery || undefined,
        category: registryFilters.category || undefined,
        is_official: registryFilters.is_official,
        limit: 50,
        offset: 0,
      };

      const response = await mcpRegistryAPI.searchServers(searchData);
      setRegistryServers(response.data);
    } catch (error) {
      console.error('Failed to search registry:', error);
      toast.error('Failed to search registry servers');
    } finally {
      setRegistryLoading(false);
    }
  }, [registrySearchQuery, registryFilters]);

  // Sync registry
  const handleSyncRegistry = async () => {
    setSyncing(true);
    try {
      const response = await mcpRegistryAPI.syncRegistry();
      const result = response.data;

      if (result.success) {
        toast.success(
          `✅ Registry synced successfully!\nNew: ${result.synced_count}, Updated: ${result.updated_count}\nTotal: ${result.total_servers} servers`,
          { duration: 5000 }
        );

        // Reload registry data
        await loadRegistryData();
        await searchRegistryServers();
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Failed to sync registry:', error);
      const errorMessage =
        error.response?.data?.detail || error.message || 'Failed to sync registry';
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  // Clear registry filters
  const clearRegistryFilters = useCallback(() => {
    setRegistryFilters({
      category: '',
      is_official: undefined,
      verified_only: false,
    });
    setRegistrySearchQuery('');
  }, []);

  // Load registry data when switching to registry tab
  useEffect(() => {
    if (isOpen && activeTab === 'registry') {
      loadRegistryData();
      searchRegistryServers();
    }
  }, [isOpen, activeTab, loadRegistryData, searchRegistryServers]);

  // Search registry servers when search query or filters change
  useEffect(() => {
    if (activeTab === 'registry') {
      searchRegistryServers();
    }
  }, [registrySearchQuery, registryFilters, activeTab, searchRegistryServers]);

  return {
    // State
    registryServers,
    registryStats,
    registryLoading,
    syncing,
    registrySearchQuery,
    registryFilters,

    // Actions
    setRegistrySearchQuery,
    setRegistryFilters,
    handleSyncRegistry,
    clearRegistryFilters,
    searchRegistryServers,
  };
}
