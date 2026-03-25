# GreenGive · Golf Charity Subscription Platform

> Built by [Digital Heroes](https://digitalheroes.co.in) — Full-Stack Development Trainee Selection

A subscription-driven web application combining **golf performance tracking**, **charity fundraising**, and a **monthly draw-based reward engine**.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your Supabase DATABASE_URL + JWT secret

# 3. Initialize the Postgres schema
npm run db:check
npm run db:init

# 4. Optional: import your existing local SQLite data into Supabase
npm run db:import

# 5. Optional: seed demo data into Supabase
npm run seed

# 6. Start development server
npm run dev

# 7. Open in browser
open http://localhost:3000
```

---

## 🔐 Local Default Credentials

| Role       | Email                   | Password     |
|------------|-------------------------|--------------|
| Admin      | admin@greengive.com     | Admin@12345  |
| Subscriber | demo@greengive.com      | Demo@12345   |

These defaults are intended for local seeding only. For production or Vercel, set admin credentials with environment variables and avoid publishing demo users.

---

## 📁 Project Structure

```
greengive/
├── server.js              # Express app entry point
├── package.json
├── .env                   # Environment variables (git-ignored)
├── .env.example           # Template
│
├── public/                # Static frontend files
│   ├── index.html         # Landing page
│   ├── login.html         # Login / Admin login
│   ├── signup.html        # Multi-step signup (account → charity → plan)
│   ├── dashboard.html     # User dashboard (scores, draws, charity, winnings)
│   ├── admin.html         # Admin panel (users, draws, charities, winners)
│   └── shared.css         # Global styles, variables, components
│
├── routes/
│   ├── authRoutes.js      # /api/auth/* (signup, login, admin-login, me)
│   ├── userRoutes.js      # /api/user/* (dashboard, profile, subscribe, cancel)
│   ├── scoreRoutes.js     # /api/scores/* (CRUD with rolling-5 logic)
│   ├── charityRoutes.js   # /api/charities/* (list, select, featured)
│   ├── drawRoutes.js      # /api/draws/* (list, enter, results)
│   └── adminRoutes.js     # /api/admin/* (analytics, users, draws, winners)
│
├── middleware/
│   └── auth.js            # JWT authenticate, requireAdmin, requireSubscription
│
└── db/
    ├── database.js        # Postgres adapter + connection management
    ├── schema.postgres.sql # Database schema for Supabase / Postgres
    ├── init.js            # Initialize schema
    ├── import-sqlite-to-postgres.js # One-time SQLite -> Supabase import
    ├── bootstrap.js       # Optional runtime bootstrap seeding
    ├── seedData.js        # Shared seed helpers
    └── seed.js            # Database seeder
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint               | Auth     | Description          |
|--------|------------------------|----------|----------------------|
| POST   | /api/auth/signup       | —        | Create account       |
| POST   | /api/auth/login        | —        | User login           |
| POST   | /api/auth/admin-login  | —        | Admin login          |
| GET    | /api/auth/me           | Bearer   | Get current user     |

### User
| Method | Endpoint               | Auth       | Description             |
|--------|------------------------|------------|-------------------------|
| GET    | /api/user/dashboard    | Bearer     | Full dashboard data     |
| PATCH  | /api/user/profile      | Bearer     | Update name/handicap    |
| POST   | /api/user/subscribe    | Bearer     | Activate subscription   |
| POST   | /api/user/cancel       | Bearer     | Cancel subscription     |

### Scores
| Method | Endpoint          | Auth         | Description              |
|--------|-------------------|--------------|--------------------------|
| GET    | /api/scores       | Bearer+Sub   | Get user's scores        |
| POST   | /api/scores       | Bearer+Sub   | Add score (rolling 5)    |
| DELETE | /api/scores/:id   | Bearer+Sub   | Delete a score           |

### Charities
| Method | Endpoint                | Auth     | Description            |
|--------|-------------------------|----------|------------------------|
| GET    | /api/charities          | —        | List all charities     |
| GET    | /api/charities/featured | —        | Get featured charity   |
| GET    | /api/charities/:id      | —        | Get single charity     |
| PATCH  | /api/charities/select   | Bearer   | User selects charity   |

### Draws
| Method | Endpoint                   | Auth         | Description              |
|--------|----------------------------|--------------|--------------------------|
| GET    | /api/draws                 | —            | List published draws     |
| GET    | /api/draws/latest          | —            | Latest published draw    |
| GET    | /api/draws/:id/my-result   | Bearer+Sub   | User's draw result       |
| POST   | /api/draws/:id/enter       | Bearer+Sub   | Enter a draw             |

### Admin (all require admin JWT)
| Method | Endpoint                         | Description                  |
|--------|----------------------------------|------------------------------|
| GET    | /api/admin/analytics             | Platform stats               |
| GET    | /api/admin/users                 | List users                   |
| PATCH  | /api/admin/users/:id             | Edit user                    |
| DELETE | /api/admin/users/:id             | Delete user                  |
| GET    | /api/admin/draws                 | All draws                    |
| POST   | /api/admin/draws                 | Create draw                  |
| POST   | /api/admin/draws/:id/simulate    | Simulate draw results        |
| POST   | /api/admin/draws/:id/publish     | Publish draw results         |
| GET    | /api/admin/winners               | List all winners             |
| PATCH  | /api/admin/winners/:id/verify    | Verify winner + mark paid    |
| GET    | /api/admin/charities             | List charities               |
| POST   | /api/admin/charities             | Create charity               |
| PATCH  | /api/admin/charities/:id         | Edit charity                 |
| DELETE | /api/admin/charities/:id         | Delete charity               |

---

## 🎨 Frontend Pages

| Page          | URL          | Description                                            |
|---------------|--------------|--------------------------------------------------------|
| Landing       | /            | Hero, how-it-works, charities, prizes, pricing, FAQ    |
| Login         | /login       | Subscriber + Admin tabs                                |
| Signup        | /signup      | 3-step: account → charity → plan                       |
| Dashboard     | /dashboard   | Scores, draws, charity, subscription, winnings         |
| Admin Panel   | /admin       | Analytics, users, draw management, winners, charities  |

---

## 🗃️ Database Schema

Built on **Postgres** for Supabase. Tables:

- `users` — subscribers and admins
- `charities` — charity listings with totals
- `scores` — rolling 5 scores per user
- `draws` — monthly draw configurations and results
- `draw_entries` — user draw participation and match results
- `payments` — subscription payment log

---

## 🧪 Test Checklist

- [ ] User signup (3-step flow)
- [ ] Login (subscriber + admin)
- [ ] Score entry (rolling 5 enforcement)
- [ ] Score deletion
- [ ] Draw entry with match calculation
- [ ] Charity selection + contribution
- [ ] Admin: create + simulate + publish draw
- [ ] Admin: winner verification + mark paid
- [ ] Admin: charity CRUD
- [ ] User dashboard all panels
- [ ] Subscription cancel
- [ ] Responsive layout (mobile + desktop)

---

## 📦 Tech Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Backend  | Node.js + Express                     |
| Database | Supabase Postgres                     |
| Auth     | JWT (jsonwebtoken) + bcryptjs         |
| Frontend | Vanilla HTML/CSS/JS                   |
| Fonts    | Playfair Display, DM Sans, DM Mono    |
| Deploy   | Vercel + Supabase                     |

---

## 🔧 Environment Variables

| Variable              | Description                                           | Default |
|-----------------------|-------------------------------------------------------|---------|
| PORT                  | Local server port                                     | 3000    |
| HOST                  | Local server host                                     | 127.0.0.1 |
| DATABASE_URL          | Supabase Postgres connection string                   | —       |
| PGSSL                 | Set to `disable` only for local non-SSL Postgres      | require |
| PG_POOL_MAX           | Max Postgres connections from the app                 | 10      |
| JWT_SECRET            | JWT signing secret                                    | —       |
| JWT_EXPIRES_IN        | Token expiry                                          | 7d      |
| NODE_ENV              | Environment                                           | development |
| BOOTSTRAP_PUBLIC_DATA | Seed charities and sample draws on app start          | false   |
| SEED_ADMIN_EMAIL      | Admin email for runtime bootstrap or `npm run seed`   | —       |
| SEED_ADMIN_PASSWORD   | Admin password for runtime bootstrap or `npm run seed`| —       |
| SEED_ADMIN_NAME       | Admin display name                                    | GreenGive Admin |
| SEED_DEMO_USER        | Whether to create a demo subscriber at runtime        | false   |
| SEED_DEMO_EMAIL       | Demo subscriber email                                 | demo@greengive.com |
| SEED_DEMO_PASSWORD    | Demo subscriber password                              | Demo@12345 |
| SEED_DEMO_NAME        | Demo subscriber display name                          | Jamie Fairway |
| SQLITE_PATH           | Existing SQLite file path for `npm run db:import`     | ./db/greengive.db |
| IMPORT_TRUNCATE       | Allow import into a non-empty Postgres DB             | false   |

---

## ▲ Supabase Setup

1. Create a new Supabase project.
2. In the Supabase dashboard, open `Connect`.
3. Copy a connection string from `Connect`.
4. For local setup and import scripts, prefer the **Direct connection** or **Session pooler** string when available.
5. Put that value into your local `.env` as `DATABASE_URL`.
6. For Vercel runtime traffic later, use the **Transaction pooler** string.
7. Set your database password in the copied URL.
8. Verify the connection:

```bash
npm run db:check
```

9. Run:

```bash
npm run db:init
```

10. If you want to migrate your existing local SQLite data:

```bash
npm run db:import
```

11. If you want demo/sample content instead of importing:

```bash
npm run seed
```

### Recommended Supabase choices

- Use the **Transaction pooler** connection string for Vercel runtime traffic.
- Use a strong database password before deploying anything public.
- Keep the default `public` schema unless you have a reason to customize it.
- You do not need Supabase Auth for this app right now because the project already uses JWT auth in Express.

## ▲ Deploying To Vercel

This project is now Vercel-compatible as an Express app with static files in `public/`.

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add at least these environment variables in Vercel:

```bash
DATABASE_URL=postgresql://postgres:[password]@db.project-ref.supabase.co:6543/postgres
JWT_SECRET=your-strong-production-secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=change-this-password
```

4. Optional runtime seed variables:

```bash
BOOTSTRAP_PUBLIC_DATA=true
SEED_ADMIN_NAME=GreenGive Admin
SEED_DEMO_USER=false
```

5. Deploy.

---

*Built for Digital Heroes — Full-Stack Development Trainee Selection Process*
