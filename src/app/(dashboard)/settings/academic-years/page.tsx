'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { Alert } from '../../../../components/ui/Alert';
import { AcademicYearDTO } from '../../../../modules/academic-years/types';
import { Calendar, Plus, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYearDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closeTargetYear, setCloseTargetYear] = useState<AcademicYearDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New year form
  const [newLabel, setNewLabel] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchYears = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/academic-years');
      if (res.ok) {
        const data = await res.json();
        setYears(data.academicYears || []);
      }
    } catch {
      setErrorMessage('Failed to load academic years.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/v1/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel,
          startDate: newStartDate,
          endDate: newEndDate,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to create academic year.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(`Academic year "${newLabel}" successfully created in planning state.`);
      setIsModalOpen(false);
      setNewLabel('');
      setNewStartDate('');
      setNewEndDate('');
      setNewNotes('');
      fetchYears();
    } catch {
      setErrorMessage('A network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseYear = async () => {
    if (!closeTargetYear) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/academic-years/${closeTargetYear.id}/close`, {
        method: 'PATCH',
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to close academic year.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(`Academic year "${closeTargetYear.label}" is now formally closed and locked.`);
      setCloseTargetYear(null);
      fetchYears();
    } catch {
      setErrorMessage('A network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-school-text">Academic Year Management</h1>
          <p className="text-xs text-school-text-muted mt-1">
            Configure calendar periods, active operational scope, and closed-year protections.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Academic Year
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
            <CardTitle>Academic Years Directory</CardTitle>
            <Badge variant="info">Closed-Year Protection Active</Badge>
          </div>
          <CardDescription>
            Closed academic years are strictly read-only; mutations (new applications, payments, or structure changes) are fail-closed rejected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-school-text-muted py-6 text-center">Loading academic years...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-school-border bg-school-surface-subtle text-school-text-muted font-semibold">
                    <th className="py-2.5 px-3">Label</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">End Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-school-border">
                  {years.map((year) => (
                    <tr key={year.id} className="hover:bg-school-surface-subtle transition-colors">
                      <td className="py-3 px-3 font-semibold text-school-primary font-mono flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-school-primary" />
                        {year.label}
                      </td>
                      <td className="py-3 px-3 text-school-text">{year.startDate}</td>
                      <td className="py-3 px-3 text-school-text">{year.endDate}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            year.status === 'current'
                              ? 'success'
                              : year.status === 'planning'
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {year.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-school-text-muted max-w-xs truncate">{year.notes || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        {year.status === 'current' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-school-danger border-school-danger hover:bg-red-50 text-[11px]"
                            onClick={() => setCloseTargetYear(year)}
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Close Year
                          </Button>
                        ) : year.status === 'closed' ? (
                          <span className="text-[11px] text-gray-400 italic">Locked</span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">In Planning</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader>
              <CardTitle>Create Academic Year</CardTitle>
              <CardDescription>
                Initializes a new academic period in &apos;planning&apos; state. Dates must not overlap with existing years.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateYear}>
              <CardContent className="space-y-4 pt-5">
                <Input
                  label="Academic Year Label"
                  placeholder="e.g. 2027-2028"
                  required
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Date"
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
                <Input
                  label="Administrative Notes"
                  placeholder="Optional planning notes..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </CardContent>
              <div className="p-4 bg-school-surface-subtle border-t border-school-border flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Create Academic Year
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Close Year Confirmation Modal */}
      {closeTargetYear && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full border-red-300 shadow-2xl">
            <CardHeader className="bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-school-danger" />
                <CardTitle className="text-school-danger">Formally Close Academic Year?</CardTitle>
              </div>
              <CardDescription className="text-red-800">
                Are you sure you want to close year &quot;{closeTargetYear.label}&quot;?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5 text-xs text-school-text-muted leading-relaxed">
              <p>
                Closing an academic year locks all fee ledger records, payments, and admissions for that year.
                <strong> This action is permanent and irreversible.</strong>
              </p>
              <p className="bg-amber-50 p-2.5 rounded border border-amber-200 text-amber-900 font-medium">
                Per SBR-05: Unpaid balances are not automatically carried forward into subsequent years.
              </p>
            </CardContent>
            <div className="p-4 bg-school-surface-subtle border-t border-school-border flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCloseTargetYear(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" isLoading={isSubmitting} onClick={handleCloseYear}>
                Confirm & Lock Academic Year
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
