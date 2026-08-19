import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi, providersApi } from '../../api';
import { Provider, VerificationStatus } from '../../types';

export const AdminProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProviders = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await adminApi.listAllProviders();
      setProviders(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load provider registry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleVerifyDecision = async (providerId: number, status: VerificationStatus) => {
    setActionLoadingId(providerId);
    setErrorMessage(null);

    try {
      await providersApi.verifyProvider(providerId, status);
      setSuccessMessage(`Provider #${providerId} status set to ${status} successfully.`);
      await fetchProviders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute verification decision.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderVerificationBadge = (status?: VerificationStatus) => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return <Badge variant="success">Verified</Badge>;
      case VerificationStatus.SUBMITTED:
        return <Badge variant="warning">Submitted Review</Badge>;
      case VerificationStatus.REJECTED:
        return <Badge variant="danger">Rejected</Badge>;
      case VerificationStatus.PENDING:
      default:
        return <Badge variant="neutral">Pending Verification</Badge>;
    }
  };

  const filteredProviders = providers.filter((p) => {
    // Tab Filter
    if (activeTab === 'PENDING') {
      if (p.verification_status !== VerificationStatus.PENDING && p.verification_status !== VerificationStatus.SUBMITTED) {
        return false;
      }
    } else if (activeTab === 'VERIFIED') {
      if (p.verification_status !== VerificationStatus.VERIFIED) return false;
    } else if (activeTab === 'REJECTED') {
      if (p.verification_status !== VerificationStatus.REJECTED) return false;
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.full_name?.toLowerCase().includes(q);
      const matchLocation = p.location?.toLowerCase().includes(q);
      const matchType = p.provider_type?.toLowerCase().includes(q);
      return matchName || matchLocation || matchType;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
              Provider Registry Management
            </h1>
            <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1">
              Review, approve, or reject provider verification credentials across all professions.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchProviders}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh List
          </Button>
        </div>

        {errorMessage && (
          <ErrorState title="Registry Error" message={errorMessage} onRetry={fetchProviders} />
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

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#1C261F] border border-[#2D3D32] rounded-xl">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-[#8EA895] text-[#141C16] shadow-sm'
                  : 'text-[#A3B5A7] hover:text-[#E6EFE8]'
              }`}
            >
              All Providers ({providers.length})
            </button>
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'PENDING'
                  ? 'bg-[#8EA895] text-[#141C16] shadow-sm'
                  : 'text-[#A3B5A7] hover:text-[#E6EFE8]'
              }`}
            >
              Pending ({providers.filter((p) => p.verification_status === 'SUBMITTED' || p.verification_status === 'PENDING').length})
            </button>
            <button
              onClick={() => setActiveTab('VERIFIED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'VERIFIED'
                  ? 'bg-[#8EA895] text-[#141C16] shadow-sm'
                  : 'text-[#A3B5A7] hover:text-[#E6EFE8]'
              }`}
            >
              Verified ({providers.filter((p) => p.verification_status === 'VERIFIED').length})
            </button>
            <button
              onClick={() => setActiveTab('REJECTED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'REJECTED'
                  ? 'bg-[#8EA895] text-[#141C16] shadow-sm'
                  : 'text-[#A3B5A7] hover:text-[#E6EFE8]'
              }`}
            >
              Rejected ({providers.filter((p) => p.verification_status === 'REJECTED').length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-[#74887A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search provider or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-xs text-[#E6EFE8] placeholder-[#74887A] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30"
            />
          </div>
        </div>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching provider profiles..." />
          </div>
        )}

        {!isLoading && filteredProviders.length === 0 && (
          <div className="p-12 bg-[#233027] border border-[#2D3D32] rounded-2xl text-center">
            <p className="text-xs text-[#A3B5A7]">No providers matched the current filter criteria.</p>
          </div>
        )}

        {!isLoading && filteredProviders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProviders.map((provider) => (
              <Card key={provider.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#E6EFE8]">{provider.full_name}</h3>
                      <Badge variant="purple">{provider.provider_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#A3B5A7]">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#8EA895]" /> {provider.location || 'N/A'}
                      </span>
                      <span>• {provider.experience_years} Years Experience</span>
                    </div>
                  </div>

                  {renderVerificationBadge(provider.verification_status)}
                </div>

                <div className="p-3 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#A3B5A7]">Profile Completion:</span>
                    <span className="font-bold text-[#8EA895]">{provider.profile_completion_percentage ?? 100}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A3B5A7]">Reliability Score:</span>
                    <span className="font-bold text-[#B3A7CF]">{provider.reliability_score?.toFixed(1) || 'N/A'} / 100</span>
                  </div>
                  {provider.generic_fields && provider.generic_fields.length > 0 && (
                    <div className="pt-1 border-t border-[#2D3D32]">
                      <span className="text-[#A3B5A7] text-[11px] block">Registration / Practice Details:</span>
                      <span className="text-[#E6EFE8] font-mono text-[11px]">
                        {provider.generic_fields.map((f) => `${f.field_label || f.field_name}: ${f.value}`).join(' | ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2D3D32]">
                  <Link to={`/admin/providers/${provider.id}`}>
                    <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      View Details
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2">
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
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
