// src/components/BackButton.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const BackButton: React.FC<{ label?: string }> = ({ label = 'Back to Search' }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/search')}
      className="flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};
