from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.database import initialize_database
from backend.models import Transaction
from backend.database import save_transaction
from backend.database import get_cards

initialize_database()
app = FastAPI()

@app.post("/api/transactions")
def save(transaction: Transaction):

    save_transaction(transaction)

    return {"success": True}
@app.get("/api/cards")
def get_cards_endpoint():
    return get_cards()

frontend_dir = Path(__file__).parent.parent / "frontend"

app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
