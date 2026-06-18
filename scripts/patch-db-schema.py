#!/usr/bin/env python3
"""
Patch the existing SQLite DB at db/custom.db to add missing tables and columns.

This mirrors the runtime migrations in src/lib/auth/prisma.ts so that the
current DB works correctly without waiting for the dev server to restart.

Run:  python3 scripts/patch-db-schema.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'db', 'custom.db')
DB_PATH = os.path.abspath(DB_PATH)

print(f'Patching database at: {DB_PATH}')

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()


def table_exists(name):
    c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return c.fetchone() is not None


def column_exists(table, column):
    c.execute(f'PRAGMA table_info({table})')
    return any(row[1] == column for row in c.fetchall())


def add_column(table, column, type_def):
    if not column_exists(table, column):
        c.execute(f'ALTER TABLE {table} ADD COLUMN {column} {type_def}')
        print(f'  + Added column {table}.{column}')
    else:
        print(f'  = Column {table}.{column} already exists')


def create_table(stmt, name):
    if not table_exists(name):
        c.execute(stmt)
        print(f'  + Created table {name}')
    else:
        print(f'  = Table {name} already exists')


# ─── Add missing tables ────────────────────────────────────────────
print('\n[1] Ensuring tables exist:')

create_table('''
CREATE TABLE "banners" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "title" TEXT,
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "linkCategory" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
)
''', 'banners')

create_table('''
CREATE TABLE "employee_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "salary" REAL,
  "wageRate" REAL,
  "wageType" TEXT,
  "bankName" TEXT,
  "bankAccountNo" TEXT,
  "bankSortCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
)
''', 'employee_profiles')
c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "employee_profiles_userId_key" ON "employee_profiles"("userId")')

# ─── Add missing columns ───────────────────────────────────────────
print('\n[2] Adding missing columns:')

# users
add_column('users', 'mustResetPassword', 'BOOLEAN NOT NULL DEFAULT 0')

# stores
add_column('stores', 'logoUrl', 'TEXT')
add_column('stores', 'defaultBanner1Url', 'TEXT')
add_column('stores', 'defaultBanner2Url', 'TEXT')

# products
add_column('products', 'originalPrice', 'REAL')
add_column('products', 'images', 'TEXT')
add_column('products', 'brand', 'TEXT')
add_column('products', 'rating', 'REAL NOT NULL DEFAULT 0')
add_column('products', 'reviewCount', 'INTEGER NOT NULL DEFAULT 0')
add_column('products', 'expiryDate', 'DATETIME')
add_column('products', 'bestBeforeDate', 'DATETIME')

# shifts
add_column('shifts', 'manualHours', 'REAL')

# orders
add_column('orders', 'promotionId', 'TEXT')
add_column('orders', 'discountAmount', 'REAL NOT NULL DEFAULT 0')
add_column('orders', 'bankTransferRef', 'TEXT')
add_column('orders', 'bankTransferVerified', 'BOOLEAN NOT NULL DEFAULT 0')
add_column('orders', 'deliveryPhotoUrl', 'TEXT')
add_column('orders', 'batchGroup', 'TEXT')
add_column('orders', 'packedAt', 'DATETIME')
add_column('orders', 'dispatchedAt', 'DATETIME')
add_column('orders', 'deliveredAt', 'DATETIME')
add_column('orders', 'hasChallenge25', 'BOOLEAN NOT NULL DEFAULT 0')
add_column('orders', 'challenge25Verified', 'BOOLEAN NOT NULL DEFAULT 0')

# order_items
add_column('order_items', 'picked', 'BOOLEAN NOT NULL DEFAULT 0')

# ─── Verify ────────────────────────────────────────────────────────
print('\n[3] Verifying:')
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
all_tables = [r[0] for r in c.fetchall()]
print(f'  Tables ({len(all_tables)}): {all_tables}')

for t in ['users', 'products', 'stores', 'shifts', 'banners', 'employee_profiles', 'orders', 'order_items']:
    c.execute(f'PRAGMA table_info({t})')
    cols = [r[1] for r in c.fetchall()]
    print(f'  {t}.columns: {cols}')

conn.commit()
conn.close()

print('\nDone. Database patched successfully.')
