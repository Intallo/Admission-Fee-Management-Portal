'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import { Select } from '../../../components/ui/Select';
import {
  StudentProfileDTO,
  StudentSearchItemDTO,
  StudentYearStatus,
} from '../../../modules/student-records/types';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  FileText,
  CreditCard,
  History,
  Award,
  Lock,
  Eye,
  RefreshCw,
  LogOut,
  Calendar,
  ShieldCheck,
  Building,
} from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentSearchItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('');

  // Profile View Modal
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<StudentProfileDTO | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<
    'details' | 'guardians' | 'documents' | 'fees' | 'receipts' | 'history' | 'certificates'
  >('details');

  // Mark Left Action Modal
  const [isMarkLeftOpen, setIsMarkLeftOpen] = useState(false);
  const [targetAcademicRecordId, setTargetAcademicRecordId] = useState<string | null>(null);
  const [targetStudentName, setTargetStudentName] = useState<string>('');
  const [exitStatus, setExitStatus] = useState<'left' | 'transferred' | 'withdrawn'>('transferred');
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [exitReason, setExitReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (gradeFilter) params.set('gradeLevelId', gradeFilter);

      const res = await fetch(`/api/v1/students?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to search student records');
      }

      const data = await res.json();
      setStudents(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading students');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, gradeFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const openStudentProfile = async (recordId: string) => {
    setActiveStudentId(recordId);
    setIsProfileLoading(true);
    setActiveProfileTab('details');

    try {
      const res = await fetch(`/api/v1/students/${recordId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to load student profile');
      }
      const data = await res.json();
      setActiveProfile(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching student profile');
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleMarkStudentStatus = async () => {
    if (!targetAcademicRecordId) return;
    if (!exitReason.trim() || exitReason.trim().length < 3) {
      setErrorMessage('Exit reason is mandatory and must be at least 3 characters.');
      return;
    }

    setIsSubmittingStatus(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/students/${targetAcademicRecordId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicRecordId: targetAcademicRecordId,
          newStatus: exitStatus,
          exitDate,
          exitReason: exitReason.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update student status');
      }

      setSuccessMessage(
        `Student "${targetStudentName}" marked as ${exitStatus.toUpperCase()}. Seat released successfully.`
      );
      setIsMarkLeftOpen(false);
      setExitReason('');
      fetchStudents();

      if (activeStudentId === targetAcademicRecordId) {
        openStudentProfile(targetAcademicRecordId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const getStatusBadge = (status: StudentYearStatus) => {
    switch (status) {
      case 'admitted':
        return <Badge variant="info">Admitted</Badge>;
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'left':
        return <Badge variant="danger">Left</Badge>;
      case 'transferred':
        return <Badge variant="warning">Transferred</Badge>;
      case 'withdrawn':
        return <Badge variant="danger">Withdrawn</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Records & Directory</h1>
          <p className="text-sm text-gray-500">
            Multi-criteria search, academic-year scoping, role-filtered profiles, and authorized status workflow.
          </p>
        </div>
        <Button variant="outline" onClick={fetchStudents} disabled={isLoading} className="self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <Alert variant="error" title="Action Denied or Failed">
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage}
        </Alert>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search Name, Admission No, STS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Enrollment Statuses</option>
                <option value="admitted">Admitted</option>
                <option value="active">Active</option>
                <option value="left">Left</option>
                <option value="transferred">Transferred</option>
                <option value="withdrawn">Withdrawn</option>
              </Select>
            </div>
            <div className="flex items-center text-sm text-gray-500 font-medium">
              Found {total} student record{total === 1 ? '' : 's'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">Admission No</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Class & Section</th>
                  <th className="px-6 py-3">STS Number</th>
                  <th className="px-6 py-3">Primary Guardian</th>
                  <th className="px-6 py-3">Enrollment Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading student records...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No student records found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.studentAcademicRecordId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-indigo-600">
                        {student.admissionNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {student.fullName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {student.gradeLevelName} • {student.sectionName}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                        {student.stsNumber || '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div>{student.primaryGuardianName}</div>
                        <div className="text-xs text-gray-400">{student.primaryGuardianMobile}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(student.status)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStudentProfile(student.studentAcademicRecordId)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Profile
                        </Button>
                        {(student.status === 'admitted' || student.status === 'active') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setTargetAcademicRecordId(student.studentAcademicRecordId);
                              setTargetStudentName(student.fullName);
                              setIsMarkLeftOpen(true);
                            }}
                          >
                            <LogOut className="w-4 h-4 mr-1 text-red-500" />
                            Mark Left
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mark Left Modal */}
      {isMarkLeftOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Authorized Status Transition</h3>
            </div>
            <p className="text-sm text-gray-600">
              Mark <strong>{targetStudentName}</strong> as Left/Transferred. This releases the student&apos;s seat while
              permanently preserving all academic records, documents, payments, and receipts.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Status</label>
                <Select value={exitStatus} onChange={(e: any) => setExitStatus(e.target.value)}>
                  <option value="transferred">Transferred (Moved to another school/city)</option>
                  <option value="left">Left (Completed or discontinued)</option>
                  <option value="withdrawn">Withdrawn</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Effective Date</label>
                <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Reason for Leaving (Mandatory)
                </label>
                <Input
                  placeholder="e.g. Relocated to Belagavi district"
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setIsMarkLeftOpen(false)} disabled={isSubmittingStatus}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleMarkStudentStatus} disabled={isSubmittingStatus}>
                {isSubmittingStatus ? 'Updating Status...' : 'Confirm Status Change'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {activeStudentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {isProfileLoading || !activeProfile ? (
              <div className="py-12 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
                Loading comprehensive student profile...
              </div>
            ) : (
              <>
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {activeProfile.demographics.firstName} {activeProfile.demographics.lastName}
                      </h2>
                      {getStatusBadge(activeProfile.currentAcademicRecord.status)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Admission No: <span className="font-mono font-medium text-indigo-600">{activeProfile.currentAcademicRecord.admissionNumber}</span> •{' '}
                      {activeProfile.currentAcademicRecord.gradeLevelName} ({activeProfile.currentAcademicRecord.sectionName}) •{' '}
                      Academic Year: {activeProfile.currentAcademicRecord.academicYearLabel}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setActiveStudentId(null)}>
                    Close
                  </Button>
                </div>

                {/* Profile Navigation Tabs (US-31 AC1) */}
                <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                  {[
                    { id: 'details', label: 'Student Details', icon: Users },
                    { id: 'guardians', label: 'Parents / Guardians', icon: Building },
                    { id: 'documents', label: 'Documents', icon: FileText, restricted: !activeProfile.documents },
                    { id: 'fees', label: 'Fees & Dues', icon: CreditCard, restricted: !activeProfile.feeSummary },
                    { id: 'receipts', label: 'Receipts', icon: History, restricted: !activeProfile.receipts },
                    { id: 'history', label: 'Status History', icon: Calendar },
                    { id: 'certificates', label: 'Certificates (LC/TC)', icon: Award },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    if (tab.restricted) return null; // Role-filtered tabs (US-31 AC2)
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveProfileTab(tab.id as any)}
                        className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeProfileTab === tab.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                {activeProfileTab === 'details' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="text-xs font-semibold uppercase text-gray-500">Demographic Information</div>
                        <div><strong>Gender:</strong> {activeProfile.demographics.gender}</div>
                        <div><strong>Date of Birth:</strong> {activeProfile.demographics.dateOfBirth}</div>
                        <div><strong>Place of Birth:</strong> {activeProfile.demographics.placeOfBirth || 'N/A'}</div>
                        <div><strong>Nationality:</strong> {activeProfile.demographics.nationality || 'Indian'}</div>
                        <div><strong>Mother Tongue:</strong> {activeProfile.demographics.motherTongue || 'N/A'}</div>
                        <div><strong>Religion:</strong> {activeProfile.demographics.religion || 'N/A'}</div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="text-xs font-semibold uppercase text-gray-500">Institutional & Transport</div>
                        <div><strong>STS Number:</strong> {activeProfile.demographics.stsNumber || 'N/A'}</div>
                        <div><strong>DISE Number:</strong> {activeProfile.demographics.diseNumber || 'N/A'}</div>
                        <div><strong>Transport Mode:</strong> {activeProfile.currentAcademicRecord.transportOptedIn ? 'School Bus' : 'Private'}</div>
                        <div><strong>Admission Date:</strong> {activeProfile.currentAcademicRecord.admissionDate}</div>
                        <div><strong>Roll Number:</strong> {activeProfile.currentAcademicRecord.rollNumber || 'Not assigned'}</div>
                      </div>
                    </div>

                    {/* Sensitive PII Section (Restricted strictly to Principal and ADM) */}
                    {activeProfile.sensitiveDetails ? (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm space-y-2">
                        <div className="flex items-center space-x-2 text-amber-800 font-semibold">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span>Confidential Demographic PII (Restricted Role Access)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-700">
                          <div>
                            <strong>Aadhaar Number:</strong>{' '}
                            {activeProfile.sensitiveDetails.aadhaarNumberUnmasked
                              ? activeProfile.sensitiveDetails.aadhaarNumberUnmasked
                              : activeProfile.sensitiveDetails.aadhaarNumberMasked}
                          </div>
                          <div><strong>Annual Household Income:</strong> ₹{activeProfile.sensitiveDetails.householdIncomeInr || 'N/A'}</div>
                          <div><strong>Caste Category:</strong> {activeProfile.sensitiveDetails.casteCategory || 'N/A'}</div>
                          <div><strong>Sub-Caste:</strong> {activeProfile.sensitiveDetails.subCaste || 'N/A'}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {activeProfileTab === 'guardians' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeProfile.guardians.map((g, idx) => (
                      <div key={idx} className="border border-gray-200 p-4 rounded-lg space-y-2 text-sm bg-gray-50">
                        <div className="flex justify-between items-center">
                          <strong className="text-base text-gray-900">{g.fullName}</strong>
                          {g.isPrimaryContact && <Badge variant="success">Primary Contact</Badge>}
                        </div>
                        <div><strong>Relationship:</strong> {g.relationship}</div>
                        <div><strong>Mobile:</strong> {g.mobileNumber}</div>
                        <div><strong>Email:</strong> {g.email || 'N/A'}</div>
                        <div><strong>Address:</strong> {g.residentialAddress || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeProfileTab === 'documents' && activeProfile.documents && (
                  <div className="space-y-3">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">Document Type</th>
                          <th className="px-4 py-2">Version</th>
                          <th className="px-4 py-2">Verification Status</th>
                          <th className="px-4 py-2">Upload Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeProfile.documents.map((d) => (
                          <tr key={d.id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{d.documentTypeName}</td>
                            <td className="px-4 py-3 font-mono">v{d.versionNumber}</td>
                            <td className="px-4 py-3">
                              <Badge variant={d.verificationStatus === 'verified' ? 'success' : 'warning'}>
                                {d.verificationStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{d.createdAt.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeProfileTab === 'fees' && activeProfile.feeSummary && (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-3 gap-4 bg-indigo-50 p-4 rounded-lg">
                      <div>
                        <div className="text-xs uppercase text-indigo-700 font-semibold">Total Assessed</div>
                        <div className="text-xl font-bold text-indigo-900">₹{activeProfile.feeSummary.totalAssessedInr}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-green-700 font-semibold">Total Paid</div>
                        <div className="text-xl font-bold text-green-900">₹{activeProfile.feeSummary.totalPaidInr}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-red-700 font-semibold">Remaining Due</div>
                        <div className="text-xl font-bold text-red-900">₹{activeProfile.feeSummary.netBalanceDueInr}</div>
                      </div>
                    </div>

                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">Fee Head</th>
                          <th className="px-4 py-2">Category</th>
                          <th className="px-4 py-2 text-right">Assessed</th>
                          <th className="px-4 py-2 text-right">Paid</th>
                          <th className="px-4 py-2 text-right">Net Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeProfile.feeSummary.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{l.feeHeadName}</td>
                            <td className="px-4 py-3 capitalize text-gray-500">{l.category.replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-right font-mono">₹{l.assessedAmount}</td>
                            <td className="px-4 py-3 text-right font-mono text-green-600">₹{l.collectedAmount}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">₹{l.netRemainingDues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeProfileTab === 'receipts' && activeProfile.receipts && (
                  <div className="space-y-3">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">Receipt No</th>
                          <th className="px-4 py-2">Category</th>
                          <th className="px-4 py-2">Payer</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeProfile.receipts.length === 0 ? (
                          <tr><td colSpan={5} className="p-4 text-center text-gray-500">No receipts issued yet.</td></tr>
                        ) : (
                          activeProfile.receipts.map((r) => (
                            <tr key={r.id}>
                              <td className="px-4 py-3 font-mono font-bold text-indigo-600">{r.receiptNumber}</td>
                              <td className="px-4 py-3 capitalize text-gray-500">{r.category}</td>
                              <td className="px-4 py-3 text-gray-700">{r.renderedSnapshot.payerName}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold">₹{r.renderedSnapshot.totalAmountInr}</td>
                              <td className="px-4 py-3 text-gray-500">{r.createdAt.slice(0, 10)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeProfileTab === 'history' && (
                  <div className="space-y-3">
                    {activeProfile.statusHistory.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                        No previous status transitions recorded.
                      </div>
                    ) : (
                      activeProfile.statusHistory.map((h) => (
                        <div key={h.id} className="p-4 border border-gray-200 rounded-lg space-y-1 text-sm bg-gray-50">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-900">
                              Transition: {h.previousStatus.toUpperCase()} → {h.newStatus.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">{h.createdAt.slice(0, 10)}</span>
                          </div>
                          <div><strong>Effective Date:</strong> {h.effectiveDate}</div>
                          <div><strong>Reason:</strong> {h.reason}</div>
                          <div className="text-xs text-gray-400">Recorded by: {h.changedByStaffName}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeProfileTab === 'certificates' && (
                  <div className="space-y-3">
                    {activeProfile.certificates.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                        No certificates generated for this academic year.
                      </div>
                    ) : (
                      activeProfile.certificates.map((c) => (
                        <div key={c.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between text-sm bg-gray-50">
                          <div>
                            <div className="font-bold text-gray-900">
                              {c.certificateType} — {c.certificateNumber || 'Number Not Yet Assigned (Draft)'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Status: <Badge variant={c.status === 'issued' ? 'success' : 'warning'}>{c.status}</Badge>{' '}
                              {c.reviewStatus && <span className="ml-2 font-medium">Review: {c.reviewStatus}</span>}
                            </div>
                          </div>
                          {c.issuedAt && (
                            <div className="text-xs text-gray-500 font-mono">Issued on {c.issuedAt.slice(0, 10)}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
