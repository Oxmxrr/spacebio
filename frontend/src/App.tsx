// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Search } from './pages/Search';
import { History } from './pages/History';
import { Library } from './pages/Library';
import { MindMap } from './pages/MindMap';
import { Storytelling } from './pages/Storytelling';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <AppLayout title="Dashboard" subtitle="Live KPIs, top entities, and trends">
                <Dashboard />
              </AppLayout>
            }
          />
          <Route
            path="/search"
            element={
              <AppLayout title="Search" subtitle="Query the knowledge base with AI assistance">
                <Search />
              </AppLayout>
            }
          />
          <Route
            path="/library"
            element={
              <AppLayout title="Library" subtitle="Browse all research with filters">
                <Library />
              </AppLayout>
            }
          />
          <Route
            path="/history"
            element={
              <AppLayout title="History" subtitle="Your saved questions and answers">
                <History />
              </AppLayout>
            }
          />
          <Route
            path="/mindmap"
            element={
              <AppLayout title="Mind Map" subtitle="Visualize concepts and relationships">
                <MindMap />
              </AppLayout>
            }
          />
          <Route
            path="/story"
            element={
              <AppLayout title="Storytelling" subtitle="Generate coherent narratives with inline citations">
                <Storytelling />
              </AppLayout>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
