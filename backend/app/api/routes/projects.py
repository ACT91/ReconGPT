from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.project import Project
from app.schemas.scan import ProjectRequest, ProjectResponse

router = APIRouter()

@router.post("", response_model=ProjectResponse)
def create_project(request: ProjectRequest, db: Session = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        name=request.name,
        description=request.description,
        created_at=datetime.utcnow()
    )
    
    db.add(project)
    db.commit()
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at
    )

@router.get("", response_model=List[ProjectResponse])
def list_projects(user_id: str, db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == user_id).all()
    
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            created_at=p.created_at
        )
        for p in projects
    ]
