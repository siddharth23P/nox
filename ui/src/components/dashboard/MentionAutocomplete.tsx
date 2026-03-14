import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AtSign, Users, Hash } from 'lucide-react';
import type { MentionUser } from '../../utils/mentions';
import { SPECIAL_MENTIONS } from '../../utils/mentions';

const API_BASE_URL = 'http://localhost:8080/v1';

interface MentionAutocompleteProps {
  /** The current search query (text after the trigger @). */
  query: string;
  /** Called when a user selects a mention from the list. */
  onSelect: (user: MentionUser) => void;
  /** Called when the user dismisses the dropdown (Escape). */
  onClose: () => void;
  /** Whether the dropdown is visible. */
  visible: boolean;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  visible,
}) => {
  const [members, setMembers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch org members with debounce
  const fetchMembers = useCallback(async (search: string) => {
    const orgId = localStorage.getItem('nox_org_id');
    const token = localStorage.getItem('nox_token');
    if (!orgId || !token) return;

    setLoading(true);
    try {
      const url = `${API_BASE_URL}/orgs/${orgId}/members?search=${encodeURIComponent(search)}&limit=10`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Mention autocomplete fetch error:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    fetchTimeout.current = setTimeout(() => {
      fetchMembers(query);
    }, 150);

    return () => {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    };
  }, [query, visible, fetchMembers]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [members, query]);

  // Build filtered list: special mentions first (if they match), then org members
  const filteredSpecial = SPECIAL_MENTIONS.filter(
    (s) => s.username.toLowerCase().startsWith(query.toLowerCase())
  );
  const allItems: MentionUser[] = [...filteredSpecial, ...members];

  // Keyboard navigation via window-level capture listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || allItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(allItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [visible, allItems, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!visible || allItems.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl z-50 custom-scrollbar"
      role="listbox"
      aria-label="Mention suggestions"
    >
      {loading && allItems.length === 0 && (
        <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
      )}

      {allItems.map((item, idx) => {
        const isSpecial = !item.user_id;
        const isSelected = idx === selectedIndex;

        return (
          <button
            key={item.user_id || item.username}
            role="option"
            aria-selected={isSelected}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              onSelect(item);
            }}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              isSelected
                ? 'bg-blue-500/20 text-white'
                : 'text-gray-300 hover:bg-white/5'
            }`}
          >
            {/* Icon / Avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 text-gray-400">
              {isSpecial ? (
                item.username === 'here' ? <Users size={16} /> : <Hash size={16} />
              ) : item.avatar_url ? (
                <img src={item.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <AtSign size={16} />
              )}
            </div>

            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  @{item.username}
                </span>
                {isSpecial && (
                  <span className="text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-semibold">
                    special
                  </span>
                )}
                {!isSpecial && item.role && (
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                    {item.role}
                  </span>
                )}
              </div>
              {(item.full_name || item.display_name) && (
                <div className="text-xs text-gray-500 truncate">
                  {item.display_name || item.full_name}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
