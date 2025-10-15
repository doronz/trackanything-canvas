import { AppDispatch, RootState } from '@/store';
import { setTheme } from '@/store/uiSlice';
import { ReactNode, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { theme } = useSelector((state: RootState) => state.ui);

  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Update CSS custom properties for theme
    if (theme === 'dark') {
      root.style.setProperty('--bg-color', '#111827');
      root.style.setProperty('--text-color', '#f9fafb');
      root.style.setProperty('--border-color', '#374151');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#111827');
      root.style.setProperty('--border-color', '#e5e7eb');
    }
  }, [theme]);

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('canvas-mcp-theme') as 'light' | 'dark';
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      dispatch(setTheme(savedTheme));
    }
  }, [dispatch]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem('canvas-mcp-theme', theme);
  }, [theme]);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${theme}`}>
      <div className="flex h-screen overflow-hidden">{children}</div>
    </div>
  );
}
