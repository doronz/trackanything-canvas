import Canvas from '@/components/Canvas/Canvas';
import ZoomControls from '@/components/Canvas/ZoomControls';
import MainLayout from '@/components/Layout/MainLayout';
import Sidebar from '@/components/Sidebar/Sidebar';
import StatusBar from '@/components/StatusBar/StatusBar';
import Toolbar from '@/components/Toolbar/Toolbar';
import { AppDispatch, RootState } from '@/store';
import { fetchAIConfigs } from '@/store/aiConfigSlice';
import { setZoom, setPan } from '@/store/canvasSlice';
import { fetchDashboards, setCurrentDashboard } from '@/store/dashboardSlice';
import { fetchMCPServers } from '@/store/mcpSlice';
import { fetchWidgets } from '@/store/widgetSlice';
import Head from 'next/head';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { dashboards, currentDashboardId, loading } = useSelector(
    (state: RootState) => state.dashboard
  );
  const { widgets } = useSelector((state: RootState) => state.widget);
  const { viewport } = useSelector((state: RootState) => state.canvas);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    dispatch(fetchDashboards());
    dispatch(fetchMCPServers());
    dispatch(fetchAIConfigs());
  }, [dispatch]);

  useEffect(() => {
    if (dashboards.length > 0 && !currentDashboardId) {
      dispatch(setCurrentDashboard(dashboards[0].id));
    }
  }, [dashboards, currentDashboardId, dispatch]);

  useEffect(() => {
    if (currentDashboardId) {
      dispatch(fetchWidgets(currentDashboardId));
      hasCenteredRef.current = false; // Reset centering when dashboard changes
    }
  }, [currentDashboardId, dispatch]);

  // Auto-center on widgets after first load
  useEffect(() => {
    if (hasCenteredRef.current || widgets.length === 0 || viewport.width === 0) return;
    hasCenteredRef.current = true;

    // Calculate bounding box of all widgets
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of widgets) {
      minX = Math.min(minX, w.x);
      minY = Math.min(minY, w.y);
      maxX = Math.max(maxX, w.x + w.width);
      maxY = Math.max(maxY, w.y + w.height);
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    // Fit zoom with padding
    const padding = 80;
    const scaleX = (viewport.width - padding * 2) / contentWidth;
    const scaleY = (viewport.height - padding * 2) / contentHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1.2); // Don't zoom in past 120%
    const clampedZoom = Math.max(0.1, Math.min(5, fitZoom));

    const panX = viewport.width / 2 - centerX * clampedZoom;
    const panY = viewport.height / 2 - centerY * clampedZoom;

    dispatch(setZoom(clampedZoom));
    dispatch(setPan({ x: panX, y: panY }));
  }, [widgets, viewport, dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>TrackAnything</title>
        <meta
          name="description"
          content="Personal life management dashboard with infinite canvas"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <MainLayout>
        <Sidebar />
        <div className="flex-1 relative">
          <Toolbar />
          <div className="h-screen">
            <Canvas />
          </div>
          <ZoomControls />
          <StatusBar />
        </div>
      </MainLayout>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
