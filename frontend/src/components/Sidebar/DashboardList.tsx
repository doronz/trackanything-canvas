import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { deleteDashboard, duplicateDashboard } from '@/store/dashboardSlice';
import { openEditDashboardModal } from '@/store/uiSlice';
import { Dashboard } from '@/types';
import {
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface DashboardListProps {
  dashboards: Dashboard[];
  currentDashboardId: number | null;
  loading: boolean;
  onSelectDashboard: (id: number) => void;
}

export default function DashboardList({
  dashboards,
  currentDashboardId,
  loading,
  onSelectDashboard,
}: DashboardListProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const handleEditDashboard = (dashboardId: number) => {
    dispatch(openEditDashboardModal(dashboardId));
    setActiveMenu(null);
  };

  const handleDuplicateDashboard = async (dashboard: Dashboard) => {
    setDuplicatingId(dashboard.id);
    setActiveMenu(null);

    try {
      await dispatch(duplicateDashboard(dashboard.id)).unwrap();
      toast.success(`Dashboard "${dashboard.name}" duplicated`);
    } catch (error) {
      toast.error('Failed to duplicate dashboard');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (dashboards.length <= 1) {
      toast.error('Cannot delete the last dashboard');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      try {
        await dispatch(deleteDashboard(dashboard.id)).unwrap();
        toast.success(`Dashboard "${dashboard.name}" deleted`);
        setActiveMenu(null);
      } catch (error) {
        toast.error('Failed to delete dashboard');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading && dashboards.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 dark:text-gray-500 mb-2">
          <DocumentDuplicateIcon className="w-8 h-8 mx-auto" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">No dashboards yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Create your first dashboard to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dashboards.map(dashboard => (
        <div
          key={dashboard.id}
          className={`group relative rounded-lg border-2 transition-all duration-200 cursor-pointer ${
            dashboard.id === currentDashboardId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          onClick={() => onSelectDashboard(dashboard.id)}
        >
          <div className="p-3">
            {/* Dashboard Info */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {dashboard.name}
                </h3>
                {dashboard.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {dashboard.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatDate(dashboard.updated_at)}
                </p>
              </div>

              {/* Menu Button */}
              <div className="relative">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === dashboard.id ? null : dashboard.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-all"
                >
                  <EllipsisVerticalIcon className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {activeMenu === dashboard.id && (
                  <div className="absolute right-0 top-6 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEditDashboard(dashboard.id);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDuplicateDashboard(dashboard);
                      }}
                      disabled={duplicatingId === dashboard.id}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                      {duplicatingId === dashboard.id ? 'Duplicating...' : 'Duplicate'}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteDashboard(dashboard);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                      disabled={dashboards.length <= 1}
                    >
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Click outside to close menu */}
      {activeMenu && <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />}

      {/* Duplicating indicator */}
      {duplicatingId && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span>Duplicating dashboard...</span>
        </div>
      )}
    </div>
  );
}
