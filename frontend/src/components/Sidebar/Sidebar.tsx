import { AppDispatch, RootState } from '@/store';
import { setCurrentDashboard } from '@/store/dashboardSlice';
import { openModal, toggleSidebar } from '@/store/uiSlice';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useDispatch, useSelector } from 'react-redux';
import DashboardList from './DashboardList';
import QuickActions from './QuickActions';

export default function Sidebar() {
  const dispatch = useDispatch<AppDispatch>();
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const { dashboards, currentDashboardId, loading } = useSelector(
    (state: RootState) => state.dashboard
  );

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleCreateDashboard = () => {
    dispatch(openModal('createDashboard'));
  };

  const handleSelectDashboard = (dashboardId: number) => {
    dispatch(setCurrentDashboard(dashboardId));
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarCollapsed ? '-translate-x-80' : 'translate-x-0'
        }`}
        style={{ width: '320px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">TrackAnything</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Personal Command Center</p>
            </div>
          </div>
          {/* TODO: Add settings button */}
          {/* <button
            onClick={handleOpenSettings}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button> */}
        </div>

        {/* Dashboard Section - takes all available space */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Dashboards
            </h2>
            <button
              onClick={handleCreateDashboard}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Create Dashboard"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Dashboard List - takes all remaining space */}
          <div className="flex-1 overflow-y-auto px-2 min-h-0">
            <DashboardList
              dashboards={dashboards}
              currentDashboardId={currentDashboardId}
              loading={loading}
              onSelectDashboard={handleSelectDashboard}
            />
          </div>
        </div>

        {/* Quick Actions - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <QuickActions />
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggleSidebar}
        className={`fixed left-0 top-1/2 transform -translate-y-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-lg px-2 py-3 shadow-lg transition-transform duration-300 ease-in-out ${
          sidebarCollapsed ? 'translate-x-0' : 'translate-x-80'
        }`}
        title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Backdrop for mobile */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={handleToggleSidebar}
        />
      )}
    </>
  );
}
