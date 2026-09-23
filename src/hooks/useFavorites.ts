import { useCallback, useMemo } from "react";
import {
  DEFAULT_FAVORITE_FOLDER,
  STORAGE_KEYS,
  isValidUserFavoriteRecord,
  type PropertyListing,
  type UserFavoriteRecord,
} from "../types";
import { APP_CONFIG } from "../lib/config";
import { readStorageList } from "../lib/storage";
import { useLocalStorage } from "./useLocalStorage";

/**
 * Wishlist state with instant, reactive persistence.
 *
 * Records are written to `localStorage` under `STORAGE_KEYS.FAVORITES` and
 * synchronised across tabs by `useLocalStorage`. The initial value is hydrated
 * synchronously from storage (sanitised member by member, so one corrupt entry
 * cannot discard the collection), which means hearts never flash the wrong state
 * on first paint.
 *
 * The repository is injected rather than imported so the seed module can stay
 * behind a dynamic import; saved ids always resolve as soon as it arrives.
 */

export interface UseFavoritesOptions {
  /** Repository used to resolve saved ids into listings. */
  listings?: readonly PropertyListing[];
  /** Folder new saves are filed under. */
  folderName?: string;
}

export interface UseFavoritesResult {
  /** Saved records in most-recently-saved order. */
  favorites: UserFavoriteRecord[];
  /** Resolved listings for the saved ids, newest first. */
  favoriteListings: PropertyListing[];
  /** O(1) membership test used by every card and pin. */
  favoriteIds: ReadonlySet<string>;
  count: number;
  /** Distinct folder names present in the collection. */
  folderNames: string[];
  isFavorite: (listingId: string) => boolean;
  /** Adds when absent, removes when present. */
  toggleFavorite: (listingId: string) => void;
  addFavorite: (listingId: string, folderName?: string) => void;
  removeFavorite: (listingId: string) => void;
  clearFavorites: () => void;
}

function readInitialFavorites(): UserFavoriteRecord[] {
  return readStorageList<UserFavoriteRecord>(
    STORAGE_KEYS.FAVORITES,
    isValidUserFavoriteRecord,
  );
}

/** Stable validator identity, so the persistence hook never re-hydrates needlessly. */
function isFavoriteRecordList(value: unknown): value is UserFavoriteRecord[] {
  return Array.isArray(value) && value.every(isValidUserFavoriteRecord);
}

export function useFavorites(
  options: UseFavoritesOptions = {},
): UseFavoritesResult {
  const {
    listings = [],
    folderName = APP_CONFIG.storage.defaultFavoriteFolder,
  } = options;

  const [favorites, setFavorites] = useLocalStorage<UserFavoriteRecord[]>(
    STORAGE_KEYS.FAVORITES,
    readInitialFavorites(),
    { validate: isFavoriteRecordList },
  );

  const favoriteIds = useMemo(
    () => new Set(favorites.map((record) => record.listingId)),
    [favorites],
  );

  const favoriteListings = useMemo(() => {
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    return favorites
      .map((record) => byId.get(record.listingId))
      .filter((listing): listing is PropertyListing => listing !== undefined);
  }, [favorites, listings]);

  const folderNames = useMemo(() => {
    const names = new Set<string>();
    for (const record of favorites) {
      names.add(record.folderName || DEFAULT_FAVORITE_FOLDER);
    }
    return Array.from(names);
  }, [favorites]);

  const isFavorite = useCallback(
    (listingId: string): boolean => favoriteIds.has(listingId),
    [favoriteIds],
  );

  const addFavorite = useCallback(
    (listingId: string, targetFolder?: string): void => {
      setFavorites((previous) => {
        if (previous.some((record) => record.listingId === listingId)) {
          return previous;
        }
        return [
          {
            listingId,
            savedAt: new Date().toISOString(),
            folderName: targetFolder ?? folderName,
          },
          ...previous,
        ];
      });
    },
    [folderName, setFavorites],
  );

  const removeFavorite = useCallback(
    (listingId: string): void => {
      setFavorites((previous) =>
        previous.filter((record) => record.listingId !== listingId),
      );
    },
    [setFavorites],
  );

  const toggleFavorite = useCallback(
    (listingId: string): void => {
      setFavorites((previous) => {
        if (previous.some((record) => record.listingId === listingId)) {
          return previous.filter((record) => record.listingId !== listingId);
        }
        return [
          {
            listingId,
            savedAt: new Date().toISOString(),
            folderName,
          },
          ...previous,
        ];
      });
    },
    [folderName, setFavorites],
  );

  const clearFavorites = useCallback((): void => {
    setFavorites([]);
  }, [setFavorites]);

  return {
    favorites,
    favoriteListings,
    favoriteIds,
    count: favorites.length,
    folderNames,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}

export default useFavorites;
