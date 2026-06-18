#!/usr/bin/env python3
"""
Second-pass bulk update — catches files missed by the first script.

Adds the apiFetch import and converts fetch() calls that:
- Use a variable URL (e.g., fetch(url))
- Use a template literal with /api/ somewhere other than the start
"""
import re
from pathlib import Path

ROOT = Path('/home/z/my-project')

FILES = [
    'src/components/customer/order-tracking-client.tsx',
    'src/components/customer/predictive-search.tsx',
    'src/components/customer/cross-sell-slider.tsx',
    'src/components/customer/product-detail-client.tsx',
    'src/components/admin/delivery-map.tsx',
    'src/components/admin/shifts-client.tsx',
    'src/components/admin/admin-settings-client.tsx',
    'src/components/admin/admin-dashboard-client.tsx',
    'src/app/admin/delivery-zones/page.tsx',
    'src/app/admin/banners/page.tsx',
    'src/app/admin/promotions/page.tsx',
]

IMPORT_LINE = "import { apiFetch } from '@/lib/api-fetch'"


def add_import(content: str) -> str:
    if IMPORT_LINE in content:
        return content
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if re.match(r"^import\s+", line):
            if "from '" in line or 'from "' in line:
                last_import_idx = i
            else:
                j = i
                while j < len(lines):
                    if "from '" in lines[j] or 'from "' in lines[j]:
                        last_import_idx = j
                        break
                    j += 1
    if last_import_idx == -1:
        for i, line in enumerate(lines):
            if line.startswith("'use client'") or line.startswith('"use client"'):
                lines.insert(i + 1, '')
                lines.insert(i + 2, IMPORT_LINE)
                return '\n'.join(lines)
        lines.insert(0, IMPORT_LINE)
        return '\n'.join(lines)
    lines.insert(last_import_idx + 1, IMPORT_LINE)
    return '\n'.join(lines)


def replace_all_fetch(content: str) -> tuple[str, int]:
    """Replace any `fetch(` with `apiFetch(` that's NOT preceded by `api` (i.e., not already `apiFetch(`)."""
    count = 0
    # Use a capturing group for the preceding char so we can reconstruct
    # Pattern: any non-word, non-dot char OR start-of-string, followed by 'fetch('
    # Then we replace with the captured char + 'apiFetch('
    pattern = re.compile(r'(^|[^A-Za-z0-9_.])fetch\(', re.MULTILINE)

    def repl(m):
        nonlocal count
        count += 1
        return m.group(1) + 'apiFetch('

    new_content, n = pattern.subn(repl, content)
    return new_content, n


def update_toast_catches(content: str) -> str:
    """Same catch-block update as the first script."""
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


def process_file(path: Path) -> tuple[bool, str]:
    if not path.exists():
        return False, f'SKIP (not found): {path}'

    content = path.read_text()
    original = content

    content = add_import(content)
    content, fetch_count = replace_all_fetch(content)
    content = update_toast_catches(content)

    if content == original:
        return False, f'NO CHANGE: {path}'

    path.write_text(content)
    return True, f'UPDATED: {path} ({fetch_count} fetch calls converted)'


def main():
    total_changed = 0
    for rel in FILES:
        path = ROOT / rel
        changed, msg = process_file(path)
        if changed:
            total_changed += 1
        print(msg)
    print(f'\nTotal: {total_changed} changed')


if __name__ == '__main__':
    main()
