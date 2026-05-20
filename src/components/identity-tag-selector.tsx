'use client';

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { IDENTITY_TAGS, getTopTags } from '@/lib/identity-tags';

interface IdentityTagSelectorProps {
  value: string | null;
  onChange: (tag: string | null) => void;
}

export function IdentityTagSelector({ value, onChange }: IdentityTagSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get filtered tags based on search query
  const getFilteredTags = () => {
    if (!searchQuery.trim()) {
      return getTopTags();
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    return IDENTITY_TAGS.filter(tag => 
      tag.toLowerCase().includes(lowerQuery)
    ).slice(0, 20); // Limit to 20 results
  };

  const filteredTags = getFilteredTags();

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search your Role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground pl-10 pr-4 py-2.5 rounded-lg border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors text-sm"
        />
      </div>

      {/* Tags Display */}
      <div className="flex flex-wrap gap-2">
        {filteredTags.length > 0 ? (
          filteredTags.map((tag) => {
            const isSelected = value === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onChange(isSelected ? null : tag)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {tag}
                {isSelected && <X size={13} strokeWidth={2.5} />}
              </button>
            );
          })
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 w-full">No tags found</p>
        )}
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        Your Role will be visible to your followers on your posts
      </p>
    </div>
  );
}
