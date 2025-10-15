import { useState, useEffect, useCallback, useRef } from 'react';
import { mcpDirectoryAPI } from '@/services/api';
import { DirectoryServer, DirectoryStats, DirectoryFilters, PaginationState } from './types';
import toast from 'react-hot-toast';

export function useDirectoryServers(isOpen: boolean, activeTab: string) {
  // Directory state
  const [directoryServers, setDirectoryServers] = useState<DirectoryServer[]>([]);
  const [directoryStats, setDirectoryStats] = useState<DirectoryStats | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [refreshingDirectory, setRefreshingDirectory] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filters, setFilters] = useState<DirectoryFilters>({
    category: '',
    programming_language: '',
    tags: '',
    is_official: false,
    min_stars: 0,
    server_type: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter options
  const [categories, setCategories] = useState<string[]>([]);
  const [programmingLanguages, setProgrammingLanguages] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Pagination
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
    perPage: 20,
  });

  // Search optimization
  const [searchCache, setSearchCache] = useState<Map<string, any>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceDelay = 500;

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, searchDebounceDelay);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchDebounceDelay]);

  // Create cache key for search parameters
  const createCacheKey = useCallback(
    (searchQuery: string, filters: DirectoryFilters, page: number) => {
      return JSON.stringify({
        query: searchQuery || '',
        category: filters.category || '',
        programming_language: filters.programming_language || '',
        tags: filters.tags || '',
        is_official: filters.is_official || false,
        min_stars: filters.min_stars || 0,
        server_type: filters.server_type || '',
        page,
        per_page: pagination.perPage,
      });
    },
    [pagination.perPage]
  );

  // Load directory data
  const loadDirectoryData = useCallback(async () => {
    try {
      const [statsResponse, categoriesResponse, languagesResponse, tagsResponse] =
        await Promise.all([
          mcpDirectoryAPI.getStats(),
          mcpDirectoryAPI.getCategories(),
          mcpDirectoryAPI.getProgrammingLanguages(),
          mcpDirectoryAPI.getTags(),
        ]);

      setDirectoryStats(statsResponse.data);
      setCategories(categoriesResponse.data);
      setProgrammingLanguages(languagesResponse.data);
      setAllTags(tagsResponse.data);
    } catch (error) {
      console.error('Failed to load directory data:', error);
      toast.error('Failed to load directory data');
    }
  }, []);

  // Search directory servers
  const searchDirectoryServers = useCallback(
    async (page = pagination.currentPage, queryOverride?: string) => {
      const effectiveQuery = queryOverride !== undefined ? queryOverride : debouncedSearchQuery;
      const cacheKey = createCacheKey(effectiveQuery, filters, page);

      // Check cache first
      if (searchCache.has(cacheKey)) {
        const cachedData = searchCache.get(cacheKey);
        setDirectoryServers(cachedData.servers);
        setPagination(prev => ({
          ...prev,
          currentPage: cachedData.page,
          totalPages: cachedData.total_pages,
          totalCount: cachedData.total_count,
          hasNext: cachedData.has_next,
          hasPrev: cachedData.has_prev,
        }));
        return;
      }

      setDirectoryLoading(true);
      try {
        const params = {
          query: effectiveQuery || undefined,
          category: filters.category || undefined,
          programming_language: filters.programming_language || undefined,
          tags: filters.tags || undefined,
          is_official: filters.is_official || undefined,
          min_stars: filters.min_stars > 0 ? filters.min_stars : undefined,
          server_type: filters.server_type || undefined,
          page: page,
          per_page: pagination.perPage,
        };

        const response = await mcpDirectoryAPI.search(params);
        const data = response.data;

        // Cache the result
        setSearchCache(prev => new Map(prev.set(cacheKey, data)));

        setDirectoryServers(data.servers);
        setPagination(prev => ({
          ...prev,
          currentPage: data.page,
          totalPages: data.total_pages,
          totalCount: data.total_count,
          hasNext: data.has_next,
          hasPrev: data.has_prev,
        }));
      } catch (error) {
        console.error('Failed to search directory:', error);
        toast.error('Failed to search directory');
      } finally {
        setDirectoryLoading(false);
      }
    },
    [
      debouncedSearchQuery,
      filters,
      pagination.currentPage,
      pagination.perPage,
      createCacheKey,
      searchCache,
    ]
  );

  // Pagination handlers
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
      searchDirectoryServers(newPage);
    },
    [searchDirectoryServers]
  );

  const handleNextPage = useCallback(() => {
    if (pagination.hasNext) {
      handlePageChange(pagination.currentPage + 1);
    }
  }, [pagination.hasNext, pagination.currentPage, handlePageChange]);

  const handlePrevPage = useCallback(() => {
    if (pagination.hasPrev) {
      handlePageChange(pagination.currentPage - 1);
    }
  }, [pagination.hasPrev, pagination.currentPage, handlePageChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setFilters({
      category: '',
      programming_language: '',
      tags: '',
      is_official: false,
      min_stars: 0,
      server_type: '',
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setSearchCache(new Map());
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, []);

  // Refresh directory
  const handleRefreshDirectory = useCallback(async () => {
    setRefreshingDirectory(true);
    try {
      await loadDirectoryData();
      await searchDirectoryServers();
      toast.success('Directory data refreshed!');
    } catch (error) {
      console.error('Failed to refresh directory:', error);
      toast.error('Failed to refresh directory');
    } finally {
      setRefreshingDirectory(false);
    }
  }, [loadDirectoryData, searchDirectoryServers]);

  // Load directory data when switching to directory tab
  useEffect(() => {
    if (isOpen && activeTab === 'directory') {
      loadDirectoryData();
      searchDirectoryServers();
    }
  }, [isOpen, activeTab, loadDirectoryData, searchDirectoryServers]);

  // Search directory servers when debounced search query or filters change (reset to page 1)
  useEffect(() => {
    if (
      activeTab === 'directory' &&
      (debouncedSearchQuery || Object.values(filters).some(f => f))
    ) {
      setPagination(prev => ({ ...prev, currentPage: 1 }));
      searchDirectoryServers(1);
    }
  }, [debouncedSearchQuery, filters, activeTab, searchDirectoryServers]);

  return {
    // State
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
    allTags,
    pagination,
    searchCache,

    // Actions
    setSearchQuery,
    setFilters,
    setShowFilters,
    handlePageChange,
    handleNextPage,
    handlePrevPage,
    handleClearFilters,
    handleRefreshDirectory,
    searchDirectoryServers,
  };
}
