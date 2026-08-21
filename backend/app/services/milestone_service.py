from typing import List
from sqlalchemy.orm import Session
from app.models.provider import ProviderType
from app.models.request import CaseMilestone

MILESTONE_TEMPLATES = {
    ProviderType.ADVOCATE: [
        "Case Assessment",
        "Document Review",
        "Legal Preparation",
        "Representation/Proceeding",
        "Service Completed",
    ],
    ProviderType.MEDIATOR: [
        "Case Preparation",
        "Mediation Scheduled",
        "Mediation Session",
        "Follow-up / Resolution",
        "Mediation Completed",
    ],
    ProviderType.ARBITRATOR: [
        "Case Preparation",
        "Evidence Review",
        "Proceedings",
        "Decision/Award Preparation",
        "Arbitration Completed",
    ],
    ProviderType.NOTARY: [
        "Documents Received",
        "Document Review",
        "Requirements Checked",
        "Notarial Process",
        "Service Completed",
    ],
    ProviderType.DOCUMENT_WRITER: [
        "Requirements Received",
        "Document Review",
        "Draft Preparation",
        "Draft Ready",
        "Citizen Review",
        "Final Document Prepared",
        "Service Completed",
    ],
}


def seed_default_milestones(
    db: Session,
    request_id: int,
    provider_type: ProviderType
) -> List[CaseMilestone]:
    """Seeds default profession-specific service milestones for a case."""
    existing = db.query(CaseMilestone).filter(CaseMilestone.request_id == request_id).all()
    if existing:
        return existing

    template = MILESTONE_TEMPLATES.get(provider_type, MILESTONE_TEMPLATES[ProviderType.ADVOCATE])
    created_milestones = []
    for name in template:
        ms = CaseMilestone(
            request_id=request_id,
            milestone_name=name,
            status="PENDING",
        )
        db.add(ms)
        created_milestones.append(ms)

    db.commit()
    for ms in created_milestones:
        db.refresh(ms)
    return created_milestones
