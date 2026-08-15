import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Scale,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  FileText,
  ShieldCheck,
  Building2,
  Users,
  Award,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { requestsApi } from '../../api';
import { ServiceRequest, RequestStatus, RequestUrgency } from '../../types';

export const RequestDetailsPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRequestDetails = async () => {
    if (!requestId || isNaN(Number(requestId))) {
      setErrorMessage('Invalid request ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await requestsApi.getRequestDetails(Number(requestId));
      setRequest(data);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        setErrorMessage('Service request not found.');
      } else if (status === 403) {
        setErrorMessage('You do not have permission to view this service request.');
      } else {
        setErrorMessage(err.message || 'Failed to load service request details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const renderStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.OPEN:
        return <Badge variant="info">Open Request</Badge>;
      case RequestStatus.MATCHED:
        return <Badge variant="purple">Providers Matched</Badge>;
      case RequestStatus.CONTACTED:
        return <Badge variant="warning">Contacted</Badge>;
      case RequestStatus.IN_PROGRESS:
        return <Badge variant="primary">In Progress</Badge>;
      case RequestStatus.COMPLETED:
        return <Badge variant="success">Completed</Badge>;
      case RequestStatus.CANCELLED:
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const statusSteps: Array<{ key: RequestStatus; label: string }> = [
    { key: RequestStatus.OPEN, label: 'Open' },
    { key: RequestStatus.MATCHED, label: 'Matched' },
    { key: RequestStatus.CONTACTED, label: 'Contacted' },
    { key: RequestStatus.IN_PROGRESS, label: 'In Progress' },
    { key: RequestStatus.COMPLETED, label: 'Completed' },
  ];

  const getStepState = (stepKey: RequestStatus, currentStatus: RequestStatus) => {
    if (currentStatus === RequestStatus.CANCELLED) {
      return 'cancelled';
    }

    const order = [
      RequestStatus.OPEN,
      RequestStatus.MATCHED,
      RequestStatus.CONTACTED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.COMPLETED,
    ];
    const currentIndex = order.indexOf(currentStatus);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/citizen/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Citizen Dashboard
        </Link>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Loading service request details..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Access Error"
            message={errorMessage}
            onRetry={fetchRequestDetails}
            className="my-8"
          />
        )}

        {!isLoading && !errorMessage && request && (
          <div className="space-y-6">
            {/* Header Title Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      Service Request #{request.id}
                    </span>
                    {renderStatusBadge(request.status)}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                    {request.service_category}
                  </h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/citizen/matches/${request.id}`}>
                    <Button variant="primary" size="md" rightIcon={<Sparkles className="w-4 h-4" />}>
                      View Matched Providers
                    </Button>
                  </Link>
                </div>
              </div>

              {/* VISUAL STATUS INDICATOR PROGRESS STEPPER */}
              <div className="pt-6">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-4">
                  Request Lifecycle Progression
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {statusSteps.map((step) => {
                    const state = getStepState(step.key, request.status);
                    return (
                      <div
                        key={step.key}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs transition-all ${
                          state === 'completed'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : state === 'current'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-bold ring-1 ring-indigo-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {state === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : state === 'current' ? (
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900" />
                        )}
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Detailed Parameters Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-6">
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" /> Description of Legal Problem
                </h2>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80 whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Location
                  </span>
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {request.location}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Preferred Provider Type
                  </span>
                  <span className="text-slate-200 font-medium">
                    {request.preferred_provider_type}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Urgency Level
                  </span>
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> {request.urgency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-800">
                <div>
                  <span className="text-slate-400">Legal Aid Interest: </span>
                  <span className="font-semibold text-slate-200">
                    {request.legal_aid_interest ? 'Yes (Flagged for Legal Aid routing)' : 'No'}
                  </span>
                </div>

                <div className="sm:text-right">
                  <span className="text-slate-400">Created At: </span>
                  <span className="text-slate-300">
                    {new Date(request.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
