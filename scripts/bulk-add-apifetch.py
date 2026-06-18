#!/usr/bin/env python3
"""
Bulk-update admin/customer/driver/picker pages to use apiFetch (auto-redirect on 401).

Pattern:
  - Add `import { apiFetch } from '@/lib/api-fetch'` after the last existing import
  - Replace `fetch(` with `apiFetch(` ONLY in URL positions (not in HTML attribute fetch)
  - Wrap catch blocks that show toasts so that the toast is skipped when the error
    message is 'Session expired — redirecting to login'

This is conservative — only converts files in the explicit allowlist below.
"""
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project')

# Files to update — these are admin pages + driver/picker/customer pages that
# have client-side fetches and would benefit from auto-redirect-on-401.
FILES = [
    # Admin pages
    'src/app/admin/customers/page.tsx',
    'src/app/admin/drivers/page.tsx',
    'src/app/admin/employees/page.tsx',
    'src/app/admin/orders/page.tsx',
    'src/app/admin/banners/page.tsx',
    'src/app/admin/promotions/page.tsx',
    'src/app/admin/delivery-zones/page.tsx',
    'src/app/admin/analytics/page.tsx',
    # Admin components
    'src/components/admin/wastage-client.tsx',
    'src/components/admin/finance-client.tsx',
    'src/components/admin/kanban-order-board.tsx',
    'src/components/admin/low-stock-alerts.tsx',
    'src/components/admin/bank-holiday-manager.tsx',
    'src/components/admin/notification-editor.tsx',
    'src/components/admin/store-status-manager.tsx',
    'src/components/admin/store-profile-editor.tsx',
    'src/components/admin/csv-import-export.tsx',
    # Customer pages
    'src/components/customer/home-client.tsx',
    'src/components/customer/orders-client.tsx',
    'src/components/customer/favourites-client.tsx',
    'src/components/customer/addresses-client.tsx',
    'src/components/customer/notifications-client.tsx',
    'src/components/customer/banner-carousel.tsx',
    'src/components/customer/checkout-client.tsx',
    # Driver pages
    'src/components/driver/driver-dashboard-client.tsx',
    'src/components/driver/driver-order-flow-client.tsx',
    'src/components/driver/driver-earnings-client.tsx',
    'src/components/driver/driver-profile-client.tsx',
    # Picker pages
    'src/components/picker/picker-dashboard-client.tsx',
    'src/components/picker/picker-packing-client.tsx',
    'src/components/picker/picker-profile-client.tsx',
]

IMPORT_LINE = "import { apiFetch } from '@/lib/api-fetch'"

def add_import(content: str) -> str:
    """Add the apiFetch import if not present."""
    if IMPORT_LINE in content:
        return content
    # Find the last `import ... from '...'` line at the top of the file
    # and insert our import after it.
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if re.match(r"^import\s+", line):
            # Could be a multi-line import — find the closing ' from "..."\''
            if "from '" in line or 'from "' in line:
                last_import_idx = i
            else:
                # Scan forward to find the closing
                j = i
                while j < len(lines):
                    if "from '" in lines[j] or 'from "' in lines[j]:
                        last_import_idx = j
                        break
                    j += 1
    if last_import_idx == -1:
        # No imports — insert at the very top after 'use client'
        for i, line in enumerate(lines):
            if line.startswith("'use client'") or line.startswith('"use client"'):
                lines.insert(i + 1, '')
                lines.insert(i + 2, IMPORT_LINE)
                return '\n'.join(lines)
        lines.insert(0, IMPORT_LINE)
        return '\n'.join(lines)
    lines.insert(last_import_idx + 1, IMPORT_LINE)
    return '\n'.join(lines)


def replace_fetch_calls(content: str) -> tuple[str, int]:
    """Replace `fetch(` with `apiFetch(` for fetch calls that hit /api/ URLs.
    Returns (new_content, replacement_count).
    """
    # Match `fetch(` or `fetch (` where the URL on the next chars contains /api/
    # Simplest approach: replace `await fetch(` -> `await apiFetch(` and `= fetch(` -> `= apiFetch(`
    # and `\n      fetch(` -> `\n      apiFetch(`
    # We avoid `window.fetch` or other special cases.
    count = 0
    # Replace any standalone fetch() call that has /api/ in its first argument
    # Match patterns: fetch(`.../api/...`), fetch('.../api/...'), fetch(".../api/...")
    # Also fetch(`/api/...`)
    # And fetch(`${...}/api/...)
    def repl(m):
        nonlocal count
        count += 1
        return m.group(1) + 'apiFetch(' + m.group(2)

    # Pattern 1: `await fetch(`/api/...`)`
    # We just match `fetch(` preceded by whitespace or = or ( and followed by a backtick or quote
    # containing /api/ in the first 200 chars.
    # Simpler: replace `fetch(`/api` -> `apiFetch(`/api` and similar for quote/double-quote variants.
    new_content = content

    # Pattern: fetch(`/api  → apiFetch(`/api
    new_content, n1 = re.subn(r'(?:^|[\s=(,])fetch\(`(/api)', lambda m: m.group(0).replace('fetch(', 'apiFetch('), new_content)
    count += n1

    # Pattern: fetch('/api  → apiFetch('/api
    new_content, n2 = re.subn(r"(?:^|[\s=(,])fetch\('(/api)", lambda m: m.group(0).replace('fetch(', 'apiFetch('), new_content)
    count += n2

    # Pattern: fetch("/api  → apiFetch("/api
    new_content, n3 = re.subn(r'(?:^|[\s=(,])fetch\("(/api)', lambda m: m.group(0).replace('fetch(', 'apiFetch('), new_content)
    count += n3

    # Pattern: fetch(`${...}/api  → apiFetch(`${...}/api
    new_content, n4 = re.subn(r'(?:^|[\s=(,])fetch\(`\$\{[^}]+\}(/api)', lambda m: m.group(0).replace('fetch(', 'apiFetch('), new_content)
    count += n4

    return new_content, count


def update_toast_catches(content: str) -> str:
    """Update catch blocks so toasts are not shown for 401-redirect errors.

    Pattern:
      } catch {
        toast.error('...')
      }

    Becomes:
      } catch (err: any) {
        if (err?.message !== 'Session expired — redirecting to login') {
          toast.error('...')
        }
      }
    """
    # Match `} catch {\n      toast.error('...')\n    }` (with consistent indentation)
    # Use a non-greedy match for the toast line.
    pattern = re.compile(
        r"(\s*)\} catch \{\n(\s*)toast\.error\(('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\")\)\n\s*\}",
        re.MULTILINE,
    )

    def repl(m):
        indent = m.group(1)
        inner_indent = m.group(2)
        toast_arg = m.group(3)
        return (
            f"{indent}}} catch (err: any) {{\n"
            f"{inner_indent}if (err?.message !== 'Session expired — redirecting to login') {{\n"
            f"{inner_indent}  toast.error({toast_arg})\n"
            f"{inner_indent}}}\n"
            f"{indent}}}"
        )

    return pattern.sub(repl, content)


def update_toast_catches_with_err(content: str) -> str:
    """Same as above but for `catch (err: any) {` blocks that already exist."""
    pattern = re.compile(
        r"(\s*)\} catch \(err: any\) \{\n(\s*)toast\.error\((err\.message \|\| '(?:[^'\\]|\\.)*'|err\.message \|\| \"(?:[^\"\\]|\\.)*\")\)\n\s*\}",
        re.MULTILINE,
    )

    def repl(m):
        indent = m.group(1)
        inner_indent = m.group(2)
        toast_arg = m.group(3)
        return (
            f"{indent}}} catch (err: any) {{\n"
            f"{inner_indent}if (err?.message !== 'Session expired — redirecting to login') {{\n"
            f"{inner_indent}  toast.error({toast_arg})\n"
            f"{inner_indent}}}\n"
            f"{indent}}}"
        )

    return pattern.sub(repl, content)


def process_file(path: Path) -> tuple[bool, str]:
    """Process a single file. Returns (changed, summary)."""
    if not path.exists():
        return False, f'SKIP (not found): {path}'

    content = path.read_text()
    original = content

    # 1. Add the import
    content = add_import(content)

    # 2. Replace fetch calls
    content, fetch_count = replace_fetch_calls(content)

    # 3. Update toast error catch blocks
    content = update_toast_catches(content)
    content = update_toast_catches_with_err(content)

    if content == original:
        return False, f'NO CHANGE: {path}'

    path.write_text(content)
    return True, f'UPDATED: {path} ({fetch_count} fetch calls converted)'


def main():
    total_changed = 0
    total_unchanged = 0
    for rel in FILES:
        path = ROOT / rel
        changed, msg = process_file(path)
        if changed:
            total_changed += 1
        else:
            total_unchanged += 1
        print(msg)
    print()
    print(f'Total: {total_changed} changed, {total_unchanged} unchanged')


if __name__ == '__main__':
    main()
