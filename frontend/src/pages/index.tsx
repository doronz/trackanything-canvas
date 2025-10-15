import Canvas from '@/components/Canvas/Canvas';
import ZoomControls from '@/components/Canvas/ZoomControls';
import MainLayout from '@/components/Layout/MainLayout';
import Sidebar from '@/components/Sidebar/Sidebar';
import StatusBar from '@/components/StatusBar/StatusBar';
import Toolbar from '@/components/Toolbar/Toolbar';
import { AppDispatch, RootState } from '@/store';
import { fetchAIConfigs } from '@/store/aiConfigSlice';
import { fetchDashboards, setCurrentDashboard } from '@/store/dashboardSlice';
import { fetchMCPServers } from '@/store/mcpSlice';
import { fetchWidgets } from '@/store/widgetSlice';
import Head from 'next/head';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { dashboards, currentDashboardId, loading } = useSelector(
    (state: RootState) => state.dashboard
  );

  useEffect(() => {
    // Load dashboards, MCP servers, and AI configs on app startup
    dispatch(fetchDashboards());
    dispatch(fetchMCPServers());
    dispatch(fetchAIConfigs());
  }, [dispatch]);

  useEffect(() => {
    // Set first dashboard as current if none selected
    if (dashboards.length > 0 && !currentDashboardId) {
      dispatch(setCurrentDashboard(dashboards[0].id));
    }
  }, [dashboards, currentDashboardId, dispatch]);

  useEffect(() => {
    // Load widgets when dashboard is selected
    if (currentDashboardId) {
      dispatch(fetchWidgets(currentDashboardId));
    }
  }, [currentDashboardId, dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Canvas MCP Client</title>
        <meta
          name="description"
          content="Customizable dashboard with infinite canvas and MCP integration!"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="VISONA - visona.me" />
        <meta
          name="keywords"
          content="dashboard, infinite canvas, MCP, widget system, AI, LLM, dashboard client"
        />
      </Head>

      <MainLayout>
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          {/* Top Toolbar */}
          <Toolbar />

          {/* Canvas */}
          <div className="h-screen">
            <Canvas />
          </div>

          {/* Zoom Controls - positioned fixed at bottom right */}
          <ZoomControls />

          {/* Bottom Status Bar */}
          <StatusBar />
        </div>
      </MainLayout>
    </>
  );
}

// Disable pre-rendering to avoid SSR issues
export async function getServerSideProps() {
  return { props: {} };
}
