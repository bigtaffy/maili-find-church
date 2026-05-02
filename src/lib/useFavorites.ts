import { useState, useEffect } from 'react';

const STORAGE_KEY = 'church_favorites';

export type FavoriteEntry = { id: number; savedAt: string };

function loadFromStorage(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // migrate old format: number[]
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'number') {
      return (parsed as number[]).map((id) => ({ id, savedAt: new Date().toISOString() }));
    }
    return parsed as FavoriteEntry[];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.some((f) => f.id === id)
        ? prev.filter((f) => f.id !== id)
        : [...prev, { id, savedAt: new Date().toISOString() }],
    );
  };

  const isFavorite = (id: number) => favorites.some((f) => f.id === id);

  // sorted newest-first
  const sortedFavorites = [...favorites].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );

  const favoriteIds = favorites.map((f) => f.id);

  return { favorites: sortedFavorites, favoriteIds, toggleFavorite, isFavorite };
}
