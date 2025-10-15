import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { closeWidgetImportExportModal, addNotification } from '@/store/uiSlice';
import { addWidget, fetchWidgets } from '@/store/widgetSlice';
import CreateDashboardModal from './CreateDashboardModal';
import EditDashboardModal from './EditDashboardModal';
import McpServerModal from './McpServerModal';
import AIConfigModal from './AIConfigModal';
import PlaceholderModal from './PlaceholderModal';
import WidgetBuilderModal from './WidgetBuilderModal';
import WidgetImportExportModal from './WidgetImportExportModal';
import DashboardImportExportModal from './DashboardImportExportModal';
import ConnectionPanel from '../Panels/ConnectionPanel';
import WidgetLibraryPanel from '../Panels/WidgetLibraryPanel';

export default function ModalManager() {
  const dispatch = useDispatch<AppDispatch>();
  const { modals, widgetImportExport, editDashboard } = useSelector((state: RootState) => state.ui);
  const widgets = useSelector((state: RootState) => state.widget.widgets);
  const { currentDashboardId } = useSelector((state: RootState) => state.dashboard);

  // Find the widget for import/export
  const selectedWidget = widgetImportExport.widgetId
    ? widgets.find(w => w.id === widgetImportExport.widgetId)
    : undefined;

  const handleImportSuccess = (widget: any) => {
    // Add the imported widget to the Redux store
    dispatch(addWidget(widget));

    // Also refresh widgets from server to ensure consistency
    if (currentDashboardId) {
      dispatch(fetchWidgets(currentDashboardId));
    }

    dispatch(
      addNotification({
        type: 'success',
        message: `Successfully imported widget: ${widget.title || 'Untitled'}`,
      })
    );
    dispatch(closeWidgetImportExportModal());
  };

  return (
    <>
      {/* Dashboard Creation Modal */}
      <CreateDashboardModal isOpen={modals.createDashboard} />

      {/* Dashboard Edit Modal */}
      <EditDashboardModal isOpen={modals.editDashboard} dashboardId={editDashboard.dashboardId} />

      {/* MCP Server Configuration Modal */}
      <McpServerModal isOpen={modals.mcpServerConfig} />

      {/* Dashboard Settings Modal */}
      <PlaceholderModal
        isOpen={modals.dashboardSettings}
        modalType="dashboardSettings"
        title="Dashboard Settings"
        description="Configure dashboard settings, themes, and preferences."
      />

      {/* AI Configuration Modal */}
      <AIConfigModal isOpen={modals.aiConfig} />

      {/* Template Manager Modal */}
      <PlaceholderModal
        isOpen={modals.templateManager}
        modalType="templateManager"
        title="Template Manager"
        description="Create, edit, and manage dashboard and widget templates."
      />

      {/* Dashboard Import/Export Modal */}
      <DashboardImportExportModal isOpen={modals.importExport} />

      {/* Widget Builder Modal */}
      <WidgetBuilderModal isOpen={modals.widgetBuilder} />

      {/* Widget Import/Export Modal */}
      <WidgetImportExportModal
        isOpen={modals.widgetImportExport}
        widget={selectedWidget}
        referencePosition={widgetImportExport.referencePosition}
        onClose={() => dispatch(closeWidgetImportExportModal())}
        onImportSuccess={handleImportSuccess}
        exportOnly={widgetImportExport.exportOnly}
      />

      {/* Widget Connection Panel */}
      <ConnectionPanel />

      {/* Widget Library Panel */}
      <WidgetLibraryPanel />
    </>
  );
}
