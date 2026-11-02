import React from 'react';
import { ChatView } from '../components/ChatView';
import { Sidebar } from '../components/Sidebar';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { useAppState } from '../state/store';
import { SettingsPage } from './Settings';

export const ChatPage: React.FC = () => {
  const { isSettingsOpen } = useAppState();

  return (
    <div
      className="w-full h-[100dvh] flex overflow-hidden relative"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
    >
      {isSettingsOpen ? (
        <SettingsPage />
      ) : (
        <>
          <Sidebar />
          <ChatView />
        </>
      )}

      {/* Global Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal />
    </div>
  );
};


