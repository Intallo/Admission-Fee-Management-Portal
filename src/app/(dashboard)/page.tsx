'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { DashboardMetricsDTO } from '../../modules/audit-reporting/types';
import {
  Users,
  CreditCard,
  Building,
  Award,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Bus,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/dashboard/metrics');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to load dashboard metrics');
      }

      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Institutional Operations Dashboard</h1>
          <p className="text-sm text-gray-500">
            Real-time enrollment, seat capacity utilization, fee collection aggregates, and certificate status.
          </p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {metrics && (
            <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700">
              Academic Year: {metrics.academicYearLabel}
            </div>
          )}
          <Button variant="outline" onClick={fetchMetrics} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <Alert variant="error" title="Dashboard Error">
          {errorMessage}
        </Alert>
      )}

      {isLoading || !metrics ? (
        <div className="py-20 text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Loading school dashboard metrics...
        </div>
      ) : (
        <>
          {/* Top Level Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Admitted Students */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Active Students</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalAdmittedStudents}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {metrics.totalLeftStudents} left / transferred
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applications */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Total Applications</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalApplications}</h3>
                    <p className="text-xs text-indigo-600 font-medium mt-1">
                      {metrics.applicationsByStatus.approved} approved • {metrics.applicationsByStatus.under_review} review
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seat Capacity */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Seat Utilization</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {metrics.seatCapacityUtilizationPercentage}%
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {metrics.totalSeatsUsed} of {metrics.totalSeatCapacity} seats ({metrics.totalSeatsAvailable} free)
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <Building className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LC / TC Certificates */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Certificates (LC/TC)</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {metrics.certificates ? metrics.certificates.total : '—'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {metrics.certificates
                        ? `${metrics.certificates.issued} issued • ${metrics.certificates.draft} draft`
                        : 'Restricted by role'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview (Visible only if user has financial authority) */}
          {metrics.financials ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Position & Fee Collection</CardTitle>
                <CardDescription>
                  Exact decimal aggregates matching ledger transactions and fee receipts for {metrics.academicYearLabel}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-6 border-b border-gray-100">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Total Assessed / Billed</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1 font-mono">
                      ₹{metrics.financials.totalFeeAssessedInr}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-xs font-semibold text-green-700 uppercase">Total Collected (Paid)</div>
                    <div className="text-2xl font-bold text-green-900 mt-1 font-mono">
                      ₹{metrics.financials.totalFeeCollectedInr}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-xs font-semibold text-red-700 uppercase">Net Outstanding Dues</div>
                    <div className="text-2xl font-bold text-red-900 mt-1 font-mono">
                      ₹{metrics.financials.totalOutstandingDuesInr}
                    </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <div className="text-xs font-semibold text-amber-700 uppercase">Approved Concessions</div>
                    <div className="text-2xl font-bold text-amber-900 mt-1 font-mono">
                      ₹{metrics.financials.totalConcessionsApprovedInr}
                    </div>
                  </div>
                </div>

                {/* Category Split */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Collection Split by Receipt Type</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {metrics.financials.categories.map((cat) => {
                      const Icon = cat.feeCategory === 'vehicle' ? Bus : cat.feeCategory === 'books' ? BookOpen : GraduationCap;
                      return (
                        <div key={cat.feeCategory} className="border border-gray-200 p-4 rounded-lg space-y-2 bg-gray-50/50">
                          <div className="flex items-center space-x-2 text-indigo-700 font-semibold text-sm">
                            <Icon className="w-4 h-4" />
                            <span>{cat.categoryLabel}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs pt-1 font-mono">
                            <div>
                              <span className="text-gray-400 block">Assessed</span>
                              <span className="font-semibold text-gray-700">₹{cat.assessedInr}</span>
                            </div>
                            <div>
                              <span className="text-green-600 block">Collected</span>
                              <span className="font-bold text-green-700">₹{cat.collectedInr}</span>
                            </div>
                            <div>
                              <span className="text-red-500 block">Dues</span>
                              <span className="font-bold text-red-700">₹{cat.outstandingInr}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Section Capacities & Enrollment Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section Capacity & Seat Availability</CardTitle>
              <CardDescription>
                Live count of admitted students per section and available seats in accordance with dual capacity policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Section Name</th>
                      <th className="px-6 py-3">Grade Standard</th>
                      <th className="px-6 py-3">Division Group</th>
                      <th className="px-6 py-3 text-right">Max Capacity</th>
                      <th className="px-6 py-3 text-right">Enrolled Students</th>
                      <th className="px-6 py-3 text-right">Available Seats</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.sectionsCapacity.map((sec) => {
                      const isFull = sec.availableSeats === 0;
                      const isClose = sec.availableSeats <= 5 && sec.availableSeats > 0;
                      return (
                        <tr key={sec.sectionId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-gray-900">{sec.sectionName}</td>
                          <td className="px-6 py-4 text-gray-600">{sec.gradeLevelName}</td>
                          <td className="px-6 py-4 capitalize text-gray-500">{sec.gradeGroup.replace('_', ' ')}</td>
                          <td className="px-6 py-4 text-right font-mono font-medium">{sec.maxCapacity}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-indigo-600">
                            {sec.enrolledCount}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                            {sec.availableSeats}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isFull ? (
                              <Badge variant="danger">Full (100%)</Badge>
                            ) : isClose ? (
                              <Badge variant="warning">Low Capacity</Badge>
                            ) : (
                              <Badge variant="success">Available</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
