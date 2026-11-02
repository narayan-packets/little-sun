/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SunMark } from './components/SunMark';
import { ChatPage } from './pages/Chat';
import { LoginPage } from './pages/Login';
import { AppStateProvider, useAppState } from './state/store';

const AppRouter: React.FC = () => {
  const { session, authLoading } = useAppState();

  if (authLoading) {
    return (
      <div
        className="w-full h-[100dvh] flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
      >
        <SunMark size={32} className="animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <ChatPage />;
};

export default function App() {
  return (
    <AppStateProvider>
      <AppRouter />
    </AppStateProvider>
  );
}
