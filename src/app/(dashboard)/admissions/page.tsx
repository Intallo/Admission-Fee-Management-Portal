'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import { Select } from '../../../components/ui/Select';
import {
  AdmissionApplicationSummaryDTO,
  AdmissionApplicationDetailDTO,
  AdmissionApplicationStatus,
  AdmissionStatusCountsDTO,
  SectionCapacityDTO,
} from '../../../modules/admissions/types';
import {
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PauseCircle,
  FileText,
  Upload,
  Lock,
  Eye,
  RefreshCw,
  Building,
} from 'lucide-react';

export default function AdmissionsPage() {
  const [applications, setApplications] = useState<AdmissionApplicationSummaryDTO[]>([]);
  const [counts, setCounts] = useState<AdmissionStatusCountsDTO>({
    draftCount: 0,
    submittedCount: 0,
    underReviewCount: 0,
    onHoldCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feeNotGeneratedOnly, setFeeNotGeneratedOnly] = useState(false);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<AdmissionApplicationDetailDTO | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Decision Modal States
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | 'hold' | 'return_to_draft' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [assignedSectionId, setAssignedSectionId] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState<SectionCapacityDTO | null>(null);

  // Document Upload
  const [uploadTypeId, setUploadTypeId] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // New Application Form State
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formGradeLevelId, setFormGradeLevelId] = useState('30000000-0000-0000-0000-000000000004'); // STD1
  const [formDob, setFormDob] = useState('2020-05-15');
  const [formGender, setFormGender] = useState<'male' | 'female' | 'other'>('male');
  const [formStsNumber, setFormStsNumber] = useState('');
  const [formReligion, setFormReligion] = useState('');
  const [formBloodGroup, setFormBloodGroup] = useState('B+');
  const [formGuardianName, setFormGuardianName] = useState('');
  const [formGuardianPhone, setFormGuardianPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAadhaar, setFormAadhaar] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIfscCode, setFormIfscCode] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/admissions/applications?';
      if (selectedStatus !== 'all') {
        url += `status=${selectedStatus}&`;
      }
      if (searchQuery.trim()) {
        url += `search=${encodeURIComponent(searchQuery.trim())}&`;
      }
      if (feeNotGeneratedOnly) {
        url += `feeNotGenerated=true&`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.items || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch {
      setErrorMessage('Failed to load admission applications.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, searchQuery, feeNotGeneratedOnly]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications();
  };

  const handleOpenDetail = async (id: string) => {
    setActiveApplicationId(id);
    setIsDetailLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/admissions/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDetail(data.application);
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || 'Failed to retrieve application details.');
      }
    } catch {
      setErrorMessage('Network error fetching application details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setActiveApplicationId(null);
    setActiveDetail(null);
    setDecisionType(null);
    setCapacityInfo(null);
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDraft(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        requestedGradeLevelId: formGradeLevelId,
        studentFirstName: formFirstName,
        studentLastName: formLastName,
        dateOfBirth: formDob,
        gender: formGender,
        stsNumber: formStsNumber.trim() || undefined,
        religion: formReligion || undefined,
        bloodGroup: formBloodGroup || undefined,
        primaryGuardianName: formGuardianName,
        primaryGuardianPhone: formGuardianPhone,
        residentialAddress: formAddress || '12 Sample Road, Bengaluru',
        aadhaarNumber: formAadhaar || undefined,
        bankName: formBankName || undefined,
        accountNumber: formAccountNumber || undefined,
        ifscCode: formIfscCode || undefined,
      };

      const res = await fetch('/api/v1/admissions/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to create application draft.');
        setIsSavingDraft(false);
        return;
      }

      setSuccessMessage(`Application draft created successfully. Assigned Number: ${data.application.applicationNumber}`);
      setIsNewModalOpen(false);
      // Reset form
      setFormFirstName('');
      setFormLastName('');
      setFormStsNumber('');
      setFormAadhaar('');
      fetchApplications();
    } catch {
      setErrorMessage('Network error occurred during draft creation.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!activeDetail) return;
    setIsDeciding(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/admissions/applications/${activeDetail.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to submit application.');
        setIsDeciding(false);
        return;
      }

      setSuccessMessage('Application submitted successfully for Principal review.');
      handleOpenDetail(activeDetail.id);
      fetchApplications();
    } catch {
      setErrorMessage('Network error submitting application.');
    } finally {
      setIsDeciding(false);
    }
  };

  const handleDecisionSubmit = async () => {
    if (!activeDetail || !decisionType) return;
    setIsDeciding(true);
    setErrorMessage(null);

    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (decisionType === 'approve') {
        endpoint = `/api/v1/admissions/applications/${activeDetail.id}/approve`;
        body = {
          assignedSectionId: assignedSectionId || '40000000-0000-0000-0000-000000000001',
          remarks: decisionReason || 'Principal approved admission.',
        };
      } else if (decisionType === 'reject') {
        endpoint = `/api/v1/admissions/applications/${activeDetail.id}/reject`;
        body = { reason: decisionReason };
      } else if (decisionType === 'hold') {
        endpoint = `/api/v1/admissions/applications/${activeDetail.id}/hold`;
        body = { reason: decisionReason };
      } else if (decisionType === 'return_to_draft') {
        endpoint = `/api/v1/admissions/applications/${activeDetail.id}/return-to-draft`;
        body = { reason: decisionReason };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Failed to complete admission decision.');
        setIsDeciding(false);
        return;
      }

      setSuccessMessage(
        decisionType === 'approve'
          ? `Admission approved! Permanent Admission Number: ${data.admissionNumber}. Zero fee payment required.`
          : `Application status transitioned to ${decisionType.toUpperCase()}.`
      );
      setDecisionType(null);
      setDecisionReason('');
      handleOpenDetail(activeDetail.id);
      fetchApplications();
    } catch {
      setErrorMessage('Network error during admission decision.');
    } finally {
      setIsDeciding(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!activeDetail || !uploadTypeId) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: activeDetail.studentId,
          admissionApplicationId: activeDetail.id,
          documentTypeId: uploadTypeId,
          fileName: uploadFileName || 'uploaded_document.pdf',
          fileSizeBytes: 1024 * 500, // 500 KB synthetic
          mimeType: 'application/pdf',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.detail || 'Document upload rejected.');
        setIsUploading(false);
        return;
      }

      setSuccessMessage(`Document "${data.document.fileName}" uploaded. Version: ${data.document.versionNumber}`);
      setUploadFileName('');
      setUploadTypeId('');
      handleOpenDetail(activeDetail.id);
    } catch {
      setErrorMessage('Network error uploading document.');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: AdmissionApplicationStatus) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved / Admitted</Badge>;
      case 'submitted':
        return <Badge variant="info">Submitted for Review</Badge>;
      case 'under_review':
        return <Badge variant="info">Under Review</Badge>;
      case 'on_hold':
        return <Badge variant="warning">On Hold</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'draft':
      default:
        return <Badge variant="default">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admissions & Intake Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Standard-wise application intake, missing document tracking, capacity checks, and Principal decisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchApplications} isLoading={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setIsNewModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> New Application Draft
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <Alert variant="danger" title="Action Error">
          <div className="flex justify-between items-center">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline ml-2 text-red-700 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" title="Success">
          <div className="flex justify-between items-center">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-xs underline ml-2 text-green-700 hover:text-green-900"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Intake</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{counts.totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Drafts</div>
          <div className="text-2xl font-bold text-gray-700 mt-1">{counts.draftCount}</div>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50/30">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{counts.submittedCount + counts.underReviewCount}</div>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50/30">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wider">On Hold</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{counts.onHoldCount}</div>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50/30">
          <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Admitted</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{counts.approvedCount}</div>
        </Card>
        <Card className="p-4 border-rose-200 bg-rose-50/30">
          <div className="text-xs font-medium text-rose-600 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-bold text-rose-900 mt-1">{counts.rejectedCount}</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by student name, application number, or STS number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'submitted', label: 'Submitted' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'approved', label: 'Approved / Admitted' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeNotGeneratedOnly}
                  onChange={(e) => setFeeNotGeneratedOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Fee Not Generated Only
              </label>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Intake Registry</CardTitle>
          <CardDescription>Academic Year 2026-2027 Admission Applications</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 font-medium">
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Standard & Section</th>
                  <th className="py-3 px-4">STS Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Fee Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No applications found matching the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-blue-700">
                        {app.applicationNumber || 'DRAFT'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{app.studentName}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {app.gradeLevelName} {app.sectionName ? `(Sec ${app.sectionName})` : ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">
                        {app.stsNumber || '—'}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(app.status)}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {app.submissionDate || 'Pending Submission'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {app.status === 'approved' ? (
                          app.feeGenerated ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Generated
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Fee Not Generated
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">Pre-Admission</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetail(app.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View & Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Draft Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Initiate Admission Application</h2>
                <p className="text-xs text-gray-500">
                  Save draft with minimal details; monotonic number allocated immediately.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Student first name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Student last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Standard to Admit <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formGradeLevelId}
                    onChange={(e) => setFormGradeLevelId(e.target.value)}
                    options={[
                      { value: '30000000-0000-0000-0000-000000000001', label: 'Nursery (Pre-primary)' },
                      { value: '30000000-0000-0000-0000-000000000004', label: 'Class 1 (Primary)' },
                      { value: '30000000-0000-0000-0000-000000000008', label: 'Class 5 (Primary)' },
                      { value: '30000000-0000-0000-0000-000000000009', label: 'Class 8 (High School)' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                  <Select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Karnataka STS Number (Unique)
                  </label>
                  <Input
                    value={formStsNumber}
                    onChange={(e) => setFormStsNumber(e.target.value)}
                    placeholder="e.g. STS-2026-999"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Blood Group</label>
                  <Input
                    value={formBloodGroup}
                    onChange={(e) => setFormBloodGroup(e.target.value)}
                    placeholder="e.g. B+"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase mb-2">Primary Guardian Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Guardian Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required
                      value={formGuardianName}
                      onChange={(e) => setFormGuardianName(e.target.value)}
                      placeholder="Father / Mother / Guardian"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Mobile Number (10 digits) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required
                      value={formGuardianPhone}
                      onChange={(e) => setFormGuardianPhone(e.target.value)}
                      placeholder="+919876543210"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  Sensitive PII (Encrypted via AES-256-GCM)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Student Aadhaar Number</label>
                    <Input
                      value={formAadhaar}
                      onChange={(e) => setFormAadhaar(e.target.value)}
                      placeholder="12-digit Aadhaar number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                    <Input
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSavingDraft}>
                  Save Application Draft
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Detail & Review Drawer / Modal */}
      {activeApplicationId && activeDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-bold text-blue-800">
                    {activeDetail.applicationNumber || 'DRAFT APPLICATION'}
                  </span>
                  {getStatusBadge(activeDetail.status)}
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">
                  {activeDetail.student.firstName} {activeDetail.student.lastName} — Standard: {activeDetail.requestedGradeLevelName}
                </h2>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Grid: Details & Documents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Demographics & Guardian */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Demographics</h3>
                  <div className="grid grid-cols-2 text-xs gap-y-1.5">
                    <span className="text-gray-500">DOB:</span>
                    <span className="font-medium text-gray-900">{activeDetail.student.dateOfBirth}</span>
                    <span className="text-gray-500">Gender:</span>
                    <span className="font-medium text-gray-900 capitalize">{activeDetail.student.gender}</span>
                    <span className="text-gray-500">STS Number:</span>
                    <span className="font-mono font-medium text-gray-900">{activeDetail.student.stsNumber || 'None'}</span>
                    <span className="text-gray-500">Blood Group:</span>
                    <span className="font-medium text-gray-900">{activeDetail.student.bloodGroup || '—'}</span>
                    <span className="text-gray-500">Transport:</span>
                    <span className="font-medium text-gray-900">{activeDetail.student.transportMode || 'Private'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Guardian Contact</h3>
                  {activeDetail.guardians.map((g, idx) => (
                    <div key={idx} className="grid grid-cols-2 text-xs gap-y-1">
                      <span className="text-gray-500">{g.relationship}:</span>
                      <span className="font-medium text-gray-900">{g.fullName}</span>
                      <span className="text-gray-500">Mobile:</span>
                      <span className="font-mono font-medium text-gray-900">{g.mobileNumber}</span>
                    </div>
                  ))}
                </div>

                {/* Sensitive PII Protection View */}
                <div className="bg-blue-50/40 rounded-lg p-4 space-y-2 border border-blue-100">
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-blue-700" /> Sensitive PII Controls (R-06)
                  </h3>
                  {activeDetail.sensitiveDetails ? (
                    <div className="grid grid-cols-2 text-xs gap-y-1.5">
                      <span className="text-gray-500">Aadhaar (Last 4):</span>
                      <span className="font-mono font-medium text-gray-900">
                        {activeDetail.sensitiveDetails.aadhaarLastFour || '••••'}
                      </span>
                      <span className="text-gray-500">Caste / Sub-Caste:</span>
                      <span className="font-medium text-gray-900">
                        {activeDetail.sensitiveDetails.caste || '—'} / {activeDetail.sensitiveDetails.subCaste || '—'}
                      </span>
                      <span className="text-gray-500">Bank:</span>
                      <span className="font-medium text-gray-900">{activeDetail.sensitiveDetails.bankName || '—'}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Sensitive PII masked for unauthorized role.</div>
                  )}
                </div>
              </div>

              {/* Document Checklist & Capacity */}
              <div className="space-y-4">
                {/* Missing Document Checklist */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Document Checklist ({activeDetail.checklist.totalReceived}/{activeDetail.checklist.totalRequired} Received)
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {activeDetail.checklist.items.map((item) => (
                      <div
                        key={item.documentTypeId}
                        className="flex items-center justify-between text-xs p-2 rounded bg-white border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          {item.isReceived ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : item.isRequired ? (
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={item.isRequired ? 'font-medium text-gray-900' : 'text-gray-600'}>
                            {item.name} {item.isRequired && <span className="text-rose-500">*</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.isReceived ? (
                            <span className="text-emerald-700 font-medium">Received (v{item.versionCount})</span>
                          ) : (
                            <span className="text-rose-600 font-medium">Missing</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Document Upload Control */}
                  <div className="pt-2 border-t border-gray-200 space-y-2">
                    <div className="text-xs font-medium text-gray-700">Attach Verified Document:</div>
                    <div className="flex gap-2">
                      <Select
                        className="text-xs flex-1"
                        value={uploadTypeId}
                        onChange={(e) => setUploadTypeId(e.target.value)}
                        options={[
                          { value: '', label: 'Select Document Type' },
                          { value: '10000000-0000-0000-0000-000000000001', label: 'Birth Certificate' },
                          { value: '10000000-0000-0000-0000-000000000002', label: 'Student Photograph' },
                          { value: '10000000-0000-0000-0000-000000000003', label: 'Parent ID Proof' },
                          { value: '10000000-0000-0000-0000-000000000004', label: 'Previous School TC' },
                        ]}
                      />
                      <Input
                        className="text-xs flex-1"
                        placeholder="File name (e.g. birth_cert.pdf)"
                        value={uploadFileName}
                        onChange={(e) => setUploadFileName(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={handleUploadDocument}
                        isLoading={isUploading}
                        disabled={!uploadTypeId}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Section Capacity Widget */}
                {activeDetail.capacity && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-gray-500" /> Section Capacity Check (US-42 / 100-Seat Cap)
                    </h3>
                    <div className="grid grid-cols-2 text-xs gap-y-1">
                      <span className="text-gray-500">Section {activeDetail.capacity.sectionName} Enrolled:</span>
                      <span className="font-medium text-gray-900">
                        {activeDetail.capacity.enrolledInSection} / {activeDetail.capacity.sectionMaxCapacity} seats
                      </span>
                      <span className="text-gray-500">Division Seats Used:</span>
                      <span className="font-medium text-gray-900">
                        {activeDetail.capacity.enrolledInGroup} / {activeDetail.capacity.groupMaxCapacity} seats
                      </span>
                      <span className="text-gray-500">Capacity Status:</span>
                      <span>
                        {activeDetail.capacity.isCapacityAvailable ? (
                          <Badge variant="success">Seats Available</Badge>
                        ) : (
                          <Badge variant="danger">Section Full</Badge>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Decision Action Bar */}
            <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-gray-500">
                Created: {new Date(activeDetail.createdAt).toLocaleDateString()} by{' '}
                {activeDetail.createdBy ? 'Admission Staff' : 'System'}
              </div>

              <div className="flex items-center gap-2">
                {activeDetail.status === 'draft' && (
                  <Button onClick={handleSubmitForReview} isLoading={isDeciding}>
                    Submit Application for Review
                  </Button>
                )}

                {(activeDetail.status === 'submitted' ||
                  activeDetail.status === 'under_review' ||
                  activeDetail.status === 'on_hold') && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setDecisionType('return_to_draft')}
                    >
                      Return to Draft
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDecisionType('hold')}
                    >
                      Put On Hold
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setDecisionType('reject')}
                    >
                      Reject Application
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setDecisionType('approve')}
                    >
                      Approve Admission
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Principal Decision Sub-dialog */}
            {decisionType && (
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase">
                  Confirm Principal Decision: {decisionType.replace(/_/g, ' ')}
                </h4>

                {decisionType === 'approve' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      Assign Classroom Section <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={assignedSectionId}
                      onChange={(e) => setAssignedSectionId(e.target.value)}
                      options={[
                        { value: '40000000-0000-0000-0000-000000000001', label: 'Section A (Capacity: 40)' },
                        { value: '40000000-0000-0000-0000-000000000002', label: 'Section B (Capacity: 40)' },
                      ]}
                    />
                    <p className="text-xs text-emerald-800 font-medium">
                      ✓ Invariant: Admission approval requires ZERO fee payment.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {decisionType === 'approve' ? 'Approval Remarks' : 'Reason / Justification'}
                  </label>
                  <Input
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={
                      decisionType === 'approve'
                        ? 'e.g. Approved after document review.'
                        : 'Required reason for status change...'
                    }
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDecisionType(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant={decisionType === 'reject' ? 'danger' : 'primary'}
                    onClick={handleDecisionSubmit}
                    isLoading={isDeciding}
                  >
                    Confirm {decisionType.toUpperCase()}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
