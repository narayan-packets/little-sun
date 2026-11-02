import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Check,
  ListFilter,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type { ChatRow } from '../lib/supabase';
import { useAppState } from '../state/store';

const SIDEBAR_DATE_FILTER_KEY = 'littlesun_sidebar_by_date_v1';

interface GroupedChats {
  today: ChatRow[];
  yesterday: ChatRow[];
  earlier: ChatRow[];
}

function groupChatsByDate(chats: ChatRow[]): GroupedChats {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const groups: GroupedChats = { today: [], yesterday: [], earlier: [] };

  for (const chat of chats) {
    const t = new Date(chat.updated_at).getTime();
    if (t >= startOfToday) {
      groups.today.push(chat);
    } else if (t >= startOfYesterday) {
      groups.yesterday.push(chat);
    } else {
      groups.earlier.push(chat);
    }
  }

  return groups;
}

export const Sidebar: React.FC = () => {
  const {
    userDisplayName,
    chats,
    activeChatId,
    isSidebarOpen,
    isDesktopSidebarCollapsed,
    isSettingsOpen,
    setIsSidebarOpen,
    toggleDesktopSidebar,
    setIsSettingsOpen,
    selectChat,
    startNewChat,
    renameChat,
    deleteChat,
  } = useAppState();

  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [showByDate, setShowByDate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_DATE_FILTER_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleShowByDate = () => {
    setShowByDate((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_DATE_FILTER_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuChatId) return;
    const onOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuChatId(null);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuChatId]);

  const grouped = useMemo(() => groupChatsByDate(chats), [chats]);

  const handleStartRename = (chat: ChatRow) => {
    setMenuChatId(null);
    setConfirmDeleteChatId(null);
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const handleConfirmRename = async (chatId: string) => {
    const trimmed = renameValue.trim();
    setRenamingChatId(null);
    if (trimmed) {
      await renameChat(chatId, trimmed);
    }
  };

  const handleConfirmDelete = async (chatId: string) => {
    setConfirmDeleteChatId(null);
    setMenuChatId(null);
    await deleteChat(chatId);
  };

  const renderChatItem = (chat: ChatRow) => {
            const isActive = chat.id === activeChatId && !isSettingsOpen;
            const isRenaming = renamingChatId === chat.id;
            const isConfirmingDelete = confirmDeleteChatId === chat.id;
            const isMenuOpen = menuChatId === chat.id;

            if (isRenaming) {
              return (
                <div
                  key={chat.id}
                  className="flex items-center gap-1 px-2 py-1"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename(chat.id);
                      if (e.key === 'Escape') setRenamingChatId(null);
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border focus:outline-none"
                    style={{
                      borderColor: 'var(--accent)',
                      borderRadius: '6px',
                      color: 'var(--text)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmRename(chat.id)}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
                    style={{ color: 'var(--success)' }}
                    aria-label="Save chat title"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingChatId(null)}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label="Cancel rename"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            if (isConfirmingDelete) {
              return (
                <div
                  key={chat.id}
                  className="px-3 py-2.5 text-xs border"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <p className="mb-2 font-medium" style={{ color: 'var(--text)' }}>
                    Delete “{chat.title}”?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(chat.id)}
                      className="min-h-[36px] px-3 py-1.5 font-medium cursor-pointer"
                      style={{
                        backgroundColor: 'var(--danger)',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteChatId(null)}
                      className="min-h-[36px] px-3 py-1.5 font-medium cursor-pointer"
                      style={{
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        borderRadius: '6px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={chat.id}
                className="group relative flex items-center transition-all duration-150 ease-out hover:bg-[var(--surface-2)]"
                style={{
                  backgroundColor: isActive ? 'var(--surface-2)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-1 top-2.5 bottom-2.5 w-[3px] rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                )}

                <button
                  type="button"
                  onClick={() => selectChat(chat.id)}
                  className="flex-1 min-w-0 min-h-[42px] pl-3.5 pr-10 py-2 text-left text-sm truncate transition-colors cursor-pointer"
                  style={{ color: 'var(--text)' }}
                >
                  {chat.title}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuChatId((prev) => (prev === chat.id ? null : chat.id));
                  }}
                  className={`absolute right-0.5 min-h-[40px] min-w-[40px] inline-flex items-center justify-center transition-opacity cursor-pointer ${
                    isActive || isMenuOpen
                      ? 'opacity-100'
                      : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                  }`}
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Chat options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {isMenuOpen && (
                  <div
                    ref={menuContainerRef}
                    className="absolute right-2 top-10 z-30 w-36 p-1 border shadow-lg"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleStartRename(chat)}
                      className="w-full min-h-[38px] px-2.5 py-1.5 flex items-center gap-2 text-xs font-medium text-left transition-colors cursor-pointer"
                      style={{ color: 'var(--text)', borderRadius: '6px' }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuChatId(null);
                        setConfirmDeleteChatId(chat.id);
                      }}
                      className="w-full min-h-[38px] px-2.5 py-1.5 flex items-center gap-2 text-xs font-medium text-left transition-colors cursor-pointer"
                      style={{ color: 'var(--danger)', borderRadius: '6px' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
  };

  const renderGroup = (label: string, items: ChatRow[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3.5">
        <div className="px-2.5 mb-1 flex items-center select-none">
          <span
            className="text-[11px] font-medium tracking-wide uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </span>
        </div>
        <div className="space-y-0.5">
          {items.map((chat) => renderChatItem(chat))}
        </div>
      </div>
    );
  };

  const initialLetter = (userDisplayName.charAt(0) || 'U').toUpperCase();

  const sidebarContent = (
    <aside
      className="w-[264px] h-full flex flex-col border-r shrink-0 select-none"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Top Header: Brand + Collapse + New Chat + Filter */}
      <div className="p-3 pb-2 space-y-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Little Sun
          </span>

          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="hidden md:inline-flex min-h-[36px] min-w-[36px] items-center justify-center transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)' }}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center cursor-pointer hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)' }}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="w-full min-h-[42px] px-3 py-2 flex items-center justify-between gap-2 text-sm font-medium border transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span>New chat</span>
          <Plus className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Section Header & Well-sized Filter Button */}
        <div className="pt-0.5 flex items-center justify-between gap-2 select-none">
          <span
            className="text-[11px] font-semibold tracking-wider uppercase px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Chats
          </span>

          <button
            type="button"
            onClick={toggleShowByDate}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border transition-all cursor-pointer hover:bg-[var(--surface-2)] active:scale-95"
            style={{
              backgroundColor: showByDate ? 'var(--surface-2)' : 'transparent',
              borderColor: showByDate ? 'var(--accent)' : 'var(--border)',
              color: showByDate ? 'var(--text)' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-pressed={showByDate}
            aria-label={showByDate ? 'Grouped by date. Click to show as it is.' : 'Showing as it is. Click to group by date.'}
            title={showByDate ? 'Grouped by date (Click for flat list)' : 'Showing as it is (Click to group by date)'}
          >
            {showByDate ? (
              <>
                <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <span>By date</span>
              </>
            ) : (
              <>
                <ListFilter className="w-3.5 h-3.5 shrink-0" />
                <span>As it is</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {chats.length === 0 ? (
          <div className="px-3 py-8 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            No conversations yet.
          </div>
        ) : showByDate ? (
          <div className="space-y-3">
            {renderGroup('Today', grouped.today)}
            {renderGroup('Yesterday', grouped.yesterday)}
            {renderGroup('Earlier', grouped.earlier)}
          </div>
        ) : (
          <div className="space-y-0.5">
            {chats.map((chat) => renderChatItem(chat))}
          </div>
        )}
      </div>

      {/* Clean Profile Footer */}
      <div
        className="p-2.5 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsSettingsOpen(true);
          }}
          className="w-full min-h-[44px] px-2.5 py-2 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
          style={{
            color: 'var(--text)',
            backgroundColor: isSettingsOpen ? 'var(--surface-2)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label="Open settings"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {initialLetter}
            </div>
            <span className="text-sm font-medium truncate">
              {userDisplayName}
            </span>
          </div>
          <Settings className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop collapsible sidebar with smooth width & transform transition */}
      <div
        className="hidden md:block h-full shrink-0 overflow-hidden transition-[width] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: isDesktopSidebarCollapsed ? 0 : 264 }}
        aria-hidden={isDesktopSidebarCollapsed}
      >
        <div
          className="w-[264px] h-full transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: isDesktopSidebarCollapsed ? 'translateX(-100%)' : 'translateX(0)',
          }}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Mobile slide-over drawer with smooth backdrop and slide transition */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 md:hidden flex backdrop-blur-[1px]"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
            onClick={() => setIsSidebarOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="h-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

