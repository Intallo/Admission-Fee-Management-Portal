'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserPlus,
  GraduationCap,
  CreditCard,
  Receipt,
  FileCheck2,
  ScrollText,
  Settings,
  Users,
  CalendarDays,
} from 'lucide-react';
import { StaffRole } from '../../modules/identity-access/types';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
  allowedRoles: StaffRole[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    phase: 'Phase 2',
    allowedRoles: ['principal', 'system_admin', 'admission_officer', 'accountant', 'clerk', 'read_only'],
  },
  {
    label: 'Admissions',
    href: '/admissions',
    icon: UserPlus,
    phase: 'Phase 3',
    allowedRoles: ['principal', 'admission_officer', 'clerk'],
  },
  {
    label: 'Students',
    href: '/students',
    icon: GraduationCap,
    phase: 'Phase 3',
    allowedRoles: ['principal', 'admission_officer'],
  },
  {
    label: 'Fee Management',
    href: '/fees',
    icon: CreditCard,
    phase: 'Phase 4',
    allowedRoles: ['principal', 'accountant'],
  },
  {
    label: 'Receipts & Dues',
    href: '/receipts',
    icon: Receipt,
    phase: 'Phase 4',
    allowedRoles: ['principal', 'accountant', 'clerk'],
  },
  {
    label: 'Certificates (LC/TC)',
    href: '/certificates',
    icon: FileCheck2,
    phase: 'Phase 5',
    allowedRoles: ['principal', 'admission_officer'],
  },
  {
    label: 'Audit Trail',
    href: '/audit',
    icon: ScrollText,
    phase: 'Phase 5',
    allowedRoles: ['principal', 'system_admin', 'accountant'],
  },
  {
    label: 'Academic Years',
    href: '/settings/academic-years',
    icon: CalendarDays,
    phase: 'Phase 3',
    allowedRoles: ['principal', 'system_admin'],
  },
  {
    label: 'Staff Directory',
    href: '/settings/staff',
    icon: Users,
    phase: 'Phase 3',
    allowedRoles: ['system_admin'],
  },
  {
    label: 'School Settings',
    href: '/settings',
    icon: Settings,
    phase: 'Phase 6',
    allowedRoles: ['principal', 'system_admin'],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState<StaffRole>('principal');

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user?.role) {
          setCurrentRole(data.user.role as StaffRole);
        }
      })
      .catch(() => {});
  }, []);

  // Filter items matching active role (US-02 Role-based menus)
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(currentRole)
  );

  return (
    <aside className="w-64 bg-school-surface border-r border-school-border flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 border-b border-school-border">
        <div className="text-xs font-bold uppercase tracking-wider text-school-text-muted">
          Portal Navigation
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-school-primary font-bold border border-blue-200'
                  : 'text-school-text hover:bg-school-surface-subtle hover:text-school-primary'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-school-primary' : 'text-school-text-muted'}`} />
                <span>{item.label}</span>
              </div>
              <span className="text-[10px] text-gray-400 font-normal">{item.phase}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-school-border bg-school-surface-subtle">
        <div className="text-[11px] text-school-text-muted space-y-1">
          <div className="font-semibold text-school-text">Active Role: {currentRole.replace('_', ' ')}</div>
          <div>RBAC Enforced on Server Boundaries</div>
          <div className="text-gray-400">Security: US-01 / US-02 / US-03</div>
        </div>
      </div>
    </aside>
  );
}
