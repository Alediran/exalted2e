// module/helpers/permissions.mjs
import { resolvePermissions } from "./permissions-defaults.mjs";

/**
 * Returns true if the given user meets the configured minimum role for the
 * named action. Reads the `exalted2e.permissions` world setting lazily on
 * every call, so mid-session changes take effect on the next invocation.
 *
 * Fallback: if the setting isn't registered yet (called before the `init`
 * hook completes) or reading it throws for any reason, we fall back to
 * `user.isGM`. That preserves current behavior during early boot.
 *
 * @param {string}   actionKey  one of the keys in PERMISSION_DEFAULTS
 * @param {User}     [user]     defaults to `game.user`
 * @returns {boolean}
 */
export function ex2eCan(actionKey, user = game.user) {
  try {
    const stored   = game.settings.get("exalted2e", "permissions");
    const required = resolvePermissions(stored)[actionKey];
    if (!Number.isFinite(required)) return !!user?.isGM;
    return (user?.role ?? 0) >= required;
  } catch {
    return !!user?.isGM;
  }
}

/**
 * Dropdown options for the configuration dialog. The dialog i18n-resolves
 * the labelKey at render time.
 */
export const REQUIRED_ROLE_CHOICES = Object.freeze([
  { value: CONST.USER_ROLES.PLAYER,     labelKey: "EX2E.RolePlayer"     },
  { value: CONST.USER_ROLES.TRUSTED,    labelKey: "EX2E.RoleTrusted"    },
  { value: CONST.USER_ROLES.ASSISTANT,  labelKey: "EX2E.RoleAssistant"  },
  { value: CONST.USER_ROLES.GAMEMASTER, labelKey: "EX2E.RoleGamemaster" }
]);
