import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Satellite, Search, History, Signal, BookOpen, GitBranch, FileText } from 'lucide-react';
import { useApi } from '../hooks/useApi';

const NavItem: React.FC<{ to: string; label: string; icon: React.ReactNode }> = ({ to, label, icon }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${active ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
};

export const Sidebar: React.FC = () => {
  const { ping } = useApi();
  const isOnline = ping.data?.index_loaded ?? false;
  const isLoading = ping.isLoading;

  return (
    <aside className="h-screen sticky top-0 w-72 shrink-0 border-r border-white/10 bg-[linear-gradient(180deg,#0b1220_0%,#0b1220_60%,#0a0f1a_100%)]">
      {/* Logo/Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Satellite className="w-7 h-7 text-blue-300" />
          <div>
            <div className="font-semibold leading-5">Cosmic Crafters Engine</div>
            <div className="text-xs text-gray-400">NASA Space Apps Demo</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4 space-y-1">
        <NavItem to="/" label="Dashboard" icon={<Signal className="w-4 h-4" />} />
        <NavItem to="/search" label="Search" icon={<Search className="w-4 h-4" />} />
        <NavItem to="/library" label="Library" icon={<BookOpen className="w-4 h-4" />} />
        <NavItem to="/mindmap" label="MindMap" icon={<GitBranch className="w-4 h-4" />} />
        <NavItem to="/story" label="Storytelling" icon={<FileText className="w-4 h-4" />} />
        <NavItem to="/history" label="History" icon={<History className="w-4 h-4" />} />
      </nav>

      {/* Footer / Backend status */}
      <div className="mt-auto p-4 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2">Backend Status</div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isLoading ? 'bg-yellow-400 animate-pulse' : isOnline ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
          <span className="text-sm text-gray-300">
            {isLoading ? 'Checking…' : isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  );
};
