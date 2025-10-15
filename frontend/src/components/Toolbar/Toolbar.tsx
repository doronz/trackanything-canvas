import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { openModal, setWidgetLibraryOpen, setActiveTool } from '@/store/uiSlice';
import { WidgetBlueprint } from '@/types';
import { useWidgetCreation } from '@/hooks/useWidgetCreation';
import Tooltip from '@/components/UI/Tooltip';
import {
  HandRaisedIcon,
  DocumentIcon,
  ListBulletIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  AcademicCapIcon,
  PlayIcon,
  ViewColumnsIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  WrenchScrewdriverIcon,
  BookOpenIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

const defaultWidgets = [
  { label: 'AI Chat', icon: ChatBubbleLeftRightIcon, blueprintName: 'AI Chat' },
  { label: 'Sticky Note', icon: DocumentIcon, blueprintName: 'Sticky Note' },
  { label: 'To-Do List', icon: ListBulletIcon, blueprintName: 'To-Do List' },
  { label: 'Image', icon: PhotoIcon, blueprintName: 'Image Widget' },
  { label: 'Webpage', icon: GlobeAltIcon, blueprintName: 'Webpage Preview' },
  { label: 'Flash Cards', icon: AcademicCapIcon, blueprintName: 'Flash Cards' },
  { label: 'Video', icon: PlayIcon, blueprintName: 'Video Player' },
  { label: 'Kanban', icon: ViewColumnsIcon, blueprintName: 'Kanban Board' },
  { label: 'Table', icon: TableCellsIcon, blueprintName: 'Spreadsheet' },
  { label: 'Markdown', icon: DocumentTextIcon, blueprintName: 'Markdown Editor' },
];

export default function Toolbar() {
  const dispatch = useDispatch<AppDispatch>();
  const { createWidgetFromBlueprint, canCreateWidget } = useWidgetCreation();
  const { activeTool } = useSelector((state: RootState) => state.ui);

  const [blueprints, setBlueprints] = useState<WidgetBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  // Cross-platform modifier key detection for tooltip
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? 'Cmd' : 'Ctrl';

  // Load widget blueprints from API - only once
  useEffect(() => {
    // TODO: Cache query results or use reactQuery
    // Prevent double loading in React StrictMode
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadBlueprints = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const response = await fetch(`${apiUrl}/api/widget-blueprints/?public_only=true`);
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded widget blueprints:', data);
          setBlueprints(data);
        }
      } catch (error) {
        console.error('Failed to load widget blueprints:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBlueprints();
  }, []);

  const handleAddWidget = async (blueprintName: string) => {
    if (!canCreateWidget || loading) return;

    // Find the blueprint by name
    const blueprint = blueprints.find(bp => bp.name === blueprintName);
    if (!blueprint) {
      console.error(`Blueprint not found: ${blueprintName}`);
      return;
    }

    // Use shared widget creation logic
    const success = await createWidgetFromBlueprint({ blueprint });
    if (!success) {
      console.error(`Failed to create widget: ${blueprintName}`);
    }
  };

  const handleHandToolToggle = () => {
    // Toggle between hand and select tool
    dispatch(setActiveTool(activeTool === 'hand' ? 'select' : 'hand'));
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center px-4 py-2">
        {/* Hand Tool */}
        <Tooltip
          content={`Hand Tool - Move and zoom canvas anywhere (Space to toggle)\nSelect widget or hold ${modifierKey} to scroll widget content`}
          position="bottom"
        >
          <button
            onClick={handleHandToolToggle}
            className={`p-2 rounded-md transition-colors ${
              activeTool === 'hand'
                ? 'bg-gradient-to-r from-[#FF5A78] from-33% to-[#FFC850] to-100% text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <HandRaisedIcon className="w-5 h-5" />
          </button>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-3" />

        {/* Widget Types */}
        <div className="flex items-center space-x-1">
          {defaultWidgets.map(widget => (
            <Tooltip key={widget.blueprintName} content={widget.label} position="bottom">
              <button
                onClick={() => handleAddWidget(widget.blueprintName)}
                disabled={!canCreateWidget || loading}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <widget.icon className="w-5 h-5" />
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-3" />

        {/* Quick Actions */}
        <div className="flex items-center space-x-1">
          <Tooltip content="Widget Library" position="bottom">
            <button
              onClick={() => dispatch(setWidgetLibraryOpen(true))}
              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-md transition-colors"
            >
              <BookOpenIcon className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Widget Builder" position="bottom">
            <button
              onClick={() => dispatch(openModal('widgetBuilder'))}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <WrenchScrewdriverIcon className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Import Widget" position="bottom">
            <button
              onClick={() => dispatch(openModal('widgetImportExport'))}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
