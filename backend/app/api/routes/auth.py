from fastapi import APIRouter

router = APIRouter()

@router.post("/login")
def login():
    return {"message": "Auth not implemented yet"}

@router.post("/register")
def register():
    return {"message": "Auth not implemented yet"}
