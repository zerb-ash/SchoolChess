const GUEST_ID_KEY = 'schoolchess_guest_player_id_v1';
const GUEST_NAME_KEY = 'schoolchess_guest_player_name_v1';

/**
 * Returns a stable, persistent player ID for the current browser session.
 * If authenticated, returns the authenticated user's ID.
 * If not authenticated, retrieves or creates a persistent guest ID stored in localStorage.
 */
export function getClientPlayerId(authenticatedUserId?: string | null): string {
  if (authenticatedUserId) return authenticatedUserId;
  if (typeof window === 'undefined') return 'guest_ssr';

  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

/**
 * Returns a stable display username for the guest or authenticated user.
 */
export function getClientPlayerUsername(authenticatedUsername?: string | null, colorHint?: 'white' | 'black' | null): string {
  if (authenticatedUsername) return authenticatedUsername;
  if (typeof window === 'undefined') return 'Guest';

  let guestName = localStorage.getItem(GUEST_NAME_KEY);
  if (!guestName) {
    const id = getClientPlayerId();
    const shortCode = id.substring(id.length - 4);
    guestName = colorHint ? `Guest (${colorHint === 'white' ? 'White' : 'Black'})` : `Guest ${shortCode}`;
    localStorage.setItem(GUEST_NAME_KEY, guestName);
  }
  return guestName;
}

