#!/usr/bin/env python3
"""
Add feature-permission checks to admin API routes.

For each file matching src/app/api/admin/<area>/.../route.ts, replaces
  await requireAdmin()
with
  await requireAdmin({ feature: '<feature_key>' })

Mapping:
  products → products
  categories → categories
  orders → orders
  customers → customers
  drivers → drivers
  employees → employees
  banners → banners
  shifts → shifts
  finance → finance
  expenses → finance
  wastage → wastage
  promotions → promotions
  delivery-zones → delivery_zones
  delivery-map → delivery_zones
  analytics → analytics
  store → settings
  bank-holidays → settings

Skip:
  sessions (admin-only by default, no feature check needed)
  employees/[id]/permissions (OWNER-only check inside route)
  employees/[id]/sessions (admin-only by default)
"""
import os
import re
import sys

BASE = '/home/z/my-project/src/app/api/admin'

# Mapping: first path segment under /api/admin/ → feature key
PATH_TO_FEATURE = {
    'products': 'products',
    'categories': 'categories',
    'orders': 'orders',
    'customers': 'customers',
    'drivers': 'drivers',
    'employees': 'employees',
    'banners': 'banners',
    'shifts': 'shifts',
    'finance': 'finance',
    'expenses': 'finance',
    'wastage': 'wastage',
    'promotions': 'promotions',
    'delivery-zones': 'delivery_zones',
    'delivery-map': 'delivery_zones',
    'analytics': 'analytics',
    'store': 'settings',
    'bank-holidays': 'settings',
}

# Files to skip (no feature check)
SKIP_FILES = {
    'sessions/route.ts',
    'sessions/[id]/route.ts',
    'employees/[id]/permissions/route.ts',
    'employees/[id]/sessions/route.ts',
}

# Pattern to match: `await requireAdmin()` (no arguments)
PATTERN = re.compile(r'await requireAdmin\(\s*\)')

def get_feature_for_file(filepath: str) -> str | None:
    rel = os.path.relpath(filepath, BASE).replace('\\', '/')
    # Skip if in skip list
    if rel in SKIP_FILES:
        return None
    # Get the first path segment
    parts = rel.split('/')
    if not parts:
        return None
    first = parts[0]
    return PATH_TO_FEATURE.get(first)

def process_file(filepath: str) -> int:
    """Replace `await requireAdmin()` with `await requireAdmin({ feature: 'X' })`. Returns count of replacements."""
    feature = get_feature_for_file(filepath)
    if not feature:
        return 0

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'requireAdmin({ feature:' in content:
        # Already processed — skip
        return 0

    replacement = f"await requireAdmin({{ feature: '{feature}' }})"
    new_content, count = PATTERN.subn(replacement, content)

    if count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✓ {filepath} ({count} replacements, feature='{feature}')")
    return count

def main():
    total_files = 0
    total_replacements = 0
    for root, dirs, files in os.walk(BASE):
        for filename in files:
            if filename == 'route.ts':
                filepath = os.path.join(root, filename)
                count = process_file(filepath)
                if count > 0:
                    total_files += 1
                    total_replacements += count
    print(f"\nTotal: {total_files} files updated, {total_replacements} replacements made")

if __name__ == '__main__':
    main()
