import React from 'react';
import { ModuleScaffold } from '../../../components/ui/ModuleScaffold';

export default function SettingsPage() {
  return (
    <ModuleScaffold
      moduleName="School Settings & Administration"
      moduleCode="MOD-08"
      scheduledPhase="Phase 6 Delivery"
      description="Academic year lifecycle management, grade standard configurations, section seat quotas, and staff directory."
      targetStories={[
        'US-01: Academic Year Planning, Current, and Closed Status Lifecycle',
        'US-02: Grade Level and Section Setup with Capacity Limits',
        'US-03: Staff Directory and Role Assignment',
        'US-33: Database User Security & Least Privilege Enforcement',
      ]}
      keyInvariants={[
        'Academic year closure blocks further payment and admission mutations',
        'System Administrator is constrained to technical administration and cannot view sensitive PII',
        'Staff deactivation disables login while preserving all historic audit and financial links',
        'Database user school_app_user has zero DELETE privileges on core tables (US-33 AC2)',
      ]}
    />
  );
}
