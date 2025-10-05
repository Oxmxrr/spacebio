import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Rocket, Wifi, WifiOff } from 'lucide-react';
import { useApi } from '../hooks/useApi';

export const Header: React.FC = () => {
  const location = useLocation();
  const { ping } = useApi();
  const isOnline = ping.data?.index_loaded ?? false;
  const isLoading = ping.isLoading;

  const nav = [
    { path: '/',        label: 'Dashboard' },
    { path: '/search',  label: 'Search' },
    { path: '/library', label: 'Library' },
    { path: '/history', label: 'History' },
  ];

  const isActive = (p: string) => location.pathname === p;

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Home">
            <Rocket className="w-8 h-8" style={{ color: '#0B3D91' }} />
            <span className="text-lg md:text-xl font-bold text-gradient">Space Biology Knowledge Engine</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2" aria-label="Primary">
            {nav.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive(n.path)
                    ? 'text-blue-300 bg-[rgba(11,61,145,0.20)]'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                aria-current={isActive(n.path) ? 'page' : undefined}
              >
                <span className="font-medium">{n.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-yellow-400" title="Checking status…">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="hidden sm:inline text-sm">Checking…</span>
              </div>
            ) : isOnline ? (
              <div className="inline-flex items-center gap-2 text-green-400" title="Index is loaded">
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Online</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-red-400" title="Index not loaded">
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden pb-3">
          <nav className="flex items-center gap-2" aria-label="Primary mobile">
            {nav.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(n.path)
                    ? 'text-blue-300 bg-[rgba(11,61,145,0.20)]'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                aria-current={isActive(n.path) ? 'page' : undefined}
              >
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};
