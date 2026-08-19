import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Filter,
  Lock,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { adminApi } from '../../api';
import { AuditLogItem } from '../../types';

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [limitFilter, setLimitFilter] = useState<number>(50);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await adminApi.getAuditLogs({
        action: actionFilter.trim() || undefined,
        limit: limitFilter,
      });
      setLogs(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load security audit log history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter, limitFilter]);

  const renderActionBadge = (action: string) => {
    if (action.startsWith('ADMIN_')) {
      return <Badge variant="purple">{action}</Badge>;
    }
    if (action.includes('REGISTER') || action.includes('LOGIN')) {
      return <Badge variant="info">{action}</Badge>;
    }
    if (action.includes('VERIFY') || action.includes('VERIFICATION')) {
      return <Badge variant="warning">{action}</Badge>;
    }
    return <Badge variant="neutral">{action}</Badge>;
  };

  const formatSanitizedMetadata = (metadata?: Record<string, any>) => {
    if (!metadata || Object.keys(metadata).length === 0) return '—';

    // Redact any sensitive passwords or secrets if present
    const sanitized = { ...metadata };
    delete sanitized.password;
    delete sanitized.hashed_password;

    return JSON.stringify(sanitized);
  };

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
              Security Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1">
              Immutable security event audit stream & access decision tracking.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Stream
          </Button>
        </div>

        {errorMessage && (
          <ErrorState
            title="Audit Log Error"
            message={errorMessage}
            onRetry={fetchAuditLogs}
          />
        )}

        {/* Filter Controls Card */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 font-bold text-[#A3B5A7] uppercase tracking-wide">
                <Filter className="w-4 h-4 text-[#8EA895]" /> Filter Event:
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
              >
                <option value="">All Audit Actions</option>
                <option value="USER_REGISTER">USER_REGISTER</option>
                <option value="USER_LOGIN">USER_LOGIN</option>
                <option value="PROVIDER_PROFILE_CREATE">PROVIDER_PROFILE_CREATE</option>
                <option value="PROVIDER_VERIFICATION_SUBMIT">PROVIDER_VERIFICATION_SUBMIT</option>
                <option value="ADMIN_VERIFICATION_VERIFIED">ADMIN_VERIFICATION_VERIFIED</option>
                <option value="ADMIN_VERIFICATION_REJECTED">ADMIN_VERIFICATION_REJECTED</option>
                <option value="SERVICE_REQUEST_CREATE">SERVICE_REQUEST_CREATE</option>
                <option value="PROVIDER_MATCHING_EXECUTE">PROVIDER_MATCHING_EXECUTE</option>
              </select>

              <select
                value={limitFilter}
                onChange={(e) => setLimitFilter(Number(e.target.value))}
                className="px-3 py-1.5 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
              >
                <option value={20}>Last 20 Logs</option>
                <option value={50}>Last 50 Logs</option>
                <option value={100}>Last 100 Logs</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-[#A3B5A7]">
              <Lock className="w-3.5 h-3.5 text-[#8EA895]" /> Sensitive fields automatically redacted
            </div>
          </div>
        </Card>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching security audit stream..." />
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <EmptyState
            title="No Audit Logs Found"
            description="No security audit logs matched the selected filter criteria."
          />
        )}

        {!isLoading && logs.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#E6EFE8]">
                <thead className="bg-[#1C261F] text-[11px] uppercase tracking-wider text-[#A3B5A7] border-b border-[#2D3D32] font-bold">
                  <tr>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5">Action Event</th>
                    <th className="px-5 py-3.5">User ID</th>
                    <th className="px-5 py-3.5">Resource Target</th>
                    <th className="px-5 py-3.5">IP Address</th>
                    <th className="px-5 py-3.5">Metadata Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3D32] font-mono text-[11px]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1C261F]/60 transition-colors">
                      <td className="px-5 py-3.5 text-[#A3B5A7] whitespace-nowrap">
                        {new Date(log.created_at || log.timestamp || '').toLocaleString()}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-[#8EA895]">
                        {log.user_id ? `User #${log.user_id}` : 'System'}
                      </td>

                      <td className="px-5 py-3.5 text-[#E6EFE8]">
                        {log.resource_type ? `${log.resource_type} #${log.resource_id || ''}` : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-[#A3B5A7]">
                        {log.ip_address || '127.0.0.1'}
                      </td>

                      <td className="px-5 py-3.5 text-[#A3B5A7] max-w-xs truncate font-sans">
                        {formatSanitizedMetadata(log.metadata_json)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};
