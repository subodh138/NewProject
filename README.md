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
# Edit .env with your JWT secret

# 3. Seed the database (creates admin + demo user + charities + sample draw)
npm run seed

# 4. Start development server
npm run dev

# 5. Open in browser
open http://localhost:3000
```

---

## 🔐 Default Credentials

| Role       | Email                   | Password     |
|------------|-------------------------|--------------|
| Admin      | admin@greengive.com     | Admin@12345  |
| Subscriber | demo@greengive.com      | Demo@12345   |

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
    ├── database.js        # SQLite init + schema
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

Built on **SQLite** via `better-sqlite3`. Tables:

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
| Database | SQLite (better-sqlite3)               |
| Auth     | JWT (jsonwebtoken) + bcryptjs         |
| Frontend | Vanilla HTML/CSS/JS                   |
| Fonts    | Playfair Display, DM Sans, DM Mono    |
| Deploy   | Vercel (serverless) + Supabase (DB)   |

---

## 🔧 Environment Variables

| Variable        | Description                        | Default        |
|-----------------|------------------------------------|----------------|
| PORT            | Server port                        | 3000           |
| JWT_SECRET      | JWT signing secret (change this!)  | —              |
| JWT_EXPIRES_IN  | Token expiry                       | 7d             |
| NODE_ENV        | Environment                        | development    |

---

*Built for Digital Heroes — Full-Stack Development Trainee Selection Process*
