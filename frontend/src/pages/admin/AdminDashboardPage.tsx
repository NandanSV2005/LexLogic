import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi, providersApi } from '../../api';
import { Provider, AuditLogItem, VerificationStatus } from '../../types';

export const AdminDashboardPage: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [provList, logs] = await Promise.all([
        adminApi.listAllProviders(),
        adminApi.getAuditLogs({ limit: 15 }),
      ]);

      setProviders(provList);
      setAuditLogs(logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load admin platform metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleVerifyDecision = async (providerId: number, status: VerificationStatus) => {
    setActionLoadingId(providerId);
    setErrorMessage(null);

    try {
      await providersApi.verifyProvider(providerId, status);
      setSuccessMessage(
        `Provider #${providerId} status updated to ${status} successfully.`
      );
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update verification decision.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Backend Metric Calculations
  const totalProviders = providers.length;
  const verifiedProviders = providers.filter((p) => p.verification_status === VerificationStatus.VERIFIED).length;
  const pendingProviders = providers.filter(
    (p) => p.verification_status === VerificationStatus.SUBMITTED || p.verification_status === VerificationStatus.PENDING
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Platform Overview
              </h1>
              <Badge variant="indigo">LexLogic MVP Admin</Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time platform statistics, provider verification decision queue, and security audit log stream.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Dashboard Data
          </Button>
        </div>

        {errorMessage && (
          <ErrorState
            title="Admin Dashboard Error"
            message={errorMessage}
            onRetry={fetchDashboardData}
          />
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-200">
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching system audit logs & provider records..." />
          </div>
        )}

        {!isLoading && (
          <div className="space-y-8">
            {/* PLATFORM STATISTICS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Providers
                  </span>
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">
                  {totalProviders}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Registered profiles</span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Verified Providers
                  </span>
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-emerald-400 mt-2 block">
                  {verifiedProviders}
                </span>
                <span className="text-[11px] text-emerald-300 mt-1 block font-medium">
                  {((verifiedProviders / (totalProviders || 1)) * 100).toFixed(0)}% verified status rate
                </span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Pending Verification
                  </span>
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-400 mt-2 block">
                  {pendingProviders.length}
                </span>
                <span className="text-[11px] text-amber-300 mt-1 block font-medium">
                  {pendingProviders.length > 0 ? 'Requires admin action' : 'Queue up to date'}
                </span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Security Audit Logs
                  </span>
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">
                  {auditLogs.length}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Recorded security events</span>
              </Card>
            </div>

            {/* PENDING VERIFICATION QUEUE SECTION */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    Provider Verification Action Queue ({pendingProviders.length})
                  </h2>
                </div>

                <Link
                  to="/admin/providers"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  Manage All Providers <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingProviders.length === 0 ? (
                <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
                  <p className="text-xs text-slate-400">
                    No pending provider verification requests in queue. All profiles reviewed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{provider.full_name}</span>
                          <Badge variant="purple">{provider.provider_type}</Badge>
                          <Badge variant="warning">{provider.verification_status}</Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          Location: <span className="text-slate-300 font-medium">{provider.location || 'N/A'}</span> • Experience: <span className="text-slate-300 font-medium">{provider.experience_years} Years</span> • Completion: <span className="text-indigo-400 font-bold">{provider.profile_completion_percentage ?? 100}%</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/admin/providers/${provider.id}`}>
                          <Button variant="outline" size="sm">
                            Inspect Details
                          </Button>
                        </Link>

                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoadingId === provider.id}
                          onClick={() => handleVerifyDecision(provider.id, VerificationStatus.VERIFIED)}
                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Approve
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={actionLoadingId === provider.id}
                          onClick={() => handleVerifyDecision(provider.id, VerificationStatus.REJECTED)}
                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* SECURITY AUDIT LOG STREAM */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-sky-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    Recent Security Audit Log Stream
                  </h2>
                </div>

                <Link
                  to="/admin/audit"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  View Full Audit Log <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {auditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="indigo">{log.action}</Badge>
                      <span className="text-slate-300">
                        User #{log.user_id || 'System'} • Resource: {log.resource_type || 'N/A'} #{log.resource_id || ''}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(log.created_at || log.timestamp || '').toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
