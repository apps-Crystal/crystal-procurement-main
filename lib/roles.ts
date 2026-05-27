export type Role = 'admin' | 'pr_approver' | 'po_creator' | 'site_user' | 'grn_approver';

// Email lists — same as existing Apps Script system
const ROLES: Record<Role, string[]> = {
  admin: ['apps@crystalgroup.in', 'yatish@crystalgroup.in', 'ra@crystalgroup.in'],
  pr_approver: ['apps@crystalgroup.in', 'suravi.das@crystalgroup.in', 'yatish@crystalgroup.in', 'ra@crystalgroup.in', 'suganti.chowdhury@crystalgroup.in', 'purchase@crystalgroup.in'],
  po_creator: ['apps@crystalgroup.in', 'accounts@crystalgroup.in', 'yatish@crystalgroup.in', 'maintenance@crystalgroup.in', 'ra@crystalgroup.in', 'jyoti.seth@crystalgroup.in'],
  grn_approver: [], // loaded dynamically from Access_Matrix sheet per site
  site_user: [], // everyone else
};

export function getUserRoles(email: string): Role[] {
  const roles: Role[] = [];
  (Object.keys(ROLES) as Role[]).forEach(role => {
    if (ROLES[role].includes(email.toLowerCase())) roles.push(role);
  });
  if (roles.length === 0) roles.push('site_user');
  return roles;
}

export function hasRole(email: string, role: Role): boolean {
  return getUserRoles(email).includes(role);
}

export function canApprovePR(email: string): boolean {
  return hasRole(email, 'admin') || hasRole(email, 'pr_approver');
}

export function canCreatePO(email: string): boolean {
  return hasRole(email, 'admin') || hasRole(email, 'po_creator');
}

export function isAdmin(email: string): boolean {
  return hasRole(email, 'admin');
}
