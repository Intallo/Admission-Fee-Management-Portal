'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/Badge';
import { LogOut, Calendar, ChevronDown, Check } from 'lucide-react';

export interface AcademicYearOption {
  id: string;
  label: string;
  status: 'planning' | 'current' | 'closed';
}

export interface AppHeaderProps {
  schoolName?: string;
  activeAcademicYear?: string;
  staffName?: string;
  staffRole?: string;
}

export function AppHeader({
  schoolName = 'ABC English Medium School',
  activeAcademicYear = '2026-2027',
  staffName = 'Authorized Staff',
  staffRole = 'Principal',
}: AppHeaderProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState({ name: staffName, role: staffRole });
  const [currentYear, setCurrentYear] = useState(activeAcademicYear);
  const [years, setYears] = useState<AcademicYearOption[]>([
    { id: '00000000-0000-0000-0000-000000000000', label: '2025-2026', status: 'closed' },
    { id: '00000000-0000-0000-0000-000000000001', label: '2026-2027', status: 'current' },
  ]);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Fetch live session information
    fetch('/api/v1/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            name: data.user.fullName,
            role: data.user.role,
          });
          if (data.user.activeAcademicYearLabel) {
            setCurrentYear(data.user.activeAcademicYearLabel);
          }
        }
      })
      .catch(() => {});

    // Fetch available academic years
    fetch('/api/v1/academic-years')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.academicYears && data.academicYears.length > 0) {
          setYears(data.academicYears);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectYear = async (year: AcademicYearOption) => {
    setIsYearDropdownOpen(false);
    try {
      const res = await fetch('/api/v1/academic-years/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId: year.id }),
      });
      if (res.ok) {
        setCurrentYear(year.label);
        router.refresh();
      }
    } catch {
      // Ignored
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="bg-school-primary text-white border-b border-school-primary-hover sticky top-0 z-30 shadow-sm">
      <div className="max-w-content mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Branding & Institution */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-white text-school-primary flex items-center justify-center font-bold text-lg shadow-sm">
            ABC
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">{schoolName}</h1>
            <p className="text-xs text-blue-200">Admission & Fee Management Portal</p>
          </div>
        </div>

        {/* Right: Academic Year Selector, Profile Capsule & Logout */}
        <div className="flex items-center gap-4">
          {/* Interactive Academic Year Dropdown Selector (US-01 AC1 / UI_UX.md) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              className="flex items-center gap-2 bg-school-primary-hover hover:bg-blue-900 px-3 py-1.5 rounded-md border border-blue-800 text-xs transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-blue-300 font-medium">Year:</span>
              <span className="font-bold text-white tracking-wide">{currentYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-300" />
            </button>

            {isYearDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-school-surface text-school-text rounded-md shadow-lg border border-school-border py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-school-text-muted border-b border-school-border">
                  Select Academic Year Scope
                </div>
                {years.map((year) => {
                  const isSelected = year.label === currentYear;
                  return (
                    <button
                      key={year.id}
                      type="button"
                      onClick={() => handleSelectYear(year)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-school-surface-subtle transition-colors text-left ${
                        isSelected ? 'bg-blue-50 text-school-primary font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="w-3.5 h-3.5 text-school-primary" />}
                        <span>{year.label}</span>
                      </div>
                      <Badge
                        variant={
                          year.status === 'current'
                            ? 'success'
                            : year.status === 'planning'
                            ? 'warning'
                            : 'default'
                        }
                        className="text-[10px] py-0 px-1.5"
                      >
                        {year.status}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-3 border-l border-blue-800/80 pl-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight">{currentUser.name}</div>
              <div className="text-[11px] text-blue-200 capitalize">{currentUser.role.replace('_', ' ')}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-school-primary flex items-center justify-center font-bold text-xs">
              {currentUser.name.charAt(0)}
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign Out"
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-md transition-colors cursor-pointer ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
