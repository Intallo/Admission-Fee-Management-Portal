import { StaffRole } from '../modules/identity-access/types';

export type PolicyAction =
  | 'admissions:create_draft'
  | 'admissions:submit_verification'
  | 'admissions:approve_decision'
  | 'admissions:set_seat_limits'
  | 'admissions:view_sensitive_pii'
  | 'documents:upload'
  | 'documents:download'
  | 'fees:configure_structure'
  | 'fees:approve_structure'
  | 'fees:record_payment'
  | 'fees:view_dues'
  | 'fees:request_concession'
  | 'fees:approve_concession'
  | 'fees:request_reversal'
  | 'fees:approve_reversal'
  | 'certificates:request_tc'
  | 'certificates:review_tc'
  | 'certificates:issue_tc'
  | 'certificates:reprint_tc'
  | 'students:mark_left'
  | 'users:manage_accounts'
  | 'audit:view_logs'
  | 'dashboard:view_metrics';

/**
 * Strict role-to-action permission mapping per signed AUTHORIZATION_MATRIX.md
 */
const ROLE_PERMISSIONS: Record<StaffRole, Set<PolicyAction>> = {
  principal: new Set([
    'admissions:create_draft',
    'admissions:approve_decision',
    'admissions:set_seat_limits',
    'admissions:view_sensitive_pii',
    'documents:upload',
    'documents:download',
    'fees:approve_structure',
    'fees:view_dues',
    'fees:request_concession',
    'fees:approve_concession',
    'fees:request_reversal',
    'fees:approve_reversal',
    'certificates:request_tc',
    'certificates:issue_tc',
    'certificates:reprint_tc',
    'students:mark_left',
    'audit:view_logs',
    'dashboard:view_metrics',
  ]),
  accountant: new Set([
    'fees:configure_structure',
    'fees:record_payment',
    'fees:view_dues',
    'fees:request_concession',
    'fees:request_reversal',
    'audit:view_logs',
    'dashboard:view_metrics',
  ]),
  admission_officer: new Set([
    'admissions:create_draft',
    'admissions:submit_verification',
    'admissions:view_sensitive_pii',
    'documents:upload',
    'documents:download',
    'certificates:request_tc',
    'certificates:review_tc',
    'certificates:reprint_tc',
    'dashboard:view_metrics',
  ]),
  clerk: new Set([
    'admissions:create_draft',
    'admissions:submit_verification',
    'fees:record_payment',
    'fees:view_dues',
    'dashboard:view_metrics',
  ]),
  system_admin: new Set([
    'users:manage_accounts',
    'audit:view_logs',
  ]),
  read_only: new Set([
    'fees:view_dues',
    'audit:view_logs',
    'dashboard:view_metrics',
  ]),
};

/**
 * Evaluates whether a role is authorized to perform a given action.
 */
export function hasPermission(role: StaffRole, action: PolicyAction): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.has(action) : false;
}

/**
 * Asserts that the role has the required permission, otherwise throwing AuthorizationError.
 */
export function assertPermission(role: StaffRole, action: PolicyAction): void {
  if (!hasPermission(role, action)) {
    throw new Error(
      `Access Denied: Role "${role}" is not authorized to execute action "${action}".`
    );
  }
}
