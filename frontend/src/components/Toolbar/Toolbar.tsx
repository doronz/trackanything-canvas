import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { openModal, setWidgetLibraryOpen, setActiveTool } from '@/store/uiSlice';
import { WidgetBlueprint } from '@/types';
import { useWidgetCreation } from '@/hooks/useWidgetCreation';
import Tooltip from '@/components/UI/Tooltip';
import {
  PlusIcon,
  XMarkIcon,
  DocumentIcon,
  ListBulletIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  AcademicCapIcon,
  PlayIcon,
  ViewColumnsIcon,
  TableCellsIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';

const defaultWidgets = [
  { label: 'AI Chat', icon: ChatBubbleLeftRightIcon, blueprintName: 'AI Chat' },
  { label: 'Sticky Note', icon: DocumentIcon, blueprintName: 'Sticky Note' },
  { label: 'To-Do List', icon: ListBulletIcon, blueprintName: 'To-Do List' },
  { label: 'World Clock', icon: ClockIcon, blueprintName: 'World Clock' },
  { label: 'Weather', icon: CloudIcon, blueprintName: 'Weather Widget' },
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

  const [blueprints, setBlueprints] = useState<WidgetBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Load widget blueprints from API - only once
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadBlueprints = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const response = await fetch(`${apiUrl}/api/widget-blueprints/?public_only=true`);
        if (response.ok) {
          const data = await response.json();
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

  // Close when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const handleAddWidget = async (blueprintName: string) => {
    if (!canCreateWidget || loading) return;

    const blueprint = blueprints.find(bp => bp.name === blueprintName);
    if (!blueprint) {
      console.error(`Blueprint not found: ${blueprintName}`);
      return;
    }

    const success = await createWidgetFromBlueprint({ blueprint });
    if (success) {
      setExpanded(false);
    }
  };

  // FAB button when collapsed
  if (!expanded) {
    return (
      <div className="fixed bottom-20 right-6 z-50">
        <Tooltip content="Add Widget" position="left">
          <button
            onClick={() => setExpanded(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
          >
            <PlusIcon className="w-7 h-7" />
          </button>
        </Tooltip>
      </div>
    );
  }

  // Expanded widget picker
  return (
    <div
      ref={toolbarRef}
      className="fixed bottom-20 right-6 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 w-72"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Widget</h3>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {defaultWidgets.map(widget => (
          <Tooltip key={widget.blueprintName} content={widget.label} position="top">
            <button
              onClick={() => handleAddWidget(widget.blueprintName)}
              disabled={!canCreateWidget || loading}
              className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <widget.icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight truncate w-full text-center">
                {widget.label}
              </span>
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              dispatch(setWidgetLibraryOpen(true));
              setExpanded(false);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <BookOpenIcon className="w-3.5 h-3.5" />
            Library
          </button>
          <button
            onClick={() => {
              dispatch(openModal('widgetBuilder'));
              setExpanded(false);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
            Builder
          </button>
          <button
            onClick={() => {
              dispatch(openModal('widgetImportExport'));
              setExpanded(false);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <ArrowUpTrayIcon className="w-3.5 h-3.5" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
