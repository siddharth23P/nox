import { useEffect, useCallback, useRef } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
  action: () => void;
}

type ShortcutHandler = () => void;

interface ShortcutRegistration {
  key: string;
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean };
  handler: ShortcutHandler;
  description: string;
  category: string;
}

const registrations = new Map<string, ShortcutRegistration>();

function makeKey(key: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }): string {
  const parts: string[] = [];
  if (mods.ctrl || mods.meta) parts.push('mod');
  if (mods.shift) parts.push('shift');
  if (mods.alt) parts.push('alt');
  parts.push(key.toLowerCase());
  return parts.join('+');
}

export function getRegisteredShortcuts(): { key: string; description: string; category: string; display: string }[] {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modSymbol = isMac ? '\u2318' : 'Ctrl';
  const shiftSymbol = isMac ? '\u21E7' : 'Shift';
  const altSymbol = isMac ? '\u2325' : 'Alt';

  return Array.from(registrations.values()).map(reg => {
    const parts: string[] = [];
    if (reg.modifiers.ctrl || reg.modifiers.meta) parts.push(modSymbol);
    if (reg.modifiers.shift) parts.push(shiftSymbol);
    if (reg.modifiers.alt) parts.push(altSymbol);
    parts.push(reg.key.length === 1 ? reg.key.toUpperCase() : reg.key);
    return {
      key: makeKey(reg.key, reg.modifiers),
      description: reg.description,
      category: reg.category,
      display: parts.join(isMac ? '' : '+'),
    };
  });
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    const ids: string[] = [];
    for (const s of shortcutsRef.current) {
      const mods = { ctrl: s.ctrl, meta: s.meta, shift: s.shift, alt: s.alt };
      const id = makeKey(s.key, mods);
      registrations.set(id, {
        key: s.key,
        modifiers: mods,
        handler: s.action,
        description: s.description,
        category: s.category,
      });
      ids.push(id);
    }
    return () => {
      for (const id of ids) {
        registrations.delete(id);
      }
    };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in inputs/textareas (unless it's a mod shortcut)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const hasMod = e.metaKey || e.ctrlKey;

    // For single-key shortcuts (like '?'), skip if typing in an input
    if (isInput && !hasMod) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modPressed = isMac ? e.metaKey : e.ctrlKey;

    for (const reg of registrations.values()) {
      const wantsMod = reg.modifiers.ctrl || reg.modifiers.meta;
      const wantsShift = !!reg.modifiers.shift;
      const wantsAlt = !!reg.modifiers.alt;

      if (e.key.toLowerCase() === reg.key.toLowerCase() &&
          !!modPressed === !!wantsMod &&
          e.shiftKey === wantsShift &&
          e.altKey === wantsAlt) {
        e.preventDefault();
        e.stopPropagation();
        reg.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
}
