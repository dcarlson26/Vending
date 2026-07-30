from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.database import initialize_database
from backend.models import Transaction
from backend.database import save_transaction
from backend.database import get_cards
from backend.database import get_inventory_values

initialize_database()
app = FastAPI()

@app.post("/api/transactions")
def save(transaction: Transaction):

    save_transaction(transaction)

    return {"success": True}
@app.get("/api/cards")
def get_cards_endpoint():
    return get_cards()

@app.get("/api/inventory")
def inventory():
    return get_inventory_values()

frontend_dir = Path(__file__).parent.parent / "frontend"

app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
