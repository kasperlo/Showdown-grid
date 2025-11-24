import databutton as db
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import mimetypes
import uuid

router = APIRouter()


class UploadResponse(BaseModel):
    """Svar som inneholder den offentlige URL-en til den opplastede filen."""

    url: str


@router.post("/upload_image", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """
    Laster opp et bilde, lagrer det som en statisk fil (static asset),
    og returnerer den offentlige, permanente URL-en.
    """
    print("[UPLOAD] Endpoint hit. Starter bildeopplasting.")
    content_type = file.content_type
    if not content_type or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Filen må være et bilde.")

    try:
        # Lag en unik nøkkel for å unngå overskriving av filer
        extension = mimetypes.guess_extension(content_type) or ""
        file_key = f"quiz_images/{uuid.uuid4().hex}{extension}"

        # Les filinnholdet
        contents = await file.read()

        # Last opp til Databuttons lagring for statiske filer
        # Bruker db.storage.put som er den korrekte metoden
        asset = db.storage.put(
            key=file_key, value=contents, content_type=content_type
        )

        # For å få en offentlig URL, må vi spesifikt be om den
        public_url = asset.as_static_asset().url

        return UploadResponse(url=public_url)

    except Exception as e:
        print(f"Feil under opplasting av bilde: {e}")
        raise HTTPException(status_code=500, detail="Kunne ikke laste opp bildet.")
    finally:
        await file.close()
