import React from 'react';
import { AppHeader } from '../../components/shell/AppHeader';
import { AppSidebar } from '../../components/shell/AppSidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        schoolName="ABC English Medium School"
        activeAcademicYear="2026-27"
        staffName="Administrative Officer"
        staffRole="Principal"
      />
      <div className="flex flex-1 max-w-content w-full mx-auto">
        <AppSidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
