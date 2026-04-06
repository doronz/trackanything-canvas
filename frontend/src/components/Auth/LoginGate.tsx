import { useState, useEffect } from 'react';

const ALLOWED_EMAIL = 'doron1zehavi@gmail.com';
const AUTH_KEY = 'trackanything-auth';

interface LoginGateProps {
  children: React.ReactNode;
}

export default function LoginGate({ children }: LoginGateProps) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check localStorage for existing session
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === ALLOWED_EMAIL) {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  const handleGoogleLogin = () => {
    // Use Google Identity Services for one-tap sign-in
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      // If no Google client ID configured, use simple email gate
      const email = prompt('Enter your email to continue:');
      if (email === ALLOWED_EMAIL) {
        localStorage.setItem(AUTH_KEY, email);
        setAuthed(true);
        setError('');
      } else {
        setError('Access denied. This is a private dashboard.');
      }
      return;
    }

    // Redirect to Google OAuth
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const scope = encodeURIComponent('email profile');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-white" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-xl max-w-sm w-full mx-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-2">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              TrackAnything
            </h1>
            <p className="text-sm text-gray-400">Your personal command center</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-3 rounded-xl bg-white px-6 py-3 text-sm font-medium text-gray-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-100 w-full justify-center"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
