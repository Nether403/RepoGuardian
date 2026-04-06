# 🗄️ Database Setup Fix - Missing Tables

## ❌ Current Error

```
Analysis Failed
500: relation "repositories" does not exist
```

**Cause:** Database tables haven't been created yet!

---

## ✅ Quick Fix (2 minutes)

### Step 1: Stop the Server
Press `Ctrl+C` in the terminal running the server

### Step 2: Create Database Tables
Run this command:
```bash
npm run db:push
```

**What this does:**
- Reads your schema from `shared/schema.ts`
- Creates all tables in your Neon database
- Sets up indexes and relationships
- Prepares the database for use

**Expected output:**
```
✓ Applying changes...
✓ Created table: users
✓ Created table: repositories
✓ Created table: repository_analyses
✓ Created table: saved_repositories
✓ Created table: similar_repositories
✓ Created table: bookmarks
✓ Created table: tags
✓ Created table: collections
... (and many more)
✓ Done!
```

### Step 3: Restart the Server
```bash
npm run dev
```

### Step 4: Test Again
1. Go to: http://localhost:3002/analyze
2. Analyze: https://github.com/facebook/react
3. Should work now! ✅

---

## 📊 What Tables Will Be Created

Your database will have these tables:

### Core Tables:
- `users` - User accounts
- `repositories` - GitHub repository data
- `repository_analyses` - AI analysis results
- `saved_repositories` - User bookmarks
- `similar_repositories` - Similar repo relationships

### Feature Tables:
- `bookmarks` - User bookmarks with notes
- `tags` - Custom tags for organizing
- `collections` - Repository collections
- `collection_items` - Items in collections
- `user_preferences` - User settings
- `user_activities` - Activity tracking
- `tracked_repositories` - Real-time monitoring
- `notifications` - User notifications
- `comments` - Repository comments
- `comment_likes` - Comment likes
- `ratings` - Repository ratings
- `rating_helpful` - Rating helpfulness votes

### Team/Collaboration:
- `teams` - Team management
- `team_members` - Team membership
- `team_invitations` - Team invites
- `shared_analyses` - Shared analysis

### Developer/API:
- `api_keys` - API key management
- `api_usage` - API usage tracking
- `webhooks` - Webhook configurations

### Analytics:
- `analytics_events` - Event tracking
- `sessions` - User sessions

---

## 🔍 Troubleshooting

### If `npm run db:push` fails:

#### Error: "Connection refused"
**Cause:** Can't connect to Neon database

**Fix:**
1. Check your `DATABASE_URL` in `.env`
2. Verify it's the pooled connection URL
3. Ensure it has `?sslmode=require` at the end

#### Error: "Permission denied"
**Cause:** Database user doesn't have CREATE permissions

**Fix:**
1. Check you're using the owner connection string
2. Should be: `postgresql://neondb_owner:...`
3. Not: `postgresql://neondb:...`

#### Error: "Timeout"
**Cause:** Network or firewall issue

**Fix:**
1. Check your internet connection
2. Try again (Neon might be slow)
3. Check Neon dashboard for database status

---

## 🧪 Verify Database Setup

After running `npm run db:push`, verify tables exist:

### Option 1: Neon Console
1. Go to: https://console.neon.tech
2. Select your project
3. Go to "SQL Editor"
4. Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
5. Should see all your tables listed

### Option 2: Check in App
1. Start server: `npm run dev`
2. Try analyzing a repository
3. Should work without "relation does not exist" error

---

## 📝 Complete Setup Checklist

- [x] ✅ Gemini API key configured
- [x] ✅ Stripe keys configured
- [x] ✅ Redis (Upstash) configured
- [x] ✅ Neon Auth configured
- [x] ✅ GitHub token configured
- [ ] ⚠️ **Database tables created** ← YOU ARE HERE
- [ ] 🎯 Test AI analysis
- [ ] 🎯 Test payments
- [ ] 🎯 Test all features

---

## 🚀 After Database Setup

Once tables are created, test these features:

### 1. AI Analysis
```
URL: http://localhost:3002/analyze
Test: https://github.com/facebook/react
Expected: Detailed AI scores and insights
```

### 2. Search
```
URL: http://localhost:3002/search
Test: Search for "react"
Expected: Repository results
```

### 3. Bookmarks
```
1. Analyze a repository
2. Click "Save" button
3. Go to profile
Expected: Saved repository appears
```

### 4. Collections
```
URL: http://localhost:3002/collections
Test: Create a new collection
Expected: Collection created successfully
```

---

## 💡 Why This Happened

**You configured everything correctly!** But there's one step that's easy to miss:

1. ✅ You set up the database connection (DATABASE_URL)
2. ✅ The app can connect to the database
3. ❌ But the tables don't exist yet!

**Solution:** Run `npm run db:push` to create the tables.

This is a **one-time setup step** - you only need to do it once per database.

---

## 🎯 Quick Command Reference

```bash
# Create/update database tables
npm run db:push

# Start development server
npm run dev

# Check TypeScript types
npm run check

# Run tests
npm run test

# Build for production
npm run build
```

---

## ✅ Success Criteria

Database is set up correctly when:
- ✅ `npm run db:push` completes without errors
- ✅ Server starts without database errors
- ✅ AI analysis works (no "relation does not exist")
- ✅ Can save repositories
- ✅ Can create collections
- ✅ All features work

---

## 🆘 Still Having Issues?

If you still get errors after running `npm run db:push`:

1. **Check the error message carefully**
2. **Verify DATABASE_URL** in `.env`
3. **Check Neon dashboard** - Is database active?
4. **Try again** - Sometimes network issues cause timeouts
5. **Check logs** - Look for specific error details

---

**Next Step:** Run `npm run db:push` now!

**Time Required:** 1-2 minutes  
**Difficulty:** Easy (just one command)  
**Impact:** Fixes all database-related errors
