'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import { Select } from '../../../components/ui/Select';
import { AuditLogEntryDTO } from '../../../modules/audit-reporting/types';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  Calendar,
  Filter,
} from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Snapshot modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntryDTO | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entityType', entityFilter);
      if (roleFilter) params.set('actorRole', roleFilter);

      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch audit logs');
      }

      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading audit trail');
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityFilter, roleFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Trail & Compliance</h1>
          <p className="text-sm text-gray-500">
            Append-only immutable record of all student lifecycle changes, certificate issues, and sensitive PII views.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
          <Lock className="w-3.5 h-3.5 text-green-600" />
          <span>Immutable & Zero-Delete Enforced</span>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <Alert variant="error" title="Access Denied or Failed">
          {errorMessage}
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Filter by Action (e.g. CERTIFICATE_ISSUED)"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div>
              <Input
                placeholder="Filter by Entity Type (e.g. student)"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              />
            </div>
            <div>
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Actor Roles</option>
                <option value="principal">Principal</option>
                <option value="admission_officer">Admission Officer</option>
                <option value="accountant">Accountant</option>
                <option value="clerk">Clerk</option>
                <option value="system_admin">System Admin</option>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={fetchAuditLogs} disabled={isLoading} className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Filter Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Actor & Role</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Target Entity</th>
                  <th className="px-6 py-3">Outcome</th>
                  <th className="px-6 py-3">Reason / Details</th>
                  <th className="px-6 py-3 text-right">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading audit records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {log.createdAt.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{log.actorName}</div>
                        <div className="text-xs text-gray-500 capitalize">{log.actorRole.replace('_', ' ')}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-indigo-600 text-xs">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-semibold text-gray-700 capitalize">{log.entityType}</span>
                        {log.entityId && (
                          <div className="font-mono text-gray-400 truncate max-w-[120px]">{log.entityId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={log.outcome === 'success' ? 'success' : 'danger'}>
                          {log.outcome}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                        {log.reason || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(log.beforeSnapshot || log.afterSnapshot) ? (
                          <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Diff
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
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

      {/* Snapshot Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Audit Snapshot: {selectedLog.action}</h3>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{selectedLog.createdAt}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Before Snapshot</h4>
                <pre className="p-3 bg-gray-50 border rounded text-xs overflow-x-auto text-gray-800 font-mono">
                  {selectedLog.beforeSnapshot ? JSON.stringify(selectedLog.beforeSnapshot, null, 2) : 'null'}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">After Snapshot</h4>
                <pre className="p-3 bg-indigo-50/50 border border-indigo-100 rounded text-xs overflow-x-auto text-indigo-950 font-mono">
                  {selectedLog.afterSnapshot ? JSON.stringify(selectedLog.afterSnapshot, null, 2) : 'null'}
                </pre>
              </div>
            </div>

            <div className="text-xs text-gray-400 bg-gray-50 p-2.5 rounded border">
              <strong>Data Privacy Assurance:</strong> Sensitive passwords, full Aadhaar numbers, and private credentials are automatically redacted prior to audit persistence.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
