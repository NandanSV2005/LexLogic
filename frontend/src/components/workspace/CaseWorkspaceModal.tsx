import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  X,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  UserCheck,
  Calendar,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { requestsApi } from '../../api';
import { WorkspaceSummary, RequestStatus } from '../../types';

interface CaseWorkspaceModalProps {
  requestId: number;
  onClose: () => void;
  onOpenPrivacyCenter?: () => void;
  onOpenScheduling?: () => void;
}

export const CaseWorkspaceModal: React.FC<CaseWorkspaceModalProps> = ({
  requestId,
  onClose,
  onOpenPrivacyCenter,
  onOpenScheduling,
}) => {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');

  const fetchWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await requestsApi.getCaseWorkspace(requestId);
      setWorkspace(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load case workspace summary.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [requestId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="max-w-3xl w-full max-h-[90vh] flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1C261F] text-[#8EA895] rounded-xl border border-[#2D3D32]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#E6EFE8] tracking-tight">
                Case Workspace #{requestId}
              </h2>
              {workspace && (
                <span className="text-xs text-[#A3B5A7]">
                  {workspace.request.service_category} • {workspace.request.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {workspace && (
              <Badge variant={workspace.request.status === RequestStatus.COMPLETED ? 'success' : 'info'}>
                {workspace.request.status.replace('_', ' ')}
              </Badge>
            )}
            <button
              onClick={onClose}
              className="text-[#A3B5A7] hover:text-[#E6EFE8] p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#8EA895] animate-spin mx-auto" />
            <p className="text-xs text-[#A3B5A7] font-semibold">Loading case workspace & timeline...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-[#3D2020] border border-[#5E3232] text-[#E89D9D] text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {!isLoading && workspace && (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* TABS HEADER */}
            <div className="flex items-center gap-2 border-b border-[#2D3D32] pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-[#1C261F] text-[#E6EFE8] shadow-sm border border-[#2D3D32]'
                    : 'text-[#A3B5A7] hover:bg-[#1C261F]/50'
                }`}
              >
                Case Overview & Actions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'timeline'
                    ? 'bg-[#1C261F] text-[#E6EFE8] shadow-sm border border-[#2D3D32]'
                    : 'text-[#A3B5A7] hover:bg-[#1C261F]/50'
                }`}
              >
                Service Timeline ({workspace.timeline.length})
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* RECOMMENDED NEXT ACTION BANNER */}
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#8EA895] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Next Recommended Action
                    </span>
                    <Badge variant="purple">{workspace.next_action.actor_role}</Badge>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#E6EFE8]">
                    {workspace.next_action.title}
                  </h3>
                  <p className="text-xs text-[#A3B5A7] leading-relaxed">
                    {workspace.next_action.description}
                  </p>
                </div>

                {/* CONNECTED PROVIDER CARD */}
                {workspace.connected_provider ? (
                  <Card className="p-4 space-y-2.5 bg-[#1C261F]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#A3B5A7] uppercase tracking-wider flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-[#8EA895]" /> Assigned Representation
                      </span>
                      <Badge variant="success">Active Representation</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-extrabold text-[#E6EFE8]">
                          {workspace.connected_provider.full_name}
                        </h4>
                        <span className="text-xs text-[#A3B5A7]">
                          {workspace.connected_provider.provider_type} • Experience: {workspace.connected_provider.experience_years} years
                        </span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold text-[#E6EFE8]">
                          {workspace.connected_provider.reliability_score.toFixed(1)}/100
                        </span>
                        <span className="text-[10px] text-[#A3B5A7] block">Reliability</span>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-4 text-center bg-[#1C261F]">
                    <Clock className="w-6 h-6 text-[#A3B5A7] mx-auto mb-2" />
                    <span className="text-xs font-bold text-[#E6EFE8] block">No Assigned Representation Yet</span>
                    <span className="text-[11px] text-[#A3B5A7]">
                      Review interested providers to accept representation for this request.
                    </span>
                  </Card>
                )}

                {/* QUICK INTEGRATED TOOLS BUTTONS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {onOpenPrivacyCenter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenPrivacyCenter}
                      leftIcon={<Lock className="w-4 h-4 text-[#8EA895]" />}
                      className="w-full justify-start"
                    >
                      Privacy & Access Controls
                    </Button>
                  )}

                  {onOpenScheduling && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenScheduling}
                      leftIcon={<Calendar className="w-4 h-4 text-[#8EA895]" />}
                      className="w-full justify-start"
                    >
                      Schedule Appointment
                    </Button>
                  )}
                </div>

                {/* SERVICE PROBLEM DESCRIPTION */}
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-[#A3B5A7] uppercase tracking-wider block">
                    Legal Need Description
                  </span>
                  <p className="text-xs text-[#E6EFE8] leading-relaxed whitespace-pre-wrap">
                    "{workspace.request.description}"
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#2D3D32]">
                {workspace.timeline.map((evt) => (
                  <div key={evt.id} className="relative pl-8 space-y-1">
                    <div className="absolute left-1 top-1 w-5 h-5 rounded-full bg-[#8EA895] text-[#141C16] flex items-center justify-center text-[10px] font-bold shadow-sm">
                      ✓
                    </div>
                    <div className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#E6EFE8]">{evt.title}</span>
                        <span className="text-[10px] text-[#A3B5A7]">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#A3B5A7] leading-relaxed">{evt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-[#2D3D32] shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Workspace
          </Button>
        </div>
      </Card>
    </div>
  );
};
