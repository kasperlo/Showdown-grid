import databutton as db
import asyncpg
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict

from app.auth import AuthorizedUser

router = APIRouter(prefix="/quiz", tags=["Quiz Storage"])

# Pydantic-modeller for request- og response-data
class QuizData(BaseModel):
    """Representerer hele quiz-objektet som lagres."""
    data: Dict[str, Any] = Field(..., description="The entire quiz state object.")

async def get_db_conn():
    """Henter en databaseforbindelse fra poolen."""
    try:
        return await asyncpg.connect(db.secrets.get("DATABASE_URL_DEV"))
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to the database.") from e

@router.get("", response_model=QuizData, summary="Hent brukerens lagrede quiz")
async def get_user_quiz(user: AuthorizedUser):
    """
    Henter quiz-data for den innloggede brukeren.
    Returnerer 404 hvis ingen quiz er lagret for brukeren.
    """
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            "SELECT quiz_data FROM user_quizzes WHERE user_id = $1",
            user.sub
        )
        if row and row['quiz_data']:
            # Konverter JSON-strengen fra databasen tilbake til et Python-dict
            quiz_dict = json.loads(row['quiz_data'])
            return QuizData(data=quiz_dict)
        else:
            raise HTTPException(status_code=404, detail="No quiz found for this user.")
    except json.JSONDecodeError as e:
        print(f"JSON decode error for user {user.sub}: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse stored quiz data.")
    finally:
        await conn.close()

@router.put("", status_code=204, summary="Lagre eller oppdater brukerens quiz")
async def save_user_quiz(quiz: QuizData, user: AuthorizedUser):
    """
    Lagrer (oppretter eller oppdaterer) quiz-data for den innloggede brukeren.
    Bruker en "upsert"-operasjon.
    """
    conn = await get_db_conn()
    try:
        # Konverter Pydantic-modellen (dict) til en JSON-streng
        json_data = json.dumps(quiz.data)
        
        await conn.execute(
            """
            INSERT INTO user_quizzes (user_id, quiz_data)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE
            SET quiz_data = EXCLUDED.quiz_data, updated_at = NOW();
            """,
            user.sub,
            json_data # Send JSON-strengen til databasen
        )
    except asyncpg.InterfaceError as e:
        print(f"Database interface error saving quiz for user {user.sub}: {e}")
        raise HTTPException(status_code=500, detail="Database communication error.") from e
    except Exception as e:
        print(f"Unexpected error saving quiz for user {user.sub}: {e}")
        raise HTTPException(status_code=500, detail="Could not save quiz data.") from e
    finally:
        await conn.close()
