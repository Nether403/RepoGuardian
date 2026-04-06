# 🔧 Database Connection Fix - SSL/TLS Issue

## ❌ Error You're Seeing

```
Error: Client network socket disconnected before secure TLS connection was established
code: 'ECONNRESET'
```

**Cause:** Drizzle Kit needs SSL configuration to connect to Neon database.

---

## ✅ Fix Applied

I've updated `drizzle.config.ts` to enable SSL:

```typescript
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: true,  // ← Added this
  },
});
```

---

## 🚀 Try Again Now

Run the migration command again:

```bash
npm run db:push
```

**Expected output:**
```
✓ Pulling schema from database...
✓ Applying changes...
✓ Created table: users
✓ Created table: repositories
✓ Created table: repository_analyses
... (many more tables)
✓ Done!
```

---

## 🔍 If Still Failing

### Alternative 1: Use Direct Connection URL

If the pooled connection still fails, try the direct connection:

1. Go to your Neon Console: https://console.neon.tech
2. Select your project
3. Go to "Connection Details"
4. Copy the **Direct connection** URL (not pooled)
5. Temporarily update `.env`:

```bash
# Temporarily use direct connection for migrations
DATABASE_URL='postgresql://neondb_owner:npg_0mpFt1auIfZT@ep-dawn-frost-agk4od4w.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require'
```

6. Run: `npm run db:push`
7. After success, you can switch back to pooled connection

### Alternative 2: Manual SSL Configuration

If the simple `ssl: true` doesn't work, try this more explicit configuration:

Update `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  },
});
```

### Alternative 3: Use Neon SQL Editor

If migrations keep failing, you can create tables manually:

1. Go to: https://console.neon.tech
2. Select your project
3. Go to "SQL Editor"
4. I can generate the SQL for you to paste

---

## 🧪 Verify Connection

Test if you can connect to the database:

```bash
# Test with psql (if installed)
psql "postgresql://neondb_owner:npg_0mpFt1auIfZT@ep-dawn-frost-agk4od4w-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Should connect successfully
```

---

## 📊 Common Neon Connection Issues

### Issue 1: Pooler vs Direct Connection
- **Pooler** (recommended for app): `ep-dawn-frost-agk4od4w-pooler.c-2.eu-central-1.aws.neon.tech`
- **Direct** (for migrations): `ep-dawn-frost-agk4od4w.c-2.eu-central-1.aws.neon.tech`

For `db:push`, sometimes direct connection works better.

### Issue 2: SSL Mode
Your connection string has `?sslmode=require` which is correct.

### Issue 3: Network/Firewall
- Check if your firewall blocks PostgreSQL port (5432)
- Try from a different network if possible
- Check if VPN is interfering

---

## 🎯 Step-by-Step Troubleshooting

### Step 1: Verify DATABASE_URL
```bash
# Check if DATABASE_URL is set correctly
echo $env:DATABASE_URL
```

Should show your Neon connection string.

### Step 2: Test Basic Connectivity
```bash
# Try to connect with Node
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); pool.query('SELECT NOW()', (err, res) => { console.log(err ? err : res.rows); pool.end(); });"
```

### Step 3: Check Neon Status
1. Go to: https://console.neon.tech
2. Check if your database is active
3. Look for any maintenance notifications

### Step 4: Try Direct Connection
Get the direct connection URL from Neon Console and try:
```bash
DATABASE_URL="direct_connection_url_here" npm run db:push
```

---

## 💡 Quick Workaround

If migrations keep failing, I can help you:

1. **Generate SQL script** - I'll create the SQL to run manually
2. **Use Neon Console** - Paste SQL directly in SQL Editor
3. **Tables created** - Then your app will work

This bypasses the migration tool entirely.

---

## 🔄 After Successful Migration

Once `npm run db:push` succeeds:

1. ✅ All tables created
2. ✅ Restart server: `npm run dev`
3. ✅ Test analysis: http://localhost:3002/analyze
4. ✅ Should work perfectly!

---

## 🆘 Still Not Working?

If you're still getting SSL errors:

**Option A: Let me generate SQL**
I can create the SQL script for you to run manually in Neon Console.

**Option B: Check Neon Settings**
1. Go to Neon Console
2. Check "Connection Details"
3. Verify SSL is enabled
4. Try copying connection string again

**Option C: Use Alternative Tool**
```bash
# Try using psql directly
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS test (id SERIAL PRIMARY KEY);"
```

---

## 📝 Current Status

- [x] ✅ SSL configuration added to drizzle.config.ts
- [ ] ⏳ Waiting for you to run: `npm run db:push`
- [ ] 🎯 Tables will be created
- [ ] 🎯 App will work

---

**Next Step:** Run `npm run db:push` again now that SSL is configured.

**If it fails again:** Let me know the exact error and I'll help with the next solution.
