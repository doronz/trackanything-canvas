import { useWidgetCreation } from '@/hooks/useWidgetCreation';
import { AppDispatch } from '@/store';
import { closeModal } from '@/store/uiSlice';
import { DatabaseWidgetBlueprint } from '@/types';
import {
  EyeIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import BaseModal from './BaseModal';

interface WidgetLibraryModalProps {
  isOpen: boolean;
}

interface WidgetLibraryFilters {
  search: string;
  category: string;
  engine: string;
  sortBy: 'name' | 'created_at' | 'install_count';
  sortOrder: 'asc' | 'desc';
}

const CATEGORIES = [
  'All',
  'Productivity',
  'Notes',
  'Data',
  'Media',
  'Forms',
  'Education',
  'Communication',
];
// Removed legacy ENGINES filter - no longer needed with Universal Widget System

const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'install_count:desc', label: 'Most Popular' },
  { value: 'install_count:asc', label: 'Least Popular' },
];

const getEngineIcon = (blueprint: any) => {
  // Use widget metadata icon if available
  if (blueprint?.widget_metadata?.icon) {
    return blueprint.widget_metadata.icon;
  }

  // Use display component to determine icon
  const displayComponent = blueprint?.view_schema?.displayComponent;
  if (displayComponent) {
    switch (displayComponent) {
      case 'Table':
      case 'Spreadsheet':
        return '📊';
      case 'Note':
      case 'Text':
        return '📝';
      case 'Gallery':
      case 'Image':
        return '🖼️';
      case 'Chat':
        return '💬';
      case 'Video':
        return '🎥';
      case 'Kanban':
        return '📋';
      case 'Todo':
        return '✅';
      case 'Clock':
        return '🌍';
      case 'Weather':
        return '🌤️';
      case 'Cards':
        return '🃏';
      case 'Markdown':
        return '📄';
      case 'Iframe':
        return '🌐';
      default:
        return '🔧';
    }
  }

  return '🔧';
};

// Mock data generation for widget previews
const generateMockPreview = (blueprint: DatabaseWidgetBlueprint) => {
  const layout = blueprint.schema?.displayLayout;

  switch (layout) {
    case 'todo' as any:
    case 'list':
      return (
        <div className="w-full space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-sm">Buy groceries</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
              <div className="w-2 h-1 bg-white rounded"></div>
            </div>
            <span className="text-sm line-through text-gray-500">Complete project setup</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-sm">Call team meeting</span>
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-1">Name</th>
                <th className="text-left p-1">Status</th>
                <th className="text-left p-1">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-1">John Doe</td>
                <td className="p-1">
                  <span className="bg-green-100 text-green-800 px-1 rounded text-xs">Active</span>
                </td>
                <td className="p-1">2025-01-15</td>
              </tr>
              <tr className="border-b">
                <td className="p-1">Jane Smith</td>
                <td className="p-1">
                  <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">
                    Pending
                  </span>
                </td>
                <td className="p-1">2025-01-14</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    case 'kanban':
      return (
        <div className="w-full flex space-x-2">
          <div className="flex-1 bg-gray-100 rounded p-2">
            <div className="text-xs font-medium mb-1">To Do</div>
            <div className="bg-white p-1 rounded text-xs mb-1">Task 1</div>
            <div className="bg-white p-1 rounded text-xs">Task 2</div>
          </div>
          <div className="flex-1 bg-blue-100 rounded p-2">
            <div className="text-xs font-medium mb-1">In Progress</div>
            <div className="bg-white p-1 rounded text-xs">Task 3</div>
          </div>
          <div className="flex-1 bg-green-100 rounded p-2">
            <div className="text-xs font-medium mb-1">Done</div>
            <div className="bg-white p-1 rounded text-xs">Task 4</div>
          </div>
        </div>
      );

    case 'note':
    case 'markdown':
      return (
        <div className="w-full space-y-2 text-left">
          <div className="text-sm font-medium">Meeting Notes</div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• Discussed project timeline</div>
            <div>• Assigned tasks to team members</div>
            <div>• Next meeting: Friday 2pm</div>
          </div>
        </div>
      );

    case 'chat':
      return (
        <div className="w-full space-y-2">
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-2 max-w-xs">
              <div className="text-xs">Hello! How can I help you today?</div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-blue-500 text-white rounded-lg p-2 max-w-xs">
              <div className="text-xs">I need help with my project</div>
            </div>
          </div>
        </div>
      );

    case 'cards':
      return (
        <div className="w-full grid grid-cols-2 gap-2">
          <div className="bg-white border rounded p-2">
            <div className="text-xs font-medium">Front</div>
            <div className="text-xs text-gray-600">What is React?</div>
          </div>
          <div className="bg-blue-50 border rounded p-2">
            <div className="text-xs font-medium">Back</div>
            <div className="text-xs text-gray-600">A JavaScript library</div>
          </div>
        </div>
      );

    case 'form':
      return (
        <div className="w-full space-y-2">
          <div>
            <div className="text-xs font-medium mb-1">Name</div>
            <div className="bg-white border rounded px-2 py-1 text-xs text-gray-500">
              Enter your name
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Email</div>
            <div className="bg-white border rounded px-2 py-1 text-xs text-gray-500">
              Enter your email
            </div>
          </div>
          <button className="bg-blue-500 text-white text-xs px-3 py-1 rounded">Submit</button>
        </div>
      );

    case 'gallery':
    case 'image':
      return (
        <div className="w-full grid grid-cols-3 gap-1">
          <div className="bg-gray-200 aspect-square rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">📷</span>
          </div>
          <div className="bg-gray-200 aspect-square rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">🖼️</span>
          </div>
          <div className="bg-gray-200 aspect-square rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">🎨</span>
          </div>
        </div>
      );

    case 'video':
      return (
        <div className="w-full">
          <div className="bg-black aspect-video rounded flex items-center justify-center">
            <div className="text-white text-2xl">▶️</div>
          </div>
          <div className="text-xs mt-1 font-medium">Sample Video Title</div>
        </div>
      );

    default:
      return (
        <div className="w-full text-center space-y-2">
          <span className="text-2xl">{getEngineIcon(blueprint.widget_engine || '')}</span>
          <div className="text-sm font-medium">{blueprint.name}</div>
          <div className="text-xs text-gray-500">
            Layout: {layout || 'Default'} • {blueprint.schema?.fields?.length || 0} fields
          </div>
        </div>
      );
  }
};

export default function WidgetLibraryModal({ isOpen }: WidgetLibraryModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { installWidgetFromLibrary, canCreateWidget } = useWidgetCreation();

  const [blueprints, setBlueprints] = useState<DatabaseWidgetBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const [filters, setFilters] = useState<WidgetLibraryFilters>({
    search: '',
    category: 'All',
    engine: 'All',
    sortBy: 'install_count',
    sortOrder: 'desc',
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewWidget, setPreviewWidget] = useState<DatabaseWidgetBlueprint | null>(null);

  // Load widget blueprints from API
  const loadBlueprints = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.category !== 'All') params.append('category', filters.category);
      // Removed engine filter - no longer needed with Universal Widget System
      params.append('public_only', 'true');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const response = await fetch(`${apiUrl}/api/widget-blueprints/?${params}`);
      if (!response.ok) throw new Error('Failed to load widget library');

      const data = await response.json();

      // Sort the data
      data.sort((a: DatabaseWidgetBlueprint, b: DatabaseWidgetBlueprint) => {
        const aVal = a[filters.sortBy as keyof DatabaseWidgetBlueprint] || '';
        const bVal = b[filters.sortBy as keyof DatabaseWidgetBlueprint] || '';

        if (filters.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      setBlueprints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load widgets');
      console.error('Error loading widget blueprints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBlueprints();
    }
  }, [isOpen, filters]);

  const handleClose = () => {
    dispatch(closeModal('widgetLibrary'));
  };

  const toggleFavorite = (blueprintId: number) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(blueprintId)) {
      newFavorites.delete(blueprintId);
    } else {
      newFavorites.add(blueprintId);
    }
    setFavorites(newFavorites);
    // TODO: Save to localStorage or user preferences
  };

  const installWidget = async (blueprint: DatabaseWidgetBlueprint) => {
    if (!canCreateWidget) {
      setError('Please select a dashboard first');
      return;
    }

    try {
      // Use shared installation logic
      const success = await installWidgetFromLibrary(blueprint);
      if (success) {
        // Close modal after successful installation
        handleClose();
      } else {
        setError('Failed to install widget');
      }
    } catch (err) {
      setError('Failed to install widget');
      console.error('Error installing widget:', err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Productivity':
        return '⚡';
      case 'Notes':
        return '📔';
      case 'Data':
        return '📈';
      case 'Media':
        return '🎨';
      case 'Forms':
        return '📋';
      case 'Education':
        return '🎓';
      case 'Communication':
        return '💬';
      default:
        return '📦';
    }
  };

  const renderFilters = () => (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <select
            value={filters.category}
            onChange={e => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
          <select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={e => {
              const [sortBy, sortOrder] = e.target.value.split(':');
              setFilters({ ...filters, sortBy: sortBy as any, sortOrder: sortOrder as any });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">View</label>
          <div className="flex border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 px-3 py-2 text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 px-3 py-2 text-sm border-l ${
                viewMode === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWidgetCard = (blueprint: DatabaseWidgetBlueprint) => {
    const isFavorite = favorites.has(blueprint.id!);

    if (viewMode === 'list') {
      return (
        <div
          key={blueprint.id}
          className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-medium text-gray-900 dark:text-white">{blueprint.name}</h3>
              <span className="text-lg">{getEngineIcon(blueprint.widget_engine || '')}</span>
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                {getCategoryIcon(blueprint.widget_metadata?.category || 'General')}{' '}
                {blueprint.widget_metadata?.category}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{blueprint.description}</p>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>🏗️ {blueprint?.view_schema?.displayComponent || 'Universal Widget'}</span>
              <span>📊 {blueprint.schema?.fields?.length || 0} fields</span>
              <span>📥 {blueprint.install_count || 0} installs</span>
              {blueprint.widget_metadata?.author && (
                <span>👤 {blueprint.widget_metadata.author}</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => toggleFavorite(blueprint.id!)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              {isFavorite ? (
                <HeartSolidIcon className="w-5 h-5" />
              ) : (
                <HeartIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setPreviewWidget(blueprint)}
              className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              <EyeIcon className="w-4 h-4 mr-1" />
              Preview
            </button>
            <button
              onClick={() => installWidget(blueprint)}
              className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Install
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={blueprint.id}
        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800 transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getEngineIcon(blueprint.widget_engine || '')}</span>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{blueprint.name}</h3>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>{getCategoryIcon(blueprint.widget_metadata?.category || 'General')}</span>
                <span>{blueprint.widget_metadata?.category}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleFavorite(blueprint.id!)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            {isFavorite ? (
              <HeartSolidIcon className="w-4 h-4" />
            ) : (
              <HeartIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{blueprint.description}</p>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>🏗️ {blueprint?.view_schema?.displayComponent || 'Universal Widget'}</span>
          <span>📊 {blueprint.schema?.fields?.length || 0} fields</span>
          <span>📥 {blueprint.install_count || 0}</span>
        </div>

        {blueprint.widget_metadata?.tags && blueprint.widget_metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {blueprint.widget_metadata.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                #{tag}
              </span>
            ))}
            {blueprint.widget_metadata.tags.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                +{blueprint.widget_metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={() => setPreviewWidget(blueprint)}
            className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            <EyeIcon className="w-4 h-4 mr-1" />
            Preview
          </button>
          <button
            onClick={() => installWidget(blueprint)}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Install
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading widgets...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-red-500 mb-2">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadBlueprints}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (blueprints.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <SparklesIcon className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Widgets Found</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.category !== 'All'
              ? 'Try adjusting your filters to find more widgets.'
              : 'No widgets are available in the library yet.'}
          </p>
          {(filters.search || filters.category !== 'All') && (
            <button
              onClick={() =>
                setFilters({
                  search: '',
                  category: 'All',
                  engine: 'All', // Keep for type compatibility but unused
                  sortBy: 'install_count',
                  sortOrder: 'desc',
                })
              }
              className="px-4 py-2 bg-gradient-to-r from-[#FF5A78] to-[#FFC850] text-white rounded-md hover:shadow-lg"
            >
              Clear Filters
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className={`p-4 ${
          viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'
        }`}
      >
        {blueprints.map(renderWidgetCard)}
      </div>
    );
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title="Widget Library" size="3xl">
      <div className="flex flex-col h-[800px]">
        {/* Header Stats */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{blueprints.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Available Widgets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{favorites.size}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Favorites</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {blueprints.reduce((sum, b) => sum + (b.install_count || 0), 0)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Installs</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => dispatch(closeModal('widgetLibrary'))}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Need help? View Guide
            </button>
          </div>
        </div>

        {/* Filters */}
        {renderFilters()}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
      </div>

      {/* Widget Preview Modal */}
      {previewWidget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setPreviewWidget(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getEngineIcon(previewWidget.widget_engine || '')}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {previewWidget.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {previewWidget.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewWidget(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Preview Content */}
            <div className="p-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Preview:
                </h4>
                <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 min-h-[200px]">
                  <div className="h-full flex flex-col">
                    <div className="flex-1 flex items-center justify-center">
                      {generateMockPreview(previewWidget)}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Interactive preview - actual widget will have full functionality
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Widget Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display:
                  </h4>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {previewWidget?.view_schema?.displayComponent || 'Universal Widget'}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fields:
                  </h4>
                  <div className="space-y-1">
                    {previewWidget.schema?.fields?.map((field: any, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2"
                      >
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        <span>{field.name}</span>
                        <span className="text-xs text-gray-500">({field.type})</span>
                        {field.required && <span className="text-xs text-red-500">*</span>}
                      </div>
                    )) || <div className="text-sm text-gray-500">No fields defined</div>}
                  </div>
                </div>
                {previewWidget.widget_metadata?.tags && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {previewWidget.widget_metadata.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    installWidget(previewWidget);
                    setPreviewWidget(null);
                  }}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Install Widget
                </button>
                <button
                  onClick={() => setPreviewWidget(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseModal>
  );
}
