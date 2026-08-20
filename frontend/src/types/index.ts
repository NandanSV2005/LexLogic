// LexLogic Frontend Domain Type Definitions

export enum UserRole {
  CITIZEN = "CITIZEN",
  PROVIDER = "PROVIDER",
  ADMIN = "ADMIN",
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export enum ProviderType {
  ADVOCATE = "ADVOCATE",
  ARBITRATOR = "ARBITRATOR",
  MEDIATOR = "MEDIATOR",
  NOTARY = "NOTARY",
  DOCUMENT_WRITER = "DOCUMENT_WRITER",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

export enum AvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  BUSY = "BUSY",
  UNAVAILABLE = "UNAVAILABLE",
}

export enum DetailedVerificationStatus {
  NOT_STARTED = "NOT_STARTED",
  SUBMITTED = "SUBMITTED",
  AUTOMATED_REVIEW = "AUTOMATED_REVIEW",
  MANUAL_REVIEW = "MANUAL_REVIEW",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
}

export enum CredentialType {
  BAR_ENROLLMENT_CERTIFICATE = "BAR_ENROLLMENT_CERTIFICATE",
  BAR_ID_CARD = "BAR_ID_CARD",
  PROPOSITION_CERTIFICATE = "PROPOSITION_CERTIFICATE",
  OTHER = "OTHER",
}

export enum EvidenceStatus {
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  FLAGGED = "FLAGGED",
}

export interface AdvocateCaseReference {
  id?: number;
  case_number: string;
  court_name: string;
  case_type?: string;
  case_year?: number;
  advocate_role?: string;
  supporting_document_id?: number;
  evidence_status?: EvidenceStatus;
  verification_status?: DetailedVerificationStatus;
  verification_notes?: string;
}

export interface AdvocateVerificationSubmit {
  full_legal_name?: string;
  jurisdiction_city?: string;
  jurisdiction_state?: string;
  state_bar_council: string;
  enrollment_number: string;
  enrollment_year: number;
  credential_type: CredentialType;
  credential_document_id?: number;
  practice_areas?: string;
  case_references: AdvocateCaseReference[];
}

export interface AdvocateVerificationProfile {
  id: number;
  verification_record_id: number;
  provider_id: number;
  full_legal_name?: string;
  jurisdiction_city?: string;
  jurisdiction_state?: string;
  state_bar_council?: string;
  enrollment_number?: string;
  enrollment_year?: number;
  credential_type: CredentialType;
  credential_document_id?: number;
  credential_verification_status: DetailedVerificationStatus;
  credential_verified_at?: string;
  verification_source_reference?: string;
  verification_notes?: string;
  created_at: string;
  updated_at: string;
  case_references: AdvocateCaseReference[];
}

export interface ProviderVerificationHistory {
  id: number;
  verification_record_id: number;
  provider_id: number;
  actor_id?: number;
  action: string;
  from_status?: string;
  to_status: string;
  notes?: string;
  timestamp: string;
}

export interface ProviderVerificationRecord {
  id: number;
  provider_id: number;
  overall_status: DetailedVerificationStatus;
  identity_status: DetailedVerificationStatus;
  credential_status: DetailedVerificationStatus;
  practice_status: DetailedVerificationStatus;
  last_reviewed_by_admin_id?: number;
  last_reviewed_at?: string;
  verification_notes?: string;
  created_at: string;
  updated_at: string;
  advocate_profile?: AdvocateVerificationProfile;
  history_entries: ProviderVerificationHistory[];
}

export interface AdminVerificationQueueItem {
  provider_id: number;
  user_id: number;
  user_email: string;
  full_name: string;
  profession: string;
  overall_status: DetailedVerificationStatus;
  submitted_at?: string;
  credential_status: DetailedVerificationStatus;
  practice_evidence_status: DetailedVerificationStatus;
  last_activity_timestamp?: string;
  last_activity_notes?: string;
  last_reviewed_by_admin_id?: number;
}

export interface AdminVerificationDetailsOut {
  provider_id: number;
  user_id: number;
  user_email: string;
  full_name: string;
  phone?: string;
  location?: string;
  bio?: string;
  experience_years: number;
  created_at: string;
  profession: string;
  state_bar_council?: string;
  enrollment_number?: string;
  enrollment_year?: number;
  jurisdiction_state?: string;
  credential_type?: CredentialType;
  credential_document_id?: number;
  credential_document_filename?: string;
  credential_verification_status: DetailedVerificationStatus;
  credential_notes?: string;
  overall_status: DetailedVerificationStatus;
  identity_status: DetailedVerificationStatus;
  credential_status: DetailedVerificationStatus;
  practice_status: DetailedVerificationStatus;
  last_reviewed_by_admin_id?: number;
  last_reviewed_at?: string;
  verification_notes?: string;
  case_references: AdvocateCaseReference[];
  history_entries: ProviderVerificationHistory[];
}

export interface ProviderFieldValue {
  field_name: string;
  field_label?: string;
  value: string;
}

export interface Provider {
  id: number;
  user_id: number;
  provider_type: ProviderType;
  full_name: string;
  phone?: string;
  location?: string;
  experience_years: number;
  bio?: string;
  verification_status: VerificationStatus;
  profile_completion_percentage: number;
  is_profile_complete: boolean;
  points: number;
  reliability_score: number;
  rating: number;
  response_rate: number;
  completed_requests: number;
  total_requests: number;
  availability_status: AvailabilityStatus;
  created_at?: string;
  updated_at?: string;
  field_values?: ProviderFieldValue[];
  generic_fields?: ProviderFieldValueDetail[];
}

export interface ProviderDashboardMetrics {
  provider_id: number;
  full_name: string;
  provider_type: ProviderType;
  verification_status: VerificationStatus;
  profile_completion_percentage: number;
  is_profile_complete: boolean;
  points: number;
  reliability_score: number;
  rating: number;
  availability_status: AvailabilityStatus;
  total_requests: number;
  completed_requests: number;
  response_rate: number;
  pending_interactions: number;
  shared_documents_count: number;
}

export enum RequestStatus {
  OPEN = "OPEN",
  MATCHED = "MATCHED",
  CONTACTED = "CONTACTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETION_REQUESTED = "COMPLETION_REQUESTED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum RequestUrgency {
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum InteractionStatus {
  PENDING = "PENDING",
  CONTACTED = "CONTACTED",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
}

export interface ServiceRequest {
  id: number;
  citizen_id: number;
  service_category: string;
  description: string;
  location: string;
  preferred_provider_type: ProviderType;
  urgency: RequestUrgency;
  legal_aid_interest: boolean;
  status: RequestStatus;
  accepted_provider_id?: number;
  accepted_provider_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderFieldValueDetail {
  field_name: string;
  field_label?: string;
  field_type?: string;
  is_required?: boolean;
  value?: string;
}

export interface MatchedProviderOut {
  provider_id: number;
  provider_type: ProviderType;
  full_name: string;
  phone?: string;
  location: string;
  experience_years: number;
  bio?: string;
  verification_status: VerificationStatus;
  availability_status: AvailabilityStatus;
  reliability_score?: number;
  generic_fields?: ProviderFieldValueDetail[];
  match_score?: number | null;
  is_advocate_factual_match: boolean;
  professional_credential_verified?: boolean;
  practice_evidence_reviewed?: boolean;
  practice_evidence_count?: number;
}

export interface MatchResponse {
  request_id: number;
  service_category: string;
  preferred_provider_type: ProviderType;
  total_matches: number;
  matched_providers: MatchedProviderOut[];
}

export interface MatchBreakdown {
  service_match: number;
  location_match: number;
  verification_score: number;
  reliability_score: number;
  experience_score: number;
}

export interface ProviderMatchItem {
  provider_id: number;
  full_name: string;
  provider_type: ProviderType;
  location: string;
  experience_years: number;
  match_score: number;
  breakdown: MatchBreakdown;
  verification_status: VerificationStatus;
  reliability_score: number;
  rating: number;
  availability_status: AvailabilityStatus;
}

export interface MatchResult {
  request: {
    service_category: string;
    location: string;
    preferred_provider_type: ProviderType;
  };
  total_matches: number;
  matches: ProviderMatchItem[];
}

export enum DocumentVisibility {
  PRIVATE = "PRIVATE",
  SHARED = "SHARED",
  REVOKED = "REVOKED",
}

export enum DocumentShareStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
}

export enum DocumentSharePermission {
  VIEW = "VIEW",
  VIEW_AND_DOWNLOAD = "VIEW_AND_DOWNLOAD",
}

export interface DocumentShareItem {
  id: number;
  document_id: number;
  shared_with_provider_id: number;
  status: DocumentShareStatus;
  permission: DocumentSharePermission;
  created_at: string;
  updated_at?: string;
}

export interface DocumentItem {
  id: number;
  owner_id: number;
  title: string;
  filename: string;
  file_path?: string;
  file_size_bytes: number;
  mime_type: string;
  visibility: DocumentVisibility;
  created_at: string;
  updated_at?: string;
  shares?: DocumentShareItem[];
  current_user_permission?: DocumentSharePermission;
}


export interface AuditLogItem {
  id: number;
  user_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: number;
  metadata_json?: Record<string, any>;
  ip_address?: string;
  timestamp?: string;
  created_at?: string;
}

export interface PointTransactionOut {
  id: number;
  provider_id: number;
  action: string;
  points_awarded: number;
  description?: string;
  created_at: string;
}

export interface PointsSummaryOut {
  total_points: number;
  transactions_count: number;
}

export interface InterestedProvider {
  provider_id: number;
  full_name: string;
  provider_type: ProviderType;
  phone?: string;
  location?: string;
  experience_years: number;
  bio?: string;
  rating: number;
  verification_status: string;
  reliability_score: number;
  interaction_status: InteractionStatus;
  requested_documents?: string;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface NextAction {
  action_key: string;
  title: string;
  description: string;
  actor_role: string;
}

export interface WorkspaceSummary {
  request: ServiceRequest;
  connected_provider?: InterestedProvider;
  next_action: NextAction;
  timeline: TimelineEvent[];
  documents_count: number;
}

export interface Appointment {
  id: number;
  request_id: number;
  provider_id: number;
  citizen_id: number;
  slot_datetime: string;
  purpose: string;
  status: string;
  created_at: string;
}

export interface DocumentPrivacyItem {
  document_id: number;
  title: string;
  filename: string;
  visibility: DocumentVisibility;
  provider_id?: number;
  provider_name?: string;
  share_status?: DocumentShareStatus;
  permission?: DocumentSharePermission;
}

export interface PrivacySummary {
  request_id: number;
  citizen_id: number;
  items: DocumentPrivacyItem[];
}

export interface APIErrorResponse {
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}

