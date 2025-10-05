// src/pages/MindMap.tsx
import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { useApi } from '../hooks/useApi';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SearchResult } from '../types';
import { ArrowLeft } from 'lucide-react';

// Minimal local typing to avoid reactflow type clashes in some TS setups
type RFNode = {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type?: string;
  style?: React.CSSProperties;
};

type RFEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
};

export const MindMap: React.FC = () => {
  const { stats } = useApi();
  const navigate = useNavigate();
  const location = useLocation() as unknown as {
    state?: { query?: string; results?: SearchResult[] };
  };

  const nodesEdges = useMemo(() => {
    const centerLabel = location.state?.query ? `“${location.state.query}”` : 'Space Biology';

    const center: RFNode = {
      id: 'center',
      position: { x: 0, y: 0 },
      data: { label: centerLabel },
      type: 'default',
      style: {
        borderRadius: 12,
        padding: 8,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(11,61,145,0.2)',
        color: 'white',
      },
    };

    const nodes: RFNode[] = [center];
    const edges: RFEdge[] = [];

    // Prefer freshly searched results
    const rs = location.state?.results;
    if (Array.isArray(rs) && rs.length) {
      const counts = {
        organism: new Map<string, number>(),
        stressor: new Map<string, number>(),
        platform: new Map<string, number>(),
      };

      rs.forEach((r) => {
        if (r?.facets?.organism)
          counts.organism.set(r.facets.organism, (counts.organism.get(r.facets.organism) || 0) + 1);
        if (r?.facets?.stressor)
          counts.stressor.set(r.facets.stressor, (counts.stressor.get(r.facets.stressor) || 0) + 1);
        if (r?.facets?.platform)
          counts.platform.set(r.facets.platform, (counts.platform.get(r.facets.platform) || 0) + 1);
      });

      const top = (m: Map<string, number>, n = 7) =>
        [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

      const orgs = top(counts.organism);
      const strs = top(counts.stressor);
      const plats = top(counts.platform);

      let y = 160;
      const addGroup = (
        list: Array<[string, number]>,
        group: 'organism' | 'stressor' | 'platform',
        yCoord: number
      ) => {
        list.forEach(([label], i) => {
          const id = `${group}-${label}`;
          nodes.push({
            id,
            position: { x: (i - (list.length - 1) / 2) * 220, y: yCoord },
            data: { label },
            style: {
              borderRadius: 10,
              padding: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              background:
                group === 'organism'
                  ? 'rgba(34,197,94,0.15)'
                  : group === 'stressor'
                  ? 'rgba(245,158,11,0.15)'
                  : 'rgba(59,130,246,0.15)',
              color: 'white',
            },
          });
          edges.push({
            id: `e-center-${id}`,
            source: 'center',
            target: id,
            animated: false,
          });
        });
      };

      addGroup(orgs, 'organism', y);
      y += 160;
      addGroup(strs, 'stressor', y);
      y += 160;
      addGroup(plats, 'platform', y);

      return { nodes, edges };
    }

    // Fallback to global stats when there's no search context
    const orgs = Object.entries(stats.data?.organisms || {}).slice(0, 5);
    const strs = Object.entries(stats.data?.stressors || {}).slice(0, 5);
    const plats = Object.entries(stats.data?.platforms || {}).slice(0, 5);

    const addGroupFromStats = (
      list: [string, number][],
      group: 'organism' | 'stressor' | 'platform',
      yCoord: number
    ) => {
      list.forEach(([label], i) => {
        const id = `${group}-${label}`;
        nodes.push({
          id,
          position: { x: (i - (list.length - 1) / 2) * 220, y: yCoord },
          data: { label: `${label}` },
          style: {
            borderRadius: 10,
            padding: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background:
              group === 'organism'
                ? 'rgba(34,197,94,0.15)'
                : group === 'stressor'
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(59,130,246,0.15)',
            color: 'white',
          },
        });
        edges.push({
          id: `e-center-${id}`,
          source: 'center',
          target: id,
          animated: false,
        });
      });
    };

    addGroupFromStats(orgs, 'organism', 160);
    addGroupFromStats(strs, 'stressor', 320);
    addGroupFromStats(plats, 'platform', 480);

    return { nodes, edges };
  }, [location.state, stats.data]);

  return (
    <div className="space-y-3">
      {/* Back to Search */}
      <div>
<button
  onClick={() => window.history.length > 1 ? history.back() : navigate('/search')}
  className="flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
>
  <ArrowLeft className="w-4 h-4" />
  <span>Back to Search</span>
</button>
      </div>

      <div className="h-[calc(100vh-200px)] rounded-xl overflow-hidden glass-panel">
        <ReactFlow nodes={nodesEdges.nodes as any} edges={nodesEdges.edges as any} fitView>
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
