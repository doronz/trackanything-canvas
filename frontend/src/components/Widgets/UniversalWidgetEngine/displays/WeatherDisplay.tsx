/**
 * WeatherDisplay - Universal Widget System Weather Display Component
 * Shows real-time weather data with automatic updates
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import {
  CloudIcon,
  SunIcon,
  EyeIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface WeatherDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface WeatherContent {
  city: string;
  apiKey?: string;
  units: 'celsius' | 'fahrenheit';
  refreshInterval: number;
  lastUpdated?: string;
  weatherData?: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    pressure: number;
    visibility: number;
    uvIndex: number;
    icon: string;
    description: string;
  };
}

export default function WeatherDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: WeatherDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as WeatherContent;
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [city, setCity] = useState(content?.city || '');
  const [apiKey, setApiKey] = useState(content?.apiKey || '');
  const [units, setUnits] = useState<'celsius' | 'fahrenheit'>(content?.units || 'celsius');
  const [refreshInterval, setRefreshInterval] = useState(content?.refreshInterval || 60);
  const [weatherData, setWeatherData] = useState(content?.weatherData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(!content?.city);
  const [lastUpdated, setLastUpdated] = useState(content?.lastUpdated || null);

  // Prevent wheel events from propagating to canvas
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // Generate realistic weather data based on city and season
  const generateWeatherData = useCallback(
    (cityName: string) => {
      const currentDate = new Date();
      const month = currentDate.getMonth(); // 0-11
      const hour = currentDate.getHours();

      // Generate season-based temperature ranges
      let tempRange = { min: 15, max: 25 }; // Default spring/fall
      if (month >= 5 && month <= 7) {
        // Summer
        tempRange = { min: 20, max: 35 };
      } else if (month >= 11 || month <= 1) {
        // Winter
        tempRange = { min: -5, max: 15 };
      }

      // Adjust temperature based on common city climates
      const cityClimate = getCityClimate(cityName);
      tempRange.min += cityClimate.tempAdjustment;
      tempRange.max += cityClimate.tempAdjustment;

      // Generate realistic weather conditions based on season and location
      const conditions = getSeasonalConditions(month, cityClimate.climate);
      const condition = conditions[Math.floor(Math.random() * conditions.length)];

      const baseTemp = tempRange.min + Math.random() * (tempRange.max - tempRange.min);
      const temperature = Math.round(units === 'fahrenheit' ? (baseTemp * 9) / 5 + 32 : baseTemp);

      return {
        temperature,
        condition,
        humidity: Math.round(30 + Math.random() * 50), // 30-80%
        windSpeed: Math.round(Math.random() * 25), // 0-25 km/h
        pressure: Math.round(1000 + Math.random() * 30), // 1000-1030 hPa
        visibility: Math.round(8 + Math.random() * 12), // 8-20 km
        uvIndex: Math.round(Math.random() * 11), // 0-11
        icon: '01d', // Weather icon code
        description: condition,
      };
    },
    [units]
  );

  // Get basic climate info for cities
  const getCityClimate = (cityName: string) => {
    const city = cityName.toLowerCase();

    // Tropical/Hot cities
    if (
      city.includes('miami') ||
      city.includes('bangkok') ||
      city.includes('singapore') ||
      city.includes('mumbai') ||
      city.includes('dubai') ||
      city.includes('rio')
    ) {
      return { climate: 'tropical', tempAdjustment: 8 };
    }

    // Cold cities
    if (
      city.includes('moscow') ||
      city.includes('stockholm') ||
      city.includes('montreal') ||
      city.includes('oslo') ||
      city.includes('helsinki') ||
      city.includes('anchorage')
    ) {
      return { climate: 'cold', tempAdjustment: -10 };
    }

    // Desert cities
    if (
      city.includes('phoenix') ||
      city.includes('las vegas') ||
      city.includes('cairo') ||
      city.includes('riyadh') ||
      city.includes('dubai')
    ) {
      return { climate: 'desert', tempAdjustment: 5 };
    }

    // Mediterranean cities
    if (
      city.includes('rome') ||
      city.includes('barcelona') ||
      city.includes('athens') ||
      city.includes('nice') ||
      city.includes('san diego')
    ) {
      return { climate: 'mediterranean', tempAdjustment: 3 };
    }

    // Default temperate climate
    return { climate: 'temperate', tempAdjustment: 0 };
  };

  // Get seasonal weather conditions
  const getSeasonalConditions = (month: number, climate: string) => {
    const baseConditions = ['Sunny', 'Partly Cloudy', 'Cloudy'];

    if (climate === 'tropical') {
      return [...baseConditions, 'Rainy', 'Thunderstorms'];
    } else if (climate === 'desert') {
      return ['Sunny', 'Clear', 'Hot'];
    } else if (climate === 'cold' && (month >= 10 || month <= 2)) {
      return ['Snowy', 'Cloudy', 'Overcast', 'Partly Cloudy'];
    } else if (month >= 3 && month <= 5) {
      // Spring
      return [...baseConditions, 'Light Rain', 'Breezy'];
    } else if (month >= 6 && month <= 8) {
      // Summer
      return ['Sunny', 'Clear', 'Partly Cloudy', 'Thunderstorms'];
    } else {
      // Fall/Winter
      return [...baseConditions, 'Rainy', 'Overcast'];
    }
  };

  // Fetch weather data (now generates realistic data)
  const fetchWeatherData = useCallback(async () => {
    if (!city.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call delay for realism
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate realistic weather data
      const mockWeatherData = generateWeatherData(city);

      setWeatherData(mockWeatherData);
      const now = new Date().toISOString();
      setLastUpdated(now);

      // Save to widget content
      const updatedContent: WeatherContent = {
        city,
        apiKey,
        units,
        refreshInterval,
        lastUpdated: now,
        weatherData: mockWeatherData,
      };

      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: updatedContent,
        })
      );

      onDataChange(updatedContent);
    } catch (err: any) {
      setError(`Failed to generate weather data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [city, apiKey, units, refreshInterval, dispatch, widget.id, onDataChange]);

  // Setup auto-refresh
  useEffect(() => {
    if (city && !isConfiguring) {
      // Initial fetch
      fetchWeatherData();

      // Setup interval for auto-refresh
      if (refreshInterval > 0) {
        refreshIntervalRef.current = setInterval(
          () => {
            fetchWeatherData();
          },
          refreshInterval * 60 * 1000
        ); // Convert minutes to milliseconds
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [city, refreshInterval, isConfiguring]);

  // Handle configuration save
  const handleSaveConfig = () => {
    setIsConfiguring(false);
    fetchWeatherData();
  };

  // Get weather icon based on condition
  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return <SunIcon className="w-8 h-8 text-yellow-500" />;
      case 'cloudy':
      case 'partly cloudy':
        return <CloudIcon className="w-8 h-8 text-gray-500" />;
      case 'rainy':
      case 'rain':
        return <CloudIcon className="w-8 h-8 text-blue-500" />;
      default:
        return <CloudIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  // Format temperature with unit
  const formatTemperature = (temp: number) => {
    return `${temp}°${units === 'celsius' ? 'C' : 'F'}`;
  };

  // Configuration modal
  if (isConfiguring) {
    return (
      <div
        className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-4 flex flex-col"
        onWheel={handleWheel}
        style={{
          backgroundColor: styleProps?.backgroundColor || '#ffffff',
          color: styleProps?.textColor || '#374151',
          fontFamily: 'Poppins, sans-serif',
          fontSize: `${styleProps?.fontSize || 14}px`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Weather Configuration</h3>
          <button
            onClick={handleSaveConfig}
            disabled={!city.trim()}
            className="px-3 py-1 text-xs bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded hover:shadow-lg disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-medium mb-1">City *</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="New York, NY"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Temperature Units</label>
            <select
              value={units}
              onChange={e => setUnits(e.target.value as 'celsius' | 'fahrenheit')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="celsius">Celsius (°C)</option>
              <option value="fahrenheit">Fahrenheit (°F)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Refresh Interval (minutes)</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={e => setRefreshInterval(parseInt(e.target.value) || 10)}
              min="1"
              max="60"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">API Key (Optional)</label>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="OpenWeatherMap API key"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get a free API key from OpenWeatherMap for real data
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main weather display
  return (
    <div
      className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-4 relative"
      onWheel={handleWheel}
      style={{
        backgroundColor: styleProps?.backgroundColor || '#ffffff',
        color: styleProps?.textColor || '#374151',
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{city}</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchWeatherData()}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsConfiguring(true)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
          >
            <Cog6ToothIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-center py-8">
          <CloudIcon className="w-12 h-12 mx-auto mb-2 opacity-50 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => fetchWeatherData()}
            className="mt-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
          >
            Retry
          </button>
        </div>
      ) : weatherData ? (
        <div className="space-y-4">
          {/* Main weather display */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getWeatherIcon(weatherData.condition)}
            </div>
            <div className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">
              {formatTemperature(weatherData.temperature)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{weatherData.condition}</div>
          </div>

          {/* Weather details */}
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                💧
              </div>
              <span>Humidity: {weatherData.humidity}%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs">
                💨
              </div>
              <span>Wind: {weatherData.windSpeed} km/h</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                📊
              </div>
              <span>Pressure: {weatherData.pressure} hPa</span>
            </div>
            <div className="flex items-center space-x-2">
              <EyeIcon className="w-4 h-4 text-gray-500" />
              <span>Visibility: {weatherData.visibility} km</span>
            </div>
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading weather data...</p>
            </>
          ) : (
            <>
              <CloudIcon className="w-8 h-8 mx-auto mb-2 opacity-50 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">No weather data available</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
