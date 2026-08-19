import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
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
        `Provider #${providerId} verification updated to "${status}"!`
      );
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update verification decision.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingProviders = providers.filter(
    (p) => p.verification_status === VerificationStatus.PENDING || p.verification_status === VerificationStatus.SUBMITTED
  );

  const verifiedProviders = providers.filter(
    (p) => p.verification_status === VerificationStatus.VERIFIED
  ).length;

  const totalProviders = providers.length;

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
                Admin Platform Dashboard
              </h1>
              <Badge variant="purple">Admin System Control</Badge>
            </div>
            <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1">
              Verification governance, audit log monitoring, and platform reliability controls.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Dashboard
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
          <div className="p-4 bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] text-xs rounded-xl flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#7ECB98]" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-[#7ECB98] hover:opacity-75">
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
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Total Providers
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {totalProviders}
                </span>
                <span className="text-[11px] text-[#A3B5A7] mt-1 block">Registered profiles</span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Verified Providers
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#7ECB98] mt-2 block">
                  {verifiedProviders}
                </span>
                <span className="text-[11px] text-[#7ECB98] mt-1 block font-semibold">
                  {((verifiedProviders / (totalProviders || 1)) * 100).toFixed(0)}% verified status rate
                </span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Pending Verification
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#E89D9D] border border-[#2D3D32] rounded-lg">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E3BA7E] mt-2 block">
                  {pendingProviders.length}
                </span>
                <span className="text-[11px] text-[#E3BA7E] mt-1 block font-semibold">
                  {pendingProviders.length > 0 ? 'Requires admin action' : 'Queue up to date'}
                </span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Security Audit Logs
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#B3A7CF] border border-[#2D3D32] rounded-lg">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {auditLogs.length}
                </span>
                <span className="text-[11px] text-[#A3B5A7] mt-1 block">Recorded security events</span>
              </Card>
            </div>

            {/* PENDING VERIFICATION QUEUE SECTION */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2D3D32]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#E89D9D]" />
                  <h2 className="text-base font-bold text-[#E6EFE8]">
                    Provider Verification Action Queue ({pendingProviders.length})
                  </h2>
                </div>

                <Link
                  to="/admin/providers"
                  className="text-xs text-[#8EA895] hover:text-[#A2BCA9] font-bold flex items-center gap-1"
                >
                  Manage All Providers <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingProviders.length === 0 ? (
                <div className="p-8 bg-[#1C261F] border border-[#2D3D32] rounded-2xl text-center">
                  <p className="text-xs text-[#A3B5A7]">
                    No pending provider verification requests in queue. All profiles reviewed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className="p-4 bg-[#1C261F] rounded-xl border border-[#2D3D32] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#E6EFE8]">{provider.full_name}</span>
                          <Badge variant="purple">{provider.provider_type}</Badge>
                          <Badge variant="warning">{provider.verification_status}</Badge>
                        </div>
                        <p className="text-xs text-[#A3B5A7]">
                          Location: <span className="text-[#E6EFE8] font-semibold">{provider.location || 'N/A'}</span> • Experience: <span className="text-[#E6EFE8] font-semibold">{provider.experience_years} Years</span> • Completion: <span className="text-[#8EA895] font-bold">{provider.profile_completion_percentage ?? 100}%</span>
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
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2D3D32]">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#B3A7CF]" />
                  <h2 className="text-base font-bold text-[#E6EFE8]">
                    Recent Security Audit Log Stream
                  </h2>
                </div>

                <Link
                  to="/admin/audit"
                  className="text-xs text-[#8EA895] hover:text-[#A2BCA9] font-bold flex items-center gap-1"
                >
                  View Full Audit Log <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {auditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-[#1C261F] rounded-xl border border-[#2D3D32] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="purple">{log.action}</Badge>
                      <span className="text-[#E6EFE8]">
                        User #{log.user_id || 'System'} • Resource: {log.resource_type || 'N/A'} #{log.resource_id || ''}
                      </span>
                    </div>

                    <span className="text-[11px] text-[#A3B5A7] font-mono">
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
