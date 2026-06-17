"""
Fresh Mart London — Features & Security Overview (short PDF, memo-style, no cover)
3 pages: Customer features | Admin/Staff + Tech Stack | Security + Roadmap
"""
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable, PageBreak,
)

# ─── Font registration ────────────────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'
# Noto Serif SC (kept as CJK fallback, even though this PDF is English-only)
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

# English sans-serif for headings
pdfmetrics.registerFont(TTFont('FreeSans', f'{FONT_DIR}/truetype/freefont/FreeSans.ttf'))
pdfmetrics.registerFont(TTFont('FreeSans-Bold', f'{FONT_DIR}/truetype/freefont/FreeSansBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSans-Italic', f'{FONT_DIR}/truetype/freefont/FreeSansOblique.ttf'))
registerFontFamily('FreeSans', normal='FreeSans', bold='FreeSans-Bold', italic='FreeSans-Italic')

# English serif for body
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic')

# ─── Cascade Palette (auto-generated) ─────────────────────────────────────
PAGE_BG       = colors.HexColor('#f6f6f5')
SECTION_BG    = colors.HexColor('#ededeb')
CARD_BG       = colors.HexColor('#efeeed')
TABLE_STRIPE  = colors.HexColor('#f2f2f1')
HEADER_FILL   = colors.HexColor('#5f573f')
COVER_BLOCK   = colors.HexColor('#615b48')
BORDER        = colors.HexColor('#cdc9bf')
ICON          = colors.HexColor('#897842')
ACCENT        = colors.HexColor('#907422')
ACCENT_2      = colors.HexColor('#5533ba')
TEXT_PRIMARY  = colors.HexColor('#272624')
TEXT_MUTED    = colors.HexColor('#8d8b83')
SEM_SUCCESS   = colors.HexColor('#538e67')
SEM_WARNING   = colors.HexColor('#91753f')
SEM_ERROR     = colors.HexColor('#a34941')
SEM_INFO      = colors.HexColor('#577a9c')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ─── Page geometry ────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
LEFT_MARGIN   = 18 * mm
RIGHT_MARGIN  = 18 * mm
TOP_MARGIN    = 18 * mm
BOTTOM_MARGIN = 18 * mm
CONTENT_WIDTH = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN  # ≈ 174 mm

OUTPUT_PATH = '/home/z/my-project/download/fresh-mart-features-overview.pdf'

# ─── Styles ───────────────────────────────────────────────────────────────
H1 = ParagraphStyle(
    name='H1', fontName='FreeSans-Bold', fontSize=20, leading=24,
    textColor=HEADER_FILL, spaceBefore=0, spaceAfter=4, alignment=TA_LEFT,
)
SUBTITLE = ParagraphStyle(
    name='Subtitle', fontName='FreeSerif-Italic', fontSize=10, leading=13,
    textColor=TEXT_MUTED, spaceAfter=10, alignment=TA_LEFT,
)
H2 = ParagraphStyle(
    name='H2', fontName='FreeSans-Bold', fontSize=13, leading=17,
    textColor=HEADER_FILL, spaceBefore=12, spaceAfter=6, alignment=TA_LEFT,
)
BODY = ParagraphStyle(
    name='Body', fontName='FreeSerif', fontSize=10, leading=14,
    textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY,
)
TABLE_HEADER_STYLE = ParagraphStyle(
    name='TableHeader', fontName='FreeSans-Bold', fontSize=9.5, leading=12,
    textColor=colors.white, alignment=TA_LEFT,
)
TABLE_CELL_STYLE = ParagraphStyle(
    name='TableCell', fontName='FreeSerif', fontSize=9.2, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
TABLE_CELL_BOLD = ParagraphStyle(
    name='TableCellBold', fontName='FreeSerif-Bold', fontSize=9.2, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
BULLET = ParagraphStyle(
    name='Bullet', fontName='FreeSerif', fontSize=9.5, leading=13,
    textColor=TEXT_PRIMARY, leftIndent=12, bulletIndent=2, spaceAfter=2,
    alignment=TA_LEFT,
)
FOOTER_STYLE = ParagraphStyle(
    name='Footer', fontName='FreeSerif-Italic', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)

# ─── Helpers ──────────────────────────────────────────────────────────────
def hr(color=BORDER, thickness=0.5, space_before=2, space_after=6):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceBefore=space_before, spaceAfter=space_after)

def features_table(rows, col_ratio=(0.30, 0.70)):
    """Build a 2-column features table. rows = list[(feature_name, description)]."""
    header = [
        Paragraph('Feature', TABLE_HEADER_STYLE),
        Paragraph('Details', TABLE_HEADER_STYLE),
    ]
    data = [header]
    for name, desc in rows:
        data.append([
            Paragraph(f'<b>{name}</b>', TABLE_CELL_BOLD),
            Paragraph(desc, TABLE_CELL_STYLE),
        ])
    col_widths = [CONTENT_WIDTH * r for r in col_ratio]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, HEADER_FILL),
        ('BOX', (0, 0), (-1, -1), 0.3, BORDER),
        ('INNERGRID', (0, 1), (-1, -1), 0.2, BORDER),
    ]
    # Row striping
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 1 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif-Italic', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 10 * mm,
        f'Fresh Mart London — Features & Security Overview  ·  Page {doc.page}')
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.3)
    canvas.line(LEFT_MARGIN, 14 * mm, PAGE_W - RIGHT_MARGIN, 14 * mm)
    canvas.restoreState()

# ─── Story ────────────────────────────────────────────────────────────────
story = []

# Title block (memo-style, no separate cover)
story.append(Paragraph('Fresh Mart London', H1))
story.append(Paragraph('Features &amp; Security Overview — Internal Reference', SUBTITLE))
story.append(hr(color=HEADER_FILL, thickness=1.2, space_before=0, space_after=10))

# Project Overview
story.append(Paragraph('Project Overview', H2))
story.append(Paragraph(
    'Fresh Mart London is a full-stack grocery delivery platform built on Next.js 16 with a '
    'Prisma-managed database. The codebase serves three distinct user surfaces — customer storefront, '
    'admin/owner back office, and staff (picker/driver) dashboards — all behind a single unified '
    'authentication system. The platform models a real UK convenience store: products with VAT and '
    'HFSS flags, age-restricted items requiring Challenge 25 verification, postcode-based delivery '
    'zones, promotions with category exclusions, driver verification workflows, and staff shift / '
    'attendance tracking. This document summarises the functional and security surface area as of '
    'the current build.',
    BODY,
))

# Customer features
story.append(Paragraph('Customer-Side Functional Features', H2))
customer_rows = [
    ('Authentication', 'Email/password registration and login, Google OAuth, password reset, role baked into HMAC-signed session token at login time.'),
    ('Catalogue Browse', 'Real DB-driven home page with banners, featured products, category navigation, search by name/brand/barcode, product detail page with image gallery and substitute suggestions.'),
    ('Favourites', 'Per-user favourite list with quick re-add to cart; stored against authenticated user, not local-only.'),
    ('Cart &amp; Live Pricing', 'Persistent cart sidebar with live delivery fee calculation based on store settings (base fee, per-km charge, free-delivery threshold), promo code validation, subtotal/VAT/total breakdown.'),
    ('Address Management', 'CRUD on saved addresses with postcode, lat/lng, default flag; addresses used at checkout for delivery zone enforcement.'),
    ('Checkout &amp; Payments', 'Stripe checkout integration, cash on delivery, bank transfer with manual verification workflow; Challenge 25 flag auto-set when basket contains age-restricted items.'),
    ('Order Tracking', 'Order history with status pipeline (placed → picking → ready → out_for_delivery → delivered / cancelled), reorder shortcut, delivery photo URL, notification feed.'),
    ('Notifications', 'In-app notification centre fed by order status changes, promotions, and system messages; mark-as-read and unread badge.'),
]
story.append(features_table(customer_rows))

story.append(PageBreak())

# Admin/Staff features
story.append(Paragraph('Admin &amp; Staff Functional Features', H2))
admin_rows = [
    ('Owner Dashboard', 'KPI overview, low-stock alerts, recent orders, attendance summary; restricted to OWNER and MANAGER roles via middleware.'),
    ('Product Management', 'Full CRUD with image upload, barcode, brand, VAT rate, HFSS flag, age restriction (Challenge 25), minimum age, aisle, stock threshold, substitute product link; CSV import/export.'),
    ('Categories', 'Hierarchical category tree with parent/child, sort order, image, active flag; slug uniqueness enforced per store.'),
    ('Order Management', 'List with status filter, order detail with item-level picked flag, refund action, driver assignment, batch grouping by postcode.'),
    ('Customers', 'Customer list with order history, contact details, account active toggle.'),
    ('Delivery Zones', 'Postcode-prefix zones (e.g. SE1, SE2) with per-zone delivery fee and minimum order value; enforced server-side at checkout.'),
    ('Promotions', 'Percentage or fixed-amount discounts, start/end dates, usage limits, minimum order value, category scoping, optional HFSS exclusion, promo code redemption.'),
    ('Drivers', 'Driver list with verification status (pending/approved/rejected), vehicle type/reg, right-to-work and licence document URLs, rejection reason.'),
    ('Picker Dashboard', 'Picker-scoped order queue, item-level pick confirmation, substitute application per customer preference (closest_match / do_not_substitute).'),
    ('Staff &amp; Shifts', 'Employee profiles with wage type/rate, bank details; shift scheduling by role; clock-in/out attendance logs with IP and geolocation.'),
    ('Wastage Logging', 'Per-product wastage entries with reason (expired/damaged/spoiled/other), quantity, notes, logged-by user.'),
    ('Finance &amp; Expenses', 'Expense ledger with category (electricity/rent/packaging/fuel/other), amount, date, receipt image; revenue analytics.'),
    ('Banners', 'Homepage carousel management with image, link URL or category slug, sort order, active flag.'),
    ('Store Settings', 'Owner-editable store name, address, lat/lng, phone, email, opening hours JSON, bank holiday mode (auto_close / reduced_hours / normal), delivery radius, base fee, per-km charge, free-delivery threshold.'),
    ('Analytics', 'Sales trends, top products, category breakdown, peak hours, customer acquisition metrics.'),
]
story.append(features_table(admin_rows))

# Tech Stack
story.append(Paragraph('Tech Stack', H2))
story.append(Paragraph(
    'The platform is a Next.js 16 application running on the App Router with React 19 Server '
    'Components. Tailwind CSS provides styling, shadcn/ui supplies accessible primitives, and '
    'Sonner handles toast notifications. Data access is via Prisma ORM against SQLite in '
    'development and a managed PostgreSQL in production. Authentication is fully local '
    '(HMAC-signed session cookies) — no third-party auth provider. Edge Runtime middleware '
    'enforces route-level role checks. Stripe powers card payments. The codebase is deploy-ready '
    'for Vercel serverless with auto-creating SQLite schema on cold start.',
    BODY,
))

story.append(PageBreak())

# Security features
story.append(Paragraph('Security Features', H2))
security_rows = [
    ('Single Auth System', 'HMAC-signed session tokens issued at login. Supabase Auth was removed; no dual-auth conflict. One token, one source of truth.'),
    ('Role-Based Access', 'Five roles baked into the token: CUSTOMER, DRIVER, PICKER, MANAGER, OWNER. Edge middleware inspects role claim before allowing /admin/* or /api/admin/* routes.'),
    ('Edge Runtime Middleware', 'Runs on every request; cannot use Node crypto. Role utilities live in a separate edge-safe module (roles.ts) to avoid importing Node deps.'),
    ('Password Hashing', 'Server-side password hashing via Node.js crypto.scrypt before storage in users.passwordHash. Plaintext never logged.'),
    ('Session Expiry', 'Tokens carry an issued-at and expiry; middleware rejects expired tokens and forces re-login. No long-lived refresh tokens in current build.'),
    ('Admin API Protection', 'Every /api/admin/* route verifies the caller is OWNER or MANAGER. Customer routes (/api/user/*) require an authenticated session; cross-user access is rejected.'),
    ('No Mock Data Leakage', 'Customer-facing queries (queries.ts) return empty arrays/null when DB is unreachable — no fake products, no fallback categories. Production shows only what the owner has uploaded.'),
    ('Environment Variable Isolation', 'Server-only secrets (DATABASE_URL, STRIPE_SECRET_KEY, HMAC secret) are never exposed to the client bundle. NEXT_PUBLIC_* prefix reserved for genuinely public values.'),
    ('Delivery Zone Enforcement', 'Server-side postcode check at checkout against active DeliveryZone rows. Customer cannot bypass by client-side tampering.'),
    ('Challenge 25 Verification', 'Orders containing age-restricted products carry hasChallenge25=true. Driver confirms challenge25Verified at delivery — auditable trail in order record.'),
    ('Bank Transfer Verification', 'Manual owner verification workflow: bankTransferRef stored on order, bankTransferVerified flag set by owner after confirming receipt. Prevents premature fulfilment.'),
    ('Driver Verification', 'Right-to-work, driving licence, and national insurance number captured at onboarding; verificationStatus gates order assignment.'),
    ('Attendance Audit Trail', 'Clock-in/out logs include IP address and lat/lng, providing a tamper-evident staff attendance record for payroll disputes.'),
]
story.append(features_table(security_rows))

# Pending roadmap
story.append(Paragraph('Pending Roadmap', H2))
story.append(Paragraph(
    'The following items are tracked in the active worklog but not yet implemented:',
    BODY,
))
roadmap_items = [
    '<b>Geolocation-based delivery zone:</b> Browser Geolocation API on customer login, Haversine distance from store lat/lng, customer-side "within radius" check, owner-editable radius in km.',
    '<b>Manual postcode entry fallback:</b> Geocode customer-entered postcode/address to lat/lng; if within radius, allow delivery even when device location is outside radius; if outside, block checkout.',
    '<b>Mobile responsiveness audit:</b> Customer storefront layout, cart sidebar, and admin tables need mobile breakpoints verified end-to-end.',
    '<b>Requirements gap analysis:</b> 36 items from the UK grocery delivery compliance PDF still need implementation review (see UK_GROCERY_DELIVERY_APP_LEGAL_COMPLIANCE.md).',
    '<b>Cloud DB migration:</b> Move from local SQLite to Vercel Postgres (or equivalent) for production persistence across serverless instances.',
    '<b>Production monitoring:</b> Error tracking (Sentry), uptime checks, and DB query performance monitoring are not yet wired in.',
]
for item in roadmap_items:
    story.append(Paragraph(f'• {item}', BULLET))

# ─── Build ────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
    title='Fresh Mart London — Features & Security Overview',
    author='Z.ai',
    subject='Functional and security feature summary for the Fresh Mart London grocery delivery platform',
    creator='Z.ai',
)
doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)

# Stats
size_kb = os.path.getsize(OUTPUT_PATH) / 1024
print(f'OK  {OUTPUT_PATH}  ({size_kb:.1f} KB)')
