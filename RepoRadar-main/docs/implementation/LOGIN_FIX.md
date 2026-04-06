# Login Error Fix - Database Migration Required

## Problem

Login is failing with 500 Internal Server Error because the database schema is out of sync. We added a `githubToken` field to the code, but it doesn't exist in the database yet.

## Quick Fix

You need to add the `github_token` column to your database. Choose one of these methods:

### Method 1: Run Database Migration (Recommended)

```bash
npm run db:push
```

If this fails due to connection issues, try Method 2.

### Method 2: Manual SQL (If migration fails)

1. Go to your Neon database console: https://console.neon.tech
2. Select your project
3. Go to SQL Editor
4. Run this SQL:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS github_token VARCHAR(255);
```

5. Verify it worked:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'github_token';
```

### Method 3: Use the SQL File

I've created `add-github-token-column.sql` with the migration SQL. You can:

1. Open your Neon console
2. Copy the contents of `add-github-token-column.sql`
3. Paste and run in SQL Editor

## Why This Happened

We added the `githubToken` field to the schema in code, but the database wasn't updated yet. The login endpoint tries to query the users table, and if the column doesn't exist, it causes a 500 error.

## After Running the Migration

1. Restart your server (if needed)
2. Try logging in again
3. Everything should work!

## Verification

After adding the column, you can verify it exists:

```sql
\d users
```

Or:

```sql
SELECT * FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
```

You should see `github_token` in the list.

## Alternative: Rollback (If you want to undo)

If you want to remove the GitHub token feature temporarily:

1. Remove the column:
```sql
ALTER TABLE users DROP COLUMN IF EXISTS github_token;
```

2. Revert the code changes in:
   - `shared/schema.ts`
   - `client/src/pages/profile.tsx`
   - `client/src/pages/code-review.tsx`
   - `server/storage.ts`
   - `server/routes.ts`

But I recommend just running the migration - the feature is great!

## Status

Once you run the migration, login will work again and you'll have the new GitHub token feature in your profile!
