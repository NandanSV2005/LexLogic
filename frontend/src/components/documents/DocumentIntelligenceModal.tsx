import React, { useEffect, useState } from 'react';
import { Sparkles, X, FileText, Calendar, Users, List, ShieldAlert, RefreshCw } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { documentsApi } from '../../api';

interface DocumentIntelligenceData {
  document_type: string;
  parties: string[];
  key_headings: string[];
  detected_dates: string[];
  file_type_summary: string;
  disclaimer: string;
}

interface DocumentIntelligenceModalProps {
  documentId: number;
  documentTitle: string;
  onClose: () => void;
}

export const DocumentIntelligenceModal: React.FC<DocumentIntelligenceModalProps> = ({
  documentId,
  documentTitle,
  onClose,
}) => {
  const [data, setData] = useState<DocumentIntelligenceData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await documentsApi.analyzeDocument(documentId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze document intelligence.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [documentId]);

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
              <h2 className="text-base font-extrabold text-[#29352D]">Smart Document Intelligence</h2>
              <span className="text-xs text-[#617066]">Analyzing "{documentTitle}"</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#617066] hover:text-[#29352D]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#7C9A82] animate-spin mx-auto" />
            <p className="text-xs text-[#617066]">Extracting document metadata & entity structure...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-[#F4D6D6] border border-[#E8B4B4] text-[#5C1D1D] text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-4 text-xs">
            {/* Extracted Type & File Format */}
            <div className="p-3.5 bg-[#DDE8DC] border border-[#C8D7C7] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#7C9A82] uppercase tracking-wider block">
                  Document Classification
                </span>
                <h3 className="text-sm font-extrabold text-[#29352D]">{data.document_type}</h3>
              </div>
              <Badge variant="purple">{data.file_type_summary}</Badge>
            </div>

            {/* Extracted Parties & Headings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-[#617066] uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#7C9A82]" /> Identified Parties
                </span>
                <ul className="space-y-1 text-xs text-[#29352D]">
                  {data.parties.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C9A82]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-[#617066] uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#7C9A82]" /> Extracted Dates
                </span>
                <ul className="space-y-1 text-xs text-[#29352D]">
                  {data.detected_dates.map((d, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C9A82]" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Structural Clauses / Headings */}
            <div className="p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-[#617066] uppercase tracking-wider flex items-center gap-1">
                <List className="w-3.5 h-3.5 text-[#7C9A82]" /> Structural Clause Headings
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {data.key_headings.map((h, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[#DDE8DC] text-[#29352D] text-[11px] font-medium rounded-md border border-[#C8D7C7]">
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* MANDATORY LEGAL DISCLAIMER BANNER */}
            <div className="p-3 bg-[#F5E6CC] border border-[#E6CE9F] text-[#5C4114] text-[11px] rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#5C4114] shrink-0 mt-0.5" />
              <span>{data.disclaimer}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-[#C8D7C7]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Intelligence
          </Button>
        </div>
      </Card>
    </div>
  );
};
