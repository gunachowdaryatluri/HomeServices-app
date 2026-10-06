# HomeServices – Full Stack Project (MongoDB Atlas)

Home Services Booking App: HTML/CSS/JS frontend + Node.js REST API + **MongoDB Atlas** database.
The UI, pages and user flow are unchanged from the original project.

## Stack
- **Frontend:** HTML, CSS, JavaScript (`frontend/`)
- **Backend:** Node.js REST API (`server.js`, `backend/`)
- **Database:** MongoDB Atlas (cloud) via the official `mongodb` driver
- **Auth:** server-side sessions (HttpOnly cookie, stored in MongoDB, auto-expire after 7 days), scrypt-hashed passwords, user/admin roles

## 1. Set up MongoDB Atlas (one time)
1. Create a free account at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. **Database Access → Add New Database User**: choose a username and password (use letters and numbers only, to avoid URL-encoding problems).
3. **Network Access → Add IP Address**: add your current IP, or `0.0.0.0/0` (allow from anywhere) for development.
4. **Database → Connect → Drivers**: copy the connection string, e.g.
   `mongodb+srv://myuser:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

## 2. Configure the project
Copy `.env.example` to `.env` and edit it:
```
MONGODB_URI=mongodb+srv://myuser:MyPass123@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=homeservices
PORT=3000
```
Replace `<password>` with the real password (without the `<` `>`). Never share `.env`.

## 3. Run
```bash
npm install
npm start
```
You should see: `HomeServices running at http://localhost:3000 (MongoDB connected)`
Open http://localhost:3000. Admin demo: `admin@homeservices.com` / `admin123` (created automatically on first start).

The database and collections (`users`, `bookings`, `sessions`) are created automatically on first use.

## Collections
| Collection | Fields |
|---|---|
| users | name, email (unique), password (hash), role |
| bookings | id (unique), name, email, service, status |
| sessions | _id (token), email, createdAt (TTL index: expires after 7 days) |

## API (unchanged)
| Method | Endpoint | Access |
|---|---|---|
| POST | /api/signup | public |
| POST | /api/login | public |
| POST | /api/logout | logged in |
| GET | /api/me | logged in |
| POST | /api/bookings | logged in |
| GET | /api/bookings/mine | logged in |
| GET | /api/admin/summary | admin |
| PUT | /api/bookings/:id/status | admin |

## Troubleshooting
- **"MONGODB_URI is not set"**: the `.env` file is missing or in the wrong folder (it must sit next to `server.js`).
- **"bad auth" / "Authentication failed"**: wrong username or password in the URI.
- **Timeout / "Server selection timed out"**: your IP isn't allowed in Atlas Network Access.
- **"Cannot find module 'mongodb'"**: run `npm install` first.

## Structure
```
server.js          starts server after connecting to MongoDB
backend/config.js  reads .env / environment variables
backend/db.js      MongoDB data layer + password hashing
backend/routes.js  API routes
frontend/          pages, style.css, script.js (unchanged)
```
