#!/usr/bin/env python3
"""Generate UK Grocery Store 6 Pre-Coding Documents as PDF using ReportLab."""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('WenQuanYi', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Color Palette ──
PAGE_BG       = colors.HexColor('#f3f3f1')
SECTION_BG    = colors.HexColor('#ebebe9')
CARD_BG       = colors.HexColor('#eeede9')
TABLE_STRIPE  = colors.HexColor('#f2f1ef')
HEADER_FILL   = colors.HexColor('#7b6e48')
COVER_BLOCK   = colors.HexColor('#655f4e')
BORDER        = colors.HexColor('#cfcbbf')
ACCENT        = colors.HexColor('#297189')
ACCENT_2      = colors.HexColor('#39bd39')
TEXT_PRIMARY   = colors.HexColor('#272724')
TEXT_MUTED     = colors.HexColor('#807d76')
SEM_SUCCESS   = colors.HexColor('#3e8e59')
SEM_WARNING   = colors.HexColor('#a38342')
SEM_ERROR     = colors.HexColor('#8d4e48')
SEM_INFO      = colors.HexColor('#466d93')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_M = RIGHT_M = 0.9 * inch
TOP_M = BOTTOM_M = 0.8 * inch
AVAIL_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
styles = getSampleStyleSheet()

s_title = ParagraphStyle('DocTitle', fontName='LiberationSerif', fontSize=28, leading=34,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=12, spaceBefore=6)
s_h1 = ParagraphStyle('H1', fontName='LiberationSerif', fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10)
s_h2 = ParagraphStyle('H2', fontName='LiberationSerif', fontSize=15, leading=20,
    textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8)
s_h3 = ParagraphStyle('H3', fontName='LiberationSerif', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6)
s_body = ParagraphStyle('Body', fontName='LiberationSerif', fontSize=10.5, leading=16,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6)
s_body_left = ParagraphStyle('BodyLeft', fontName='LiberationSerif', fontSize=10.5, leading=16,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=4)
s_bullet = ParagraphStyle('Bullet', fontName='LiberationSerif', fontSize=10.5, leading=16,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, leftIndent=20, spaceAfter=3,
    bulletIndent=8, bulletFontSize=10)
s_verify = ParagraphStyle('Verify', fontName='LiberationSerif', fontSize=10.5, leading=16,
    alignment=TA_JUSTIFY, textColor=SEM_ERROR, spaceAfter=6)
s_th = ParagraphStyle('TH', fontName='LiberationSerif', fontSize=10, leading=13,
    alignment=TA_CENTER, textColor=colors.white)
s_td = ParagraphStyle('TD', fontName='LiberationSerif', fontSize=9.5, leading=13,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY)
s_td_c = ParagraphStyle('TDC', fontName='LiberationSerif', fontSize=9.5, leading=13,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY)
s_caption = ParagraphStyle('Caption', fontName='LiberationSerif', fontSize=9, leading=12,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=12)
s_toc_h1 = ParagraphStyle('TOCH1', fontName='LiberationSerif', fontSize=13, leading=20, leftIndent=20)
s_toc_h2 = ParagraphStyle('TOCH2', fontName='LiberationSerif', fontSize=11, leading=18, leftIndent=40)

# ── Helper Functions ──
def P(text, style=s_body):
    return Paragraph(text, style)

def H1(text):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), s_h1)
    p.bookmark_name = text; p.bookmark_level = 0; p.bookmark_text = text; p.bookmark_key = key
    return p

def H2(text):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), s_h2)
    p.bookmark_name = text; p.bookmark_level = 1; p.bookmark_text = text; p.bookmark_key = key
    return p

def H3(text): return Paragraph(text, s_h3)
def B(text): return P(text, s_body_left)
def BL(items):
    return [Paragraph('<bullet>&bull;</bullet> ' + item, s_bullet) for item in items]

def VR(text):
    """Verify marker in red."""
    return Paragraph('[VERIFY: ' + text + ']', s_verify)

def make_table(headers, rows, col_ratios=None):
    hdr = [P('<b>%s</b>' % h, s_th) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([P(str(c), s_td) if not isinstance(c, Paragraph) else c for c in row])
    if col_ratios:
        cw = [r * AVAIL_W for r in col_ratios]
    else:
        cw = [AVAIL_W / len(headers)] * len(headers)
    t = Table(data, colWidths=cw, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Build Document ──
output_path = '/home/z/my-project/download/UK_Grocery_Store_6_PreCoding_Docs.pdf'
doc = TocDocTemplate(output_path, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M, topMargin=TOP_M, bottomMargin=BOTTOM_M)

story = []

# ── Table of Contents ──
toc = TableOfContents()
toc.levelStyles = [s_toc_h1, s_toc_h2]
story.append(P('<b>Table of Contents</b>', ParagraphStyle('TOCTitle', fontName='LiberationSerif',
    fontSize=22, leading=28, alignment=TA_CENTER, textColor=ACCENT, spaceAfter=20)))
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 1: PRD
# ══════════════════════════════════════════════════════════════
story.append(H1('1. Product Requirements Document (PRD)'))
story.append(Spacer(1, 6))

story.append(H2('1.1 Product Overview'))
story.append(P('<b>Product Name:</b> UK Local Grocery Store'))
story.append(P('<b>One-Line Idea:</b> Order groceries from your local store and get delivery in under 60 minutes.'))
story.append(P('<b>Version:</b> 1.0 (MVP)'))
story.append(P('<b>Platform:</b> Web (responsive) + Mobile App (iOS/Android via CapacitorJS)'))
story.append(P('<b>Target Market:</b> United Kingdom (urban and suburban areas)'))

story.append(H2('1.2 Problem Statement'))
story.append(P('The UK grocery delivery market is dominated by supermarket giants like Tesco Whoosh and Sainsbury\'s Chop Chop, which leverage existing store networks but suffer from frequent out-of-stock substitutions, inconsistent delivery times, and poor customer service. Pure quick-commerce players like Getir and Gorillas collapsed in 2024 due to unsustainable dark-store economics, proving that ultra-fast delivery (under 15 minutes) is not viable in the UK market without massive capital expenditure. Meanwhile, independent local grocery stores are being left out of the digital economy entirely, unable to compete with the logistics infrastructure of Tesco or Ocado. There is a clear gap in the market for a platform that connects local grocery stores directly with their surrounding communities, offering reliable 30-60 minute delivery without the overhead of dark stores or the inconsistency of gig-economy personal shoppers like Beelivery.'))

story.append(H2('1.3 Target Users'))
story.append(P('The primary user base consists of UK residents aged 18-65 living in urban and suburban areas who need convenient grocery delivery. This includes busy professionals who do not have time to visit physical stores, families with young children for whom grocery shopping is logistically challenging, elderly or mobility-impaired individuals who cannot easily carry heavy shopping bags, and students or young adults in shared accommodation who prefer smaller, more frequent shops over large weekly hauls. Secondary users include the local grocery store owners and their staff (managers, pickers, and riders) who need a streamlined operational tool to manage orders, inventory, and deliveries from a single dashboard.'))

story.append(H2('1.4 Core Features (MoSCoW Prioritization)'))
story.append(H3('Must Have (MVP)'))
story += BL([
    'Customer postcode-based delivery zone validation (Postcodes.io)',
    'Product browsing by category with real-time stock status',
    'Shopping cart with server-side price and VAT calculation',
    'Stripe checkout with 3D Secure (SCA) compliance',
    'Order lifecycle: New, Packing, Out for Delivery, Delivered, Cancelled',
    'Kanban board for order management in admin dashboard',
    'RBAC: Customer, Owner, Manager, Picker, Rider roles',
    'VAT-compliant pricing (0%, 5%, 20%) with unit pricing display',
    'Allergen information display (Natasha\'s Law compliance)',
    'Challenge 25 age verification flag for restricted items',
    'Rider manual ETA setting with customer live tracking',
    'Email order confirmation (Resend) + SMS delivery updates (Twilio)',
    'Responsive design (mobile-first, WCAG 2.1 AA)',
])

story.append(H3('Should Have'))
story += BL([
    'Promo code system with percentage and flat discount types',
    'Homepage banner carousel (admin-configurable)',
    '"Buy It Again" quick reorder from order history',
    'Guest checkout (email-only, full account creation post-purchase)',
    'Product search with predictive suggestions',
    'Low stock alerts and kill switch for out-of-stock items',
    'Staff attendance tracking',
    'Wastage/expiry log for fresh items',
    'Delivery zone management in admin settings',
    'Store open/close status with automatic scheduling',
])

story.append(H3('Could Have (Post-MVP)'))
story += BL([
    'CapacitorJS mobile app (iOS/Android) with push notifications',
    'Subscription/recurring orders (GoCardless Direct Debit)',
    'Loyalty points system',
    'Product reviews and ratings',
    'Multi-store/multi-vendor support (Stripe Connect)',
    'Advanced analytics dashboard with export',
    'WhatsApp Business API notifications',
    'AI-powered product recommendations',
])

story.append(H3('Won\'t Have (v1)'))
story += BL([
    'Real-time GPS tracking of riders (uses manual ETA instead — simpler, more reliable for MVP)',
    'Automated inventory management or POS integration',
    'Voice commerce or AI chatbot ordering',
    'Social media integration or sharing features',
    'Multi-language support (English only for v1)',
    'Cryptocurrency or non-card payment methods',
])

story.append(H2('1.5 User Roles and Permissions'))
story.append(make_table(
    ['Role', 'Access Level', 'Key Permissions'],
    [
        ['Customer', 'Storefront + own orders', 'Browse, cart, checkout, track orders, view history, manage profile'],
        ['Owner', 'Full dashboard', 'All Manager permissions + finance reports, audit logs, system settings, staff salary data'],
        ['Manager', 'Operational dashboard', 'Manage products, categories, brands, promo codes, banners, staff attendance, view orders'],
        ['Picker', 'Packing queue only', 'View assigned orders, update packing status, mark items as packed'],
        ['Rider', 'Delivery queue only', 'View assigned deliveries, set ETA, adjust ETA, mark delivered, verify age (Challenge 25)'],
    ],
    [0.12, 0.20, 0.68]
))
story.append(Spacer(1, 6))

story.append(H2('1.6 User Stories'))
story.append(H3('Customer Stories'))
story += BL([
    'As a customer, I want to enter my postcode so that I can verify my area is within the delivery zone before browsing.',
    'As a customer, I want to browse products by category so that I can quickly find the groceries I need.',
    'As a customer, I want to see allergen information on each product so that I can make safe food choices for my family.',
    'As a customer, I want to see the total including VAT before checkout so that there are no surprise charges.',
    'As a customer, I want to pay with Apple Pay or Google Pay so that I can checkout quickly without entering card details.',
    'As a customer, I want to track my order in real time with a countdown timer so that I know when to expect my delivery.',
    'As a customer, I want to reorder my previous basket with one tap so that I can quickly restock my regular items.',
])

story.append(H3('Staff Stories'))
story += BL([
    'As a picker, I want to see only the orders assigned to me in a Kanban view so that I can focus on packing without distraction.',
    'As a rider, I want to set my own delivery ETA based on local knowledge so that customers get accurate time estimates.',
    'As a rider, I want to tap a quick-preset ETA button (15/30/45/60 min) so that I can set the estimate one-handed while on the move.',
    'As a manager, I want to toggle a product as "out of stock" instantly so that customers never order unavailable items.',
    'As an owner, I want to see the total VAT collected across all orders so that I can file accurate HMRC returns.',
])

story.append(H2('1.7 Success Metrics (KPIs)'))
story.append(make_table(
    ['KPI', 'Target', 'Measurement'],
    [
        ['Order Completion Rate', '> 95%', 'Delivered orders / total orders placed'],
        ['On-Time Delivery', '> 90%', 'Orders delivered within rider-set ETA'],
        ['Average Delivery Time', '< 45 minutes', 'Mean time from order to delivery'],
        ['Customer NPS', '> 50', 'Post-delivery survey (1-10 scale)'],
        ['Cart Abandonment Rate', '< 30%', 'Carts abandoned / carts created'],
        ['Out-of-Stock Rate', '< 5%', 'Items cancelled due to stock / total items ordered'],
        ['Payment Success Rate', '> 98%', 'Successful Stripe charges / payment attempts'],
    ],
    [0.30, 0.20, 0.50]
))
story.append(Spacer(1, 6))

story.append(H2('1.8 MVP Scope'))
story.append(H3('In Scope (v1)'))
story += BL([
    'Full customer storefront: browse, search, cart, checkout, order tracking, order history',
    'Complete admin dashboard: orders (Kanban), catalog (products, categories, brands), finance (basic), staff management, settings',
    'Stripe payment integration with webhook verification',
    'UK compliance: VAT calculation, allergen display, Challenge 25 flags, unit pricing',
    'Email + SMS notifications for order lifecycle events',
    'Responsive web design (mobile, tablet, desktop)',
    'Postcode-based delivery zone validation',
])

story.append(H3('Out of Scope (v1)'))
story += BL([
    'Native mobile app (CapacitorJS wrapper is post-MVP)',
    'Real-time GPS rider tracking (manual ETA is sufficient for launch)',
    'Subscription/recurring orders',
    'Multi-store marketplace model',
    'Advanced analytics and reporting',
    'Social features (reviews, sharing, wishlists)',
])

story.append(H2('1.9 Competitive Advantage'))
story.append(P('Unlike Tesco Whoosh and Sainsbury\'s Chop Chop which suffer from frequent out-of-stock substitutions (Trustpilot 1/5 stars each), our platform enforces real-time stock validation at add-to-cart time, preventing the frustrating experience of paying for items that cannot be delivered. Unlike Beelivery which relies on personal shoppers with inconsistent quality and high mark-ups, our model uses store-based fulfilment with dedicated pickers and riders, ensuring consistent service quality. Unlike Zapp which is limited to London and uses expensive dark stores, our store-pick model leverages existing grocery store infrastructure, making it economically viable to expand beyond London to any UK town with a local grocery store. Our manual ETA system (rider sets the delivery time) produces more accurate estimates than algorithmic routing, which research shows routinely underestimates delivery times in UK urban environments, particularly during rush hour near the Thames and in dense residential areas.'))

story.append(VR('Delivery pricing model — fixed fee per order, distance-based, or free-above-threshold? The blueprint specifies a delivery_fee column but does not define the pricing strategy.'))
story.append(VR('Will this be a single-store platform or a multi-store marketplace? The current schema supports single-store. Multi-store would require Stripe Connect and a different data model.'))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 2: TRD
# ══════════════════════════════════════════════════════════════
story.append(H1('2. Technical Requirements Document (TRD)'))
story.append(Spacer(1, 6))

story.append(H2('2.1 Architecture Overview'))
story.append(P('The platform follows a server-first architecture where the Next.js API Routes running on Vercel serverless functions serve as the single source of truth for all pricing, inventory, and order state. The system is organised as a Turborepo monorepo housing both the customer storefront and the admin dashboard in a single repository. Stripe handles payment processing via cryptographically verified webhooks, ensuring no order is marked as paid without server-side confirmation. The Turso database provides edge-replicated SQLite for fast reads across UK regions, and Vercel KV (Redis) handles session storage, rate limiting, and cart caching. All client-side price calculations are validated server-side to prevent tampering.'))

story.append(H2('2.2 Technology Stack'))
story.append(make_table(
    ['Layer', 'Technology', 'Purpose', 'Cost Tier'],
    [
        ['Frontend', 'Next.js 14+ (App Router)', 'Storefront + Admin (Turborepo monorepo)', 'Free'],
        ['Backend API', 'Next.js API Routes', 'REST endpoints on Vercel serverless', 'Free tier'],
        ['Database', 'Turso (libSQL)', 'Primary data store with edge replication', 'Free tier'],
        ['Cache', 'Vercel KV (Redis)', 'Session storage, rate limiting, cart cache', 'Free tier'],
        ['Auth', 'NextAuth.js v5', 'Magic link (customer) + credentials (staff)', 'Free'],
        ['Payments', 'Stripe', 'Card payments, refunds, webhook events', '1.5% + 20p/tx'],
        ['File Storage', 'Vercel Blob', 'Product images, receipts', 'Free tier'],
        ['Email', 'Resend', 'Order confirmations, delivery updates', 'Free (3K/mo)'],
        ['SMS', 'Twilio', 'Delivery ETA notifications, OTP', 'Pay per use'],
        ['Push', 'Firebase Cloud Messaging', 'Mobile push notifications', 'Free'],
        ['Maps/Geo', 'Postcodes.io API', 'UK postcode validation and geolocation', 'Free'],
        ['Monitoring', 'Sentry', 'Error tracking and performance monitoring', 'Free tier'],
        ['CI/CD', 'GitHub Actions', 'Automated testing and deployment', 'Free tier'],
        ['Mobile', 'CapacitorJS', 'Wrap web app for iOS/Android', 'Free'],
    ],
    [0.14, 0.22, 0.42, 0.22]
))
story.append(Spacer(1, 6))

story.append(H2('2.3 Frontend Stack'))
story.append(P('The frontend uses Next.js 14+ with the App Router, providing React Server Components for SEO-critical product catalog pages, Server Actions for mutations (cart operations, checkout), and streaming SSR for progressive page loading. Tailwind CSS handles all styling with a custom design token system for consistent theming. Zustand is used for lightweight client-side state management (cart state, UI state), while React Query (TanStack Query) handles server state caching and background refetching for product listings and order status. The monorepo structure uses Turborepo with shared packages for types, UI components, and business logic, enabling code sharing between the storefront and admin dashboard applications.'))

story.append(H2('2.4 Backend Stack'))
story.append(P('The backend is implemented entirely as Next.js API Routes running on Vercel serverless functions. This eliminates the need for a separate API server, reducing operational complexity and cost. All endpoints use Zod schemas for input validation, Drizzle ORM for parameterised database queries (preventing SQL injection), and HTTP-only cookies for session management. Rate limiting is enforced at 100 requests per minute for public endpoints and 300 requests per minute for authenticated endpoints using Vercel KV. The server-first architecture means all price calculations, VAT computations, and inventory decrements happen server-side, never trusting client-submitted values.'))

story.append(H2('2.5 Database'))
story.append(P('The primary database is Turso (libSQL), an edge-replicated SQLite service that provides fast reads from locations closest to UK users. All tables use UUID v4 primary keys for uniqueness across distributed environments. The schema includes 14 tables covering users, products, orders, and operational data. Foreign key relationships enforce referential integrity, and order items snapshot prices and VAT rates at the time of purchase to ensure accurate historical records even when product prices change.'))
story.append(VR('Research suggests PostgreSQL (Neon/Supabase) with PostGIS may be better suited than Turso for geospatial queries like "find stores within 3km" and complex relational joins. Turso lacks native geospatial support and has lower write throughput. However, for a single-store MVP, Turso is adequate. If multi-store expansion is planned, migrating to PostgreSQL should be considered in Phase 2.'))

story.append(H2('2.6 Authentication'))
story.append(P('NextAuth.js v5 provides a dual authentication strategy. Customers use passwordless magic-link login, maximising conversion rates by eliminating password friction during the critical onboarding flow. Staff members use email-plus-password authentication with optional two-factor authentication (TOTP). All sessions are managed via HTTP-only, SameSite=Strict cookies to prevent XSS-based session theft and CSRF attacks. Customer sessions persist for 7 days, while staff sessions expire after 30 minutes of inactivity. The magic link flow sends a time-limited URL to the customer\'s email; clicking the link authenticates them and sets the session cookie.'))

story.append(H2('2.7 Payment Integration'))
story.append(P('Stripe handles all payment processing with the following integration: PaymentIntent creation on the server (never on the client), Stripe.js for the secure card input element, webhook endpoint at /api/payments/webhook with signature verification (preventing spoofed payment confirmations), and automatic 3D Secure (SCA) handling for UK card regulations. Apple Pay and Google Pay are enabled through Stripe\'s Payment Request Button, which research shows increases conversion by 12-15%. Refund processing uses Stripe\'s Refund API with partial refund support for Challenge 25 age verification failures (refunding only the restricted items).'))
story.append(VR('Consider adding GoCardless for Direct Debit if subscription/recurring grocery orders are planned for v2. GoCardless charges 1% capped at 4 GBP per transaction, significantly cheaper than Stripe for large recurring payments.'))

story.append(H2('2.8 Third-Party Integrations'))
story.append(make_table(
    ['Service', 'Provider', 'Purpose', 'Free Tier'],
    [
        ['Postcode Validation', 'Postcodes.io', 'UK postcode validation + lat/lng', 'Completely free'],
        ['Address Autocomplete', 'Ideal Postcodes', 'Full Royal Mail address lookup', '1K lookups/day'],
        ['Email Delivery', 'Resend', 'Transactional emails (React Email templates)', '3,000 emails/mo'],
        ['SMS Notifications', 'Twilio', 'Delivery updates, OTP verification', 'Pay per SMS (~0.6p)'],
        ['Push Notifications', 'Firebase Cloud Messaging', 'Mobile push for order tracking', 'Unlimited free'],
        ['Image Hosting', 'Vercel Blob', 'Product images, brand logos, receipts', '1GB storage'],
        ['Error Monitoring', 'Sentry', 'Error tracking, source maps, performance', '5K errors/mo'],
    ],
    [0.18, 0.18, 0.38, 0.26]
))
story.append(Spacer(1, 6))

story.append(H2('2.9 Security Requirements'))
story += BL([
    'All API endpoints enforce HTTPS with HSTS headers',
    'CSRF protection via SameSite=Strict cookies and CSRF tokens for state-changing requests',
    'Input validation with Zod schemas on all request bodies; reject malformed data with HTTP 400',
    'SQL injection prevention via Drizzle ORM parameterised queries; no raw SQL strings',
    'Rate limiting: 100 req/min per IP (public), 300 req/min per user (authenticated)',
    'Security headers: Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options on all responses',
    'CORS: Only allow requests from own domain; no wildcard Access-Control-Allow-Origin',
    'All 4xx and 5xx responses logged to Sentry with request context',
    'Payment data never touches our servers — Stripe handles all card data (PCI DSS Level 1)',
])

story.append(H2('2.10 Performance Requirements'))
story.append(make_table(
    ['Metric', 'Target', 'Measurement Method'],
    [
        ['First Contentful Paint', '< 1.5s', 'Lighthouse / Web Vitals'],
        ['Time to Interactive', '< 3.0s', 'Lighthouse / Web Vitals'],
        ['API Response Time (read)', '< 200ms', 'Sentry APM / Vercel Analytics'],
        ['API Response Time (write)', '< 500ms', 'Sentry APM / Vercel Analytics'],
        ['Product Search Latency', '< 100ms', 'Client-side timing'],
        ['Uptime', '> 99.9%', 'Vercel status page / Sentry'],
        ['Error Rate', '< 0.1%', 'Sentry error tracking'],
    ],
    [0.30, 0.20, 0.50]
))
story.append(Spacer(1, 6))

story.append(VR('CapacitorJS vs React Native (Expo) for mobile app: Research suggests React Native provides better native GPS tracking, push notification reliability, and App Store presence. CapacitorJS shares the same codebase as the web app but has limitations with background location tracking and native device features. Evaluate based on mobile feature requirements before implementation.'))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 3: APP FLOW
# ══════════════════════════════════════════════════════════════
story.append(H1('3. App Flow Document'))
story.append(Spacer(1, 6))

story.append(H2('3.1 Screen Inventory'))
story.append(P('The platform comprises two distinct applications: the Customer Storefront and the Admin Dashboard. Each application has its own set of screens, navigation flow, and user interactions. The Customer Storefront is the public-facing shopping experience, optimised for mobile-first browsing and fast checkout. The Admin Dashboard is the operational tool for store staff, with role-specific views controlled by the RBAC system. Below is the comprehensive screen inventory for both applications.'))

story.append(H3('Customer Storefront Screens'))
story.append(make_table(
    ['#', 'Screen', 'Description'],
    [
        ['1', 'Welcome / Postcode Entry', 'First-time modal asking for postcode or GPS location for delivery zone validation'],
        ['2', 'Delivery Unavailable', 'Shown when postcode is outside delivery zone; offers email signup for future expansion'],
        ['3', 'Homepage', 'Banner carousel, category product sliders, search bar, sticky cart widget, delivery timer'],
        ['4', 'Category Listing', 'Left sidebar sub-categories, right side product grid with filters and sorting'],
        ['5', 'Product Detail', 'Image gallery, pricing with VAT, allergen info, weight, Challenge 25 badge, add to cart'],
        ['6', 'Search Results', 'Predictive search with instant suggestions, filtered results grid'],
        ['7', 'Slide-Out Cart', 'Sidebar with item list, quantity controls, bill summary, promo code input, checkout button'],
        ['8', 'Checkout', 'Delivery address, contact info, payment method (Stripe), order summary, place order'],
        ['9', 'Order Confirmation', 'Success state with order ID, estimated delivery, next-step suggestions'],
        ['10', 'Order Tracking', 'Live countdown timer, status timeline, rider contact card, map view'],
        ['11', 'Order History', 'List of past orders with reorder button, order details expansion'],
        ['12', 'Profile', 'Personal details, delivery addresses, order preferences'],
        ['13', 'Login / Register', 'Magic link login for customers, optional social auth (Google)'],
        ['14', 'Forgot Password', 'Email-based password reset flow'],
        ['15', 'Email Verification', 'Click-through verification for new accounts'],
    ],
    [0.05, 0.25, 0.70]
))
story.append(Spacer(1, 6))

story.append(H3('Admin Dashboard Screens'))
story.append(make_table(
    ['#', 'Screen', 'Description', 'Min Role'],
    [
        ['16', 'Login (Staff)', 'Email + password with optional 2FA', 'Picker'],
        ['17', 'Dashboard Overview', 'Revenue, orders, profit metrics with date filters', 'Manager'],
        ['18', 'Kanban Board', '4-column order management: New, Packing, Out for Delivery, Delivered', 'Picker'],
        ['19', 'Order Detail', 'Full order info, customer contact, items, status timeline', 'Picker'],
        ['20', 'Catalog - Products', 'Product list with search, add/edit/delete', 'Manager'],
        ['21', 'Catalog - Categories', 'Category management with display order', 'Manager'],
        ['22', 'Catalog - Brands', 'Brand management with logo upload', 'Manager'],
        ['23', 'Finance - Summary', 'Revenue, VAT collected, product cost, profit', 'Owner'],
        ['24', 'Staff Management', 'Employee list, attendance, performance', 'Manager'],
        ['25', 'Marketing - Promo Codes', 'Create/edit promo codes with restrictions', 'Manager'],
        ['26', 'Marketing - Banners', 'Upload homepage banners with link targets', 'Manager'],
        ['27', 'Settings - Store Status', 'Open/close store, auto-scheduling', 'Owner'],
        ['28', 'Settings - Delivery Zones', 'Add/remove delivery postcodes', 'Owner'],
        ['29', 'Settings - Payment Keys', 'Stripe live/test key configuration', 'Owner'],
        ['30', 'Rider Delivery Screen', 'Active deliveries, ETA setting, map, customer contact', 'Rider'],
        ['31', 'Rider Delivery Detail', 'Order items, address, "Start Delivery" with ETA, "Mark Delivered"', 'Rider'],
        ['32', 'Age Verification Screen', 'Challenge 25 verification at delivery door', 'Rider'],
    ],
    [0.05, 0.25, 0.50, 0.20]
))
story.append(Spacer(1, 6))

story.append(H2('3.2 Customer User Journey'))
story.append(H3('Discovery and Onboarding'))
story.append(P('When a new customer first visits the storefront, they are presented with a location detection popup. If they grant GPS permission, the app reverse-geocodes their location to a UK postcode via Postcodes.io. If they deny permission, they manually enter their postcode. The postcode is validated against the delivery_zones table. If valid, they proceed to the homepage with the delivery timer showing "Delivering in XX Mins". If invalid, they see the Delivery Unavailable screen with an option to sign up for email notifications when their area becomes available. No account creation is required at this stage — customers can browse immediately as guests.'))

story.append(H3('Browsing and Adding to Cart'))
story.append(P('The homepage features an auto-scrolling banner carousel (4 configurable banners, 3-second rotation), followed by category-based product sliders. Each product card shows the product image, name, weight/volume, price (VAT-inclusive), discount badge if applicable, and a prominent "ADD" button. Tapping "ADD" animates the item into the floating cart widget (top right) which updates the count and total in real time. Tapping a product card opens the Product Detail screen with full information including allergens, ingredients, unit pricing (UK legal requirement), and Challenge 25 badge if age-restricted. The "Add to Cart" button on the detail page has a quantity selector. The slide-out cart sidebar shows all items with quantity controls, a promo code input field, the bill summary (item total, delivery fee, discount, total), and the "Proceed to Pay" button.'))

story.append(H3('Checkout and Payment'))
story.append(P('The checkout screen collects delivery address (with Ideal Postcodes autocomplete if available), contact phone number, and payment method. First-time customers are offered a streamlined guest checkout requiring only email; full account creation is prompted post-purchase. The payment flow uses Stripe\'s Payment Sheet which handles card input, Apple Pay, and Google Pay in a single interface. 3D Secure authentication is triggered automatically for SCA-compliant cards. On payment success, the server creates the order, decrements inventory, and redirects to the Order Confirmation screen. On payment failure, the cart is preserved and the customer sees a clear error message with retry options; the order is NOT created and inventory is NOT decremented.'))

story.append(H3('Order Tracking'))
story.append(P('After payment, the customer can track their order in real time. The tracking screen shows a vertical timeline with status steps: Order Confirmed (with timestamp), Packing (in progress indicator), Out for Delivery (with ETA countdown), and Delivered (pending). When the rider sets the ETA, the customer receives an SMS and sees a live countdown timer. If the ETA is adjusted, the timer updates and a push notification is sent. When the timer drops below 5 minutes, the display changes to "Your rider is almost there!" with an animated icon. The rider contact card shows the rider\'s name and a "Call Rider" button.'))

story.append(H2('3.3 Error and Edge Case Flows'))
story.append(make_table(
    ['State', 'Trigger', 'User Experience', 'Technical Action'],
    [
        ['Payment Failed', 'Card declined / Stripe error', 'Clear message + alternative payment prompt', 'Do NOT create order; keep cart intact'],
        ['Out of Stock at Checkout', 'Item becomes unavailable', 'Badge on product card; disable add button', 'Server validates stock before payment intent'],
        ['Out of Stock Post-Payment', 'Item unavailable during packing', 'SMS + email with partial refund for missing item', 'Picker marks item unavailable; auto-refund via Stripe'],
        ['Delivery Unavailable', 'Postcode outside zone', 'Modal with explanation + email signup', 'Postcodes.io validation before cart'],
        ['ETA Expired', 'Rider ETA passed without delivery', '"Running slightly late" with calming message', 'Auto-alert Manager; SMS to customer'],
        ['Challenge 25 Failed', 'Customer cannot verify age', 'Restricted items removed; partial refund issued', 'Rider taps "Cannot Verify"; Stripe partial refund'],
        ['Network Error', 'No internet connection', 'Banner + cached content where possible', 'Service Worker stale-while-revalidate'],
        ['Order Cancelled', 'Customer cancels before packing', 'Full refund via Stripe; inventory restored', 'Update order status; trigger Stripe refund'],
    ],
    [0.15, 0.20, 0.30, 0.35]
))
story.append(Spacer(1, 6))

story.append(H2('3.4 Navigation Flow'))
story.append(P('The Customer Storefront uses a bottom tab navigation on mobile (Home, Categories, Search, Orders, Profile) and a sticky top navigation on desktop with category mega-menu, search bar, and cart widget. The Admin Dashboard uses a left sidebar with collapsible sections: Overview, Orders (Kanban), Catalog (Products, Categories, Brands), Finance, Staff, Marketing (Promo Codes, Banners), and Settings (Store, Delivery, Payments). The sidebar highlights the current section and respects RBAC — Pickers see only Orders, Riders see Orders and their Delivery screen, Managers see everything except Finance and Settings, and Owners see everything.'))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 4: UI/UX DESIGN BRIEF
# ══════════════════════════════════════════════════════════════
story.append(H1('4. UI/UX Design Brief'))
story.append(Spacer(1, 6))

story.append(H2('4.1 Design Philosophy'))
story.append(P('The design language is "Fresh Market" — a clean, trust-building aesthetic that combines the freshness of a farmers\' market with the reliability of modern e-commerce. The visual identity must communicate three core values: freshness (through green tones and organic shapes), speed (through bold delivery timers and streamlined checkout), and trust (through transparent pricing, security badges, and clear product information). The design draws inspiration from Zapp\'s sleek minimalism, Ocado\'s premium quality perception, and Tesco\'s practical efficiency, but establishes its own distinct identity through a green-forward color palette that differentiates from the blue (Tesco), orange (Sainsbury\'s), and purple (Ocado) of existing competitors.'))

story.append(H2('4.2 Color Palette'))
story.append(make_table(
    ['Role', 'Color Name', 'Hex Value', 'Usage'],
    [
        ['Primary', 'Fresh Leaf Green', '#2D8C4E', 'Primary buttons, active states, success indicators, brand identity'],
        ['Accent', 'Golden Harvest', '#F7D36C', 'Deals/offers badges, promo highlights, secondary CTAs'],
        ['Error/Sale', 'Vibrant Red', '#C91E1E', 'Error messages, sale badges, out-of-stock indicators, Challenge 25 warnings'],
        ['Trust/Info', 'Deep Navy', '#1F4E7C', 'Links, informational text, trust badges, security indicators'],
        ['Text Primary', 'Midnight Ink', '#1A1A2E', 'All body text, headings, labels'],
        ['Text Muted', 'Stone Grey', '#6B7280', 'Captions, timestamps, secondary information'],
        ['Background', 'Cloud White', '#F9FAFB', 'Page background, card backgrounds'],
        ['Surface', 'Soft Ivory', '#F3F4F6', 'Section backgrounds, table striping, elevated surfaces'],
        ['Border', 'Mist Grey', '#E5E7EB', 'Dividers, input borders, card outlines'],
        ['Success', 'Sage Green', '#3E8E59', 'Confirmation messages, delivered status'],
        ['Warning', 'Amber Gold', '#A38342', 'Low stock alerts, ETA adjustments'],
    ],
    [0.12, 0.18, 0.14, 0.56]
))
story.append(Spacer(1, 6))

story.append(H2('4.3 Typography'))
story.append(make_table(
    ['Element', 'Font Family', 'Weight', 'Size', 'Line Height'],
    [
        ['H1 / Page Title', 'DM Sans', 'Bold (700)', '28px', '1.3'],
        ['H2 / Section Title', 'DM Sans', 'SemiBold (600)', '22px', '1.3'],
        ['H3 / Subsection', 'DM Sans', 'SemiBold (600)', '18px', '1.4'],
        ['Body Text', 'Inter', 'Regular (400)', '16px', '1.6'],
        ['Body Small', 'Inter', 'Regular (400)', '14px', '1.5'],
        ['Button Text', 'DM Sans', 'SemiBold (600)', '16px', '1.0'],
        ['Price / Money', 'Inter', 'Medium (500)', '20px', '1.2'],
        ['Price Small', 'Inter', 'Medium (500)', '14px', '1.2'],
        ['Caption / Meta', 'Inter', 'Regular (400)', '12px', '1.4'],
        ['Input Label', 'Inter', 'Medium (500)', '14px', '1.4'],
    ],
    [0.18, 0.14, 0.18, 0.14, 0.14]
))
story.append(Spacer(1, 6))
story.append(P('Inter is chosen for body text because it offers tabular figures (essential for aligned price displays), excellent readability at small sizes, and native support for British pound sterling symbols. DM Sans provides a clean geometric contrast for headings without the overused familiarity of system fonts. Both fonts are available on Google Fonts with permissive licenses. All text must support Dynamic Type scaling up to 200% without horizontal scroll, as 40% of Tesco\'s iOS users reportedly use non-default text sizes.'))

story.append(H2('4.4 Component Style Guide'))
story.append(H3('Buttons'))
story += BL([
    'Primary: Background #2D8C4E, white text, 16px DM Sans SemiBold, 48px height, 8px border-radius, hover: darken 10%',
    'Secondary: Border #2D8C4E, text #2D8C4E, white background, hover: fill with #2D8C4E',
    'Danger: Background #C91E1E, white text (for destructive actions like "Cancel Order")',
    'Disabled: Background #E5E7EB, text #9CA3AF, cursor not-allowed',
    'Minimum touch target: 44x44px (WCAG 2.1 AA requirement)',
])

story.append(H3('Cards'))
story += BL([
    'Product Card: White background, 8px border-radius, subtle shadow (0 1px 3px rgba(0,0,0,0.1)), product image top 60%, info bottom 40%',
    'Order Card: White background, left border accent color by status (New=blue, Packing=amber, Delivery=green, Delivered=grey)',
    'Metric Card (Dashboard): White background, top border 3px #2D8C4E, large stat number (32px Inter Bold), label below (14px Inter Regular)',
])

story.append(H3('Input Fields'))
story += BL([
    'Height: 48px, border: 1px #E5E7EB, border-radius: 8px, focus: border #2D8C4E, ring 3px rgba(45,140,78,0.2)',
    'Label: 14px Inter Medium above input, error state: border #C91E1E, error message 12px #C91E1E below',
    'Placeholder: #9CA3AF, no placeholder-only labels (WCAG requirement: every input has visible label)',
])

story.append(H3('Modals and Toasts'))
story += BL([
    'Modal: Centered overlay, white background, 16px border-radius, max-width 480px, backdrop blur',
    'Toast: Bottom-right positioned, auto-dismiss 4s, success (green), error (red), info (blue) variants',
    'Loading: Skeleton placeholders matching content layout, shown within 200ms of data fetch start',
])

story.append(H2('4.5 Responsive Breakpoints'))
story.append(make_table(
    ['Breakpoint', 'Width', 'Target', 'Layout Changes'],
    [
        ['Mobile S', '320-374px', 'iPhone SE', 'Single column, bottom sheet cart, hamburger nav'],
        ['Mobile', '375-428px', 'iPhone 14/15', 'Single column, sticky add button, swipe cards'],
        ['Tablet', '429-768px', 'iPad Mini', 'Two-column product grid, sidebar cart'],
        ['Desktop S', '769-1024px', 'Small laptops', 'Three-column grid, expanded nav, sidebar categories'],
        ['Desktop', '1025-1440px', 'Standard monitors', 'Four-column grid, full navigation bar'],
        ['Desktop XL', '1441px+', 'Large monitors', 'Six-column grid, wider spacing'],
    ],
    [0.12, 0.14, 0.20, 0.54]
))
story.append(Spacer(1, 6))

story.append(H2('4.6 Accessibility Requirements (WCAG 2.1 AA)'))
story += BL([
    'Color contrast: 4.5:1 for normal text, 3:1 for large text (all text/background pairs verified)',
    'Touch targets: Minimum 44x44px for all interactive elements',
    'Form labels: Every input has a visible label element with for/id association',
    'Keyboard navigation: All interactive elements focusable in logical tab order with visible focus indicators',
    'Screen readers: aria-live regions for cart updates, order status changes; alt text on all product images',
    'Text resize: Support up to 200% zoom without horizontal scroll using rem units',
    'Error messages: Descriptive, specific, with suggestions; aria-describedby on inputs',
    'Dynamic content: Announced to screen readers via aria-live="polite" for cart, "assertive" for errors',
])

story.append(H2('4.7 Inspiration References'))
story += BL([
    'Zapp (zapp.co.uk): Sleek dark-mode checkout, one-tap ordering, 24/7 delivery branding',
    'Ocado (ocado.com): Premium product photography, M&S brand association, smart favourites',
    'Tesco Groceries (tesco.com): Clubcard integration, practical category navigation, trusted brand feel',
    'Gopuff (gopuff.com): Quick-tap product cards, speed-first messaging, simple checkout flow',
])

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 5: BACKEND SCHEMA
# ══════════════════════════════════════════════════════════════
story.append(H1('5. Backend Schema Document'))
story.append(Spacer(1, 6))

story.append(H2('5.1 Design Principles'))
story.append(P('The database schema is designed for Turso (libSQL) with full UK compliance support built in. Every product record includes VAT rate, unit pricing string, allergen data, and Challenge 25 flag to satisfy UK legal requirements at the data layer. Order items snapshot the price and VAT rate at the time of purchase to ensure accurate historical records even if product prices change later. All tables use UUID v4 primary keys for uniqueness across distributed edge replicas. Foreign key constraints enforce referential integrity, and indexed columns support the expected query patterns for a high-read, moderate-write grocery delivery workload.'))

story.append(H2('5.2 Core Tables'))
story.append(H3('users'))
story.append(make_table(
    ['Column', 'Type', 'Constraints', 'Purpose'],
    [
        ['id', 'TEXT', 'PRIMARY KEY', 'UUID v4 unique identifier'],
        ['email', 'TEXT', 'UNIQUE, NOT NULL', 'Login and communication'],
        ['phone', 'TEXT', '', 'Delivery contact number'],
        ['full_name', 'TEXT', 'NOT NULL', 'Customer display name'],
        ['password_hash', 'TEXT', '', 'bcrypt hash (staff only)'],
        ['role', 'TEXT', "DEFAULT 'customer'", 'customer/owner/manager/picker/rider'],
        ['postcode', 'TEXT', '', 'Default delivery postcode'],
        ['is_banned', 'BOOLEAN', 'DEFAULT FALSE', 'Fraud prevention flag'],
        ['created_at', 'TEXT', 'DEFAULT CURRENT_TIMESTAMP', 'Account creation date'],
        ['updated_at', 'TEXT', '', 'Last profile update'],
    ],
    [0.18, 0.12, 0.30, 0.40]
))
story.append(Spacer(1, 6))

story.append(H3('products'))
story.append(make_table(
    ['Column', 'Type', 'Constraints', 'Purpose'],
    [
        ['id', 'TEXT', 'PRIMARY KEY', 'UUID v4 unique identifier'],
        ['name', 'TEXT', 'NOT NULL', 'Product display name'],
        ['description', 'TEXT', '', 'Full product description'],
        ['category_id', 'TEXT', 'FK -> categories.id', 'Product category'],
        ['brand_id', 'TEXT', 'FK -> brands.id', 'Product brand'],
        ['price', 'REAL', 'NOT NULL', 'Selling price in GBP (VAT-inclusive)'],
        ['compare_at_price', 'REAL', '', 'Original price (for discount display)'],
        ['unit_price', 'TEXT', 'NOT NULL', 'e.g. "1.20/100g" (UK law requirement)'],
        ['vat_rate', 'REAL', 'NOT NULL', '0.0, 0.05, or 0.20'],
        ['weight_value', 'REAL', '', 'Numeric weight or volume'],
        ['weight_unit', 'TEXT', '', 'g, kg, ml, L, etc.'],
        ['image_url', 'TEXT', '', 'Product photograph URL (Vercel Blob)'],
        ['stock_count', 'INTEGER', 'DEFAULT 0', 'Current inventory level'],
        ['low_stock_threshold', 'INTEGER', 'DEFAULT 10', 'Alert trigger level'],
        ['is_active', 'BOOLEAN', 'DEFAULT TRUE', 'Kill switch for stock-out'],
        ['challenge_25', 'BOOLEAN', 'DEFAULT FALSE', 'Age-restricted item flag'],
        ['allergens', 'TEXT', '', 'Comma-separated allergen list (14 allergens)'],
        ['ingredients', 'TEXT', '', 'Full ingredients list'],
        ['use_by_date', 'TEXT', '', 'For fresh items'],
        ['created_at', 'TEXT', 'DEFAULT CURRENT_TIMESTAMP', 'Product creation date'],
    ],
    [0.18, 0.10, 0.26, 0.46]
))
story.append(Spacer(1, 6))

story.append(H3('orders'))
story.append(make_table(
    ['Column', 'Type', 'Constraints', 'Purpose'],
    [
        ['id', 'TEXT', 'PRIMARY KEY', 'UUID v4 unique identifier'],
        ['user_id', 'TEXT', 'FK -> users.id', 'Customer reference'],
        ['status', 'TEXT', 'NOT NULL', 'new/packing/out_for_delivery/delivered/cancelled'],
        ['subtotal', 'REAL', 'NOT NULL', 'Pre-VAT item total'],
        ['vat_total', 'REAL', 'NOT NULL', 'Total VAT collected'],
        ['delivery_fee', 'REAL', 'DEFAULT 0', 'Delivery charge'],
        ['discount_amount', 'REAL', 'DEFAULT 0', 'Promo code discount'],
        ['total', 'REAL', 'NOT NULL', 'Final amount charged'],
        ['stripe_payment_intent_id', 'TEXT', 'UNIQUE', 'Stripe payment reference'],
        ['delivery_address', 'TEXT', 'NOT NULL', 'Full delivery address'],
        ['delivery_postcode', 'TEXT', 'NOT NULL', 'UK postcode'],
        ['customer_phone', 'TEXT', '', 'Contact number for delivery'],
        ['assigned_picker_id', 'TEXT', 'FK -> users.id', 'Staff packing the order'],
        ['assigned_rider_id', 'TEXT', 'FK -> users.id', 'Staff delivering the order'],
        ['estimated_delivery_minutes', 'INTEGER', '', 'ETA set manually by rider'],
        ['estimated_delivery_at', 'TEXT', '', 'Calculated: dispatched_at + ETA minutes'],
        ['dispatched_at', 'TEXT', '', 'Timestamp when rider starts delivery'],
        ['delivered_at', 'TEXT', '', 'Timestamp when rider confirms delivery'],
        ['eta_adjustment_count', 'INTEGER', 'DEFAULT 0', 'Number of ETA adjustments (max 3)'],
        ['age_verified', 'BOOLEAN', 'DEFAULT FALSE', 'Challenge 25 check passed'],
        ['promo_code_id', 'TEXT', 'FK -> promo_codes.id', 'Applied discount code'],
        ['cancellation_reason', 'TEXT', '', 'If cancelled, record reason'],
        ['created_at', 'TEXT', 'DEFAULT CURRENT_TIMESTAMP', 'Order timestamp'],
        ['updated_at', 'TEXT', '', 'Last status change'],
    ],
    [0.22, 0.10, 0.22, 0.46]
))
story.append(Spacer(1, 6))

story.append(H3('order_items'))
story.append(make_table(
    ['Column', 'Type', 'Constraints', 'Purpose'],
    [
        ['id', 'TEXT', 'PRIMARY KEY', 'UUID v4'],
        ['order_id', 'TEXT', 'FK -> orders.id ON DELETE CASCADE', 'Parent order'],
        ['product_id', 'TEXT', 'FK -> products.id', 'Product at time of order'],
        ['quantity', 'INTEGER', 'NOT NULL', 'Number of items'],
        ['unit_price', 'REAL', 'NOT NULL', 'Price per item (snapshot)'],
        ['vat_rate', 'REAL', 'NOT NULL', 'VAT rate at time of order (snapshot)'],
        ['line_total', 'REAL', 'NOT NULL', 'unit_price * quantity'],
    ],
    [0.22, 0.10, 0.32, 0.36]
))
story.append(Spacer(1, 6))

story.append(H2('5.3 Supporting Tables'))
story.append(make_table(
    ['Table', 'Key Columns', 'Purpose'],
    [
        ['categories', 'id, name, slug, display_order, is_active', 'Product categorisation (Dairy, Meat, Bakery, etc.)'],
        ['brands', 'id, name, slug, logo_url', 'Brand filtering and display'],
        ['promo_codes', 'id, code, discount_type, discount_value, min_order, max_uses, used_count, expires_at', 'Marketing promotions'],
        ['delivery_zones', 'id, postcode_prefix, max_distance_km, is_active', 'Delivery area management'],
        ['banners', 'id, image_url, link_target, display_order, is_active', 'Homepage banner carousel'],
        ['staff_attendance', 'id, user_id, date, status', 'Daily attendance tracking'],
        ['wastage_log', 'id, product_id, quantity, reason, logged_at', 'Expired/damaged stock tracking'],
        ['audit_log', 'id, user_id, action, entity, entity_id, timestamp', 'Security and compliance audit trail'],
        ['order_tracking', 'id, order_id, status, eta_minutes, rider_lat, rider_lng, timestamp', 'Real-time tracking event log'],
        ['notifications', 'id, user_id, type, message, is_read, created_at', 'In-app and push notification queue'],
    ],
    [0.15, 0.50, 0.35]
))
story.append(Spacer(1, 6))

story.append(H2('5.4 Indexes'))
story.append(P('The following indexes support the expected query patterns. Product lookups by category and search are the most frequent reads. Order status updates and inventory decrements are the most frequent writes. The index strategy prioritises read performance for the customer storefront while maintaining acceptable write throughput for order processing.'))
story.append(make_table(
    ['Index', 'Table', 'Columns', 'Rationale'],
    [
        ['idx_products_category', 'products', 'category_id, is_active', 'Category page product listing (most common query)'],
        ['idx_products_search', 'products', 'name, is_active', 'Product search autocomplete'],
        ['idx_products_stock', 'products', 'stock_count, low_stock_threshold', 'Low stock alert queries'],
        ['idx_orders_status', 'orders', 'status, created_at', 'Kanban board filtered by status'],
        ['idx_orders_user', 'orders', 'user_id, created_at DESC', 'Customer order history'],
        ['idx_orders_rider', 'orders', 'assigned_rider_id, status', 'Rider delivery queue'],
        ['idx_order_items_order', 'order_items', 'order_id', 'Order detail page item retrieval'],
        ['idx_delivery_zones_postcode', 'delivery_zones', 'postcode_prefix', 'Postcode validation lookup'],
        ['idx_audit_user', 'audit_log', 'user_id, timestamp DESC', 'User activity audit trail'],
    ],
    [0.22, 0.14, 0.30, 0.34]
))
story.append(Spacer(1, 6))

story.append(H2('5.5 Authentication and Sessions'))
story.append(P('Authentication uses HTTP-only, SameSite=Strict cookies managed by NextAuth.js v5. Customer sessions use a magic-link flow that sets a session cookie valid for 7 days. Staff sessions use email-plus-password authentication with optional TOTP two-factor authentication, expiring after 30 minutes of inactivity. Session data is stored in Vercel KV (Redis) with TTL-based automatic expiry. The session token is a cryptographically random string (256-bit) that maps to a session record containing the user ID, role, and expiry timestamp. All authenticated API endpoints verify the session cookie before processing requests, and the RBAC middleware checks the user\'s role against the endpoint\'s minimum permission level.'))

story.append(H2('5.6 VAT Configuration'))
story.append(P('UK VAT is handled at the data layer with three rates: zero-rated (0%, most food items), reduced rate (5%, rarely applies to groceries), and standard rate (20%, alcohol, soft drinks, confectionery, tobacco). The vat_rate column on the products table stores the applicable rate as a decimal (0.0, 0.05, 0.20). The order_items table snapshots the VAT rate at the time of purchase. The critical rule is that all VAT calculations must be performed server-side — the API recalculates the total from product IDs and quantities stored in the database, never trusting client-submitted prices. This prevents both accidental miscalculation and malicious price tampering.'))

story.append(H2('5.7 Migration Strategy'))
story.append(P('Database migrations are managed via Drizzle ORM\'s migration system. Each migration is a versioned SQL file stored in the repository under drizzle/migrations/. Migrations run automatically during the Vercel deployment process via a GitHub Actions step that executes drizzle-kit push before the application deploys. This ensures the database schema is always in sync with the application code. Rollback is supported by keeping previous migration files and using drizzle-kit down for reverting. For production safety, all destructive migrations (dropping columns, changing types) require manual approval via a Vercel deployment protection rule.'))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# DOCUMENT 6: IMPLEMENTATION PLAN
# ══════════════════════════════════════════════════════════════
story.append(H1('6. Implementation Plan'))
story.append(Spacer(1, 6))

story.append(H2('6.1 Timeline Overview'))
story.append(P('The implementation follows an 8-week development plan for a team of 2 full-stack developers (Kiran and Akshat). The plan is structured in 7 phases, each with clear deliverables, acceptance criteria, and risk mitigation strategies. The deadline of June 15, 2026 provides a tight but achievable timeline if the team focuses on MVP scope and defers all post-MVP features. The plan assumes both developers work full-time on this project with daily standups and weekly demos to the project owner. Critical path items are the payment integration (Week 5) and compliance layer (Week 6), which must not slip as they gate the launch.'))
story.append(VR('Timeline is very tight for 2 developers over 8 weeks. If either developer is unavailable for more than 2 days, the deadline is at risk. Consider reducing scope or extending timeline by 1-2 weeks.'))

story.append(H2('6.2 Phase 1: Foundation and Authentication (Week 1)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['Turborepo monorepo setup with apps/web + apps/admin', 'Kiran', '1', 'Working monorepo with shared packages'],
        ['Turso database setup + Drizzle ORM schema (all 14 tables)', 'Akshat', '1.5', 'Migration files, seed script with test data'],
        ['NextAuth.js v5 integration (magic link + credentials)', 'Kiran', '1.5', 'Login/register flows, session management'],
        ['Vercel deployment pipeline (dev/staging/prod)', 'Akshat', '1', 'Auto-deploy on merge, preview deploys for PRs'],
        ['RBAC middleware + role-based route protection', 'Kiran', '1', 'Middleware that blocks unauthorised access by role'],
        ['Sentry error tracking integration', 'Akshat', '0.5', 'Sentry capturing errors in all environments'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> A developer can log in as any of the 5 roles, see only their permitted screens, and all actions are logged to the audit trail. The database contains all 14 tables with seed data for testing. Error tracking is active in Sentry.'))

story.append(H2('6.3 Phase 2: Core Storefront (Weeks 2-3)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['Homepage: banner carousel, category sliders, search bar', 'Kiran', '2', 'Responsive homepage with test banners and products'],
        ['Product listing: category page with sidebar + grid', 'Kiran', '1.5', 'Category browsing with live product data'],
        ['Product detail page with allergens, VAT, Challenge 25', 'Kiran', '1.5', 'Full product detail with all UK compliance data'],
        ['Shopping cart: slide-out sidebar, quantity controls', 'Akshat', '2', 'Working cart with server-side price calculation'],
        ['Postcode validation + delivery zone check', 'Akshat', '1', 'Postcodes.io integration, delivery zone validation'],
        ['Search: predictive search with instant suggestions', 'Akshat', '1.5', 'Search bar with debounced API calls and suggestions'],
        ['Cart persistence in Vercel KV (guest + authenticated)', 'Akshat', '1.5', 'Cart survives page refresh and login'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> A customer can browse products by category, search for items, add them to cart, see VAT-inclusive prices with unit pricing, view allergen information, and validate their postcode for delivery. The cart persists across page refreshes. All prices are calculated server-side.'))

story.append(H2('6.4 Phase 3: Admin Dashboard (Week 4)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['Kanban board: 4-column order management with drag-and-drop', 'Kiran', '2', 'Real-time Kanban with role-restricted views'],
        ['Order detail: customer info, items, status timeline', 'Kiran', '1', 'Full order detail with action buttons'],
        ['Catalog management: products CRUD with image upload', 'Akshat', '2', 'Add/edit/delete products with Vercel Blob upload'],
        ['Category and brand management', 'Akshat', '1', 'CRUD for categories and brands with display order'],
        ['Staff management: list, attendance, role assignment', 'Kiran', '1', 'Staff roster with daily attendance toggle'],
        ['Dashboard overview: revenue, orders, profit metrics', 'Akshat', '1', 'Metric cards with date range filter'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> A manager can manage products, categories, and brands. A picker sees only the packing queue. A rider sees only the delivery queue. An owner sees everything including finance metrics. All CRUD operations are audit-logged.'))

story.append(H2('6.5 Phase 4: Payments and Webhooks (Week 5)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['Stripe PaymentIntent creation (server-side)', 'Kiran', '1', 'Checkout creates PaymentIntent, returns client_secret'],
        ['Stripe.js integration + 3D Secure (SCA)', 'Kiran', '1.5', 'Card input, Apple Pay, Google Pay working'],
        ['Webhook endpoint with signature verification', 'Kiran', '1.5', 'Idempotent webhook handler for all Stripe events'],
        ['Order creation on payment success', 'Akshat', '1', 'Order record + inventory decrement on payment_success'],
        ['Payment failure handling + cart preservation', 'Akshat', '1', 'Failed payment does not create order; cart intact'],
        ['Refund flow (full + partial for Challenge 25)', 'Akshat', '1', 'Stripe Refund API integration'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> A customer can complete a real payment with Stripe test cards. Webhook delivery is verified with Stripe CLI. Payment failure leaves the cart intact. Partial refunds work for age verification failures. All payment events are logged.'))

story.append(H2('6.6 Phase 5: Compliance Layer (Week 6)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['VAT calculation engine (0%, 5%, 20%) server-side', 'Kiran', '1', 'All checkout totals verified against HMRC rules'],
        ['Unit pricing display on all product cards (Weights & Measures)', 'Kiran', '1', 'Every product shows e.g. "1.20/100g"'],
        ['Allergen data display (14 allergens, Natasha\'s Law)', 'Kiran', '1', 'Allergens visible on product detail + at checkout'],
        ['Challenge 25 flag + age verification flow for riders', 'Akshat', '1.5', 'Age-restricted items flagged; rider verifies at door'],
        ['Privacy policy + cookie consent (UK GDPR + PECR)', 'Akshat', '1', 'Cookie consent banner, privacy policy page, DPIA'],
        ['Consumer rights: cancellation + refund policy pages', 'Akshat', '0.5', 'Legal pages with correct cancellation rights'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> All UK compliance requirements from the 15-regulation checklist are implemented and verified. VAT calculations are accurate for all three rate categories. Allergen data is visible at every touchpoint. Challenge 25 flow works end-to-end.'))

story.append(H2('6.7 Phase 6: Notifications and Tracking (Week 7)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['Resend email integration (order confirmation, delivery updates)', 'Kiran', '1', 'HTML email templates via React Email'],
        ['Twilio SMS integration (ETA notifications, OTP)', 'Kiran', '1', 'SMS sent on rider dispatch, ETA adjustment, delivery'],
        ['Rider ETA system: manual ETA setting + quick presets', 'Akshat', '1.5', '15/30/45/60 min presets, custom entry, "Start Delivery"'],
        ['Customer tracking screen: countdown timer + status timeline', 'Akshat', '1.5', 'Live countdown, timeline, rider contact card'],
        ['ETA adjustment flow (max 3 adjustments + expiry handling)', 'Akshat', '1', '"Running slightly late" state + manager alert'],
        ['Promo code system + banner management', 'Kiran', '1', 'Create/apply promo codes, manage homepage banners'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))
story.append(P('<b>Acceptance Criteria:</b> Customer receives email confirmation on order, SMS when rider dispatches, and can track their order with live countdown. Rider can set and adjust ETA. Promo codes apply discounts correctly at checkout.'))

story.append(H2('6.8 Phase 7: Testing, QA and Launch (Week 8)'))
story.append(make_table(
    ['Task', 'Owner', 'Days', 'Deliverable'],
    [
        ['End-to-end testing: full customer + staff journeys', 'Both', '2', 'All critical paths tested with Playwright E2E'],
        ['Cross-browser testing: Chrome, Safari, Firefox, Edge, mobile', 'Both', '1', 'Visual + functional consistency across browsers'],
        ['Performance audit: Lighthouse score >90 on all pages', 'Both', '1', 'Optimised images, code splitting, caching verified'],
        ['Security audit: OWASP top 10, input validation, rate limiting', 'Both', '1', 'No critical vulnerabilities in penetration test'],
        ['Production deployment: Stripe live keys, DNS, SSL', 'Both', '0.5', 'Production environment live and verified'],
        ['Launch monitoring: 48-hour watch with Sentry + Vercel alerts', 'Both', '0.5', 'Zero critical errors in first 48 hours'],
    ],
    [0.42, 0.12, 0.10, 0.36]
))
story.append(Spacer(1, 6))

story.append(H2('6.9 Risk Assessment'))
story.append(make_table(
    ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
    [
        ['Timeline slip due to scope creep', 'High', 'High', 'Strict MVP scope; defer all Could-Have features'],
        ['Stripe integration complexity', 'Medium', 'High', 'Start webhook testing in Week 3 with Stripe CLI'],
        ['Turso limitations at scale', 'Low', 'High', 'Design schema for PostgreSQL compatibility; plan migration path'],
        ['UK compliance gaps', 'Medium', 'Critical', 'Dedicated compliance week (Phase 5); legal review before launch'],
        ['Single developer unavailability', 'Medium', 'High', 'Cross-train on all code areas; daily commits to main branch'],
        ['Mobile app app store rejection', 'Medium', 'Medium', 'Use Physical Goods exemption; no in-app purchases for groceries'],
    ],
    [0.25, 0.15, 0.15, 0.45]
))
story.append(Spacer(1, 6))

story.append(H2('6.10 Testing Strategy'))
story.append(P('The testing strategy follows a pyramid model: 70% unit tests, 20% integration tests, and 10% end-to-end tests. Unit tests cover all business logic functions (VAT calculation, price computation, promo code validation, RBAC checks) using Vitest with a target of 80% code coverage. Integration tests verify API endpoint behaviour with a real Turso database (test instance) using Supertest, covering authentication, CRUD operations, and payment flows. End-to-end tests use Playwright to verify complete customer and staff journeys across all major flows. All tests run on every pull request via GitHub Actions, and merges to main are blocked if any test fails.'))

story.append(H2('6.11 Deployment Pipeline'))
story.append(P('The CI/CD pipeline uses GitHub Actions with three environments: development (auto-deploy on every PR for preview), staging (auto-deploy on merge to main for QA testing), and production (manual approval gate before deploy). Each deployment runs the following steps: lint (ESLint + TypeScript compiler), test (Vitest unit + integration), build (Next.js production build), migrate (Drizzle schema push), deploy (Vercel CLI), and verify (Sentry source map upload + smoke test). Rollback is achieved by redeploying the previous Vercel deployment, which takes under 60 seconds.'))

story.append(PageBreak())

# ── Verification Items Summary ──
story.append(H1('Items Requiring Verification'))
story.append(Spacer(1, 8))
story.append(P('The following items have been flagged during document generation with [VERIFY] markers. These represent assumptions or decisions that need confirmation from the project owner or team before implementation begins.'))
story.append(Spacer(1, 8))

verify_items = [
    ['1', 'Database Choice', 'Research suggests PostgreSQL (Neon/Supabase) with PostGIS may be better than Turso for geospatial queries and complex relational operations. Turso is adequate for single-store MVP but may need migration for multi-store expansion.'],
    ['2', 'Payment Gateway', 'Stripe is confirmed as best for one-time checkout. Consider adding GoCardless for Direct Debit if subscription/recurring grocery orders are planned for v2.'],
    ['3', 'Mobile Framework', 'CapacitorJS vs React Native (Expo): Research suggests React Native provides better native GPS, push notification, and camera support. Evaluate based on mobile feature requirements.'],
    ['4', 'Delivery Pricing Model', 'The blueprint specifies a delivery_fee column but does not define the pricing strategy. Options: fixed fee per order, distance-based tiered pricing, or free-above-threshold model.'],
    ['5', 'Single vs Multi-Store', 'Current schema supports a single store. Multi-store marketplace would require Stripe Connect, a stores table, and tenant isolation in the data model.'],
    ['6', 'Timeline Risk', '8 weeks for 2 developers is very tight. If either developer is unavailable for more than 2 days, the deadline is at risk. Consider scope reduction or timeline extension.'],
    ['7', 'HFSS Advertising', 'From January 2026, UK restricts online advertising of High in Fat, Salt and Sugar (HFSS) products. The product schema and CMS need an HFSS flag to filter promoted placements.'],
    ['8', 'Right-to-Work Checks', 'New UK legislation (2026) may require delivery platforms to verify couriers\' right to work. This needs to be built into the rider onboarding flow.'],
]

story.append(make_table(
    ['#', 'Item', 'Details'],
    verify_items,
    [0.05, 0.18, 0.77]
))

# ── Build ──
doc.multiBuild(story)
print(f"PDF generated: {output_path}")
print(f"File size: {os.path.getsize(output_path)} bytes")
