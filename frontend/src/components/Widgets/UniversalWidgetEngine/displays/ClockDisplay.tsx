/**
 * ClockDisplay - Universal Widget System Clock/Timezone Display Component
 * Shows real-time clock across multiple timezones with automatic updates
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateWidgetContent } from '@/store/widgetSlice';
import {
  ClockIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  SunIcon,
  MoonIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ClockDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface TimezoneContent {
  timezones: string[] | string; // Support both array (legacy) and string (new format)
  timeFormat: '12-hour' | '24-hour';
  showSeconds: boolean;
  showDate: boolean;
  lastUpdated?: string;
}

interface TimezoneInfo {
  timezone: string;
  localTime: Date;
  formattedTime: string;
  formattedDate: string;
  utcOffset: string;
  isDaylight: boolean;
  cityName: string;
}

export default function ClockDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: ClockDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const content = widget.content as TimezoneContent;
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parse timezones from content - handle both array and string formats
  const parseTimezones = (tz: string[] | string | undefined): string[] => {
    if (!tz) return ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
    if (Array.isArray(tz)) return tz; // Legacy format
    return tz
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0); // New string format
  };

  const [timezones, setTimezones] = useState<string[]>(parseTimezones(content?.timezones));
  const [timeFormat, setTimeFormat] = useState<'12-hour' | '24-hour'>(
    content?.timeFormat || '12-hour'
  );
  const [showSeconds, setShowSeconds] = useState(
    content?.showSeconds !== undefined ? content.showSeconds : false
  );
  const [showDate, setShowDate] = useState(
    content?.showDate !== undefined ? content.showDate : true
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezoneInfos, setTimezoneInfos] = useState<TimezoneInfo[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [newTimezone, setNewTimezone] = useState('');

  // Prevent wheel events from propagating to canvas
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // Get city name from timezone
  const getCityName = (timezone: string): string => {
    const parts = timezone.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return timezone;
  };

  // Check if it's daytime in a timezone (simple approximation)
  const isDaytime = (date: Date): boolean => {
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  };

  // Format time according to user preference
  const formatTime = (date: Date, timezone: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour12: timeFormat === '12-hour',
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds && { second: '2-digit' }),
    };

    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  // Format date
  const formatDate = (date: Date, timezone: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  // Get UTC offset for timezone
  const getUtcOffset = (date: Date, timezone: string): string => {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = localDate.getTime() - utcDate.getTime();
    const offsetHours = offsetMs / (1000 * 60 * 60);
    const sign = offsetHours >= 0 ? '+' : '-';
    const absHours = Math.abs(offsetHours);
    const hours = Math.floor(absHours);
    const minutes = Math.round((absHours - hours) * 60);

    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Update timezone information
  const updateTimezoneInfos = useCallback(() => {
    const now = new Date();
    setCurrentTime(now);

    const infos: TimezoneInfo[] = timezones.map(timezone => {
      try {
        // Create a date in the target timezone
        const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        return {
          timezone,
          localTime,
          formattedTime: formatTime(now, timezone),
          formattedDate: formatDate(now, timezone),
          utcOffset: getUtcOffset(now, timezone),
          isDaylight: isDaytime(localTime),
          cityName: getCityName(timezone),
        };
      } catch (error) {
        // Invalid timezone
        return {
          timezone,
          localTime: now,
          formattedTime: 'Invalid timezone',
          formattedDate: '',
          utcOffset: '',
          isDaylight: true,
          cityName: timezone,
        };
      }
    });

    setTimezoneInfos(infos);
  }, [timezones, timeFormat, showSeconds, showDate]);

  // Setup real-time clock updates
  useEffect(() => {
    // Initial update
    updateTimezoneInfos();

    // Update every second
    clockIntervalRef.current = setInterval(updateTimezoneInfos, 1000);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [updateTimezoneInfos]);

  // Save content when settings change (debounced to avoid infinite loops)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const updatedContent: TimezoneContent = {
        timezones: timezones.join('\n'), // Save as string for new format
        timeFormat,
        showSeconds,
        showDate,
        lastUpdated: new Date().toISOString(),
      };

      dispatch(
        updateWidgetContent({
          widgetId: widget.id,
          content: updatedContent,
        })
      );

      onDataChange(updatedContent);
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [timezones, timeFormat, showSeconds, showDate]);

  // Add new timezone
  const addTimezone = () => {
    if (newTimezone.trim() && !timezones.includes(newTimezone.trim())) {
      setTimezones([...timezones, newTimezone.trim()]);
      setNewTimezone('');
    }
  };

  // Remove timezone
  const removeTimezone = (timezone: string) => {
    setTimezones(timezones.filter(tz => tz !== timezone));
  };

  // Popular timezones for suggestions
  const popularTimezones = [
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

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
          <h3 className="text-sm font-medium">Clock Configuration</h3>
          <button
            onClick={() => setIsConfiguring(false)}
            className="px-3 py-1 text-xs bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded hover:shadow-lg"
          >
            Done
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Time Format */}
          <div>
            <label className="block text-xs font-medium mb-1">Time Format</label>
            <select
              value={timeFormat}
              onChange={e => setTimeFormat(e.target.value as '12-hour' | '24-hour')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="12-hour">12-hour (AM/PM)</option>
              <option value="24-hour">24-hour</option>
            </select>
          </div>

          {/* Display Options */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showSeconds}
                onChange={e => setShowSeconds(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Show seconds</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showDate}
                onChange={e => setShowDate(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Show date</span>
            </label>
          </div>

          {/* Add Timezone */}
          <div>
            <label className="block text-xs font-medium mb-1">Add Timezone</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTimezone}
                onChange={e => setNewTimezone(e.target.value)}
                placeholder="e.g., America/New_York"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addTimezone}
                className="px-3 py-2 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded-md hover:shadow-lg"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Popular Timezones */}
          <div>
            <label className="block text-xs font-medium mb-2">Popular Timezones</label>
            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-auto">
              {popularTimezones
                .filter(tz => !timezones.includes(tz))
                .map(timezone => (
                  <button
                    key={timezone}
                    onClick={() => setTimezones([...timezones, timezone])}
                    className="text-left px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {getCityName(timezone)} ({timezone})
                  </button>
                ))}
            </div>
          </div>

          {/* Current Timezones */}
          <div>
            <label className="block text-xs font-medium mb-2">Current Timezones</label>
            <div className="space-y-1">
              {timezones.map(timezone => (
                <div
                  key={timezone}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm">{getCityName(timezone)}</span>
                  <button
                    onClick={() => removeTimezone(timezone)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main timezone display
  return (
    <div
      className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-4"
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
        <div className="flex items-center space-x-2">
          <GlobeAltIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">World Clock</h3>
        </div>
        <button
          onClick={() => setIsConfiguring(true)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
        >
          <Cog6ToothIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Timezone List */}
      <div className="space-y-3 overflow-auto">
        {timezoneInfos.map(info => (
          <div
            key={info.timezone}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {info.isDaylight ? (
                  <SunIcon className="w-5 h-5 text-yellow-500" />
                ) : (
                  <MoonIcon className="w-5 h-5 text-blue-500" />
                )}
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{info.cityName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{info.utcOffset}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                  {info.formattedTime}
                </div>
                {showDate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {info.formattedDate}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {timezoneInfos.length === 0 && (
        <div className="text-center py-8">
          <ClockIcon className="w-8 h-8 mx-auto mb-2 opacity-50 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">No timezones configured</p>
          <button
            onClick={() => setIsConfiguring(true)}
            className="mt-2 px-3 py-1 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded text-xs hover:shadow-lg transition-shadow"
          >
            Add Timezones
          </button>
        </div>
      )}
    </div>
  );
}
