import ModalManager from '@/components/Modals/ModalManager';
import WidgetSettingsPanel from '@/components/Panels/WidgetSettingsPanel';
import LoginGate from '@/components/Auth/LoginGate';
import { RootState, store } from '@/store';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Provider, useSelector } from 'react-redux';

function AppContent({ Component, pageProps }: AppProps) {
  const widgetSettingsPanel = useSelector((state: RootState) => state.ui.widgetSettingsPanel);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Component {...pageProps} />;
  }

  return (
    <LoginGate>
      <Component {...pageProps} />
      <ModalManager />
      <WidgetSettingsPanel
        isOpen={widgetSettingsPanel.open}
        widgetId={widgetSettingsPanel.widgetId}
      />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-color)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </LoginGate>
  );
}

export default function App(props: AppProps) {
  return (
    <Provider store={store}>
      <AppContent {...props} />
    </Provider>
  );
}
