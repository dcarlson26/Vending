# backend/database.py

# database.py

import sqlite3
from pathlib import Path
from datetime import date
DB_PATH = Path(__file__).parent / "pokemon.db"
TRANSACTION_BUY = "BUY"
TRANSACTION_SELL = "SELL"
TRANSACTION_TRADE = "TRADE"

DIRECTION_IN = "IN"
DIRECTION_OUT = "OUT"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")

    return conn

def initialize_database():
    conn = get_connection()

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS cards
        (
            card_id INTEGER PRIMARY KEY AUTOINCREMENT,

            product_id INTEGER NOT NULL,

            condition TEXT,

            date_added TEXT NOT NULL,

            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS transactions
        (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,

            transaction_type TEXT NOT NULL,

            transaction_date TEXT NOT NULL,

            cash_in REAL DEFAULT 0,

            cash_out REAL DEFAULT 0,

            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS transaction_items
        (
            transaction_item_id INTEGER PRIMARY KEY AUTOINCREMENT,

            transaction_id INTEGER NOT NULL,

            card_id INTEGER NOT NULL,

            direction TEXT NOT NULL,

            value REAL NOT NULL,

            FOREIGN KEY(transaction_id)
                REFERENCES transactions(transaction_id),

            FOREIGN KEY(card_id)
                REFERENCES cards(card_id)
        );
    """)

    conn.commit()
    conn.close()

def create_card(
    product_id,
    condition,
    notes=None,
    conn=None,
):
    date_added = date.today().isoformat()
    cursor = conn.execute(
        """
        INSERT INTO cards
        (
            product_id,
            condition,
            date_added,
            notes
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            product_id,
            condition,
            date_added,
            notes,
        ),
    )
    owns_connection = conn is None

    if owns_connection:
        conn = get_connection()
    conn.commit()

    card_id = cursor.lastrowid

    return card_id

def create_transaction(
    transaction_type,
    transaction_date,
    cash_in=0,
    cash_out=0,
    notes=None,
    conn=None,
):
    cursor = conn.execute(
        """
        INSERT INTO transactions
        (
            transaction_type,
            transaction_date,
            cash_in,
            cash_out,
            notes
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            transaction_type,
            transaction_date,
            cash_in,
            cash_out,
            notes,
        ),
    )
    owns_connection = conn is None

    if owns_connection:
        conn = get_connection()
    conn.commit()

    transaction_id = cursor.lastrowid

    return transaction_id

def add_transaction_item(
    transaction_id,
    card_id,
    direction,
    value,
    conn=None,
):
    owns_connection = conn is None

    if owns_connection:
        conn = get_connection()

    conn.execute(
        """
        INSERT INTO transaction_items
        (
            transaction_id,
            card_id,
            direction,
            value
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            transaction_id,
            card_id,
            direction,
            value,
        ),
    )

    conn.commit()

def save_transaction(transaction):
    conn = get_connection()
    from datetime import date

    if transaction.transaction_date is None:
        transaction.transaction_date = date.today().isoformat()
    try:
        conn.execute("BEGIN")

        # create transaction
        transaction_id = create_transaction(
            transaction.transaction_type,
            transaction.transaction_date,
            transaction.cash_in,
            transaction.cash_out,
            transaction.notes,
            conn
        )
        # create cards
        for item in transaction.items:
            card_id = create_card(
                item.product_id,
                item.condition,
                item.notes,
                conn
            )
            # create transaction_items
            add_transaction_item(
                transaction_id,
                card_id,
                item.direction,
                item.value,
                conn
            )
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()

def get_cards():
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            card_id,
            product_id,
            condition,
            notes
        FROM cards
        ORDER BY card_id DESC;
     """).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_inventory_values():
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            c.card_id,
            c.product_id,
            c.condition,
            c.date_added,

            ti.value,
            ti.direction,

            t.transaction_type,
            t.transaction_date,
            t.cash_in,
            t.cash_out

        FROM cards c

        JOIN transaction_items ti
            ON ti.card_id = c.card_id

        JOIN transactions t
            ON t.transaction_id = ti.transaction_id

        ORDER BY t.transaction_date DESC;
    """).fetchall()
    conn.close()

    return [dict(row) for row in rows]