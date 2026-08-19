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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1C261F] text-[#8EA895] rounded-xl border border-[#2D3D32]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#E6EFE8]">Smart Document Intelligence</h2>
              <span className="text-xs text-[#A3B5A7]">Analyzing "{documentTitle}"</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#A3B5A7] hover:text-[#E6EFE8]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#8EA895] animate-spin mx-auto" />
            <p className="text-xs text-[#A3B5A7]">Extracting document metadata & entity structure...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-[#3D2020] border border-[#5E3232] text-[#E89D9D] text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-4 text-xs">
            {/* Extracted Type & File Format */}
            <div className="p-3.5 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8EA895] uppercase tracking-wider block">
                  Document Classification
                </span>
                <h3 className="text-sm font-extrabold text-[#E6EFE8]">{data.document_type}</h3>
              </div>
              <Badge variant="purple">{data.file_type_summary}</Badge>
            </div>

            {/* Extracted Parties & Headings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-[#A3B5A7] uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#8EA895]" /> Identified Parties
                </span>
                <ul className="space-y-1 text-xs text-[#E6EFE8]">
                  {data.parties.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-[#A3B5A7] uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#8EA895]" /> Extracted Dates
                </span>
                <ul className="space-y-1 text-xs text-[#E6EFE8]">
                  {data.detected_dates.map((d, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895]" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Structural Clauses / Headings */}
            <div className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-[#A3B5A7] uppercase tracking-wider flex items-center gap-1">
                <List className="w-3.5 h-3.5 text-[#8EA895]" /> Structural Clause Headings
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {data.key_headings.map((h, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[#233027] text-[#E6EFE8] text-[11px] font-medium rounded-md border border-[#2D3D32]">
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* MANDATORY LEGAL DISCLAIMER BANNER */}
            <div className="p-3 bg-[#3B301D] border border-[#5E4D2E] text-[#E3BA7E] text-[11px] rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#E3BA7E] shrink-0 mt-0.5" />
              <span>{data.disclaimer}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-[#2D3D32]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Intelligence
          </Button>
        </div>
      </Card>
    </div>
  );
};
