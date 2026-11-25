"""Schémas : résultat d'un scan de pièce."""

from pydantic import BaseModel, Field

from app.services.ocr_service import FieldGuess
from app.services.scan_service import ScanResult, needs_review


class OcrField(BaseModel):
    value: str | None
    confidence: float = Field(ge=0, le=1)
    needs_review: bool = Field(description="Vrai si l'utilisateur doit vérifier ce champ.")

    @classmethod
    def of(cls, guess: FieldGuess) -> "OcrField":
        return cls(value=guess.value, confidence=guess.confidence,
                   needs_review=needs_review(guess.confidence, guess.value))


class OcrFields(BaseModel):
    doc_type: OcrField
    surname: OcrField
    given_names: OcrField
    holder_name: OcrField
    birth_date: OcrField = Field(description="Format AAAA-MM-JJ")
    document_number: OcrField


class ScanOut(BaseModel):
    ocr_available: bool
    message: str
    upload_id: str | None = Field(
        description="À renvoyer dans POST /found pour rattacher la photo floutée."
    )
    preview: str | None = Field(description="Miniature FLOUTÉE (data URI JPEG).")
    blurred_regions: int
    duration_ms: int
    fields: OcrFields

    @classmethod
    def of(cls, result: ScanResult) -> "ScanOut":
        parsed = result.parsed
        found = [f for f in (parsed.holder_name, parsed.document_number) if f.value]
        if not result.ocr_available:
            message = ("La lecture automatique n'est pas disponible pour le moment. "
                       "Pas de souci, remplis le formulaire à la main.")
        elif len(found) == 2:
            message = "C'est lu ! Vérifie les champs en orange avant de valider."
        elif found:
            message = "Lecture partielle : complète les champs manquants."
        else:
            message = ("On n'a pas réussi à lire la pièce. Reprends une photo bien à plat, "
                       "sans reflet, ou remplis le formulaire à la main.")
        return cls(
            ocr_available=result.ocr_available,
            message=message,
            upload_id=result.upload_id,
            preview=result.preview_data_uri,
            blurred_regions=result.blurred_regions,
            duration_ms=result.duration_ms,
            fields=OcrFields(
                doc_type=OcrField.of(parsed.doc_type),
                surname=OcrField.of(parsed.surname),
                given_names=OcrField.of(parsed.given_names),
                holder_name=OcrField.of(parsed.holder_name),
                birth_date=OcrField.of(parsed.birth_date),
                document_number=OcrField.of(parsed.document_number),
            ),
        )
