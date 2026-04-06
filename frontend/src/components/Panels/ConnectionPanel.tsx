import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
  hideConnectionModal,
  createConnectionWithAI,
  fetchDashboardConnections,
  clearError,
} from '@/store/connectionSlice';
import { addWidget } from '@/store/widgetSlice';
import { fetchAIConfigs } from '@/store/aiConfigSlice';
import connectionService from '@/services/connectionService';
import { WidgetBlueprint } from '@/types';
import {
  XMarkIcon,
  LinkIcon,
  EyeIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

export default function ConnectionPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    showConnectionModal,
    selectedSourceWidget,
    selectedConnectionDirection,
    creatingConnection,
    error,
  } = useSelector((state: RootState) => state.connection);

  const { widgets } = useSelector((state: RootState) => state.widget);
  const { currentDashboardId } = useSelector((state: RootState) => state.dashboard);
  const canvasState = useSelector((state: RootState) => state.canvas);
  const { configs: aiConfigs, defaultConfig: defaultAIConfig } = useSelector(
    (state: RootState) => state.aiConfig
  );

  const [selectedWidgetType, setSelectedWidgetType] = useState<string>('');
  const [selectedBlueprint, setSelectedBlueprint] = useState<any | null>(null);
  const [createEmptyWidget, setCreateEmptyWidget] = useState(false);
  const [transformationPrompt, setTransformationPrompt] = useState<string>('');
  const [selectedAIConfigId, setSelectedAIConfigId] = useState<number | undefined>(undefined);
  const [isConverting, setIsConverting] = useState(false);
  const [aiConfigStatus, setAiConfigStatus] = useState<{
    available: boolean;
    message: string;
    loading: boolean;
  }>({ available: false, message: '', loading: true });

  // Widget library state
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [loadingBlueprints, setLoadingBlueprints] = useState(false);
  const [blueprintSearchTerm, setBlueprintSearchTerm] = useState('');
  const [previewBlueprint, setPreviewBlueprint] = useState<any | null>(null);
  const [sortedBlueprints, setSortedBlueprints] = useState<any[]>([]);

  const availableWidgetTypes = connectionService.getAvailableTargetWidgetTypes();

  // Load widget blueprints from API
  const loadBlueprints = async () => {
    setLoadingBlueprints(true);
    try {
      const params = new URLSearchParams();
      if (blueprintSearchTerm) params.append('search', blueprintSearchTerm);
      // Load both public and private blueprints for connections
      // params.append('public_only', 'true')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const response = await fetch(`${apiUrl}/api/widget-blueprints/?${params}`);
      if (!response.ok) throw new Error('Failed to load widget blueprints');

      const data = await response.json();

      // Sort by most popular first
      data.sort((a: any, b: any) => {
        return (b.install_count || 0) - (a.install_count || 0);
      });

      setBlueprints(data);
      setSortedBlueprints(data);
    } catch (err) {
      console.error('Error loading widget blueprints:', err);
      // Fallback to empty array if loading fails
      setBlueprints([]);
      setSortedBlueprints([]);
    } finally {
      setLoadingBlueprints(false);
    }
  };

  const getWidgetIcon = (blueprint: any) => {
    // For Universal Widget System (v2.0), use the blueprint icon
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

  // Get the source widget
  const sourceWidget = selectedSourceWidget
    ? widgets.find(w => w.id === selectedSourceWidget)
    : null;

  // Determine if AI is required for the selected blueprint
  const isAIRequired = (blueprint: any | null): boolean => {
    if (createEmptyWidget || !blueprint) return false;

    // For Universal Widget System (v2.0), check displayComponent
    if (blueprint?.widget_version === '2.0') {
      const displayComponent = blueprint?.view_schema?.displayComponent;

      // Simple text/content widgets don't need AI for webpage-to-text conversion
      const simpleTextComponents = ['Note', 'Markdown', 'Text'];

      // Complex structured components need AI conversion
      const structuredComponents = ['Todo', 'Kanban', 'Cards', 'Table', 'Spreadsheet'];

      if (simpleTextComponents.includes(displayComponent)) {
        return false;
      }

      if (structuredComponents.includes(displayComponent)) {
        return true;
      }

      // Default to no AI for unknown components
      return false;
    }

    // No more legacy system support - all widgets should be Universal Widget System v2.0
    return false;
  };

  // Legacy function for compatibility (converts widget type to check)
  const isAIRequiredByType = (targetType: string): boolean => {
    if (createEmptyWidget) return false;

    // Text-to-text conversions don't need AI
    const textToTextTypes = ['sticky_note', 'markdown_editor'];

    // Structured data types require AI conversion
    const structuredTypes = ['table', 'todo_list', 'kanban', 'data_widget', 'flash_card'];

    return structuredTypes.includes(targetType);
  };

  const handleClose = () => {
    dispatch(hideConnectionModal());
    setSelectedWidgetType('');
    setCreateEmptyWidget(false);
    setTransformationPrompt('');
    setSelectedAIConfigId(undefined);
    dispatch(clearError());
  };

  const handleBlueprintSelection = (blueprint: any) => {
    setSelectedBlueprint(blueprint);

    // Animate selected blueprint to top
    const otherBlueprints = sortedBlueprints.filter(b => b.id !== blueprint.id);
    setSortedBlueprints([blueprint, ...otherBlueprints]);
  };

  const handleCreateConnection = async () => {
    if (!sourceWidget || !selectedBlueprint || !currentDashboardId) return;

    setIsConverting(true);

    try {
      // Calculate position for new widget
      const position = connectionService.calculateNewWidgetPosition(
        sourceWidget,
        canvasState,
        selectedConnectionDirection || 'right'
      );

      // Use the blueprint name directly instead of converting to legacy widget types
      const targetWidgetType = selectedBlueprint.name;

      let result;

      if (createEmptyWidget) {
        // Create empty widget connection
        result = await connectionService.createConnectionWithEmptyWidget({
          source_widget_id: sourceWidget.id,
          target_widget_type: targetWidgetType,
          position,
          direction: selectedConnectionDirection || 'right',
        });
      } else if (transformationPrompt.trim() || isAIRequired(selectedBlueprint)) {
        // Extract text content from source widget for AI conversion
        // Use AI conversion if there's a transformation prompt OR if the widget type requires it
        const sourceData = connectionService.extractWidgetText(sourceWidget);

        if (!sourceData.trim()) {
          throw new Error('No text content found in source widget');
        }

        // Create connection with AI conversion
        result = await dispatch(
          createConnectionWithAI({
            source_widget_id: sourceWidget.id,
            target_widget_type: targetWidgetType,
            source_data: sourceData,
            ai_config_id: selectedAIConfigId,
            transformation_prompt: transformationPrompt.trim() || undefined,
            position,
            direction: selectedConnectionDirection || 'right',
          })
        ).unwrap();
      } else {
        // Simple content copy (no AI required)
        const sourceData = connectionService.extractWidgetText(sourceWidget);

        result = await connectionService.createConnectionWithContentCopy({
          source_widget_id: sourceWidget.id,
          target_widget_type: targetWidgetType,
          source_data: sourceData || '', // Allow empty content for text-to-text conversion
          position,
          direction: selectedConnectionDirection || 'right',
        });
      }

      // Add the new widget to the widget state
      dispatch(addWidget(result.target_widget));

      // Only the AI path (createConnectionWithAI) automatically adds connection to Redux state
      // Empty widget and content copy paths use service methods, so need manual fetch
      const usedReduxAIPath =
        !createEmptyWidget && (transformationPrompt.trim() || isAIRequired(selectedBlueprint));
      if (!usedReduxAIPath && currentDashboardId) {
        dispatch(fetchDashboardConnections(currentDashboardId));
      }

      // Close panel on success
      handleClose();
    } catch (error) {
      console.error('Failed to create connection:', error);
      // Error will be handled by the Redux slice
    } finally {
      setIsConverting(false);
    }
  };

  // Check AI config status and load blueprints when panel opens
  useEffect(() => {
    if (showConnectionModal) {
      const checkAIConfig = async () => {
        try {
          setAiConfigStatus(prev => ({ ...prev, loading: true }));
          // Fetch AI configs from Redux
          await dispatch(fetchAIConfigs());
          const status = await connectionService.getAIConfigStatus();
          setAiConfigStatus({
            available: status.available,
            message: status.message,
            loading: false,
          });
        } catch (error) {
          console.error('Failed to check AI config status:', error);
          setAiConfigStatus({
            available: false,
            message: 'Failed to check AI configuration status',
            loading: false,
          });
        }
      };
      checkAIConfig();
      loadBlueprints();
    }
  }, [showConnectionModal, dispatch]);

  // Load blueprints when search term changes
  useEffect(() => {
    if (showConnectionModal) {
      const timeoutId = setTimeout(() => {
        loadBlueprints();
      }, 300); // Debounce search
      return () => clearTimeout(timeoutId);
    }
  }, [blueprintSearchTerm, showConnectionModal]);

  // Reset state when panel closes
  useEffect(() => {
    if (!showConnectionModal) {
      setSelectedWidgetType('');
      setSelectedBlueprint(null);
      setCreateEmptyWidget(false);
      setTransformationPrompt('');
      setSelectedAIConfigId(undefined);
      setIsConverting(false);
      setBlueprintSearchTerm('');
      setPreviewBlueprint(null);
      setSortedBlueprints([]);
    }
  }, [showConnectionModal]);

  // Set default AI config when configs are loaded
  useEffect(() => {
    if (showConnectionModal && defaultAIConfig && !selectedAIConfigId) {
      setSelectedAIConfigId(defaultAIConfig.id);
    }
  }, [showConnectionModal, defaultAIConfig, selectedAIConfigId]);

  // Update sorted blueprints when blueprints change
  useEffect(() => {
    setSortedBlueprints(blueprints);
  }, [blueprints]);

  if (!showConnectionModal || !sourceWidget) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={handleClose} />

      {/* Right Panel */}
      <div className="fixed right-0 top-0 h-screen w-[650px] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Connection
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Type Tabs */}
        <div className="px-4 pt-4">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setCreateEmptyWidget(false)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                !createEmptyWidget
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Convert Content
            </button>
            <button
              onClick={() => setCreateEmptyWidget(true)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                createEmptyWidget
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Empty Widget
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Fixed Top Section */}
          <div className="flex-shrink-0 px-4 pb-3">
            {/* Compact Source Widget Info */}
            <div className="flex items-center py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-400 dark:text-gray-500">Source:</div>
              <div className="flex items-center space-x-3">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: sourceWidget.color || '#e5e7eb' }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {sourceWidget.title || 'Untitled Widget'}
                  </p>
                </div>
              </div>
            </div>

            {/* Widget Selection Header */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {createEmptyWidget ? 'Select Widget Type' : 'Convert To'}
                </h4>
                {selectedBlueprint && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedBlueprint.name}
                  </div>
                )}
              </div>

              {/* Search Bar */}
              {/* TODO: Temporarily disabled */}
              {/* <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search widgets..."
                  value={blueprintSearchTerm}
                  onChange={(e) => setBlueprintSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:bg-gray-800 dark:text-white"
                />
              </div> */}

              {/* AI Transformation Prompt - show for content conversion when AI is available */}
              {!createEmptyWidget && selectedBlueprint && aiConfigStatus.available && (
                <div className="border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-900 dark:text-white text-sm">🤖</div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        AI Transformation (Optional)
                      </h5>
                    </div>
                    {/* AI Config Selection */}
                    {aiConfigs.length > 0 && (
                      <select
                        value={selectedAIConfigId || ''}
                        onChange={e =>
                          setSelectedAIConfigId(e.target.value ? Number(e.target.value) : undefined)
                        }
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Default AI Config</option>
                        {aiConfigs.map(config => (
                          <option key={config.id} value={config.id}>
                            {config.name} ({config.provider})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <textarea
                    value={transformationPrompt}
                    onChange={e => setTransformationPrompt(e.target.value)}
                    placeholder="e.g., 'Summarize key points', 'Translate to Spanish', 'Extract action items'"
                    className="w-full px-3 py-2 border-2 border-transparent rounded-md focus:outline-none focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                    rows={2}
                  />
                  <div className="mt-1 text-xs text-gray-900 dark:text-white">
                    Transform content before converting to {selectedBlueprint.name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Widget Selection Grid */}
          <div className="flex-1 overflow-y-auto px-4">
            <div className="space-y-2 pt-4">
              {loadingBlueprints ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-gray-600 text-sm">Loading widgets...</span>
                </div>
              ) : blueprints.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-2xl mb-2">📦</div>
                  <p className="text-sm font-medium">No widgets found</p>
                  {blueprintSearchTerm && (
                    <button
                      onClick={() => setBlueprintSearchTerm('')}
                      className="text-xs text-blue-500 hover:text-blue-700 mt-2"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                sortedBlueprints.map((blueprint: any, index: number) => (
                  <div
                    key={blueprint.id}
                    onClick={() => handleBlueprintSelection(blueprint)}
                    className={`
                      w-full p-3 border rounded-lg text-left transition-all duration-300 cursor-pointer transform
                      ${
                        selectedBlueprint?.id === blueprint.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500 scale-[1.02]'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                    style={{
                      animationDelay:
                        selectedBlueprint?.id === blueprint.id ? '0ms' : `${index * 50}ms`,
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-lg flex-shrink-0">{getWidgetIcon(blueprint)}</span>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {blueprint.name}
                          </h5>
                          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {blueprint.widget_metadata?.category || 'General'}
                            </span>
                            <span>•</span>
                            <span>
                              {blueprint.data_schema?.fields?.length ||
                                blueprint.schema?.fields?.length ||
                                0}{' '}
                              fields
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewBlueprint(blueprint);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    </div>
                    {blueprint.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {blueprint.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Status and Preview Section */}
        <div className="flex-shrink-0 px-4 pb-4 space-y-3">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <XMarkIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    Connection Failed
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Status - Only show if there are issues */}
          {!createEmptyWidget && selectedBlueprint && aiConfigStatus.loading && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Checking AI configuration...
              </p>
            </div>
          )}

          {!createEmptyWidget &&
            selectedBlueprint &&
            !aiConfigStatus.loading &&
            !aiConfigStatus.available && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <XMarkIcon className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                      AI Setup Required
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                      {aiConfigStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Compact Preview */}
          {selectedBlueprint && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {sourceWidget.title || 'Untitled Widget'}
                  </div>
                </div>
                <div className="space-2 text-center">
                  <div>
                    <span>{getWidgetIcon(sourceWidget.widget_blueprint)}</span>
                    <span>→</span>
                    {transformationPrompt.trim() && !createEmptyWidget && (
                      <>
                        <span className="text-purple-600 dark:text-purple-400">🤖</span>
                        <span>→</span>
                      </>
                    )}
                    <span>{getWidgetIcon(selectedBlueprint)}</span>
                  </div>
                  {transformationPrompt.trim() && !createEmptyWidget && (
                    <div className="mt-2 text-center text-orange-600 dark:text-orange-400">
                      "{transformationPrompt.slice(0, 60)}
                      {transformationPrompt.length > 60 ? '...' : ''}"
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedBlueprint.name}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              disabled={isConverting || creatingConnection}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateConnection}
              disabled={
                !selectedBlueprint ||
                isConverting ||
                (!createEmptyWidget && !aiConfigStatus.loading && !aiConfigStatus.available)
              }
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 border border-transparent rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isConverting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </div>
              ) : aiConfigStatus.loading ? (
                'Checking AI...'
              ) : !createEmptyWidget && !aiConfigStatus.available ? (
                'AI Setup Required'
              ) : createEmptyWidget ? (
                'Create Empty Widget'
              ) : (
                'Create Connection'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Blueprint Preview Modal */}
      {previewBlueprint && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setPreviewBlueprint(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getWidgetIcon(previewBlueprint)}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {previewBlueprint.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {previewBlueprint.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewBlueprint(null)}
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
                <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 min-h-[120px]">
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-4xl">{getWidgetIcon(previewBlueprint)}</span>
                      <div className="text-sm font-medium mt-2">{previewBlueprint.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {previewBlueprint.data_schema?.fields?.length ||
                          previewBlueprint.schema?.fields?.length ||
                          0}{' '}
                        fields •{' '}
                        {previewBlueprint?.view_schema?.displayComponent || 'Universal Widget'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Interactive preview - actual widget will have full functionality
                    </div>
                  </div>
                </div>
              </div>

              {/* Widget Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Engine:
                  </h4>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {previewBlueprint?.view_schema?.displayComponent || 'Universal Widget'}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fields:
                  </h4>
                  <div className="space-y-1">
                    {(previewBlueprint.data_schema?.fields || previewBlueprint.schema?.fields)?.map(
                      (field: any, index: number) => (
                        <div
                          key={index}
                          className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2"
                        >
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          <span>{field.name}</span>
                          <span className="text-xs text-gray-500">({field.type})</span>
                          {field.required && <span className="text-xs text-red-500">*</span>}
                        </div>
                      )
                    ) || <div className="text-sm text-gray-500">No fields defined</div>}
                  </div>
                </div>
                {previewBlueprint.widget_metadata?.tags && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {previewBlueprint.widget_metadata.tags.map((tag: string) => (
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
                    setSelectedBlueprint(previewBlueprint);
                    setPreviewBlueprint(null);
                  }}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md hover:shadow-lg transition-shadow"
                >
                  Select Widget
                </button>
                <button
                  onClick={() => setPreviewBlueprint(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
