/**
 * Hook for handling different data sources in the Universal Widget System
 */

import { UniversalDataSource } from '@/types/universalWidget';
import { useCallback, useEffect, useState } from 'react';

interface UseDataSourceReturn {
  data: any;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDataSource(
  dataSource: UniversalDataSource,
  currentData?: any
): UseDataSourceReturn {
  const [data, setData] = useState<any>(currentData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      switch (dataSource.type) {
        case 'userInput':
          // For user input, we use the current widget data
          // Extract array data from legacy format or use directly
          let userData = currentData || [];

          // Handle legacy content format with nested arrays
          if (userData && typeof userData === 'object' && !Array.isArray(userData)) {
            // Try common array field names used in legacy widgets
            if (userData.items && Array.isArray(userData.items)) {
              userData = userData.items;
            } else if (userData.messages && Array.isArray(userData.messages)) {
              userData = userData.messages;
            } else if (userData.cards && Array.isArray(userData.cards)) {
              userData = userData.cards;
            } else if (userData.data && Array.isArray(userData.data)) {
              userData = userData.data;
            } else if (userData.columns && Array.isArray(userData.columns)) {
              userData = userData.columns;
            } else {
              // For non-array widgets (like Note, Text), convert to single-item array for validation
              userData = [userData];
            }
          }

          setData(userData);
          break;

        case 'static':
          // For static data, return the predefined data
          setData(dataSource.data || []);
          break;

        case 'api':
          // For API data source, fetch from the endpoint
          const response = await fetch(dataSource.endpoint, {
            method: dataSource.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...dataSource.headers,
              ...(dataSource.authentication?.type === 'bearer' && dataSource.authentication.token
                ? {
                    Authorization: `Bearer ${dataSource.authentication.token}`,
                  }
                : {}),
              ...(dataSource.authentication?.type === 'apiKey' && dataSource.authentication.apiKey
                ? {
                    'X-API-Key': dataSource.authentication.apiKey,
                  }
                : {}),
            },
            ...(dataSource.body ? { body: JSON.stringify(dataSource.body) } : {}),
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          const apiData = await response.json();
          setData(apiData);
          break;

        case 'database':
          // TODO: Implement database data source
          throw new Error('Database data source not yet implemented');

        case 'realtime':
          // For realtime data sources (like clocks, live data), use current widget content
          // This allows the component to manage its own real-time updates
          setData(currentData || {});
          break;

        default:
          throw new Error(`Unknown data source type: ${(dataSource as any).type}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [dataSource, currentData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up auto-refresh for API and other external sources
  useEffect(() => {
    if (
      dataSource &&
      typeof dataSource === 'object' &&
      'refreshInterval' in dataSource &&
      dataSource.refreshInterval &&
      dataSource.refreshInterval > 0
    ) {
      const interval = setInterval(fetchData, dataSource.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [dataSource, fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
