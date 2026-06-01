#!/usr/bin/env python3
"""Generate HTML version of UK Grocery Store 6 Pre-Coding Documents."""

html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UK Local Grocery Store - 6 Pre-Coding Documents</title>
<style>
  :root {
    --primary: #2D8C4E;
    --accent: #F7D36C;
    --error: #C91E1E;
    --info: #1F4E7C;
    --text: #1A1A2E;
    --muted: #6B7280;
    --bg: #F9FAFB;
    --surface: #F3F4F6;
    --border: #E5E7EB;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; }
  h1 { color: var(--info); font-size: 1.8rem; margin: 2rem 0 1rem; border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; }
  h2 { color: #5a4e2e; font-size: 1.3rem; margin: 1.5rem 0 0.75rem; }
  h3 { color: var(--text); font-size: 1.1rem; margin: 1rem 0 0.5rem; }
  p { margin: 0.5rem 0; }
  ul { margin: 0.5rem 0 0.5rem 1.5rem; }
  li { margin: 0.25rem 0; }
  .verify { color: var(--error); font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
  th { background: #7b6e48; color: white; padding: 8px 10px; text-align: left; }
  td { padding: 6px 10px; border: 1px solid var(--border); }
  tr:nth-child(even) td { background: var(--surface); }
  .cover { text-align: center; padding: 4rem 2rem; margin-bottom: 2rem; background: linear-gradient(135deg, #f0f7f0, #f5f5f0); border-radius: 12px; }
  .cover h1 { border: none; font-size: 2.5rem; color: var(--primary); }
  .cover .subtitle { font-size: 1.4rem; color: var(--muted); margin: 1rem 0; }
  .cover .docs-list { text-align: left; max-width: 400px; margin: 1.5rem auto; }
  .cover .meta { color: var(--muted); font-size: 0.95rem; margin-top: 2rem; }
  .toc { background: var(--surface); padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 2rem; }
  .toc a { color: var(--info); text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  .toc li { margin: 0.4rem 0; }
</style>
</head>
<body>

<div class="cover">
  <h1>UK Local Grocery Store</h1>
  <div class="subtitle">6 Pre-Coding Documents</div>
  <div class="docs-list">
    <ol>
      <li>Product Requirements Document (PRD)</li>
      <li>Technical Requirements Document (TRD)</li>
      <li>App Flow Document</li>
      <li>UI/UX Design Brief</li>
      <li>Backend Schema Document</li>
      <li>Implementation Plan</li>
    </ol>
  </div>
  <div class="meta">
    <p>Version 1.0 | June 2026</p>
    <p>Prepared by Z.ai for TrishulHub</p>
  </div>
</div>

<div class="toc">
  <h2>Table of Contents</h2>
  <ol>
    <li><a href="#prd">Product Requirements Document (PRD)</a>
      <ul>
        <li>1.1 Product Overview</li>
        <li>1.2 Problem Statement</li>
        <li>1.3 Target Users</li>
        <li>1.4 Core Features (MoSCoW)</li>
        <li>1.5 User Roles and Permissions</li>
        <li>1.6 User Stories</li>
        <li>1.7 Success Metrics (KPIs)</li>
        <li>1.8 MVP Scope</li>
        <li>1.9 Competitive Advantage</li>
      </ul>
    </li>
    <li><a href="#trd">Technical Requirements Document (TRD)</a>
      <ul>
        <li>2.1 Architecture Overview</li>
        <li>2.2 Technology Stack</li>
        <li>2.3 Frontend Stack</li>
        <li>2.4 Backend Stack</li>
        <li>2.5 Database</li>
        <li>2.6 Authentication</li>
        <li>2.7 Payment Integration</li>
        <li>2.8 Third-Party Integrations</li>
        <li>2.9 Security Requirements</li>
        <li>2.10 Performance Requirements</li>
      </ul>
    </li>
    <li><a href="#appflow">App Flow Document</a>
      <ul>
        <li>3.1 Screen Inventory</li>
        <li>3.2 Customer User Journey</li>
        <li>3.3 Error and Edge Case Flows</li>
        <li>3.4 Navigation Flow</li>
      </ul>
    </li>
    <li><a href="#uiux">UI/UX Design Brief</a>
      <ul>
        <li>4.1 Design Philosophy</li>
        <li>4.2 Color Palette</li>
        <li>4.3 Typography</li>
        <li>4.4 Component Style Guide</li>
        <li>4.5 Responsive Breakpoints</li>
        <li>4.6 Accessibility Requirements</li>
        <li>4.7 Inspiration References</li>
      </ul>
    </li>
    <li><a href="#schema">Backend Schema Document</a>
      <ul>
        <li>5.1 Design Principles</li>
        <li>5.2 Core Tables</li>
        <li>5.3 Supporting Tables</li>
        <li>5.4 Indexes</li>
        <li>5.5 Authentication and Sessions</li>
        <li>5.6 VAT Configuration</li>
        <li>5.7 Migration Strategy</li>
      </ul>
    </li>
    <li><a href="#plan">Implementation Plan</a>
      <ul>
        <li>6.1 Timeline Overview</li>
        <li>6.2 Phase 1: Foundation (Week 1)</li>
        <li>6.3 Phase 2: Core Storefront (Weeks 2-3)</li>
        <li>6.4 Phase 3: Admin Dashboard (Week 4)</li>
        <li>6.5 Phase 4: Payments (Week 5)</li>
        <li>6.6 Phase 5: Compliance (Week 6)</li>
        <li>6.7 Phase 6: Notifications & Tracking (Week 7)</li>
        <li>6.8 Phase 7: Testing & Launch (Week 8)</li>
        <li>6.9 Risk Assessment</li>
        <li>6.10 Testing Strategy</li>
        <li>6.11 Deployment Pipeline</li>
      </ul>
    </li>
  </ol>
</div>

<h1 id="prd">1. Product Requirements Document (PRD)</h1>

<h2>1.1 Product Overview</h2>
<p><strong>Product Name:</strong> UK Local Grocery Store</p>
<p><strong>One-Line Idea:</strong> Order groceries from your local store and get delivery in under 60 minutes.</p>
<p><strong>Version:</strong> 1.0 (MVP)</p>
<p><strong>Platform:</strong> Web (responsive) + Mobile App (iOS/Android via CapacitorJS)</p>
<p><strong>Target Market:</strong> United Kingdom (urban and suburban areas)</p>

<h2>1.2 Problem Statement</h2>
<p>The UK grocery delivery market is dominated by supermarket giants like Tesco Whoosh and Sainsbury's Chop Chop, which leverage existing store networks but suffer from frequent out-of-stock substitutions, inconsistent delivery times, and poor customer service. Pure quick-commerce players like Getir and Gorillas collapsed in 2024 due to unsustainable dark-store economics, proving that ultra-fast delivery (under 15 minutes) is not viable in the UK market without massive capital expenditure. Meanwhile, independent local grocery stores are being left out of the digital economy entirely, unable to compete with the logistics infrastructure of Tesco or Ocado. There is a clear gap in the market for a platform that connects local grocery stores directly with their surrounding communities, offering reliable 30-60 minute delivery without the overhead of dark stores or the inconsistency of gig-economy personal shoppers like Beelivery.</p>

<h2>1.3 Target Users</h2>
<p>The primary user base consists of UK residents aged 18-65 living in urban and suburban areas who need convenient grocery delivery. This includes busy professionals who do not have time to visit physical stores, families with young children for whom grocery shopping is logistically challenging, elderly or mobility-impaired individuals who cannot easily carry heavy shopping bags, and students or young adults in shared accommodation who prefer smaller, more frequent shops over large weekly hauls. Secondary users include the local grocery store owners and their staff (managers, pickers, and riders) who need a streamlined operational tool to manage orders, inventory, and deliveries from a single dashboard.</p>

<h2>1.4 Core Features (MoSCoW Prioritization)</h2>

<h3>Must Have (MVP)</h3>
<ul>
  <li>Customer postcode-based delivery zone validation (Postcodes.io)</li>
  <li>Product browsing by category with real-time stock status</li>
  <li>Shopping cart with server-side price and VAT calculation</li>
  <li>Stripe checkout with 3D Secure (SCA) compliance</li>
  <li>Order lifecycle: New, Packing, Out for Delivery, Delivered, Cancelled</li>
  <li>Kanban board for order management in admin dashboard</li>
  <li>RBAC: Customer, Owner, Manager, Picker, Rider roles</li>
  <li>VAT-compliant pricing (0%, 5%, 20%) with unit pricing display</li>
  <li>Allergen information display (Natasha's Law compliance)</li>
  <li>Challenge 25 age verification flag for restricted items</li>
  <li>Rider manual ETA setting with customer live tracking</li>
  <li>Email order confirmation (Resend) + SMS delivery updates (Twilio)</li>
  <li>Responsive design (mobile-first, WCAG 2.1 AA)</li>
</ul>

<h3>Should Have</h3>
<ul>
  <li>Promo code system with percentage and flat discount types</li>
  <li>Homepage banner carousel (admin-configurable)</li>
  <li>"Buy It Again" quick reorder from order history</li>
  <li>Guest checkout (email-only, full account creation post-purchase)</li>
  <li>Product search with predictive suggestions</li>
  <li>Low stock alerts and kill switch for out-of-stock items</li>
  <li>Staff attendance tracking</li>
  <li>Wastage/expiry log for fresh items</li>
  <li>Delivery zone management in admin settings</li>
  <li>Store open/close status with automatic scheduling</li>
</ul>

<h3>Could Have (Post-MVP)</h3>
<ul>
  <li>CapacitorJS mobile app (iOS/Android) with push notifications</li>
  <li>Subscription/recurring orders (GoCardless Direct Debit)</li>
  <li>Loyalty points system</li>
  <li>Product reviews and ratings</li>
  <li>Multi-store/multi-vendor support (Stripe Connect)</li>
  <li>Advanced analytics dashboard with export</li>
  <li>WhatsApp Business API notifications</li>
  <li>AI-powered product recommendations</li>
</ul>

<h3>Won't Have (v1)</h3>
<ul>
  <li>Real-time GPS tracking of riders (uses manual ETA instead)</li>
  <li>Automated inventory management or POS integration</li>
  <li>Voice commerce or AI chatbot ordering</li>
  <li>Social media integration or sharing features</li>
  <li>Multi-language support (English only for v1)</li>
  <li>Cryptocurrency or non-card payment methods</li>
</ul>

<h2>1.5 User Roles and Permissions</h2>
<table>
  <tr><th>Role</th><th>Access Level</th><th>Key Permissions</th></tr>
  <tr><td>Customer</td><td>Storefront + own orders</td><td>Browse, cart, checkout, track orders, view history, manage profile</td></tr>
  <tr><td>Owner</td><td>Full dashboard</td><td>All Manager permissions + finance, audit logs, system settings, salary data</td></tr>
  <tr><td>Manager</td><td>Operational dashboard</td><td>Products, categories, brands, promo codes, banners, staff attendance</td></tr>
  <tr><td>Picker</td><td>Packing queue only</td><td>View assigned orders, update packing status</td></tr>
  <tr><td>Rider</td><td>Delivery queue only</td><td>View deliveries, set ETA, adjust ETA, mark delivered, verify age</td></tr>
</table>

<h2>1.6 User Stories</h2>
<h3>Customer Stories</h3>
<ul>
  <li>As a customer, I want to enter my postcode so that I can verify my area is within the delivery zone before browsing.</li>
  <li>As a customer, I want to browse products by category so that I can quickly find the groceries I need.</li>
  <li>As a customer, I want to see allergen information on each product so that I can make safe food choices for my family.</li>
  <li>As a customer, I want to see the total including VAT before checkout so that there are no surprise charges.</li>
  <li>As a customer, I want to pay with Apple Pay or Google Pay so that I can checkout quickly.</li>
  <li>As a customer, I want to track my order in real time with a countdown timer so that I know when to expect delivery.</li>
  <li>As a customer, I want to reorder my previous basket with one tap so that I can quickly restock my regular items.</li>
</ul>

<h3>Staff Stories</h3>
<ul>
  <li>As a picker, I want to see only my assigned orders in a Kanban view so that I can focus on packing.</li>
  <li>As a rider, I want to set my own delivery ETA based on local knowledge so that customers get accurate estimates.</li>
  <li>As a manager, I want to toggle a product as "out of stock" instantly so that customers never order unavailable items.</li>
  <li>As an owner, I want to see total VAT collected so that I can file accurate HMRC returns.</li>
</ul>

<h2>1.7 Success Metrics (KPIs)</h2>
<table>
  <tr><th>KPI</th><th>Target</th><th>Measurement</th></tr>
  <tr><td>Order Completion Rate</td><td>&gt; 95%</td><td>Delivered orders / total orders</td></tr>
  <tr><td>On-Time Delivery</td><td>&gt; 90%</td><td>Orders delivered within rider-set ETA</td></tr>
  <tr><td>Average Delivery Time</td><td>&lt; 45 min</td><td>Mean time from order to delivery</td></tr>
  <tr><td>Customer NPS</td><td>&gt; 50</td><td>Post-delivery survey</td></tr>
  <tr><td>Cart Abandonment Rate</td><td>&lt; 30%</td><td>Carts abandoned / carts created</td></tr>
  <tr><td>Payment Success Rate</td><td>&gt; 98%</td><td>Successful charges / attempts</td></tr>
</table>

<h2>1.8 MVP Scope</h2>
<h3>In Scope (v1)</h3>
<ul>
  <li>Full customer storefront: browse, search, cart, checkout, order tracking, order history</li>
  <li>Complete admin dashboard: orders (Kanban), catalog, finance (basic), staff management, settings</li>
  <li>Stripe payment integration with webhook verification</li>
  <li>UK compliance: VAT calculation, allergen display, Challenge 25 flags, unit pricing</li>
  <li>Email + SMS notifications for order lifecycle events</li>
  <li>Responsive web design (mobile, tablet, desktop)</li>
  <li>Postcode-based delivery zone validation</li>
</ul>
<h3>Out of Scope (v1)</h3>
<ul>
  <li>Native mobile app (CapacitorJS wrapper is post-MVP)</li>
  <li>Real-time GPS rider tracking (manual ETA is sufficient for launch)</li>
  <li>Subscription/recurring orders</li>
  <li>Multi-store marketplace model</li>
</ul>

<h2>1.9 Competitive Advantage</h2>
<p>Unlike Tesco Whoosh and Sainsbury's Chop Chop which suffer from frequent out-of-stock substitutions (Trustpilot 1/5 stars each), our platform enforces real-time stock validation at add-to-cart time. Unlike Beelivery which relies on personal shoppers with inconsistent quality and high mark-ups, our model uses store-based fulfilment with dedicated pickers and riders. Unlike Zapp which is limited to London and uses expensive dark stores, our store-pick model leverages existing grocery store infrastructure, making it economically viable to expand beyond London to any UK town with a local grocery store.</p>
<p class="verify">[VERIFY: Delivery pricing model — fixed fee per order, distance-based, or free-above-threshold?]</p>
<p class="verify">[VERIFY: Single-store platform or multi-store marketplace? Current schema supports single-store only.]</p>

<h1 id="trd">2. Technical Requirements Document (TRD)</h1>

<h2>2.1 Architecture Overview</h2>
<p>The platform follows a server-first architecture where the Next.js API Routes running on Vercel serverless functions serve as the single source of truth for all pricing, inventory, and order state. The system is organised as a Turborepo monorepo housing both the customer storefront and the admin dashboard in a single repository. Stripe handles payment processing via cryptographically verified webhooks. The Turso database provides edge-replicated SQLite for fast reads, and Vercel KV (Redis) handles session storage, rate limiting, and cart caching.</p>

<h2>2.2 Technology Stack</h2>
<table>
  <tr><th>Layer</th><th>Technology</th><th>Purpose</th><th>Cost</th></tr>
  <tr><td>Frontend</td><td>Next.js 14+ (App Router)</td><td>Storefront + Admin (Turborepo)</td><td>Free</td></tr>
  <tr><td>Backend API</td><td>Next.js API Routes</td><td>REST on Vercel serverless</td><td>Free tier</td></tr>
  <tr><td>Database</td><td>Turso (libSQL)</td><td>Primary data store with edge replication</td><td>Free tier</td></tr>
  <tr><td>Cache</td><td>Vercel KV (Redis)</td><td>Sessions, rate limiting, cart cache</td><td>Free tier</td></tr>
  <tr><td>Auth</td><td>NextAuth.js v5</td><td>Magic link + credentials</td><td>Free</td></tr>
  <tr><td>Payments</td><td>Stripe</td><td>Card payments, refunds, webhooks</td><td>1.5% + 20p/tx</td></tr>
  <tr><td>File Storage</td><td>Vercel Blob</td><td>Product images, receipts</td><td>Free tier</td></tr>
  <tr><td>Email</td><td>Resend</td><td>Order confirmations</td><td>Free (3K/mo)</td></tr>
  <tr><td>SMS</td><td>Twilio</td><td>Delivery updates</td><td>Pay per use</td></tr>
  <tr><td>Push</td><td>FCM</td><td>Mobile push notifications</td><td>Free</td></tr>
  <tr><td>Maps/Geo</td><td>Postcodes.io</td><td>UK postcode validation</td><td>Free</td></tr>
  <tr><td>Monitoring</td><td>Sentry</td><td>Error tracking</td><td>Free tier</td></tr>
  <tr><td>CI/CD</td><td>GitHub Actions</td><td>Automated deploy</td><td>Free tier</td></tr>
  <tr><td>Mobile</td><td>CapacitorJS</td><td>Web app wrapper for iOS/Android</td><td>Free</td></tr>
</table>

<h2>2.5 Database</h2>
<p>The primary database is Turso (libSQL), an edge-replicated SQLite service. All tables use UUID v4 primary keys. Order items snapshot prices and VAT rates at time of purchase.</p>
<p class="verify">[VERIFY: Research suggests PostgreSQL (Neon/Supabase) with PostGIS may be better than Turso for geospatial queries and complex relational operations. Turso is adequate for single-store MVP but may need migration for multi-store expansion.]</p>

<h2>2.7 Payment Integration</h2>
<p>Stripe handles all payment processing with PaymentIntent creation on the server, Stripe.js for card input, webhook endpoint with signature verification, and automatic 3D Secure (SCA) handling. Apple Pay and Google Pay are enabled. Refund processing supports partial refunds for Challenge 25 failures.</p>
<p class="verify">[VERIFY: Consider adding GoCardless for Direct Debit if subscription/recurring grocery orders are planned for v2.]</p>

<h2>2.10 Performance Requirements</h2>
<table>
  <tr><th>Metric</th><th>Target</th></tr>
  <tr><td>First Contentful Paint</td><td>&lt; 1.5s</td></tr>
  <tr><td>API Response Time (read)</td><td>&lt; 200ms</td></tr>
  <tr><td>API Response Time (write)</td><td>&lt; 500ms</td></tr>
  <tr><td>Uptime</td><td>&gt; 99.9%</td></tr>
  <tr><td>Error Rate</td><td>&lt; 0.1%</td></tr>
</table>

<p class="verify">[VERIFY: CapacitorJS vs React Native (Expo) for mobile app: Research suggests React Native provides better native GPS, push notification, and camera support. Evaluate based on mobile feature requirements.]</p>

<h1 id="appflow">3. App Flow Document</h1>

<h2>3.1 Screen Inventory</h2>
<p>The platform comprises 32 screens across Customer Storefront (15 screens) and Admin Dashboard (17 screens). See the PDF version for the complete screen inventory table.</p>

<h2>3.2 Customer User Journey</h2>
<h3>Discovery and Onboarding</h3>
<p>First-time customers see a location detection popup. GPS permission triggers reverse-geocoding via Postcodes.io; manual postcode entry is the fallback. Valid postcode proceeds to homepage with delivery timer; invalid shows Delivery Unavailable with email signup. No account creation required at this stage.</p>

<h3>Browsing and Adding to Cart</h3>
<p>Homepage features banner carousel, category sliders, search bar, and floating cart widget. Product cards show image, name, price (VAT-inclusive), discount badge, and ADD button. Product Detail shows allergens, unit pricing, Challenge 25 badge. Slide-out cart has quantity controls, promo codes, bill summary, and checkout button.</p>

<h3>Checkout and Payment</h3>
<p>Checkout collects delivery address (with autocomplete), phone, and payment method. Guest checkout available (email-only). Stripe Payment Sheet handles cards, Apple Pay, Google Pay with 3D Secure. On success: order created, inventory decremented, confirmation shown. On failure: cart preserved, clear error with retry.</p>

<h3>Order Tracking</h3>
<p>Tracking screen shows vertical timeline (Confirmed, Packing, Out for Delivery, Delivered), live countdown timer, rider contact card, and ETA adjustment notifications. "Almost there!" state when ETA drops below 5 minutes.</p>

<h2>3.3 Error and Edge Case Flows</h2>
<table>
  <tr><th>State</th><th>Trigger</th><th>User Experience</th></tr>
  <tr><td>Payment Failed</td><td>Card declined</td><td>Clear message + alternative payment; cart intact</td></tr>
  <tr><td>Out of Stock</td><td>Item unavailable</td><td>Badge on card; add button disabled</td></tr>
  <tr><td>ETA Expired</td><td>Rider ETA passed</td><td>"Running slightly late"; auto-alert Manager</td></tr>
  <tr><td>Challenge 25 Failed</td><td>Age not verified</td><td>Restricted items removed; partial refund</td></tr>
  <tr><td>Network Error</td><td>No internet</td><td>Banner + cached content via Service Worker</td></tr>
</table>

<h1 id="uiux">4. UI/UX Design Brief</h1>

<h2>4.1 Design Philosophy</h2>
<p>The design language is "Fresh Market" — clean, trust-building, combining farmers' market freshness with modern e-commerce reliability. Visual identity communicates freshness (green tones), speed (bold delivery timers), and trust (transparent pricing, security badges). Inspired by Zapp's minimalism, Ocado's premium quality, and Tesco's practical efficiency.</p>

<h2>4.2 Color Palette</h2>
<table>
  <tr><th>Role</th><th>Name</th><th>Hex</th><th>Usage</th></tr>
  <tr><td>Primary</td><td>Fresh Leaf Green</td><td>#2D8C4E</td><td>Buttons, active states, brand identity</td></tr>
  <tr><td>Accent</td><td>Golden Harvest</td><td>#F7D36C</td><td>Deals/offers, promo highlights</td></tr>
  <tr><td>Error</td><td>Vibrant Red</td><td>#C91E1E</td><td>Errors, out-of-stock, Challenge 25</td></tr>
  <tr><td>Info</td><td>Deep Navy</td><td>#1F4E7C</td><td>Links, trust badges, security</td></tr>
  <tr><td>Text</td><td>Midnight Ink</td><td>#1A1A2E</td><td>Body text, headings</td></tr>
  <tr><td>Background</td><td>Cloud White</td><td>#F9FAFB</td><td>Page background</td></tr>
</table>

<h2>4.3 Typography</h2>
<ul>
  <li><strong>Headings:</strong> DM Sans (Bold/SemiBold) — clean geometric, modern</li>
  <li><strong>Body:</strong> Inter (Regular/Medium) — tabular figures for prices, excellent readability</li>
  <li>Support Dynamic Type up to 200% without horizontal scroll</li>
</ul>

<h2>4.5 Responsive Breakpoints</h2>
<table>
  <tr><th>Breakpoint</th><th>Width</th><th>Layout</th></tr>
  <tr><td>Mobile S</td><td>320-374px</td><td>Single column, bottom sheet cart</td></tr>
  <tr><td>Mobile</td><td>375-428px</td><td>Single column, sticky add button</td></tr>
  <tr><td>Tablet</td><td>429-768px</td><td>Two-column grid, sidebar cart</td></tr>
  <tr><td>Desktop S</td><td>769-1024px</td><td>Three-column grid</td></tr>
  <tr><td>Desktop</td><td>1025-1440px</td><td>Four-column grid</td></tr>
  <tr><td>Desktop XL</td><td>1441px+</td><td>Six-column grid</td></tr>
</table>

<h1 id="schema">5. Backend Schema Document</h1>

<h2>5.1 Design Principles</h2>
<p>Designed for Turso (libSQL) with full UK compliance at the data layer. Every product includes VAT rate, unit pricing, allergen data, and Challenge 25 flag. Order items snapshot prices at purchase time. All tables use UUID v4 primary keys.</p>

<h2>5.2 Core Tables</h2>
<ul>
  <li><strong>users:</strong> id, email, phone, full_name, password_hash, role, postcode, is_banned, created_at, updated_at</li>
  <li><strong>products:</strong> id, name, description, category_id, brand_id, price, compare_at_price, unit_price, vat_rate, weight_value, weight_unit, image_url, stock_count, low_stock_threshold, is_active, challenge_25, allergens, ingredients, use_by_date, created_at</li>
  <li><strong>orders:</strong> id, user_id, status, subtotal, vat_total, delivery_fee, discount_amount, total, stripe_payment_intent_id, delivery_address, delivery_postcode, customer_phone, assigned_picker_id, assigned_rider_id, estimated_delivery_minutes, estimated_delivery_at, dispatched_at, delivered_at, eta_adjustment_count, age_verified, promo_code_id, cancellation_reason, created_at, updated_at</li>
  <li><strong>order_items:</strong> id, order_id, product_id, quantity, unit_price (snapshot), vat_rate (snapshot), line_total</li>
</ul>

<h2>5.3 Supporting Tables</h2>
<ul>
  <li><strong>categories:</strong> id, name, slug, display_order, is_active</li>
  <li><strong>brands:</strong> id, name, slug, logo_url</li>
  <li><strong>promo_codes:</strong> id, code, discount_type, discount_value, min_order, max_uses, used_count, expires_at</li>
  <li><strong>delivery_zones:</strong> id, postcode_prefix, max_distance_km, is_active</li>
  <li><strong>banners:</strong> id, image_url, link_target, display_order, is_active</li>
  <li><strong>staff_attendance:</strong> id, user_id, date, status</li>
  <li><strong>wastage_log:</strong> id, product_id, quantity, reason, logged_at</li>
  <li><strong>audit_log:</strong> id, user_id, action, entity, entity_id, timestamp</li>
  <li><strong>order_tracking:</strong> id, order_id, status, eta_minutes, rider_lat, rider_lng, timestamp</li>
  <li><strong>notifications:</strong> id, user_id, type, message, is_read, created_at</li>
</ul>

<h2>5.6 VAT Configuration</h2>
<table>
  <tr><th>Category</th><th>Rate</th><th>Examples</th></tr>
  <tr><td>Zero-rated</td><td>0%</td><td>Most food, books, children's clothing</td></tr>
  <tr><td>Reduced rate</td><td>5%</td><td>Domestic energy, children's car seats</td></tr>
  <tr><td>Standard rate</td><td>20%</td><td>Alcohol, soft drinks, confectionery, tobacco</td></tr>
</table>
<p><strong>Critical Rule:</strong> All VAT calculations must be performed server-side. Never trust client-submitted prices.</p>

<h1 id="plan">6. Implementation Plan</h1>

<h2>6.1 Timeline Overview</h2>
<p>8-week plan for 2 full-stack developers. Structured in 7 phases with clear deliverables and acceptance criteria. Deadline: June 15, 2026.</p>
<p class="verify">[VERIFY: Timeline is very tight for 2 developers over 8 weeks. If either developer is unavailable for more than 2 days, the deadline is at risk.]</p>

<h2>6.2 Phase 1: Foundation and Authentication (Week 1)</h2>
<ul>
  <li>Turborepo monorepo setup with apps/web + apps/admin</li>
  <li>Turso database setup + Drizzle ORM schema (all 14 tables)</li>
  <li>NextAuth.js v5 integration (magic link + credentials)</li>
  <li>Vercel deployment pipeline (dev/staging/prod)</li>
  <li>RBAC middleware + role-based route protection</li>
  <li>Sentry error tracking integration</li>
</ul>

<h2>6.3 Phase 2: Core Storefront (Weeks 2-3)</h2>
<ul>
  <li>Homepage: banner carousel, category sliders, search bar</li>
  <li>Product listing: category page with sidebar + grid</li>
  <li>Product detail page with allergens, VAT, Challenge 25</li>
  <li>Shopping cart: slide-out sidebar, quantity controls</li>
  <li>Postcode validation + delivery zone check</li>
  <li>Search: predictive search with instant suggestions</li>
  <li>Cart persistence in Vercel KV (guest + authenticated)</li>
</ul>

<h2>6.4 Phase 3: Admin Dashboard (Week 4)</h2>
<ul>
  <li>Kanban board: 4-column order management with drag-and-drop</li>
  <li>Catalog management: products CRUD with image upload</li>
  <li>Category and brand management</li>
  <li>Staff management: list, attendance, role assignment</li>
  <li>Dashboard overview: revenue, orders, profit metrics</li>
</ul>

<h2>6.5 Phase 4: Payments and Webhooks (Week 5)</h2>
<ul>
  <li>Stripe PaymentIntent creation (server-side)</li>
  <li>Stripe.js integration + 3D Secure (SCA)</li>
  <li>Webhook endpoint with signature verification</li>
  <li>Order creation on payment success</li>
  <li>Payment failure handling + cart preservation</li>
  <li>Refund flow (full + partial for Challenge 25)</li>
</ul>

<h2>6.6 Phase 5: Compliance Layer (Week 6)</h2>
<ul>
  <li>VAT calculation engine (0%, 5%, 20%) server-side</li>
  <li>Unit pricing display on all product cards</li>
  <li>Allergen data display (14 allergens, Natasha's Law)</li>
  <li>Challenge 25 flag + age verification flow for riders</li>
  <li>Privacy policy + cookie consent (UK GDPR + PECR)</li>
  <li>Consumer rights: cancellation + refund policy pages</li>
</ul>

<h2>6.7 Phase 6: Notifications and Tracking (Week 7)</h2>
<ul>
  <li>Resend email integration (order confirmation, delivery updates)</li>
  <li>Twilio SMS integration (ETA notifications, OTP)</li>
  <li>Rider ETA system: manual ETA setting + quick presets</li>
  <li>Customer tracking screen: countdown timer + status timeline</li>
  <li>ETA adjustment flow (max 3 adjustments + expiry handling)</li>
  <li>Promo code system + banner management</li>
</ul>

<h2>6.8 Phase 7: Testing, QA and Launch (Week 8)</h2>
<ul>
  <li>End-to-end testing: full customer + staff journeys</li>
  <li>Cross-browser testing: Chrome, Safari, Firefox, Edge, mobile</li>
  <li>Performance audit: Lighthouse score &gt;90 on all pages</li>
  <li>Security audit: OWASP top 10, input validation, rate limiting</li>
  <li>Production deployment: Stripe live keys, DNS, SSL</li>
  <li>Launch monitoring: 48-hour watch with Sentry + Vercel alerts</li>
</ul>

<h2>6.9 Risk Assessment</h2>
<table>
  <tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr>
  <tr><td>Timeline slip (scope creep)</td><td>High</td><td>High</td><td>Strict MVP scope; defer Could-Have features</td></tr>
  <tr><td>Stripe integration complexity</td><td>Medium</td><td>High</td><td>Start webhook testing in Week 3 with Stripe CLI</td></tr>
  <tr><td>Turso limitations at scale</td><td>Low</td><td>High</td><td>Design schema for PostgreSQL compatibility</td></tr>
  <tr><td>UK compliance gaps</td><td>Medium</td><td>Critical</td><td>Dedicated compliance week; legal review before launch</td></tr>
  <tr><td>Developer unavailability</td><td>Medium</td><td>High</td><td>Cross-train; daily commits to main</td></tr>
</table>

<h2>Items Requiring Verification</h2>
<table>
  <tr><th>#</th><th>Item</th><th>Details</th></tr>
  <tr><td>1</td><td>Database Choice</td><td>PostgreSQL+PostGIS may be better than Turso for geospatial queries. Turso adequate for single-store MVP.</td></tr>
  <tr><td>2</td><td>Payment Gateway</td><td>Consider GoCardless for Direct Debit if subscriptions planned for v2.</td></tr>
  <tr><td>3</td><td>Mobile Framework</td><td>React Native (Expo) may provide better native features than CapacitorJS.</td></tr>
  <tr><td>4</td><td>Delivery Pricing</td><td>Strategy undefined: fixed fee, distance-based, or free-above-threshold?</td></tr>
  <tr><td>5</td><td>Single vs Multi-Store</td><td>Current schema supports single store. Multi-store needs Stripe Connect.</td></tr>
  <tr><td>6</td><td>Timeline Risk</td><td>8 weeks for 2 devs is very tight. Consider scope reduction or extension.</td></tr>
  <tr><td>7</td><td>HFSS Advertising</td><td>Jan 2026 UK restrictions on HFSS product advertising need an HFSS flag in schema.</td></tr>
  <tr><td>8</td><td>Right-to-Work</td><td>New UK legislation may require courier right-to-work checks in rider onboarding.</td></tr>
</table>

</body>
</html>
"""

output = '/home/z/my-project/download/UK_Grocery_Store_6_PreCoding_Docs.html'
with open(output, 'w', encoding='utf-8') as f:
    f.write(html)
print(f"HTML generated: {output}")
print(f"File size: {os.path.getsize(output)} bytes")
