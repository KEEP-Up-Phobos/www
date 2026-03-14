/**
 * KEEP-Up Role-Based Access Control (RBAC)
 *
 * Maps Joomla user groups to frontend permissions.
 * This is the SINGLE SOURCE OF TRUTH for group → capability mapping.
 *
 * Joomla Group Hierarchy (from clone_usergroups):
 *   1  Public        (parent: 0)
 *   2  Registered    (parent: 1)  — basic logged-in user
 *   3  Author        (parent: 2)  — can create events
 *   4  Editor        (parent: 3)  — can create events
 *   5  Publisher     (parent: 4)  — can create events
 *   6  Manager       (parent: 1)  — backend access
 *   7  Administrator (parent: 6)  — backend + Node.js admin
 *   8  Super Users   (parent: 1)  — full access
 *   9  Guest         (parent: 1)  — not logged in
 */

// ─── Group IDs ──────────────────────────────────────────────────────
export const GROUP = {
  PUBLIC:        1,
  REGISTERED:    2,
  AUTHOR:        3,
  EDITOR:        4,
  PUBLISHER:     5,
  MANAGER:       6,
  ADMINISTRATOR: 7,
  SUPER_USER:    8,
  GUEST:         9,
} as const;

export type GroupId = (typeof GROUP)[keyof typeof GROUP];

// ─── Permission sets ────────────────────────────────────────────────
// Which groups can do what.  Order doesn't matter — we use .some().

/** Browse events + map (any logged-in user) */
export const CAN_BROWSE = [
  GROUP.REGISTERED, GROUP.AUTHOR, GROUP.EDITOR, GROUP.PUBLISHER,
  GROUP.MANAGER, GROUP.ADMINISTRATOR, GROUP.SUPER_USER,
] as const;

/** Create / submit events (Author through Super User) */
export const CAN_CREATE_EVENT = [
  GROUP.AUTHOR, GROUP.EDITOR, GROUP.PUBLISHER,
  GROUP.MANAGER, GROUP.ADMINISTRATOR, GROUP.SUPER_USER,
] as const;

/** Access the admin dashboard (Manager+) */
export const CAN_ACCESS_ADMIN = [
  GROUP.MANAGER, GROUP.ADMINISTRATOR, GROUP.SUPER_USER,
] as const;

/** Access Node.js admin panel (Administrator + Super User only) */
export const CAN_ACCESS_NODE_ADMIN = [
  GROUP.ADMINISTRATOR, GROUP.SUPER_USER,
] as const;

/** Full unrestricted access */
export const FULL_ACCESS = [
  GROUP.SUPER_USER,
] as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Check if user has at least one of the required groups */
export function hasPermission(
  userGroups: number[] | undefined,
  requiredGroups: readonly number[],
): boolean {
  if (!userGroups || userGroups.length === 0) return false;
  return userGroups.some(g => (requiredGroups as readonly number[]).includes(g));
}

/** Quick boolean helpers that take raw group array */
export const can = {
  browse:       (g?: number[]) => hasPermission(g, CAN_BROWSE),
  createEvent:  (g?: number[]) => hasPermission(g, CAN_CREATE_EVENT),
  accessAdmin:  (g?: number[]) => hasPermission(g, CAN_ACCESS_ADMIN),
  accessNode:   (g?: number[]) => hasPermission(g, CAN_ACCESS_NODE_ADMIN),
  fullAccess:   (g?: number[]) => hasPermission(g, FULL_ACCESS),
};

/** Human-readable role label for display (picks highest) */
export function roleName(groups?: number[]): string {
  if (!groups || groups.length === 0) return 'Guest';
  if (groups.includes(GROUP.SUPER_USER))    return 'Super User';
  if (groups.includes(GROUP.ADMINISTRATOR)) return 'Administrator';
  if (groups.includes(GROUP.MANAGER))       return 'Manager';
  if (groups.includes(GROUP.PUBLISHER))     return 'Publisher';
  if (groups.includes(GROUP.EDITOR))        return 'Editor';
  if (groups.includes(GROUP.AUTHOR))        return 'Author';
  if (groups.includes(GROUP.REGISTERED))    return 'Registered';
  return 'Guest';
}
