#!/usr/bin/env python3
"""
Update /api/driver/* and /api/picker/* API routes to use the new
requireDriver / requirePicker guards with feature-permission checks.

Each route file currently has the pattern:
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (user.role.toLowerCase() !== 'driver') {   // or 'picker'
      return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
    }

We replace this with:
    const { error, user } = await requireDriver({ feature: '<feature_key>' })
    if (error) return error

And update the import line accordingly.

The feature key is determined by the file path:
  /api/driver/profile/*    → driver_profile
  /api/driver/earnings/*   → driver_earnings
  /api/driver/orders/*     → driver_dashboard
  /api/driver/*            → driver_dashboard
  /api/picker/profile/*    → picker_profile
  /api/picker/orders/*     → picker_packing
  /api/picker/*            → picker_dashboard
"""
import os
import re

DRIVER_BASE = '/home/z/my-project/src/app/api/driver'
PICKER_BASE = '/home/z/my-project/src/app/api/picker'

def get_driver_feature(filepath: str) -> str:
    rel = os.path.relpath(filepath, DRIVER_BASE).replace('\\', '/')
    if rel.startswith('profile'):
        return 'driver_profile'
    if rel.startswith('earnings'):
        return 'driver_earnings'
    return 'driver_dashboard'

def get_picker_feature(filepath: str) -> str:
    rel = os.path.relpath(filepath, PICKER_BASE).replace('\\', '/')
    if rel.startswith('profile'):
        return 'picker_profile'
    if rel.startswith('orders') or rel.startswith('packing'):
        return 'picker_packing'
    return 'picker_dashboard'

# Pattern: matches the auth+role block in driver routes
DRIVER_AUTH_BLOCK = re.compile(
    r"const user = await getServerUser\(\)\s*\n"
    r"\s*if \(!user\) \{\s*\n"
    r"\s*return NextResponse\.json\(\{ error: 'Authentication required' \}, \{ status: 401 \}\)\s*\n"
    r"\s*\}\s*\n"
    r"\s*if \(user\.role\.toLowerCase\(\) !== 'driver'\) \{\s*\n"
    r"\s*return NextResponse\.json\(\{ error: 'Forbidden — driver role required' \}, \{ status: 403 \}\)\s*\n"
    r"\s*\}",
    re.MULTILINE
)

PICKER_AUTH_BLOCK = re.compile(
    r"const user = await getServerUser\(\)\s*\n"
    r"\s*if \(!user\) \{\s*\n"
    r"\s*return NextResponse\.json\(\{ error: 'Authentication required' \}, \{ status: 401 \}\)\s*\n"
    r"\s*\}\s*\n"
    r"\s*if \(user\.role\.toLowerCase\(\) !== 'picker'\) \{\s*\n"
    r"\s*return NextResponse\.json\(\{ error: 'Forbidden — picker role required' \}, \{ status: 403 \}\)\s*\n"
    r"\s*\}",
    re.MULTILINE
)

def process_driver_file(filepath: str) -> int:
    feature = get_driver_feature(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'requireDriver' in content:
        return 0  # Already processed

    new_content, count = DRIVER_AUTH_BLOCK.subn(
        f"const {{ error, user }} = await requireDriver({{ feature: '{feature}' }})\n"
        f"  if (error) return error",
        content
    )

    if count > 0:
        # Update imports: remove getServerUser, add requireDriver
        new_content = new_content.replace(
            "import { getServerUser } from '@/lib/auth/server'",
            "import { requireDriver } from '@/lib/feature-permissions'"
        )
        # If the file didn't have that exact import line, try alternative
        if "getServerUser" in new_content and "requireDriver" not in new_content.split('\n', 30)[0:30].__str__():
            # Add the import at the top
            lines = new_content.split('\n')
            # Find the last import line
            last_import_idx = 0
            for i, line in enumerate(lines[:20]):
                if line.startswith('import '):
                    last_import_idx = i
            lines.insert(last_import_idx + 1, "import { requireDriver } from '@/lib/feature-permissions'")
            new_content = '\n'.join(lines)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✓ {filepath} (feature='{feature}', {count} replacements)")
    else:
        print(f"  ⚠ {filepath} — pattern not matched (manual review needed)")
    return count

def process_picker_file(filepath: str) -> int:
    feature = get_picker_feature(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'requirePicker' in content:
        return 0  # Already processed

    new_content, count = PICKER_AUTH_BLOCK.subn(
        f"const {{ error, user }} = await requirePicker({{ feature: '{feature}' }})\n"
        f"  if (error) return error",
        content
    )

    if count > 0:
        new_content = new_content.replace(
            "import { getServerUser } from '@/lib/auth/server'",
            "import { requirePicker } from '@/lib/feature-permissions'"
        )
        if "getServerUser" in new_content and "requirePicker" not in new_content.split('\n', 30)[0:30].__str__():
            lines = new_content.split('\n')
            last_import_idx = 0
            for i, line in enumerate(lines[:20]):
                if line.startswith('import '):
                    last_import_idx = i
            lines.insert(last_import_idx + 1, "import { requirePicker } from '@/lib/feature-permissions'")
            new_content = '\n'.join(lines)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✓ {filepath} (feature='{feature}', {count} replacements)")
    else:
        print(f"  ⚠ {filepath} — pattern not matched (manual review needed)")
    return count

def main():
    print("Processing driver routes:")
    for root, dirs, files in os.walk(DRIVER_BASE):
        for filename in files:
            if filename == 'route.ts':
                filepath = os.path.join(root, filename)
                process_driver_file(filepath)

    print("\nProcessing picker routes:")
    for root, dirs, files in os.walk(PICKER_BASE):
        for filename in files:
            if filename == 'route.ts':
                filepath = os.path.join(root, filename)
                process_picker_file(filepath)

if __name__ == '__main__':
    main()
