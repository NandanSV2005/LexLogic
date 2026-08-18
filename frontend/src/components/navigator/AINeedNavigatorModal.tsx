import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { apiClient } from '../../api/client';
import { ProviderType } from '../../types';

interface NavigatorOutput {
  service_category: string;
  preferred_provider_type: ProviderType;
  summary_context: string;
  disclaimer: string;
}

interface AINeedNavigatorModalProps {
  onClose: () => void;
  onApplyClassification: (category: string, providerType: ProviderType, description?: string) => void;
}

export const AINeedNavigatorModal: React.FC<AINeedNavigatorModalProps> = ({
  onClose,
  onApplyClassification,
}) => {
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [result, setResult] = useState<NavigatorOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descriptionInput.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await apiClient.post<NavigatorOutput>('/api/navigator/classify', {
        description: descriptionInput.trim(),
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.message || 'Classification service unavailable. You can continue manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyClassification(result.service_category, result.preferred_provider_type, descriptionInput.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#29352D]/50 backdrop-blur-sm">
      <Card className="max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C8D7C7] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#29352D]">AI Legal Need Navigator</h2>
              <span className="text-xs text-[#617066]">Smart classification helper for service requests</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#617066] hover:text-[#29352D]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#29352D] uppercase tracking-wide">
                Describe your problem in plain language
              </label>
              <textarea
                rows={4}
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                required
                placeholder="e.g. My tenant hasn't paid rent for 4 months and is refusing to vacate the premises..."
                className="w-full px-3.5 py-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] placeholder-[#8C9B90] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30 leading-relaxed"
              />
            </div>

            {error && (
              <div className="p-3 bg-[#F4D6D6] border border-[#E8B4B4] text-[#5C1D1D] text-xs rounded-xl font-semibold">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isAnalyzing} leftIcon={<Sparkles className="w-4 h-4" />}>
                Analyze Legal Need
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#DDE8DC] border border-[#C8D7C7] rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#7C9A82] uppercase tracking-wider block">
                Classification Recommendation
              </span>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#29352D] text-sm">{result.service_category}</span>
                <Badge variant="purple">{result.preferred_provider_type}</Badge>
              </div>
              <p className="text-xs text-[#29352D] leading-relaxed">
                "{result.summary_context}"
              </p>
            </div>

            {/* MANDATORY LEGAL DISCLAIMER BANNER */}
            <div className="p-3 bg-[#F5E6CC] border border-[#E6CE9F] text-[#5C4114] text-[11px] rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#5C4114] shrink-0 mt-0.5" />
              <span>{result.disclaimer}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#C8D7C7]">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-[#7C9A82] hover:underline font-semibold"
              >
                Re-describe Problem
              </button>

              <Button variant="primary" size="sm" onClick={handleApply} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Apply to Request Form
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
