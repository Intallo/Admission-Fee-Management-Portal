'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Badge } from '../../../../components/ui/Badge';
import { Alert } from '../../../../components/ui/Alert';
import { StaffRole, StaffMemberDTO } from '../../../../modules/identity-access/types';
import { ALL_ROLES, ROLE_LABELS } from '../../../../policy/roles';
import { Users, UserPlus, KeyRound, UserCheck, UserX, ShieldCheck } from 'lucide-react';

export default function StaffDirectoryPage() {
  const [staffList, setStaffList] = useState<StaffMemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetModalResult, setResetModalResult] = useState<{ email: string; tempPass: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New staff form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('clerk');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch {
      setErrorMessage('Failed to load staff directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to create staff member.');
        setIsSubmitting(false);
        return;
      }

      setResetModalResult({
        email: data.staff.email,
        tempPass: data.temporaryPassword,
      });

      setIsCreateModalOpen(false);
      setFullName('');
      setEmail('');
      setRole('clerk');
      fetchStaff();
    } catch {
      setErrorMessage('Network error creating staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (staff: StaffMemberDTO) => {
    const newActiveState = !staff.isActive;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/admin/staff/${staff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActiveState }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to update staff status.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `Staff member "${staff.fullName}" ${newActiveState ? 'reactivated' : 'deactivated'} successfully.`
      );
      fetchStaff();
    } catch {
      setErrorMessage('Network error updating staff status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (staff: StaffMemberDTO) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/admin/staff/${staff.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staff.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to reset password.');
        setIsSubmitting(false);
        return;
      }

      setResetModalResult({
        email: staff.email,
        tempPass: data.temporaryPassword,
      });
    } catch {
      setErrorMessage('Network error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-school-text">Staff Directory & User Lifecycle</h1>
          <p className="text-xs text-school-text-muted mt-1">
            Manage staff accounts, assign RBAC roles, deactivate departing users, and reset credentials.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add Staff Member
        </Button>
      </div>

      {errorMessage && (
        <Alert variant="danger" title="Error">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Staff Accounts</CardTitle>
            <Badge variant="info">Zero Hard-Deletes (US-04 AC2)</Badge>
          </div>
          <CardDescription>
            Deactivating an account blocks login immediately while preserving historical ledger and audit links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-school-text-muted py-6 text-center">Loading staff directory...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-school-border bg-school-surface-subtle text-school-text-muted font-semibold">
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-school-border">
                  {staffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-school-surface-subtle transition-colors">
                      <td className="py-3 px-3 font-semibold text-school-text flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-school-primary font-bold flex items-center justify-center text-[11px]">
                          {staff.fullName.charAt(0)}
                        </div>
                        {staff.fullName}
                      </td>
                      <td className="py-3 px-3 text-school-text-muted font-mono">{staff.email}</td>
                      <td className="py-3 px-3">
                        <Badge variant="default" className="capitalize">
                          {staff.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={staff.isActive ? 'success' : 'danger'}>
                          {staff.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleResetPassword(staff)}
                          disabled={!staff.isActive || isSubmitting}
                          title="Generate temporary password"
                        >
                          <KeyRound className="w-3 h-3 mr-1 text-amber-600" />
                          Reset Pass
                        </Button>
                        <Button
                          variant={staff.isActive ? 'outline' : 'secondary'}
                          size="sm"
                          className={staff.isActive ? 'text-school-danger border-school-danger' : 'text-school-success'}
                          onClick={() => handleToggleActive(staff)}
                          disabled={isSubmitting}
                        >
                          {staff.isActive ? (
                            <>
                              <UserX className="w-3 h-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Staff Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader>
              <CardTitle>Create Staff Member</CardTitle>
              <CardDescription>
                Provisions a new staff user with single-role assignment and generates a first-login temporary password.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateStaff}>
              <CardContent className="space-y-4 pt-5">
                <Input
                  label="Full Name"
                  placeholder="e.g. Ramesh Kulkarni"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@school-demo.example"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Select
                  label="Assigned System Role"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  options={ALL_ROLES.map((r) => ({
                    label: ROLE_LABELS[r],
                    value: r,
                  }))}
                />
              </CardContent>
              <div className="p-4 bg-school-surface-subtle border-t border-school-border flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Create Staff Account
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Temporary Password Modal Notice */}
      {resetModalResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full border-green-300 shadow-2xl">
            <CardHeader className="bg-green-50 border-green-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-school-success" />
                <CardTitle className="text-school-success">Temporary Password Generated</CardTitle>
              </div>
              <CardDescription className="text-green-800">
                Provide this temporary credential to staff member {resetModalResult.email}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <p className="text-xs text-school-text-muted">
                The user will be required to change this password immediately upon their first login (A-21).
              </p>
              <div className="p-3 bg-gray-100 rounded border border-gray-300 font-mono text-center text-sm font-bold tracking-wider text-school-primary select-all">
                {resetModalResult.tempPass}
              </div>
            </CardContent>
            <div className="p-4 bg-school-surface-subtle border-t border-school-border flex justify-end">
              <Button type="button" variant="primary" onClick={() => setResetModalResult(null)}>
                Acknowledged & Copied
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
