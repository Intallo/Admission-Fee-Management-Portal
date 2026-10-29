import { StaffRole } from '../modules/identity-access/types';
import { PolicyAction, hasPermission } from './permissions';
import { AuthorizationError } from '../lib/errors';

export function enforcePolicy(role: StaffRole, action: PolicyAction): void {
  if (!hasPermission(role, action)) {
    throw new AuthorizationError(
      `Access Denied: You do not possess the required permission for action "${action}".`
    );
  }
}
