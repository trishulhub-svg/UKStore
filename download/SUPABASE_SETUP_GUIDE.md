# 🔧 Supabase Setup Guide — UK STORE [DEMO]

## The Problem

Your Supabase project (`rkryxwvbnafioldhndcer`) **no longer exists** — DNS returns `NXDOMAIN`, which means the project has been **deleted** (not just paused). A paused project would still resolve DNS but return a "Project is paused" error.

## Step 1: Create a New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `UK Store Demo`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `eu-west-2` for London)
   - **Plan**: Free tier is fine for demo
4. Wait ~2 minutes for the project to provision

## Step 2: Get Your API Keys

1. In your new project, go to **Settings → API**
2. Copy these three values:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g., `https://abcdefghijk.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (⚠️ secret!) |

## Step 3: Set Vercel Environment Variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **UKStore** project
3. Go to **Settings → Environment Variables**
4. Add ALL of these:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Make sure they're set for **Production**, **Preview**, and **Development**
6. **Redeploy** — go to Deployments → click the 3 dots on the latest → Redeploy

## Step 4: Run Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Run each migration file IN ORDER:

### Migration 1: Initial Schema
Open `supabase/migrations/00001_initial_schema.sql` → paste → Run

### Migration 2: RLS Policies
Open `supabase/migrations/00002_rls_policies.sql` → paste → Run

### Migration 3: Auth Trigger
Open `supabase/migrations/00003_auth_trigger.sql` → paste → Run

### Migration 4: Store Settings
Open `supabase/migrations/00004_store_settings.sql` → paste → Run

### Migration 5: Nullable Store ID
Open `supabase/migrations/00005_profiles_nullable_store.sql` → paste → Run

### Seed Data
Open `supabase/seed/seed.sql` → paste → Run

## Step 5: Enable PostGIS Extension

1. Go to **Database → Extensions**
2. Search for `postgis`
3. Click **Enable**

## Step 6: Configure Auth

1. Go to **Authentication → Providers**
2. Make sure **Email** is enabled
3. Under **Email Auth**, configure:
   - **Enable Email Confirmations**: ON (recommended for production) or OFF (for quick demo)
   - **Enable Sign ups**: ON
4. (Optional) Enable **Google** OAuth:
   - You need a Google Cloud project with OAuth 2.0 Client ID
   - Set the redirect URL to: `https://your-vercel-app.vercel.app/auth/callback`

## Step 7: Verify Everything Works

1. After Vercel redeploys, visit your site
2. The navbar should show **Sign In** and **Register** buttons
3. Click **Register** → create an account
4. If email confirmation is ON, check your email → confirm → then log in
5. If email confirmation is OFF, you'll be logged in immediately

## Do API Keys Expire?

**Supabase API keys (anon key and service_role key) do NOT expire.** They are JWT tokens signed with your project's secret, and they remain valid as long as the project exists. However:

- If you **reset your project's JWT secret** (Settings → API → JWT Secret → Reset), ALL existing keys become invalid
- If your project is **deleted**, the keys stop working (DNS won't resolve, as you experienced)
- The **service_role key** should NEVER be exposed in client-side code

## Quick Checklist

- [ ] New Supabase project created
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel
- [ ] All 5 migrations run in Supabase SQL Editor
- [ ] Seed data run in Supabase SQL Editor
- [ ] PostGIS extension enabled
- [ ] Auth providers configured (Email + optional Google)
- [ ] Vercel redeployed
- [ ] Login works!
