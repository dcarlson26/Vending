# models.py

from pydantic import BaseModel
from enum import Enum

class TransactionType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    TRADE = "TRADE"

class Direction(str, Enum):
    IN = "IN"
    OUT = "OUT"

class cardCondition(str, Enum):
    NM = "NM"
    LP = "LP"
    MP = "MP"
    HP = "HP"
    DMG = "DMG"

class Card(BaseModel):
    product_id: int
    date_added: str
    condition: cardCondition
    notes: str | None = None

class TransactionItem(BaseModel):

    product_id: int
    condition: cardCondition
    direction: Direction
    value: float
    notes: str | None = None

class Transaction(BaseModel):

    transaction_type: TransactionType

    transaction_date: str | None = None
    cash_in: float = 0

    cash_out: float = 0

    notes: str | None = None

    items: list[TransactionItem]