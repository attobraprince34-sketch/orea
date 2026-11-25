"""Profil de l'utilisateur connecté."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.errors import BadRequest
from app.core.security import hash_password, verify_password
from app.schemas.users import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Profil"])


@router.get("/me", response_model=UserOut, summary="Mon profil")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut, summary="Modifier mon profil")
def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserOut:
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password,
                                                             user.password_hash):
            raise BadRequest("Ton mot de passe actuel est incorrect.", code="WRONG_PASSWORD")
        user.password_hash = hash_password(data.new_password)
    db.commit()
    return UserOut.model_validate(user)
