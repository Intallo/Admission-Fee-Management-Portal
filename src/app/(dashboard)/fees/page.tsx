'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import { Select } from '../../../components/ui/Select';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Plus,
  RefreshCw,
  Building,
  ShieldCheck,
  Printer,
  FileText,
} from 'lucide-react';
import { FeeHeadDTO, FeeStructureDTO, TransportRateDTO } from '../../../modules/fee-configuration/types';
import { StudentFeeSummaryDTO } from '../../../modules/fees-ledger/types';

export default function FeesPage() {
  const [activeTab, setActiveTab] = useState<'collection' | 'structures' | 'adjustments' | 'reversals'>('collection');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Tab 1: Offline Payment Collection State ---
  const [studentRecordIdSearch, setStudentRecordIdSearch] = useState('');
  const [isSearchingDues, setIsSearchingDues] = useState(false);
  const [studentDues, setStudentDues] = useState<StudentFeeSummaryDTO | null>(null);

  // Payment Form
  const [paymentCategory, setPaymentCategory] = useState<'school_fee' | 'vehicle' | 'books'>('school_fee');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque' | 'bank_transfer' | 'upi_manual' | 'other'>('cash');
  const [payerName, setPayerName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [allocations, setAllocations] = useState<{ [assessmentLineId: string]: string }>({});
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState<{
    receiptNumber: string;
    receiptId: string;
    amountInr: string;
    timestamp: string;
  } | null>(null);

  // --- Tab 2: Structures & Catalog State ---
  const [feeStructures, setFeeStructures] = useState<FeeStructureDTO[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHeadDTO[]>([]);
  const [transportRates, setTransportRates] = useState<TransportRateDTO[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isApprovingStructure, setIsApprovingStructure] = useState<string | null>(null);

  // New Fee Structure Form
  const [newGradeLevelId, setNewGradeLevelId] = useState('30000000-0000-0000-0000-000000000004'); // Default STD1
  const [newStructureAmounts, setNewStructureAmounts] = useState<{ [headId: string]: string }>({});
  const [isCreatingStructure, setIsCreatingStructure] = useState(false);

  // New Fee Head Form
  const [newHeadCode, setNewHeadCode] = useState('');
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadCategory, setNewHeadCategory] = useState<'school_fee' | 'vehicle' | 'books'>('school_fee');
  const [newHeadIsVariable, setNewHeadIsVariable] = useState(false);
  const [isCreatingHead, setIsCreatingHead] = useState(false);

  // --- Tab 3: Concessions State ---
  const [concessionLineId, setConcessionLineId] = useState('');
  const [concessionAmount, setConcessionAmount] = useState('');
  const [concessionReason, setConcessionReason] = useState('');
  const [isSubmittingConcession, setIsSubmittingConcession] = useState(false);

  // Principal Approval for Concession
  const [adjustmentApprovalId, setAdjustmentApprovalId] = useState('');
  const [isApprovingAdjustment, setIsApprovingAdjustment] = useState(false);

  // --- Tab 4: Payment Reversals State ---
  const [reversalPaymentId, setReversalPaymentId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [principalAuthorizationCheck, setPrincipalAuthorizationCheck] = useState(false);
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);

  // Load catalog data
  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const [headsRes, structsRes, ratesRes] = await Promise.all([
        fetch('/api/v1/fee-config/heads'),
        fetch('/api/v1/fee-config/structures'),
        fetch('/api/v1/fee-config/transport-rates'),
      ]);

      if (headsRes.ok) {
        const data = await headsRes.json();
        setFeeHeads(data.items || []);
      }
      if (structsRes.ok) {
        const data = await structsRes.json();
        setFeeStructures(data.items || []);
      }
      if (ratesRes.ok) {
        const data = await ratesRes.json();
        setTransportRates(data.items || []);
      }
    } catch {
      setErrorMessage('Failed to load fee configuration catalog.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Search Student Dues
  const handleSearchDues = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!studentRecordIdSearch.trim()) return;

    setIsSearchingDues(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastPaymentResult(null);

    try {
      const res = await fetch(`/api/v1/students/${encodeURIComponent(studentRecordIdSearch.trim())}/dues`);
      if (res.ok) {
        const data = await res.json();
        setStudentDues(data);
        setPayerName(data.studentName || '');
        // Initialize default empty allocations
        const initialAllocs: { [id: string]: string } = {};
        for (const line of data.lines || []) {
          initialAllocs[line.id] = '';
        }
        setAllocations(initialAllocs);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Student fee dues record not found.');
        setStudentDues(null);
      }
    } catch {
      setErrorMessage('Failed to retrieve student dues.');
      setStudentDues(null);
    } finally {
      setIsSearchingDues(false);
    }
  };

  // Calculate total payment allocation
  const calculateTotalPayment = (): string => {
    let sum = 0;
    for (const [lineId, amtStr] of Object.entries(allocations)) {
      const line = studentDues?.lines.find((l) => l.id === lineId);
      if (line && line.category === paymentCategory) {
        const num = parseFloat(amtStr);
        if (!isNaN(num) && num > 0) {
          sum += num;
        }
      }
    }
    return sum.toFixed(2);
  };

  // Submit Offline Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentDues) return;

    const totalAmt = calculateTotalPayment();
    if (parseFloat(totalAmt) <= 0) {
      setErrorMessage('Please enter at least one positive allocation amount matching the selected fee category.');
      return;
    }

    const payloadAllocations = Object.entries(allocations)
      .filter(([lineId, amt]) => {
        const line = studentDues.lines.find((l) => l.id === lineId);
        return line && line.category === paymentCategory && parseFloat(amt) > 0;
      })
      .map(([lineId, amt]) => ({
        assessmentLineId: lineId,
        amount: parseFloat(amt).toFixed(2),
      }));

    setIsSubmittingPayment(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/v1/fees/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentAcademicRecordId: studentDues.studentAcademicRecordId,
          category: paymentCategory,
          amount: totalAmt,
          method: paymentMethod,
          payerName: payerName.trim() || studentDues.studentName,
          referenceNumber: referenceNumber.trim() || undefined,
          remarks: paymentRemarks.trim() || undefined,
          allocations: payloadAllocations,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setSuccessMessage(`Payment recorded successfully! Receipt issued: ${result.receiptNumber}`);
        setLastPaymentResult({
          receiptNumber: result.receiptNumber,
          receiptId: result.receiptId,
          amountInr: result.amountInr,
          timestamp: new Date().toLocaleTimeString(),
        });
        // Refresh dues
        await handleSearchDues();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Payment recording failed.');
      }
    } catch {
      setErrorMessage('Network or server error while recording payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Approve Fee Structure (Principal)
  const handleApproveStructure = async (structureId: string) => {
    setIsApprovingStructure(structureId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/fee-config/structures/${structureId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        setSuccessMessage('Fee structure approved and published successfully.');
        await loadCatalog();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Approval failed. Principal role required.');
      }
    } catch {
      setErrorMessage('Network error during fee structure approval.');
    } finally {
      setIsApprovingStructure(null);
    }
  };

  // Create Fee Structure
  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = Object.entries(newStructureAmounts)
      .filter(([, amt]) => parseFloat(amt) > 0)
      .map(([headId, amt]) => ({
        feeHeadId: headId,
        defaultAmount: parseFloat(amt).toFixed(2),
      }));

    if (lines.length === 0) {
      setErrorMessage('Please configure at least one fee head with an amount greater than ₹0.00.');
      return;
    }

    setIsCreatingStructure(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/fee-config/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeLevelId: newGradeLevelId,
          lines,
        }),
      });

      if (res.ok) {
        setSuccessMessage('Draft fee structure created. Awaiting Principal approval.');
        setNewStructureAmounts({});
        await loadCatalog();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to create fee structure.');
      }
    } catch {
      setErrorMessage('Error creating fee structure.');
    } finally {
      setIsCreatingStructure(false);
    }
  };

  // Create Fee Head
  const handleCreateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadCode.trim() || !newHeadName.trim()) {
      setErrorMessage('Code and Name are required for fee head creation.');
      return;
    }

    setIsCreatingHead(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/fee-config/heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newHeadCode.trim().toUpperCase(),
          name: newHeadName.trim(),
          category: newHeadCategory,
          isVariable: newHeadIsVariable,
        }),
      });

      if (res.ok) {
        setSuccessMessage(`Fee head "${newHeadName.trim()}" created successfully.`);
        setNewHeadCode('');
        setNewHeadName('');
        await loadCatalog();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to create fee head.');
      }
    } catch {
      setErrorMessage('Error creating fee head.');
    } finally {
      setIsCreatingHead(false);
    }
  };

  // Submit Concession Request
  const handleSubmitConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concessionLineId.trim() || !concessionAmount.trim() || !concessionReason.trim()) {
      setErrorMessage('Assessment Line ID, Concession Amount, and Reason are required.');
      return;
    }

    setIsSubmittingConcession(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/fees/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentFeeAssessmentLineId: concessionLineId.trim(),
          amount: parseFloat(concessionAmount).toFixed(2),
          reason: concessionReason.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(`Concession requested successfully (ID: ${data.adjustmentId}). Pending Principal approval.`);
        setConcessionLineId('');
        setConcessionAmount('');
        setConcessionReason('');
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to submit concession request.');
      }
    } catch {
      setErrorMessage('Error submitting concession request.');
    } finally {
      setIsSubmittingConcession(false);
    }
  };

  // Principal Concession Approval
  const handleApproveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentApprovalId.trim()) return;

    setIsApprovingAdjustment(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/fees/adjustments/${encodeURIComponent(adjustmentApprovalId.trim())}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        setSuccessMessage('Concession approved and ledger updated.');
        setAdjustmentApprovalId('');
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Approval failed. Principal role required.');
      }
    } catch {
      setErrorMessage('Error during concession approval.');
    } finally {
      setIsApprovingAdjustment(false);
    }
  };

  // Principal Payment Reversal
  const handlePaymentReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPaymentId.trim() || !reversalReason.trim() || !principalAuthorizationCheck) {
      setErrorMessage('Payment ID, Reason, and Principal explicit authorization confirmation are required.');
      return;
    }

    setIsSubmittingReversal(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/fees/payments/${encodeURIComponent(reversalPaymentId.trim())}/reversal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reversalReason.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(
          `Payment reversal completed! Reversal Entry ID: ${data.reversalPaymentId}. Line balances restored.`
        );
        setReversalPaymentId('');
        setReversalReason('');
        setPrincipalAuthorizationCheck(false);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Reversal failed. Principal role strictly required.');
      }
    } catch {
      setErrorMessage('Error during payment reversal.');
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-700" />
            Fee Configuration & Ledger Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Offline payment recording, multi-head dues calculation, fee structure approval, and ledger immutability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">Phase 5 Active</Badge>
          <Badge variant="success">Offline Only (DEC-03)</Badge>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <Alert variant="danger" title="Operation Error">
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('collection')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'collection'
              ? 'border-blue-700 text-blue-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Offline Payment Collection
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'structures'
              ? 'border-blue-700 text-blue-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building className="w-4 h-4" />
          Fee Structures & Catalog
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'adjustments'
              ? 'border-blue-700 text-blue-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Concessions & Adjustments
        </button>
        <button
          onClick={() => setActiveTab('reversals')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'reversals'
              ? 'border-rose-700 text-rose-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Payment Reversals (Principal)
        </button>
      </div>

      {/* TAB 1: OFFLINE PAYMENT COLLECTION */}
      {activeTab === 'collection' && (
        <div className="space-y-6">
          {/* Student Search Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Step 1: Lookup Student Dues Ledger</CardTitle>
              <CardDescription>
                Enter the student academic record UUID or admission ID to load itemized head assessments and outstanding dues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchDues} className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Enter Student Academic Record ID (e.g. 50000000-0000-0000-0000-000000000001)..."
                    value={studentRecordIdSearch}
                    onChange={(e) => setStudentRecordIdSearch(e.target.value)}
                  />
                </div>
                <Button type="submit" isLoading={isSearchingDues}>
                  Search Dues
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Dues Breakdown & Payment Posting Form */}
          {studentDues && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Dues Summary & Itemized Heads */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-semibold">{studentDues.studentName}</CardTitle>
                    <CardDescription>
                      Adm No: <span className="font-mono font-medium text-gray-800">{studentDues.admissionNumber}</span> • Standard:{' '}
                      <span className="font-medium text-gray-800">{studentDues.standard}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between text-sm py-1 border-b">
                      <span className="text-gray-500">Total Assessed:</span>
                      <span className="font-medium">₹{studentDues.totalAssessedInr}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b">
                      <span className="text-gray-500">Concessions:</span>
                      <span className="font-medium text-emerald-600">- ₹{studentDues.totalConcessionsInr}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b">
                      <span className="text-gray-500">Total Collected:</span>
                      <span className="font-medium text-blue-600">₹{studentDues.totalPaidInr}</span>
                    </div>
                    <div className="flex justify-between text-base py-2 font-bold bg-amber-50 px-2 rounded">
                      <span className="text-amber-900">Net Remaining Dues:</span>
                      <span className="text-amber-900">₹{studentDues.netBalanceDueInr}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Itemized Heads Balance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 border-b">
                        <tr>
                          <th className="py-2 px-3 text-left">Head</th>
                          <th className="py-2 px-2 text-right">Assessed</th>
                          <th className="py-2 px-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {studentDues.lines.map((l) => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-800">
                              {l.feeHeadName}
                              <span className="block text-[10px] text-gray-400 capitalize">{l.category}</span>
                            </td>
                            <td className="py-2 px-2 text-right text-gray-600">₹{l.assessedAmount}</td>
                            <td className="py-2 px-2 text-right font-semibold text-amber-700">₹{l.netRemainingDues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Payment Recording Form */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-base font-semibold">Step 2: Record Offline Payment</CardTitle>
                        <CardDescription>
                          Atomic transaction: Collection posting + Allocation + Monotonic Receipt generation (RCT-YYYY-NNNNNN).
                        </CardDescription>
                      </div>
                      <Badge variant="warning">Single Category (BR-17)</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={handleRecordPayment} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                          label="Fee Category (Strict Single Category)"
                          value={paymentCategory}
                          onChange={(e) => {
                            setPaymentCategory(e.target.value as 'school_fee' | 'vehicle' | 'books');
                          }}
                          options={[
                            { label: 'School Fee (Tuition, Lab, Admission, etc.)', value: 'school_fee' },
                            { label: 'Vehicle / Transport Tariff', value: 'vehicle' },
                            { label: 'Books & Stationery', value: 'books' },
                          ]}
                          required
                        />

                        <Select
                          label="Payment Method (Offline)"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          options={[
                            { label: 'Cash (Physical Counter Cash)', value: 'cash' },
                            { label: 'Bank Cheque', value: 'cheque' },
                            { label: 'Bank Transfer (NEFT / RTGS)', value: 'bank_transfer' },
                            { label: 'UPI Manual Reference', value: 'upi_manual' },
                            { label: 'Demand Draft / Other', value: 'other' },
                          ]}
                          required
                        />

                        <Input
                          label="Payer Name"
                          placeholder="Parent or Guardian name"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          required
                        />

                        <Input
                          label="Instrument / Reference Number"
                          placeholder="Cheque No, UTR, DD No, or Transaction Ref"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                      </div>

                      {/* Line Item Allocations */}
                      <div className="border rounded-md p-3 bg-gray-50/50 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Allocations for {paymentCategory.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-blue-800">
                            Total Payment: ₹{calculateTotalPayment()}
                          </span>
                        </div>

                        {studentDues.lines.filter((l) => l.category === paymentCategory).length === 0 ? (
                          <p className="text-xs text-gray-500 py-2">
                            No active dues assessed under category &ldquo;{paymentCategory}&rdquo;.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {studentDues.lines
                              .filter((l) => l.category === paymentCategory)
                              .map((line) => (
                                <div
                                  key={line.id}
                                  className="flex items-center justify-between gap-4 bg-white p-2.5 rounded border text-xs"
                                >
                                  <div className="flex-1">
                                    <span className="font-semibold text-gray-800">{line.feeHeadName}</span>
                                    <span className="block text-[11px] text-gray-500">
                                      Remaining Due: <strong className="text-amber-700">₹{line.netRemainingDues}</strong>
                                    </span>
                                  </div>
                                  <div className="w-36">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={allocations[line.id] || ''}
                                      onChange={(e) => {
                                        setAllocations({
                                          ...allocations,
                                          [line.id]: e.target.value,
                                        });
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <Input
                        label="Internal Notes / Remarks (Optional)"
                        placeholder="e.g. Handed over at Accounts Counter"
                        value={paymentRemarks}
                        onChange={(e) => setPaymentRemarks(e.target.value)}
                      />

                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          isLoading={isSubmittingPayment}
                          disabled={parseFloat(calculateTotalPayment()) <= 0}
                        >
                          <Receipt className="w-4 h-4 mr-2" />
                          Record Payment & Issue Receipt (₹{calculateTotalPayment()})
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Receipt Success Banner */}
                {lastPaymentResult && (
                  <Card className="border-green-300 bg-green-50/40">
                    <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-green-700 font-semibold uppercase tracking-wider">
                            Receipt Generated
                          </div>
                          <div className="text-lg font-bold font-mono text-green-950">
                            {lastPaymentResult.receiptNumber}
                          </div>
                          <div className="text-xs text-green-800">
                            Amount: ₹{lastPaymentResult.amountInr} at {lastPaymentResult.timestamp}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/v1/receipts/${lastPaymentResult.receiptId}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="secondary">
                            <Printer className="w-4 h-4 mr-1.5" />
                            View / Print PDF
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STRUCTURES & CATALOG */}
      {activeTab === 'structures' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Fee Structures & Catalog</h2>
            <Button size="sm" variant="secondary" onClick={loadCatalog} isLoading={isLoadingCatalog}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh Catalog
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Fee Structures List */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">Grade Fee Structures</CardTitle>
                  <CardDescription>
                    Requires Principal approval to activate. Once approved, the previous version is archived and locked.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 border-b">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Grade</th>
                          <th className="py-2.5 px-2 text-center">Version</th>
                          <th className="py-2.5 px-3 text-left">Status</th>
                          <th className="py-2.5 px-3 text-right">Fixed Heads Total</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {feeStructures.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-gray-400">
                              No fee structures defined yet.
                            </td>
                          </tr>
                        ) : (
                          feeStructures.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-semibold text-gray-800">{s.gradeLevelName}</td>
                              <td className="py-3 px-2 text-center font-mono">v{s.version}</td>
                              <td className="py-3 px-3">
                                <Badge variant={s.status === 'approved' ? 'success' : 'warning'}>
                                  {s.status.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-right font-medium">₹{s.totalFixedAmountInr}</td>
                              <td className="py-3 px-4 text-right">
                                {s.status === 'draft' ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleApproveStructure(s.id)}
                                    isLoading={isApprovingStructure === s.id}
                                  >
                                    Approve (Principal)
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-gray-400 font-medium">Locked</span>
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

              {/* Fee Heads Catalog */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">Fee Heads Catalog</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 border-b">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Code</th>
                          <th className="py-2.5 px-4 text-left">Name</th>
                          <th className="py-2.5 px-3 text-left">Category</th>
                          <th className="py-2.5 px-3 text-center">Type</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {feeHeads.map((h) => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-mono font-medium text-gray-800">{h.code}</td>
                            <td className="py-2.5 px-4 font-medium text-gray-900">{h.name}</td>
                            <td className="py-2.5 px-3 capitalize text-gray-600">{h.category.replace('_', ' ')}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant={h.isVariable ? 'warning' : 'default'}>
                                {h.isVariable ? 'Variable' : 'Fixed'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant={h.isActive ? 'success' : 'danger'}>
                                {h.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Transport Tariff Rates */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">Transport Tariff Rates</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 border-b">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Place / Stage</th>
                          <th className="py-2.5 px-3 text-left">Mode</th>
                          <th className="py-2.5 px-4 text-right">Annual Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {transportRates.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-medium text-gray-800">{t.placeName}</td>
                            <td className="py-2.5 px-3 text-gray-600">{t.mode}</td>
                            <td className="py-2.5 px-4 text-right font-medium">₹{t.rateAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Forms to create Structure & Fee Head */}
            <div className="space-y-6">
              {/* Draft Fee Structure Form */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold">Draft New Fee Structure</CardTitle>
                  <CardDescription>Creates a draft structure. Principal must approve before activation.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleCreateStructure} className="space-y-3">
                    <Select
                      label="Grade Level"
                      value={newGradeLevelId}
                      onChange={(e) => setNewGradeLevelId(e.target.value)}
                      options={[
                        { label: 'Std 1', value: '30000000-0000-0000-0000-000000000004' },
                        { label: 'Std 2', value: '30000000-0000-0000-0000-000000000005' },
                        { label: 'Std 3', value: '30000000-0000-0000-0000-000000000006' },
                        { label: 'Std 10', value: '30000000-0000-0000-0000-000000000013' },
                      ]}
                      required
                    />

                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-semibold text-gray-700">Fee Head Default Amounts (₹):</span>
                      {feeHeads
                        .filter((h) => !h.isVariable)
                        .map((head) => (
                          <div key={head.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-gray-700 truncate w-28">{head.name}:</span>
                            <div className="w-28">
                              <Input
                                type="number"
                                step="100.00"
                                placeholder="0.00"
                                value={newStructureAmounts[head.id] || ''}
                                onChange={(e) => {
                                  setNewStructureAmounts({
                                    ...newStructureAmounts,
                                    [head.id]: e.target.value,
                                  });
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="pt-2">
                      <Button type="submit" size="sm" className="w-full" isLoading={isCreatingStructure}>
                        Create Draft Structure
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Add New Fee Head Form */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold">Add New Fee Head</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleCreateHead} className="space-y-3">
                    <Input
                      label="Head Code"
                      placeholder="e.g. EXAM_FEE"
                      value={newHeadCode}
                      onChange={(e) => setNewHeadCode(e.target.value)}
                      required
                    />
                    <Input
                      label="Head Name"
                      placeholder="e.g. Annual Examination Fee"
                      value={newHeadName}
                      onChange={(e) => setNewHeadName(e.target.value)}
                      required
                    />
                    <Select
                      label="Category"
                      value={newHeadCategory}
                      onChange={(e) => setNewHeadCategory(e.target.value as any)}
                      options={[
                        { label: 'School Fee', value: 'school_fee' },
                        { label: 'Vehicle / Transport', value: 'vehicle' },
                        { label: 'Books & Stationery', value: 'books' },
                      ]}
                      required
                    />
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={newHeadIsVariable}
                        onChange={(e) => setNewHeadIsVariable(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Is Variable Head (Amount Billed = Amount Paid)
                    </label>

                    <div className="pt-2">
                      <Button type="submit" size="sm" variant="secondary" className="w-full" isLoading={isCreatingHead}>
                        <Plus className="w-4 h-4 mr-1" />
                        Create Fee Head
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONCESSIONS & ADJUSTMENTS */}
      {activeTab === 'adjustments' && (
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold">Request Fee Concession / Waiver</CardTitle>
              <CardDescription>
                Submits a concession request against a specific student assessment line. Principal authorization is strictly required (US-25).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmitConcession} className="space-y-4">
                <Input
                  label="Student Fee Assessment Line ID"
                  placeholder="UUID of the assessed fee head line"
                  value={concessionLineId}
                  onChange={(e) => setConcessionLineId(e.target.value)}
                  required
                />
                <Input
                  label="Concession Amount (₹)"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5000.00"
                  value={concessionAmount}
                  onChange={(e) => setConcessionAmount(e.target.value)}
                  required
                />
                <Input
                  label="Reason / Documentation Reference"
                  placeholder="e.g. Sibling concession approved under 2026-27 policy"
                  value={concessionReason}
                  onChange={(e) => setConcessionReason(e.target.value)}
                  required
                />
                <Button type="submit" isLoading={isSubmittingConcession}>
                  Submit Concession Request
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/20">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold">Principal Concession Approval</CardTitle>
              <CardDescription>
                Authorizes a pending concession and immediately updates the student&apos;s net dues ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleApproveAdjustment} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Adjustment ID"
                    placeholder="Enter Pending Adjustment UUID"
                    value={adjustmentApprovalId}
                    onChange={(e) => setAdjustmentApprovalId(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" isLoading={isApprovingAdjustment}>
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Approve Concession (Principal)
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: PAYMENT REVERSALS */}
      {activeTab === 'reversals' && (
        <div className="max-w-2xl space-y-6">
          <Card className="border-rose-200">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <CardTitle className="text-base font-semibold text-rose-950">
                  Principal Payment Reversal (US-26A / BR-22)
                </CardTitle>
              </div>
              <CardDescription>
                Strictly restricted to the Principal. The original payment record is immutable; a linked reversal transaction is recorded to restore outstanding dues. No receipt number is issued.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handlePaymentReversal} className="space-y-4">
                <Input
                  label="Original Payment UUID"
                  placeholder="UUID of the payment to reverse"
                  value={reversalPaymentId}
                  onChange={(e) => setReversalPaymentId(e.target.value)}
                  required
                />
                <Input
                  label="Reversal Reason"
                  placeholder="e.g. Cheque dishonoured by bank / Wrong student allocated"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  required
                />
                <label className="flex items-start gap-2.5 text-xs text-gray-700 bg-rose-50 p-3 rounded border border-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={principalAuthorizationCheck}
                    onChange={(e) => setPrincipalAuthorizationCheck(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    I confirm that I am logged in as the <strong>Principal</strong> and authorize this irreversible ledger reversal.
                  </span>
                </label>
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={isSubmittingReversal}
                  disabled={!principalAuthorizationCheck}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Authorize & Post Reversal
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
