import { ProviderType } from "../types";

export interface ProviderProfessionConfig {
  providerType: ProviderType;
  label: string;
  professionTitle: string;
  activeWorkLabel: string;
  requestLabel: string;
  eligibleRequestsHeading: string;
  completionLabel: string;
  relevantServices: string[];
  areaFieldLabel: string;
  areaFieldName: string;
  themeColor: string;
  badgeBg: string;
  badgeText: string;
}

export const PROVIDER_PROFESSION_CONFIGS: Record<ProviderType, ProviderProfessionConfig> = {
  [ProviderType.ADVOCATE]: {
    providerType: ProviderType.ADVOCATE,
    label: "Advocate",
    professionTitle: "Advocate / Legal Counsel",
    activeWorkLabel: "Active Cases",
    requestLabel: "Legal Requests",
    eligibleRequestsHeading: "Eligible Legal Requests",
    completionLabel: "Case Completed",
    relevantServices: [
      "Civil Dispute",
      "Criminal Defense",
      "Corporate Litigation",
      "Property Litigation",
      "Family & Matrimonial",
      "Legal Representation",
      "Legal Aid Inquiry",
    ],
    areaFieldLabel: "Practice Area(s)",
    areaFieldName: "practice_area",
    themeColor: "indigo",
    badgeBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
    badgeText: "Advocate",
  },
  [ProviderType.MEDIATOR]: {
    providerType: ProviderType.MEDIATOR,
    label: "Mediator",
    professionTitle: "Dispute Mediator",
    activeWorkLabel: "Active Mediations",
    requestLabel: "Mediation Requests",
    eligibleRequestsHeading: "Eligible Mediation Requests",
    completionLabel: "Mediation Completed",
    relevantServices: [
      "Mediation",
      "Commercial Mediation",
      "Family Settlement",
      "Workplace Dispute Mediation",
      "Community Mediation",
    ],
    areaFieldLabel: "Mediation Specialization",
    areaFieldName: "specialization",
    themeColor: "emerald",
    badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    badgeText: "Mediator",
  },
  [ProviderType.ARBITRATOR]: {
    providerType: ProviderType.ARBITRATOR,
    label: "Arbitrator",
    professionTitle: "Neutral Arbitrator",
    activeWorkLabel: "Active Arbitrations",
    requestLabel: "Arbitration Requests",
    eligibleRequestsHeading: "Eligible Arbitration Requests",
    completionLabel: "Arbitration Completed",
    relevantServices: [
      "Commercial Arbitration",
      "Construction Arbitration",
      "Contractual Arbitration",
      "International Arbitration",
    ],
    areaFieldLabel: "Arbitration Specialization",
    areaFieldName: "specialization",
    themeColor: "purple",
    badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    badgeText: "Arbitrator",
  },
  [ProviderType.NOTARY]: {
    providerType: ProviderType.NOTARY,
    label: "Notary",
    professionTitle: "Notary Public",
    activeWorkLabel: "Active Notary Requests",
    requestLabel: "Notary Requests",
    eligibleRequestsHeading: "Pending Notary Requests",
    completionLabel: "Notary Service Completed",
    relevantServices: [
      "Notary Service",
      "Affidavit Notarization",
      "Document Verification",
      "Power of Attorney Attestation",
      "Oaths & Affirmations",
    ],
    areaFieldLabel: "Notary Services Offered",
    areaFieldName: "service_type",
    themeColor: "amber",
    badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    badgeText: "Notary Public",
  },
  [ProviderType.DOCUMENT_WRITER]: {
    providerType: ProviderType.DOCUMENT_WRITER,
    label: "Document Writer",
    professionTitle: "Legal Document Specialist",
    activeWorkLabel: "Active Documents",
    requestLabel: "Document Requests",
    eligibleRequestsHeading: "Document Drafting Requests",
    completionLabel: "Document Drafting Completed",
    relevantServices: [
      "Document Preparation",
      "Sale Deed Drafting",
      "Will & Trust Writing",
      "Contract Drafting",
      "Rental Agreement Writing",
    ],
    areaFieldLabel: "Document Types Handled",
    areaFieldName: "document_types",
    themeColor: "cyan",
    badgeBg: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
    badgeText: "Document Writer",
  },
};

export function getProviderProfessionConfig(providerType?: ProviderType): ProviderProfessionConfig {
  if (providerType && PROVIDER_PROFESSION_CONFIGS[providerType]) {
    return PROVIDER_PROFESSION_CONFIGS[providerType];
  }
  return PROVIDER_PROFESSION_CONFIGS[ProviderType.ADVOCATE];
}
