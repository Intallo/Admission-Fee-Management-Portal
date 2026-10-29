'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import { Select } from '../../../components/ui/Select';
import {
  StudentCertificateDTO,
} from '../../../modules/certificates-lctc/types';
import {
  Award,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Printer,
  RefreshCw,
  Plus,
  ShieldAlert,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<StudentCertificateDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('all');

  // Step 1 Review Modal (Admission Officer)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewCert, setReviewCert] = useState<StudentCertificateDTO | null>(null);
  const [reviewAction, setReviewAction] = useState<'forward_for_approval' | 'return_to_draft'>('forward_for_approval');
  const [reviewConduct, setReviewConduct] = useState('Good');
  const [reviewProgress, setReviewProgress] = useState('Satisfactory');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Step 2 Approval Modal (Principal)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueCert, setIssueCert] = useState<StudentCertificateDTO | null>(null);
  const [duesOverrideReason, setDuesOverrideReason] = useState('');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Reprint Modal
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [reprintCert, setReprintCert] = useState<StudentCertificateDTO | null>(null);
  const [reprintReason, setReprintReason] = useState('');
  const [isSubmittingReprint, setIsSubmittingReprint] = useState(false);

  // Prepopulate State
  const [isPrepopulating, setIsPrepopulating] = useState(false);

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (reviewFilter && reviewFilter !== 'all') params.set('reviewStatus', reviewFilter);

      const res = await fetch(`/api/v1/certificates?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch certificates');
      }

      const data = await res.json();
      setCertificates(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading certificates');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, reviewFilter]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handlePrepopulate = async () => {
    setIsPrepopulating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/certificates/prepopulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to pre-populate certificates');
      }

      const data = await res.json();
      setSuccessMessage(`Successfully created ${data.createdCount} certificate records for the academic year.`);
      fetchCertificates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error pre-populating certificates');
    } finally {
      setIsPrepopulating(false);
    }
  };

  const handleStep1Review = async () => {
    if (!reviewCert) return;
    setIsSubmittingReview(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/certificates/${reviewCert.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          conduct: reviewConduct,
          progress: reviewProgress,
          remarks: reviewRemarks || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Review submission failed');
      }

      setSuccessMessage(`Certificate for ${reviewCert.studentName} reviewed and forwarded.`);
      setIsReviewModalOpen(false);
      fetchCertificates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Review failed');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleStep2Issue = async () => {
    if (!issueCert) return;
    setIsSubmittingIssue(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/certificates/${issueCert.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duesOverrideReason: duesOverrideReason || undefined,
          remarks: issueRemarks || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Approval failed');
      }

      const result = await res.json();
      setSuccessMessage(
        `Certificate successfully approved & issued with monotonic number ${result.certificateNumber}. Continuing student status unchanged.`
      );
      setIsIssueModalOpen(false);
      setDuesOverrideReason('');
      setIssueRemarks('');
      fetchCertificates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Approval and issuance failed');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleReprint = async () => {
    if (!reprintCert) return;
    if (!reprintReason.trim() || reprintReason.trim().length < 3) {
      setErrorMessage('Reprint reason is mandatory and must be at least 3 characters.');
      return;
    }

    setIsSubmittingReprint(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/certificates/${reprintCert.id}/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reprintReason.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Reprint failed');
      }

      const result = await res.json();
      setSuccessMessage(
        `Duplicate copy issued (Version ${result.newVersionNumber}) for TC ${result.certificateNumber} with audit logging.`
      );
      setIsReprintModalOpen(false);
      setReprintReason('');
      fetchCertificates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Reprint request failed');
    } finally {
      setIsSubmittingReprint(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leaving & Transfer Certificates (LC/TC)</h1>
          <p className="text-sm text-gray-500">
            Annual LC/TC workflow, two-step review/approval, dues warnings, monotonic numbering, and duplicate reprints.
          </p>
        </div>
        <div className="flex space-x-3 self-start sm:self-auto">
          <Button variant="outline" onClick={handlePrepopulate} disabled={isPrepopulating || isLoading}>
            <Plus className="w-4 h-4 mr-2" />
            {isPrepopulating ? 'Prepopulating...' : 'Batch Pre-populate Year'}
          </Button>
          <Button variant="outline" onClick={fetchCertificates} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search Student, Admission No, TC No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Certificate States</option>
                <option value="draft">Draft (Unissued)</option>
                <option value="issued">Issued</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div>
              <Select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
                <option value="all">All Review States</option>
                <option value="pending">Step 1: Pending Review</option>
                <option value="reviewed">Step 2: Reviewed (Ready for Principal)</option>
                <option value="returned">Returned</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">TC Number</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Class & Section</th>
                  <th className="px-6 py-3">Outstanding Dues</th>
                  <th className="px-6 py-3">Workflow State</th>
                  <th className="px-6 py-3">Versions</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading certificate records...
                    </td>
                  </tr>
                ) : certificates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No certificate records found. Use &quot;Batch Pre-populate Year&quot; to generate draft records.
                    </td>
                  </tr>
                ) : (
                  certificates.map((cert) => {
                    const hasDues = parseFloat(cert.unpaidBalanceInr) > 0;
                    return (
                      <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                          {cert.certificateNumber || 'Draft (Pending)'}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {cert.studentName}
                          <div className="text-xs text-gray-400 font-mono">{cert.admissionNumber}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {cert.gradeLevelName} • {cert.sectionName}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {hasDues ? (
                            <span className="text-red-600 font-semibold flex items-center">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-500 inline" />
                              ₹{cert.unpaidBalanceInr}
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium">Cleared (₹0.00)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div>
                            <Badge variant={cert.status === 'issued' ? 'success' : 'warning'}>
                              {cert.status.toUpperCase()}
                            </Badge>
                          </div>
                          {cert.status === 'draft' && (
                            <div className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              Review: <strong className="ml-1 capitalize">{cert.reviewStatus}</strong>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          v{cert.versions.length || 0}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {cert.status === 'draft' && cert.reviewStatus === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReviewCert(cert);
                                setReviewConduct(cert.conduct);
                                setReviewProgress(cert.progress);
                                setReviewRemarks(cert.reviewRemarks || '');
                                setIsReviewModalOpen(true);
                              }}
                            >
                              <FileCheck className="w-4 h-4 mr-1 text-indigo-600" />
                              Step 1: Review
                            </Button>
                          )}

                          {cert.status === 'draft' && cert.reviewStatus === 'reviewed' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setIssueCert(cert);
                                setDuesOverrideReason('');
                                setIssueRemarks('');
                                setIsIssueModalOpen(true);
                              }}
                            >
                              <Award className="w-4 h-4 mr-1" />
                              Step 2: Approve & Issue
                            </Button>
                          )}

                          {cert.status === 'issued' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setReprintCert(cert);
                                setReprintReason('');
                                setIsReprintModalOpen(true);
                              }}
                            >
                              <Printer className="w-4 h-4 mr-1 text-gray-600" />
                              Reprint Copy
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 Review Modal (Admission Officer) */}
      {isReviewModalOpen && reviewCert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Step 1: Admission Officer Review</h3>
            <p className="text-sm text-gray-600">
              Review conduct and progress records for <strong>{reviewCert.studentName}</strong> before forwarding to
              the Principal.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Review Decision</label>
                <Select value={reviewAction} onChange={(e: any) => setReviewAction(e.target.value)}>
                  <option value="forward_for_approval">Forward for Principal Approval</option>
                  <option value="return_to_draft">Return to Draft</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Conduct Remarks</label>
                <Input value={reviewConduct} onChange={(e) => setReviewConduct(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Academic Progress</label>
                <Input value={reviewProgress} onChange={(e) => setReviewProgress(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Review Notes / Remarks</label>
                <Input
                  placeholder="Optional review notes"
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setIsReviewModalOpen(false)} disabled={isSubmittingReview}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleStep1Review} disabled={isSubmittingReview}>
                {isSubmittingReview ? 'Submitting...' : 'Complete Review'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 Approve & Issue Modal (Principal) */}
      {isIssueModalOpen && issueCert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-700">
              <Award className="w-6 h-6" />
              <h3 className="text-lg font-bold">Step 2: Principal Approval & TC Generation</h3>
            </div>
            <p className="text-sm text-gray-600">
              Approve and generate monotonic Transfer Certificate (TC-YYYY-NNNN) for{' '}
              <strong>{issueCert.studentName}</strong>.
            </p>

            {/* Dues Warning & Override Section (US-35 AC3, REG-03) */}
            {parseFloat(issueCert.unpaidBalanceInr) > 0 ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-red-800 font-bold">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <span>Dues Warning: Student has pending fee arrears of ₹{issueCert.unpaidBalanceInr}</span>
                </div>
                <p className="text-xs text-red-700">
                  Per school business rules (A-13, REG-03), a Transfer Certificate cannot be issued with pending dues
                  unless the Principal explicitly records a justified override reason.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-red-900 uppercase mb-1">
                    Principal Dues Override Justification (Mandatory)
                  </label>
                  <Input
                    placeholder="e.g. Cleared by management committee special resolution #12"
                    value={duesOverrideReason}
                    onChange={(e) => setDuesOverrideReason(e.target.value)}
                    className="border-red-300 focus:ring-red-500"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs text-green-800 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                All fee dues cleared (₹0.00). No override required.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Principal Remarks</label>
              <Input
                placeholder="Optional certificate remarks"
                value={issueRemarks}
                onChange={(e) => setIssueRemarks(e.target.value)}
              />
            </div>

            <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded border">
              <strong>Non-Negotiable Rule:</strong> Issuing this certificate will <em>not</em> mark the student as Left.
              Continuing students remain active in school records.
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setIsIssueModalOpen(false)} disabled={isSubmittingIssue}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleStep2Issue} disabled={isSubmittingIssue}>
                {isSubmittingIssue ? 'Issuing Certificate...' : 'Approve & Issue Certificate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Reprint Modal */}
      {isReprintModalOpen && reprintCert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reprint Certificate (Duplicate Copy)</h3>
            <p className="text-sm text-gray-600">
              Issue a reprint for <strong>{reprintCert.certificateNumber}</strong> ({reprintCert.studentName}). The copy
              will be watermarked with &quot;DUPLICATE COPY&quot; and logged in the immutable audit trail.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Reason for Reissue (Mandatory)
              </label>
              <Input
                placeholder="e.g. Original lost by parent; verified affidavit submitted"
                value={reprintReason}
                onChange={(e) => setReprintReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setIsReprintModalOpen(false)} disabled={isSubmittingReprint}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleReprint} disabled={isSubmittingReprint}>
                {isSubmittingReprint ? 'Logging & Printing...' : 'Print Duplicate Copy'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
