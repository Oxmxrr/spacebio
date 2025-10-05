import React, { useState, useEffect } from 'react';
import { Clock, Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bookmark } from '../types';

export const History: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('bookmarks');
    if (stored) {
      setBookmarks(JSON.parse(stored));
    }
  }, []);

  const handleDelete = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('bookmarks', JSON.stringify(updated));
  };

  const handleReAsk = (bookmark: Bookmark) => {
    navigate('/search', { 
      state: { 
        query: bookmark.question,
        answer: bookmark.answer,
        sources: bookmark.sourceCount
      } 
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (bookmarks.length === 0) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-4">No History Yet</h2>
            <p className="text-gray-400 mb-8">
              Your search history and bookmarked answers will appear here.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="nasa-button"
            >
              Start Searching
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Search History</h1>
          <p className="text-gray-400">
            Your saved questions and AI responses from previous searches.
          </p>
        </div>

        <div className="space-y-6">
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="glass-panel p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {bookmark.question}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(bookmark.timestamp)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ExternalLink className="w-4 h-4" />
                      <span>{bookmark.sourceCount} sources</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReAsk(bookmark)}
                    className="nasa-button-secondary flex items-center space-x-2"
                    title="Re-ask this question"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Re-Ask</span>
                  </button>
                  
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <div className="text-gray-200 leading-relaxed">
                  {truncateText(bookmark.answer)}
                </div>
              </div>


              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigator.clipboard.writeText(bookmark.answer)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Copy Answer
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(bookmark.question)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Copy Question
                  </button>
                </div>
                
                <div className="text-xs text-gray-500">
                  Saved {formatDate(bookmark.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('bookmarks');
              setBookmarks([]);
            }}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Clear All History
          </button>
        </div>
      </div>
    </div>
  );
};
