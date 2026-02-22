import { create } from "zustand";
import { AppMode } from "../types";

interface AppState {
  // UI State
  mode: AppMode;
  view: "chat" | "profile";
  isSidebarOpen: boolean;
  showSearchView: boolean;
  searchQuery: string;
  editTitleId: string | null;
  editTitleValue: string;
  systemPrompt: string;

  // Actions
  setMode: (mode: AppMode) => void;
  setView: (view: "chat" | "profile") => void;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setShowSearchView: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setEditTitleId: (id: string | null) => void;
  setEditTitleValue: (value: string) => void;
  setSystemPrompt: (prompt: string) => void;

  // Compound actions
  handleSearchClick: (createConversation: () => string) => void;
  handleCloseSearch: () => void;
  resetForNewUser: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  mode: "chat",
  view: "chat",
  isSidebarOpen: false,
  showSearchView: false,
  searchQuery: "",
  editTitleId: null,
  editTitleValue: "",
  systemPrompt: localStorage.getItem("systemPrompt") || "",

  // Simple setters
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setShowSearchView: (show) => set({ showSearchView: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setEditTitleId: (id) => set({ editTitleId: id }),
  setEditTitleValue: (value) => set({ editTitleValue: value }),
  setSystemPrompt: (prompt) => {
    localStorage.setItem("systemPrompt", prompt);
    set({ systemPrompt: prompt });
  },

  // Compound actions
  handleSearchClick: (createConversation) => {
    const { view, showSearchView } = get();
    if (view === "profile") {
      set({ showSearchView: true, view: "chat" });
    } else {
      const nextShowSearch = !showSearchView;
      set({ showSearchView: nextShowSearch });
      if (nextShowSearch) {
        createConversation();
      } else {
        set({ searchQuery: "" });
      }
    }
  },

  handleCloseSearch: () => {
    const { showSearchView } = get();
    if (showSearchView) {
      set({ showSearchView: false, searchQuery: "" });
    }
  },

  resetForNewUser: () => {
    set({
      view: "chat",
      mode: "chat",
      showSearchView: false,
    });
  },
}));
