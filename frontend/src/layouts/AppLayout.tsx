import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search as SearchIcon,
  BookOpen,
  Clock,
  Wifi,
  WifiOff,
  Rocket,
  LogOut
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export const AppLayout: React.FC<Props> = ({ title, subtitle, children }) => {
  const location = useLocation();
  const { ping } = useApi();
  const { logout, authRequired } = useAuth();
  const isOnline = ping.data?.index_loaded ?? false;
  const isLoading = ping.isLoading;

  const nav = [
    { path: '/',        label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: '/search',  label: 'Search',    icon: <SearchIcon className="w-4 h-4" /> },
    { path: '/library', label: 'Library',   icon: <BookOpen className="w-4 h-4" /> },
    { path: '/history', label: 'History',   icon: <Clock className="w-4 h-4" /> },
  ];

  const isActive = (p: string) => location.pathname === p;

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col gap-4 glass-panel m-4 p-4">
        <Link to="/" className="flex items-center gap-2 mb-2">
          <Rocket className="w-6 h-6" style={{ color: '#0B3D91' }} />
          <span className="font-bold text-sm">Space Biology Knowledge Engine</span>
        </Link>

        <nav className="flex-1 space-y-1" aria-label="Sidebar">
          {nav.map((n) => (
            <Link
              key={n.path}
              to={n.path}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                ${isActive(n.path)
                  ? 'bg-white/10 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
              aria-current={isActive(n.path) ? 'page' : undefined}
            >
              <span
                className={`shrink-0 ${isActive(n.path) ? 'text-blue-300' : 'text-gray-400 group-hover:text-blue-200'}`}
              >
                {n.icon}
              </span>
              <span className="font-medium text-sm">{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <span className="text-xs text-gray-400">Backend Status</span>
            {isLoading ? (
              <span className="inline-flex items-center gap-1 text-yellow-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Checking…
              </span>
            ) : isOnline ? (
              <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                <Wifi className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </div>

          {authRequired && (
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="m-4 md:ml-0 space-y-4">
        {/* Mobile top bar (shows nav as horizontal pills if you want) */}
        <div className="md:hidden glass-panel p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-6 h-6" style={{ color: '#0B3D91' }} />
              <span className="font-bold text-sm">Space Biology Knowledge Engine</span>
            </div>
            {isLoading ? (
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Checking…" />
            ) : isOnline ? (
              <span className="w-2 h-2 rounded-full bg-green-400" title="Online" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-400" title="Offline" />
            )}
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto">
            {nav.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap
                  ${isActive(n.path) ? 'bg-white/10 text-white' : 'text-gray-300 bg-white/5'}`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Page header */}
        <div className="glass-panel p-5">
          <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
        </div>

        {/* Page body */}
        {children}

        {/* Footer */}
        <footer className="py-6 text-center text-xs text-gray-500">
          Built with React, TypeScript, Tailwind • Demo only • © 2025
        </footer>
      </main>
    </div>
  );
};
