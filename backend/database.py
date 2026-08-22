# backend/database.py

# database.py

import sqlite3
from pathlib import Path
from datetime import date
import psycopg
from psycopg.rows import dict_row
import os
from .models import Direction
from .models import cardCondition

DATABASE_URL = os.environ["DATABASE_URL"]
DB_PATH = Path(__file__).parent / "pokemon.db"

def get_connection():
    return psycopg.connect(
    DATABASE_URL,
    row_factory=dict_row
)

def initialize_database():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS cards
        (
            card_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

            product_id INTEGER NOT NULL,

            condition TEXT,

            date_added TEXT NOT NULL,

            in_stock BOOLEAN NOT NULL DEFAULT TRUE,

            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS transactions
        (
            transaction_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

            transaction_type TEXT NOT NULL,

            transaction_date TEXT NOT NULL,

            cash_received REAL DEFAULT 0,

            cash_paid REAL DEFAULT 0,

            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS transaction_items
        (
            transaction_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

            transaction_id INTEGER NOT NULL,

            card_id INTEGER,

            product_id INTEGER NOT NULL,

            direction TEXT NOT NULL,

            value REAL NOT NULL,

            market_value REAL NOT NULL,

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

    owns_connection = conn is None

    if owns_connection:
        conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO cards
        (
            product_id,
            condition,
            date_added,
            notes
        )
        VALUES (%s, %s, %s, %s)
        RETURNING card_id
        """,
        (
            product_id,
            condition,
            date_added,
            notes,
        ),
    )

    card_id = cursor.fetchone()["card_id"]

    if owns_connection:
        conn.commit()
        conn.close()

    return card_id

def create_transaction(
    transaction_type,
    transaction_date,
    cash_received=0,
    cash_paid=0,
    notes=None,
    conn=None,
):
    owns_connection = conn is None

    if owns_connection:
        conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO transactions
        (
            transaction_type,
            transaction_date,
            cash_received,
            cash_paid,
            notes
        )
        VALUES (%s, %s, %s, %s, %s)
        RETURNING transaction_id
        """,
        (
            transaction_type,
            transaction_date,
            cash_received,
            cash_paid,
            notes,
        ),
    )

    transaction_id = cursor.fetchone()["transaction_id"]

    if owns_connection:
        conn.commit()
        conn.close()

    return transaction_id

def add_transaction_item(
    transaction_id,
    card_id,
    product_id,
    direction,
    value,
    market_value,
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
            product_id,
            direction,
            value,
            market_value
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            transaction_id,
            card_id,
            product_id,
            direction,
            value,
            market_value
        ),
    )

    if owns_connection:
        conn.commit()
        conn.close()

def save_transaction(transaction):
    conn = get_connection()
    from datetime import date
    from fastapi import HTTPException

    if len(transaction.items) == 0:
        raise HTTPException(
            status_code=400,
            detail="Transaction must contain at least one card."
        )
    if transaction.transaction_date is None:
        transaction.transaction_date = date.today().isoformat()
    try:
        conn.execute("BEGIN")
        # create transaction
        transaction_id = create_transaction(
            transaction.transaction_type,
            transaction.transaction_date,
            transaction.cash_received,
            transaction.cash_paid,
            transaction.notes,
            conn
        )
        for item in transaction.items:

            if item.direction == Direction.IN:

                # New inventory
                card_id = create_card(
                    item.product_id,
                    item.condition,
                    item.notes,
                    conn
                )

            else:

                # Consume existing inventory using FIFO
                card_id = get_oldest_in_stock_card(
                    item.product_id,
                    conn
                )

                if card_id is not None:
                    mark_card_out_of_stock(
                        card_id,
                        conn
                    )
                else:

                    # Card wasn't in tracked inventory.
                    # Create a historical card record, but don't
                    # add it to current inventory.

                    card_id = create_card(
                        item.product_id,
                        cardCondition.NM,
                        "auto-created via sale",
                        conn
                    )

                    mark_card_out_of_stock(
                        card_id,
                        conn
                    )

            add_transaction_item(
                transaction_id,
                card_id,
                item.product_id,
                item.direction,
                item.value,
                item.market_value,
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
    return rows

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
            t.cash_received,
            t.cash_paid

        FROM cards c

        JOIN transaction_items ti
            ON ti.card_id = c.card_id

        JOIN transactions t
            ON t.transaction_id = ti.transaction_id

        WHERE c.in_stock = TRUE

        ORDER BY t.transaction_date DESC;
    """).fetchall()
    conn.close()

    return rows

def get_transactions_by_date(start_date,end_date):
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT
                t.transaction_id,
                t.transaction_type,
                t.transaction_date,
                t.cash_received,
                t.cash_paid,
                t.notes,

                ti.direction,
                ti.value,
                ti.market_value,

                c.product_id,
                c.condition

            FROM transactions t

            JOIN transaction_items ti
                ON t.transaction_id = ti.transaction_id

            JOIN cards c
                ON ti.card_id = c.card_id

            WHERE t.transaction_date BETWEEN %s AND %s

            ORDER BY t.transaction_date DESC,
                    t.transaction_id DESC
            """,
            (start_date, end_date)
        ).fetchall()
        transactions = {}

        for row in rows:
            transaction_id = row["transaction_id"]

            if transaction_id not in transactions:
                transactions[transaction_id] = {
                    "transaction_id": transaction_id,
                    "transaction_type": row["transaction_type"],
                    "transaction_date": row["transaction_date"],
                    "cash_received": row["cash_received"],
                    "cash_paid": row["cash_paid"],
                    "notes": row["notes"],
                    "items": []
                }

            transactions[transaction_id]["items"].append({
                "product_id": row["product_id"],
                "condition": row["condition"],
                "direction": row["direction"],
                "value": row["value"],
                "market_value": row["market_value"]
            })

        return list(transactions.values())

    finally:
        conn.close()

def get_oldest_in_stock_card(product_id, conn):
    row = conn.execute(
        """
        SELECT
            card_id
        FROM cards
        WHERE product_id = %s
          AND in_stock = TRUE
        ORDER BY date_added ASC,
                 card_id ASC
        LIMIT 1
        """,
        (
            product_id,
        )
    ).fetchone()

    if row is None:
        return None

    return row["card_id"]

def mark_card_out_of_stock(card_id, conn):
    conn.execute(
        """
        UPDATE cards
        SET in_stock = FALSE
        WHERE card_id = %s
        """,
        (card_id,)
    )