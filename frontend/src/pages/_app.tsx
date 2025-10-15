import type { AppProps } from 'next/app';
import { Provider, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store, RootState } from '@/store';
import ModalManager from '@/components/Modals/ModalManager';
import WidgetSettingsPanel from '@/components/Panels/WidgetSettingsPanel';
import '@/styles/globals.css';

function AppContent({ Component, pageProps }: AppProps) {
  const widgetSettingsPanel = useSelector((state: RootState) => state.ui.widgetSettingsPanel);

  return (
    <>
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
    </>
  );
}

export default function App(props: AppProps) {
  return (
    <Provider store={store}>
      <AppContent {...props} />
    </Provider>
  );
}
