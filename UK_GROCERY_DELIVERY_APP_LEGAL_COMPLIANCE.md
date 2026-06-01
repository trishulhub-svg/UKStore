# UK Grocery Delivery App — Legal Compliance Requirements

> **Research Date**: March 2026  
> **Scope**: All mandatory UK legal/regulatory requirements for operating a grocery delivery application  
> **Sources**: GOV.UK, ICO, FSA, FCA, Legislation.gov.uk, and specialist legal publishers

---

## Table of Contents

1. [UK GDPR & Data Protection Act 2018](#1-uk-gdpr--data-protection-act-2018)
2. [PECR (Privacy and Electronic Communications Regulations 2003) & DUAA 2025](#2-pecr--duaa-2025)
3. [Consumer Rights Act 2015](#3-consumer-rights-act-2015)
4. [Food Safety Act 1990 & Food Business Registration](#4-food-safety-act-1990--food-business-registration)
5. [Food Information Regulations 2014 (FIR) — 14 Allergens & Distance Selling](#5-food-information-regulations-2014-fir--14-allergens--distance-selling)
6. [Natasha's Law — Food Information (Amendment) Regulations 2021](#6-natashas-law--food-information-amendment-regulations-2021)
7. [Licensing Act 2003 & Challenge 25 — Age Verification](#7-licensing-act-2003--challenge-25--age-verification)
8. [VAT Act 1994 — VAT Registration & Digital Services](#8-vat-act-1994--vat-registration--digital-services)
9. [Payment Services Regulations 2017 — SCA & 3D Secure](#9-payment-services-regulations-2017--sca--3d-secure)
10. [PCI DSS — Payment Card Industry Data Security Standard](#10-pci-dss--payment-card-industry-data-security-standard)
11. [Equality Act 2010 — Digital Accessibility](#11-equality-act-2010--digital-accessibility)
12. [HFSS Advertising Restrictions 2025–2026](#12-hfss-advertising-restrictions-20252026)
13. [Courier/Worker Right-to-Work Checks (Immigration)](#13-courierworker-right-to-work-checks-immigration)
14. [Consolidated Technical Implementation Checklist](#14-consolidated-technical-implementation-checklist)

---

## 1. UK GDPR & Data Protection Act 2018

### Legal Citation
- **UK GDPR**: Retained EU Regulation 2016/679 as amended by the Data Protection, Privacy and Electronic Communications (Amendments etc) (EU Exit) Regulations 2019
- **Data Protection Act 2018** (DPA 2018): UK implementing legislation — `ukpga/2018/12`
- **Data (Use and Access) Act 2025** (DUAA): Latest amendments to DPA 2018 and UK GDPR

### Key Requirements for a Grocery Delivery App

| Requirement | Detail |
|---|---|
| **Lawful basis for processing** | Must identify and document a lawful basis under Article 6 for every processing activity (e.g., Contract for order processing, Consent for marketing, Legitimate Interest for fraud prevention) |
| **Special category data** | If processing health/allergen data (e.g., dietary requirements), need Article 9 condition + Article 6 basis. Explicit consent is most common basis |
| **Privacy notice** | Must provide concise, transparent, intelligible, easily accessible privacy information at point of data collection (Articles 12–14) |
| **Data Subject Rights** | Must support: access (Art.15), rectification (Art.16), erasure (Art.17), restriction (Art.18), data portability (Art.20), objection (Art.21) |
| **Data Processing Records** | Maintain Article 30 Record of Processing Activities (ROPA) |
| **Data Protection Impact Assessment** | Mandatory DPIA for high-risk processing (e.g., profiling, large-scale processing of health data, tracking location data of delivery drivers/customers) |
| **Data Protection Officer** | Required if core activities involve regular/systematic monitoring of data subjects on a large scale, or large-scale processing of special category data |
| **Data breach notification** | Notify ICO within **72 hours** of becoming aware of a notifiable breach (Art.33). Notify data subjects without undue delay if high risk (Art.34) |
| **International transfers** | Transfers outside UK require adequacy decision, appropriate safeguards (SCCs/UK Addendum), or derogation |
| **Data minimisation** | Only collect data that is adequate, relevant, and necessary |
| **Retention** | Must not keep personal data longer than necessary — define and enforce retention periods |

### Penalties for Non-Compliance

| Tier | Maximum Fine | Applies To |
|---|---|---|
| **Lower tier** | **£8.7 million** or 2% of annual global turnover (whichever is higher) | Failures of records, security, DPIA, DPO, breach notification, privacy by design |
| **Upper tier** | **£17.5 million** or 4% of annual global turnover (whichever is higher) | Violations of basic principles, data subject rights, international transfer rules, unlawful processing |

**Recent enforcement**: In H1 2025, ICO fined Advanced Computer Software Group £3.07m and £2.31m for security failures. Fines for security/data breach violations are trending sharply upward.

### Technical Implementation

```
✅ Consent Management Platform (CMP) — integrate Cookiebot, OneTrust, or Usercentrics
✅ Privacy-by-design — embed data protection into system architecture from day 1
✅ Encryption at rest (AES-256) and in transit (TLS 1.3) for all PII
✅ API endpoints for data subject rights (export, delete, rectify)
✅ Automated breach detection and notification pipeline (72hr SLA)
✅ ROPA database/system documenting all processing activities
✅ DPIA process for location tracking, allergen profiles, payment data
✅ Data retention automation — TTL policies on databases and object storage
✅ DPO appointment (even if not strictly required — best practice)
✅ UK Addendum to SCCs for any non-UK sub-processors
✅ Pseudonymisation of driver location data and customer order history
```

---

## 2. PECR & DUAA 2025

### Legal Citation
- **PECR**: The Privacy and Electronic Communications (EC Directive) Regulations 2003 — SI 2003/2426
- **Data (Use and Access) Act 2025** (DUAA): `ukpga/2025/xx` — came into force 2025, key provisions taking effect from early 2026

### Key Requirements

| Requirement | Detail |
|---|---|
| **Cookie consent** | Regulation 6: Must not store/access information on user's device unless: (a) clear & comprehensive information provided, AND (b) user has given consent. Strictly necessary cookies exempt |
| **New DUAA cookie exemptions** | DUAA expands exemptions — certain analytics/operational cookies may no longer require prior consent. However, advertising cookies still require opt-in consent |
| **Direct marketing (email)** | Regulation 22: Must not send unsolicited marketing emails to individual subscribers unless they have given **prior consent** (soft opt-in allowed for existing customers for similar products) |
| **Direct marketing (calls)** | Regulation 21: Must not make unsolicited marketing calls to numbers on the Telephone Preference Service (TPS) register |
| **Communications security** | Regulation 5: Must take appropriate technical measures to safeguard communications security |
| **Traffic/location data** | Regulations 6(7)–6(9): Must erase or anonymise traffic data when no longer needed for communication purposes |

### Penalties for Non-Compliance

| Regime | Maximum Fine |
|---|---|
| **PECR (pre-DUAA)** | £500,000 |
| **PECR (post-DUAA, now in force)** | **£17.5 million** or 4% of global annual turnover (aligned with UK GDPR) |

> ⚠️ **Critical change**: The DUAA has brought PECR fines in line with UK GDPR levels. Cookie consent failures can now result in fines up to £17.5m.

### Technical Implementation

```
✅ Cookie consent banner — granular opt-in consent (not opt-out), reject-all button
✅ Cookie categorisation: Strictly Necessary / Analytics / Marketing / Functional
✅ Prior-blocking of non-essential cookies until consent given
✅ Push notification consent flow (Reg 6 PECR equivalent for apps)
✅ Email marketing: double opt-in list, clear unsubscribe in every email
✅ TPS screening before any outbound sales calls
✅ DUAA compliance: review new cookie exemptions, update consent flows accordingly
✅ Consent receipt logging with timestamp, version, and preferences
```

---

## 3. Consumer Rights Act 2015

### Legal Citation
- **Consumer Rights Act 2015**: `ukpga/2015/15` — Part 1, Chapter 3 (Digital Content), Chapter 2 (Goods), Chapter 4 (Services)

### Key Requirements

| Area | Requirement |
|---|---|
| **Digital content quality** | App/digital service must be of **satisfactory quality**, **fit for purpose**, and **match description** (s.33–s.36 CRA 2015) |
| **Goods quality** | Delivered groceries must be of satisfactory quality, fit for purpose, match description (s.9–s.11) |
| **Delivery timing** | Goods must be delivered within the agreed timeframe. If no time agreed, within 30 days. Failure = right to refund (s.28–s.29) |
| **Right to cancel (distance sales)** | 14-day cancellation right for online orders under Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (CCR 2013). Perishable goods exemption applies (Reg 28(h) CCR) — right to cancel does NOT apply to goods that deteriorate rapidly |
| **Pre-contract information** | Must provide: trader identity, total price, delivery arrangements, right to cancel info, complaint handling (Reg 6 CCR 2013) |
| **Unfair terms** | Contract terms must be fair under CRA 2015 Part 2 — no hidden charges, no exclusion of liability for death/personal injury |
| **Subscriptions/recurring** | If offering subscription services, must provide clear cancellation mechanism (Digital Markets, Competition and Consumers Act 2024 — new requirements) |

### Penalties for Non-Compliance

- **Civil liability**: Consumers can sue for breach of statutory rights
- **CMA enforcement**: Competition and Markets Authority can take court action for unfair terms
- **Trading Standards**: Local authority enforcement with improvement notices and prosecution
- **DMCC Act 2024**: New direct enforcement powers for CMA with fines up to **10% of global turnover** for consumer law breaches

### Technical Implementation

```
✅ Order tracking with real-time status updates and ETA
✅ Clear refund/return policy per product category (perishable vs non-perishable)
✅ Pre-contract information displayed before checkout confirmation
✅ 14-day cancellation flow for non-perishable goods
✅ Automated quality issue reporting (photo upload, item-level complaints)
✅ Fair T&Cs — avoid exclusion clauses, ensure plain language
✅ Itemised receipts and order confirmation emails with all required info
✅ Freshness/temperature monitoring for perishable deliveries
```

---

## 4. Food Safety Act 1990 & Food Business Registration

### Legal Citation
- **Food Safety Act 1990**: `ukpga/1990/16`
- **Food Safety and Hygiene (England) Regulations 2013**: SI 2013/2996
- **EC Regulation 852/2004** (retained EU law) — hygiene of foodstuffs, HACCP principles
- **Food Business Registration**: Regulation (EC) No 852/2004, Article 6(2)

### Key Requirements

| Requirement | Detail |
|---|---|
| **Food business registration** | Must register with local authority **at least 28 days before trading**. Applies to ALL food businesses including delivery-only/dark kitchens |
| **Food Hygiene Rating Scheme (FHRS)** | Voluntary display for online/delivery, but platforms increasingly require minimum rating of 3/5 |
| **HACCP** | Must implement food safety management system based on HACCP principles (retained Reg 852/2004, Article 5) |
| **Food not injurious to health** | Section 7 FSA 1990: Must not render food injurious to health |
| **Food not falsely described** | Section 15 FSA 1990: Must not falsely describe/present food |
| **Food not damaging to health** | Section 8 FSA 1990: Must not sell food not complying with food safety requirements |
| **Due diligence defence** | Section 21 FSA 1990: Defence available if took all reasonable precautions and exercised all due diligence |
| **Traceability** | Regulation 178/2002 Article 18: Must be able to identify and trace food suppliers and business customers (one step back, one step forward) |
| **Temperature control** | Retained Reg 852/2004 Annex II: Chilled food ≤8°C (ideally ≤5°C), frozen food ≤−18°C throughout delivery chain |
| **Withdrawal and recall** | Regulation 178/2002 Article 19: Must withdraw unsafe food and notify authorities and consumers |

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| Section 7/8/9 FSA 1990 (food safety) | **Unlimited fine** and/or up to 2 years' imprisonment (on indictment) |
| Section 15 FSA 1990 (falsely describing food) | **Unlimited fine** and/or up to 6 months' imprisonment |
| Failure to register | **Unlimited fine** on indictment |
| Hygiene offences | **£5,000** (summary) or **unlimited** (indictment) and/or prison |
| Emergency prohibition notice | Immediate closure of premises |

### Technical Implementation

```
✅ Food business registration API integration (register all premises/fulfilment centres)
✅ FHRS rating display on app per retailer/restaurant
✅ Temperature monitoring IoT integration for delivery vehicles/bags
✅ HACCP digital management system (CCP records, temperature logs)
✅ Traceability database — supplier batch tracking, one-step-forward/one-step-back
✅ Product recall/withdrawal notification system (push + in-app banner)
✅ Due diligence audit trail — automated logging of all food safety checks
✅ Allergen cross-contamination risk flags per product/SKU
✅ Delivery time windows calibrated to food safety requirements (max 30 min for hot food)
✅ Driver food hygiene training records management
```

---

## 5. Food Information Regulations 2014 (FIR) — 14 Allergens & Distance Selling

### Legal Citation
- **Food Information Regulations 2014** (FIR 2014): SI 2014/1855
- **Retained EU Regulation 1169/2011** (FIC Regulation) — especially Article 14 (distance selling), Articles 9 & 21 (allergen information)
- **14 Mandatory Allergens**: celery, cereals (gluten), crustaceans, eggs, fish, lupin, milk, molluscs, mustard, nuts, peanuts, sesame, soya, sulphur dioxide/sulphites

### Key Requirements for Distance Selling (ONLINE/APP ORDERS)

| Requirement | Detail |
|---|---|
| **Pre-purchase allergen info** | Article 14 FIC: Allergen information must be available **before the purchase is concluded** — must be visible on the product listing page or accessible via a clear link before checkout |
| **At-delivery allergen info** | Article 14 FIC: Allergen information must also be available **at the point of delivery** — on packaging, accompanying documentation, or via a clearly indicated digital link |
| **14 allergens emphasis** | Articles 9 & 21 FIC: The 14 allergens must be clearly emphasised in the ingredients list (bold, italics, contrasting colour, or ALL CAPS) |
| **Mandatory particulars for prepacked food** | Article 9 FIC: Name, ingredients, allergens, quantity, net quantity, use-by/date of minimum durability, storage conditions, business name/address, country of origin, instructions for use, alcohol content |
| **Non-prepacked food** | FIR 2014 Reg 5: Allergen info must be available for non-prepacked food — can be provided orally or in writing, but for distance selling MUST be in writing before purchase |

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| FIR 2014 Reg 8 — failure to provide allergen info | **Unlimited fine** on indictment |
| FIR 2014 Reg 8 — failure to provide mandatory food info | **Unlimited fine** on indictment |
| Selling non-compliant food | Seizure, condemnation, forfeiture of food |
| Improvement notice | Must comply or face prosecution |

### Technical Implementation

```
✅ Product database with allergen fields for all 14 allergens per SKU
✅ Allergen icons/badges on product listing cards (filterable)
✅ Allergen filter/search — customers can exclude products containing specific allergens
✅ Mandatory allergen display on product detail page BEFORE add-to-cart
✅ Checkout confirmation page showing allergen summary for basket
✅ Delivery documentation includes allergen info (printed receipt or QR code link)
✅ Allergen data API integration with suppliers for automatic updates
✅ "May contain" / cross-contamination warnings per product
✅ Allergen alert subscription — push notifications if product allergen info changes
✅ Audit log of allergen information provided per order (due diligence defence)
```

---

## 6. Natasha's Law — Food Information (Amendment) Regulations 2021

### Legal Citation
- **Food Information (Amendment) (England) Regulations 2019**: SI 2019/1218 (came into force 1 October 2021)
- Amends FIR 2014 to add requirements for **Pre-Packed for Direct Sale (PPDS)** food
- Equivalent regulations in Scotland, Wales, and Northern Ireland

### What is PPDS?
Food that is **packaged on the same premises** from which it is sold, **before** the customer orders or selects it. Examples for a grocery app:
- Sandwiches pre-wrapped on-site by the retailer
- Bakery items pre-packaged in-store
- Meal deals pre-assembled and wrapped in-store

### Key Requirements

| Requirement | Detail |
|---|---|
| **Full ingredients list** | PPDS food MUST display a **full ingredients list** on the packaging |
| **Allergen emphasis** | The 14 allergens must be **clearly emphasised** in the ingredients list (bold, ALL CAPS, contrasting colour, or underlined) |
| **Name of food** | Must display the name of the food |
| **Quantitative declaration** | QUID where applicable (quantity of characterising ingredient) |

> **Important distinction for delivery apps**: Natasha's Law applies to PPDS food. For food that is **packaged after the customer orders** (e.g., a made-to-order sandwich prepared after app order placed), standard FIR 2014 distance selling allergen requirements apply (see Section 5), NOT Natasha's Law. However, the FSA recommends applying Natasha's Law standards as best practice for all products.

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| Non-compliance with PPDS labelling | **Up to £5,000 per instance** (summary offence) |
| Improvement notice breach | **Unlimited fine** on indictment |
| Seizure of non-compliant food | Forfeiture and destruction of food |
| Prosecution | Criminal record for responsible persons |

### Technical Implementation

```
✅ Product catalogue flag: is_PPDS = true/false per SKU
✅ For PPDS products: display full ingredients list with allergen emphasis on product page
✅ Auto-generated labels for PPDS items — include name, full ingredients, allergens highlighted
✅ Integration with label printing at store level for PPDS products
✅ Allergen emphasis rendering in app UI (bold/coloured text for allergen ingredients)
✅ Supply chain allergen data sync — automatic updates when recipes change
✅ PPDS compliance audit trail per product
✅ Customer-facing allergen info matching the label exactly
```

---

## 7. Licensing Act 2003 & Challenge 25 — Age Verification

### Legal Citation
- **Licensing Act 2003**: `ukpga/2003/17` — Sections 146–147 (sale of alcohol to children), Section 150 (age verification)
- **Licensing Act 2003 (Mandatory Licensing Conditions) Order 2010**: SI 2010/860 — mandates age verification policy
- **Challenge 25**: Industry-standard policy endorsed by ACS, RASG, and police; can be a mandatory premises licence condition

### Key Requirements for Delivery

| Requirement | Detail |
|---|---|
| **Age verification policy** | Section 150 LA 2003: Premises must have an age verification policy. **Challenge 25** is the standard — anyone who appears under 25 must produce valid ID |
| **No sale to under-18s** | Section 146 LA 2003: It is an offence to sell alcohol to a person under 18. This applies equally to delivery |
| **Delivery verification** | Age verification must occur at **point of sale AND point of delivery**. The GOV.UK consultation confirms the law requires verification "at the point of sale or appropriation to a contract" and at delivery |
| **Acceptable ID** | Passport, UK driving licence, EU/EEA national identity card, PASS-accredited proof of age card, military ID |
| **Record keeping** | Must maintain refusal logs for age-restricted sales |
| **Staff training** | All staff involved in age-restricted sales must be trained on the age verification policy |

### Digital Age Verification (2025+)

- GOV.UK consultation on "Alcohol licensing: age verification" is examining enabling **digital age verification** for delivery, including potential for verification at point of order (online) in addition to/at delivery
- Current legal position: **Physical ID check at delivery is required** for alcohol deliveries
- Emerging technology: digital ID verification (Yoti, Post Office EasyID, One Login) may be accepted in future regulatory updates

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| Selling alcohol to under-18 (s.146) | **Unlimited fine** on indictment and/or up to 6 months' imprisonment |
| Persistently selling to children | Premises review, potential revocation of premises licence |
| Delivery driver selling to under-18 | Personal liability — fine and/or imprisonment |
| Failure to have age verification policy | **Unlimited fine** |
| Licensing review | Suspension or revocation of premises licence |

### Technical Implementation

```
✅ Age-restricted product flag in product database (alcohol, knives, solvents, tobacco, lottery)
✅ Age gate at checkout — customer must confirm they are 18+ for age-restricted items
✅ Mandatory "Age verification required at delivery" notice on order confirmation
✅ Driver app: age verification workflow — scan/check ID, confirm pass/fail
✅ ID scanning integration (Yoti, OCR for passport/driving licence)
✅ Photo capture of ID at delivery (with GDPR consent/legitimate interest documentation)
✅ Refusal logging in driver app (timestamp, reason, product)
✅ Driver training module and certification tracking
✅ Order tagging: age-restricted flag passed to fulfilment and delivery systems
✅ Fall-back procedure: if customer cannot produce ID, items returned, refund issued
✅ Digital age verification API integration (future-proofing for regulatory changes)
✅ Reporting dashboard: age verification compliance metrics
```

---

## 8. VAT Act 1994 — VAT Registration & Digital Services

### Legal Citation
- **Value Added Tax Act 1994** (VATA 1994): `ukpga/1994/23`
- **VAT Regulations 1995**: SI 1995/2518
- **Making Tax Digital for VAT**: The Income Tax (Digital Requirements) Regulations 2024 and VAT Regulations amendments

### Key Requirements

| Requirement | Detail |
|---|---|
| **VAT registration threshold** | **£90,000** taxable turnover (2025/26 tax year). Must register within 30 days of exceeding threshold |
| **Deregistration threshold** | **£88,000** — can deregister if turnover falls below |
| **Zero-rated food** | Most grocery food items are **zero-rated** (0% VAT) under VATA 1994 Schedule 8 Group 1 |
| **Standard-rated items** | Some food/drink is standard-rated (20%): soft drinks, confectionery, crisps, hot takeaway food, ice cream, alcohol |
| **Hot food** | Food served above ambient temperature for consumption is standard-rated (VATA 1994 Schedule 8, Note 3B/3C) |
| **Delivery charges** | If delivery is part of the supply of goods, VAT follows the goods. If separate supply, standard-rated at 20% |
| **Marketplace VAT rules** | If operating as a marketplace (not the seller), different VAT obligations — deeming provisions may apply |
| **Making Tax Digital** | Must maintain digital records and submit VAT returns using MTD-compatible software |
| **Overseas sellers** | No £90k threshold — must register immediately if selling to UK consumers and storing goods in UK |

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| Late registration | **Up to 100%** of VAT owed for the period of delay |
| Late filing | £200 + daily penalties (after 2nd default) |
| Late payment | 2% → 4% → 4% + daily surcharges based on amount owed |
| Deliberate evasion | **Unlimited fine** and/or imprisonment (Criminal) |
| Incorrect returns | Penalties up to 100% of potential lost revenue |
| MTD non-compliance | £200 penalty per VAT return not filed digitally |

### Technical Implementation

```
✅ Product database: VAT rate field per SKU (0%, 5%, 20%) with HMRC category mapping
✅ Automated VAT calculations — per-item and per-order with tax breakdown
✅ VAT registration monitoring — dashboard tracking rolling 12-month turnover
✅ VAT-inclusive / VAT-exclusive price display (consumer prices must be VAT-inclusive)
✅ Delivery charge VAT treatment — separate line item with correct rate
✅ MTD-compatible accounting integration (Xero, QuickBooks, Sage API)
✅ Invoice generation with full VAT details (registration number, rate per item)
✅ Zero-rate evidence capture — product classification audit trail
✅ Hot food temperature-based VAT rate logic (if applicable)
✅ Reverse charge handling for B2B transactions
✅ Overseas seller VAT compliance — marketplace deeming provisions if applicable
```

---

## 9. Payment Services Regulations 2017 — SCA & 3D Secure

### Legal Citation
- **Payment Services Regulations 2017** (PSRs 2017): SI 2017/752 — Regulation 100 (Strong Customer Authentication)
- **UK PSD2**: Implemented via PSRs 2017, based on EU Directive 2015/2366 (PSD2)
- **FCA enforcement**: SCA mandatory since 14 March 2022 in UK

### Key Requirements

| Requirement | Detail |
|---|---|
| **Strong Customer Authentication (SCA)** | Regulation 100 PSRs 2017: Must apply SCA when customer: (a) accesses payment account online, (b) initiates electronic payment transaction, (c) carries out action through remote channel that may imply fraud risk |
| **Two-factor authentication** | SCA requires **2 out of 3** factors: (1) **Knowledge** (password/PIN), (2) **Possession** (phone/card), (3) **Inherence** (fingerprint/face) |
| **3D Secure 2** | Implementation mechanism for SCA in card-not-present e-commerce. Must support 3DS2 for all online card payments |
| **Dynamic linking** | Authentication code must be dynamically linked to transaction amount and payee |
| **Exemptions** | Limited exemptions available: low-value (£30 threshold for contactless), recurring payments, trusted beneficiaries, risk-based analysis, secure corporate payments |

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| FCA enforcement | Fines, requirements, and restrictions on payment services |
| Acquirer refusal | Payment processors may decline non-SCA transactions |
| Liability shift | Merchant may bear fraud liability for non-SCA transactions |
| FCA supervisory action | Skilled persons review, voluntary requirements, own-initiative requirements |

### Technical Implementation

```
✅ 3D Secure 2 (3DS2) integration with payment gateway (Stripe, Adyen, Checkout.com)
✅ SCA challenge flow — frictionless vs step-up based on risk assessment
✅ Exemption engine — apply low-value, TRA, recurring payment exemptions where possible
✅ Tokenisation — store payment tokens, not raw card data (also supports PCI DSS)
✅ Strong password policy for account access (first SCA factor)
✅ Device binding / possession factor for second SCA element
✅ Biometric authentication option (third factor for step-up)
✅ Dynamic linking — transaction amount and payee bound to authentication
✅ Fallback for 3DS failures — alternative payment methods (Open Banking, wallets)
✅ SCA compliance monitoring dashboard
```

---

## 10. PCI DSS — Payment Card Industry Data Security Standard

### Legal Citation
- Not a law, but a **contractual requirement** imposed by card schemes (Visa, Mastercard, Amex) and enforced through merchant agreements
- **PCI DSS v4.0** — fully effective from 31 March 2025 (transition from v3.2.1)
- Underpins compliance with UK GDPR Article 32 (security of processing) and PSRs 2017

### Key Requirements (PCI DSS v4.0)

| Requirement | Detail |
|---|---|
| **Scope** | Applies to ALL systems that store, process, or transmit cardholder data |
| **Requirement 1** | Install and maintain network security controls (firewalls, segmentation) |
| **Requirement 3** | Protect stored account data — encryption, tokenisation, key management |
| **Requirement 4** | Protect cardholder data with strong cryptography during transmission over open networks |
| **Requirement 6** | Develop and maintain secure systems and software |
| **Requirement 8** | Identify users and authenticate access to system components (MFA required) |
| **Requirement 10** | Log and monitor all access to system components and cardholder data |
| **Requirement 11** | Test security of systems and networks regularly (vulnerability scans, pen testing) |
| **Requirement 12** | Support information security with organisational policies and risk management |
| **SAQ level** | Level depends on transaction volume: SAQ A (redirect to payment provider), SAQ D (full assessment if storing/processing cards) |

### Penalties for Non-Compliance

| Consequence | Detail |
|---|---|
| **Monthly fines** | £5,000–£100,000 per month imposed by acquiring bank |
| **Increased processing fees** | Card schemes may impose higher interchange rates |
| **Loss of card processing** | Acquirer may terminate merchant account |
| **Breach costs** | Average data breach cost in UK: £3.6M (IBM 2024) |
| **Forensic investigation** | Mandatory PFI (Payment Forensic Investigator) at merchant's expense |
| **Brand damage** | Public listing on Visa/Mastercard non-compliant merchant lists |

### Technical Implementation

```
✅ Use a PCI DSS Level 1 payment gateway (Stripe, Adyen, Checkout.com, Braintree)
✅ Redirect or iframe payment form — minimise self-assessment to SAQ A
✅ NEVER store full card numbers, CVV, or magnetic stripe data
✅ Tokenisation for recurring payments — store payment tokens only
✅ Web Application Firewall (WAF) for all payment-related endpoints
✅ Network segmentation — cardholder data environment isolated from general systems
✅ Vulnerability scanning — quarterly ASV scans, annual penetration test
✅ MFA on all administrative access to payment systems
✅ Centralised logging for all payment system access (SIEM integration)
✅ Quarterly compliance attestation and annual ROC/SAQ submission
✅ PCI DSS v4.0 customised approach documentation (if using customised validations)
```

---

## 11. Equality Act 2010 — Digital Accessibility

### Legal Citation
- **Equality Act 2010**: `ukpga/2010/15` — Section 29 (provision of services), Section 20 (duty to make reasonable adjustments)
- **Public Sector Bodies (Websites and Mobile Applications) (No. 2) Accessibility Regulations 2018**: SI 2018/952 (public sector only, but sets standard)
- **BS 8878:2010** — Web accessibility code of practice
- **WCAG 2.1 AA** — de facto standard referenced by courts and regulators

### Key Requirements

| Requirement | Detail |
|---|---|
| **Reasonable adjustments** | Section 20 EqA 2010: Service providers must make **reasonable adjustments** to avoid putting disabled people at a substantial disadvantage |
| **Anticipatory duty** | Duty is **anticipatory** — must think ahead about what disabled customers may need, not wait until asked |
| **Provision of auxiliary aids** | Must provide auxiliary aids/services where reasonable (e.g., screen reader compatibility, alternative formats) |
| **WCAG 2.1 AA standard** | Courts and regulators treat WCAG 2.1 Level AA as the benchmark for "reasonable" digital accessibility |
| **Accessibility statement** | Required for public sector; best practice for private sector — must state compliance level and how to request accessible formats |
| **No discrimination** | Must not directly or indirectly discriminate on grounds of any protected characteristic (age, disability, race, religion, sex, sexual orientation, etc.) |

### Penalties for Non-Compliance

| Consequence | Detail |
|---|---|
| **County Court claim** | Disabled individuals can bring discrimination claims in county court |
| **Damages** | Unlimited compensation for injury to feelings + financial losses |
| **Strategic legal action** | Organisations like RNIB have pursued test cases against inaccessible websites |
| **Reputational damage** | Significant public relations risk |
| **Regulatory scrutiny** | CMA may investigate under consumer protection legislation |

### Technical Implementation

```
✅ WCAG 2.1 Level AA compliance for all web and mobile interfaces
✅ Semantic HTML with proper ARIA labels and roles
✅ Keyboard navigation — all functionality accessible without a mouse
✅ Screen reader compatibility (VoiceOver, TalkBack, JAWS, NVDA)
✅ Colour contrast ratios — minimum 4.5:1 for text, 3:1 for large text
✅ Text resizing — support up to 200% without loss of content/functionality
✅ Alt text for all images; long descriptions for product images
✅ Focus management for dynamic content (modals, toasts, page transitions)
✅ Video captions and audio descriptions for any media content
✅ Touch target sizes — minimum 44×44 CSS pixels
✅ Accessibility statement page with contact method for accessibility issues
✅ Automated testing (axe, Lighthouse) + manual testing with assistive technology
✅ Accessibility audit at least annually
✅ Voice-over compatibility for allergen information (critical for visually impaired users)
```

---

## 12. HFSS Advertising Restrictions 2025–2026

### Legal Citation
- **The Broadcasting (Restrictions on Advertising of Less Healthy Food and Drink) Regulations 2025** — came into force 5 January 2026
- **The Advertising of Less Healthy Food and Drink (Restrictions) Regulations 2025** — online restrictions from 5 January 2026
- **Communications Act 2003** — underlying statutory power
- **Nutrient Profiling Model (NPM)** — DHSC tool for classifying products as HFSS/less healthy

### Key Requirements

| Requirement | Detail |
|---|---|
| **Online ad ban** | From **5 January 2026**: Paid-for online advertising of "less healthy" (HFSS) food and drink products is **banned** |
| **TV ad ban** | From **5 January 2026**: HFSS product advertising on TV is banned before the **9pm watershed** |
| **"Identifiable" products** | Ban covers ads for "identifiable" less healthy products — product is recognisable even if not named |
| **Brand advertising** | Brand-only advertising (no identifiable product) remains permitted |
| **In-app product listings** | Product listings on grocery/delivery platforms are NOT advertising — they are transactional. However, promoted/sponsored product placements within the app MAY be caught |
| **Search advertising** | Paid search ads for HFSS products are caught by the ban |
| **Social media ads** | Paid social media ads for HFSS products are banned |

> **Critical for grocery apps**: While product listings are transactional (not advertising), any **sponsored placements**, **promoted products**, **banner ads**, or **featured product slots** within the app for HFSS items could constitute "paid-for online advertising" and would be prohibited.

### Penalties for Non-Compliance

| Body | Penalty |
|---|---|
| **ASA (Advertising Standards Authority)** | Adjudication, removal of ad, public naming |
| **Ofcom** | Statutory enforcement, fines up to £250,000 for broadcast |
| **Trading Standards** | Criminal prosecution, unlimited fines |
| **Competitors** | Competitor complaints to ASA/CAP |

### Technical Implementation

```
✅ Product database: HFSS classification per SKU using NPM scoring
✅ Advertising system: block HFSS products from sponsored/promoted placements
✅ Search ads: filter HFSS products from paid search campaigns
✅ Social media: audit all paid social content for HFSS compliance
✅ Content review workflow: flag HFSS products before any promotional content goes live
✅ Email marketing: exclude HFSS products from promotional emails
✅ Push notifications: filter HFSS products from promotional push campaigns
✅ Homepage banners: ensure no HFSS products featured in banner ads
✅ Product recommendation engine: exclude HFSS from "promoted" recommendations
✅ Compliance reporting: audit trail of all promotional placements by HFSS status
✅ Legal review process for all marketing content involving food/drink products
```

---

## 13. Courier/Worker Right-to-Work Checks (Immigration)

### Legal Citation
- **Immigration, Asylum and Nationality Act 2006**: Section 15–25 — penalty for employing illegal worker
- **Immigration Act 2016**: Section 34 — offence of illegal working
- **Home Office announcement (2025)**: Food delivery apps will be **legally required** to carry out right-to-work checks on couriers

### Key Requirements

| Requirement | Detail |
|---|---|
| **Right-to-work checks** | Must verify couriers/delivery drivers have the legal right to work in the UK before engagement |
| **Online verification** | Use Home Office online right-to-work checking service |
| **List A / List B documents** | Acceptable documents for manual checks as per Home Office guidance |
| **Repeat checks** | For workers with time-limited permission, must conduct follow-up checks |
| **Coming soon** | New legislation expected to make right-to-work checks on delivery couriers **mandatory for platforms** (not just the employer) |

### Penalties for Non-Compliance

| Offence | Penalty |
|---|---|
| Employing illegal worker (first offence) | Up to **£20,000 per illegal worker** (civil penalty) |
| Repeated offence | Up to **£20,000 per illegal worker** |
| Knowingly employing illegal worker | **Unlimited fine** and/or up to **5 years' imprisonment** (criminal offence) |

### Technical Implementation

```
✅ Courier onboarding: right-to-work check as mandatory step before activation
✅ Home Office online checking service API integration
✅ Document upload and verification workflow (List A / List B)
✅ Expiry tracking for time-limited permissions with automated re-check reminders
✅ Audit trail of all right-to-work checks with timestamps
✅ Compliance dashboard showing check status per courier
✅ Integration with courier management system — block activation without valid check
```

---

## 14. Consolidated Technical Implementation Checklist

### Priority Matrix

| Priority | Regulation | Must-Have Before Launch | Deadline |
|---|---|---|---|
| 🔴 P0 | UK GDPR | Privacy notice, consent flows, data subject rights, DPIA, breach process, DPO | Day 1 |
| 🔴 P0 | PECR/DUAA | Cookie consent (opt-in), email marketing consent, push notification consent | Day 1 |
| 🔴 P0 | Food Safety Act | Food business registration (28 days before), HACCP, temperature controls | Day 1 |
| 🔴 P0 | FIR 2014 / Allergens | Pre-purchase allergen info, at-delivery allergen info, 14 allergens emphasis | Day 1 |
| 🔴 P0 | Natasha's Law | PPDS labelling with full ingredients + allergen emphasis | Day 1 |
| 🔴 P0 | Licensing Act / Challenge 25 | Age verification at delivery, driver ID check process | Day 1 (if selling alcohol) |
| 🔴 P0 | PCI DSS | Level 1 payment gateway, tokenisation, never store card data | Day 1 |
| 🔴 P0 | PSRs 2017 / SCA | 3D Secure 2 for all card payments | Day 1 |
| 🟡 P1 | Consumer Rights Act | Refund policy, 14-day cancellation, pre-contract info, delivery tracking | Day 1 |
| 🟡 P1 | Equality Act | WCAG 2.1 AA, screen reader support, keyboard navigation | Day 1 |
| 🟡 P1 | VAT Act | VAT registration monitoring, correct rate per product, MTD compliance | Day 1 / £90k threshold |
| 🟠 P2 | HFSS ad restrictions | Block HFSS from promoted placements, search ads, banners | 5 Jan 2026 (in force) |
| 🟠 P2 | Right-to-work | Courier right-to-work verification | New legislation pending |
| 🟢 P3 | FHRS display | Food hygiene ratings on platform | Ongoing best practice |

### Data Architecture Implications

```
Product Database Fields (minimum):
├── sku_id, name, description
├── vat_rate (0% / 5% / 20%)
├── is_hfss (boolean + NPM score)
├── is_age_restricted (boolean + restriction_type)
├── is_ppds (boolean — Natasha's Law flag)
├── allergens[] (array of 14 allergens + "may_contain" flags)
├── ingredients_full (text — for PPDS label generation)
├── hfss_category (for ad restriction logic)
├── food_safety: use_by_date, storage_temp, is_chilled, is_frozen
├── supplier_traceability: batch_id, supplier_id
└── fhrs_rating (for display)

User/Order Database Fields (minimum):
├── user_id, consent_records[], marketing_opt_in
├── allergen_preferences[] (with explicit consent for processing)
├── age_verified (boolean + verification method + timestamp)
├── right_to_work_verified (couriers only)
├── orders[] → order_items[] → per-item allergen_info_snapshot
├── data_subject_request_log[]
└── breach_notification_log[]
```

### Legal Register Template

| Reg ID | Regulation | Requirement | Owner | Status | Evidence | Review Date |
|---|---|---|---|---|---|---|
| LEG-001 | UK GDPR Art. 13 | Privacy notice at collection | DPO | ✅ | URL to notice | Quarterly |
| LEG-002 | PECR Reg 6 | Cookie consent banner | CTO | ✅ | Screenshot, CMP config | Quarterly |
| LEG-003 | FIR 2014 Art.14 | Pre-purchase allergen info | Product | ✅ | Product page audit | Monthly |
| LEG-004 | LA 2003 s.146 | Age verification at delivery | Ops | ✅ | Driver app logs | Monthly |
| LEG-005 | PSRs 2017 Reg 100 | SCA / 3DS2 | CTO | ✅ | Payment gateway config | Quarterly |
| ... | ... | ... | ... | ... | ... | ... |

---

## Key Sources & Further Reading

| Source | URL |
|---|---|
| ICO — UK GDPR Guidance | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/ |
| ICO — PECR Guidance | https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/ |
| ICO — DUAA 2025 Summary | https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/ |
| FSA — Allergen Guidance for Food Businesses | https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses |
| FSA — PPDS / Natasha's Law | https://www.food.gov.uk/business-guidance/introduction-to-allergen-labelling-changes-ppds |
| FSA — Selling Food for Delivery | https://www.food.gov.uk/business-guidance/selling-food-for-delivery |
| FCA — Strong Customer Authentication | https://www.fca.org.uk/firms/strong-customer-authentication |
| GOV.UK — HFSS Promotion/Advertising | https://www.gov.uk/government/publications/restricting-promotions-of-products-high-in-fat-sugar-or-salt-by-location-and-by-volume-price/ |
| GOV.UK — Food Business Registration | https://www.gov.uk/guidance/food-business-registration |
| GOV.UK — Alcohol Licensing Age Verification | https://www.gov.uk/government/consultations/alcohol-licensing-age-verification/ |
| ASA — HFSS Advertising Rules | https://www.asa.org.uk/advice-online/food-hfss-product-and-brand-advertising.html |
| Legislation — Consumer Rights Act 2015 | https://www.legislation.gov.uk/ukpga/2015/15/contents |
| Legislation — Food Safety Act 1990 | https://www.legislation.gov.uk/ukpga/1990/16/contents |
| Legislation — Licensing Act 2003 | https://www.legislation.gov.uk/ukpga/2003/17/contents |
| Legislation — PSRs 2017 | https://www.legislation.gov.uk/uksi/2017/752/contents |
| Legislation — Equality Act 2010 | https://www.legislation.gov.uk/ukpga/2010/15/contents |
| PCI Security Standards Council | https://www.pcisecuritystandards.org/ |

---

> **Disclaimer**: This document is for informational purposes only and does not constitute legal advice. All compliance decisions should be reviewed by a qualified UK legal professional. Regulations are subject to change — verify current requirements with the relevant regulator before implementation.

---

*Report generated: March 2026 | Based on live web research across GOV.UK, ICO, FSA, FCA, ASA, and specialist legal sources*
