# StayEase

StayEase is a full-stack hotel discovery and booking demo. The browser UI is served by Express, and hotel, account and reservation data is stored in MongoDB through Mongoose. It uses cookie-based JWT sessions and bcrypt password hashing. There is no real payment processing.

## Requirements

- Node.js 20 or later and npm
- MongoDB 6 or later (local MongoDB or a MongoDB Atlas connection string)

## Setup

1. Create a MongoDB database. For local development, start MongoDB and use `mongodb://127.0.0.1:27017/stayease`. For Atlas, create a database user, allow your development IP in Network Access, and copy the connection string.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique `JWT_SECRET` of at least 32 characters. Keep `.env` private; it is ignored by Git.
3. Install dependencies and load ten sample hotels and their rooms across ten destinations:

   ```sh
   npm install
   npm run seed
   ```

4. Start StayEase:

   ```sh
   npm run dev
   ```

5. Visit `http://localhost:3000`.

The seed command can optionally create/promote an administrator. Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before running `npm run seed`; the password must be at least 12 characters. No administrator password or production secret is shipped with the project. Sign in with that account and use **Manage** to add hotels and rooms, change hotel details and rates, adjust inventory, and review or cancel reservations.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port (default `3000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Random secret used to sign sessions; minimum 32 characters |
| `NODE_ENV` | No | `development`, `test`, or `production`; secure cookies are enabled in production |
| `CLIENT_ORIGIN` | No | Allowed browser origin for credentialed API requests (default `http://localhost:3000`) |
| `ADMIN_EMAIL` | No | Email for an administrator created by the seed script; must be set with `ADMIN_PASSWORD` |
| `ADMIN_PASSWORD` | No | Administrator password for seed; minimum 12 characters |

For production, use HTTPS, set `NODE_ENV=production`, use a high-entropy secret and a restricted MongoDB user, and set `CLIENT_ORIGIN` to the exact public origin. Do not commit `.env` or share the production secret.

## Deploy to Vercel

Vercel detects the Express application exported from the repository-root `index.js`. Express serves the files in `public/` and handles `/api/*` requests in the same deployment, so no custom rewrites or persistent server process are needed.

1. Push the repository to GitHub, GitLab, or Bitbucket. Confirm `.env` is not tracked (`git check-ignore .env` should print `.env`).
2. In Vercel, choose **Add New → Project**, import the repository, and keep the project root set to the repository root. The framework should be detected as Express. Leave the output directory and rewrites unset.
3. In **Project Settings → Environment Variables**, add these variables for Production (and Preview too if you want preview deployments to connect to the database):
   - `MONGODB_URI`: your MongoDB Atlas connection string, including the database name.
   - `JWT_SECRET`: a unique, random value of at least 32 characters.
   - `NODE_ENV`: `production`.
   - `CLIENT_ORIGIN`: the exact HTTPS origin used by the deployed site, such as `https://your-project.vercel.app` (no trailing path).
4. In MongoDB Atlas, ensure the database user has the required database permissions and the Atlas network-access rules permit connections from Vercel. Prefer Vercel static outbound IPs or a private network integration where available; avoid broadly opening database access unless required by your Vercel setup.
5. If the Atlas database has no hotels yet, configure a local, uncommitted environment to use that same `MONGODB_URI` and run `npm run seed`. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in that local environment before seeding to create an administrator.
6. Deploy the project from Vercel. When the first API request arrives, the function connects to Atlas and initializes the required indexes; warm function instances reuse their Mongoose connection.
7. Open the deployment URL and verify the page, styles, and browser app load. In the browser console or Network panel, confirm `GET /api/hotels` returns `200`; then register/log in and test a booking and cancellation. Also check `GET /api/auth/me` returns the expected signed-in user after login and `401` after logout.
8. If configuration changes are needed, update the Vercel environment variables and redeploy. Review the function logs in Vercel if an API request fails.

Vercel has not been run against your account or Atlas database as part of this repository change; follow the steps above to deploy and verify it.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with Node's built-in watch mode |
| `npm start` | Start the server |
| `npm run seed` | Idempotently upsert ten sample hotels/rooms and optionally configure an administrator |
| `npm test` | Run API integration tests against an ephemeral MongoDB server |
| `npm run check` | Run JavaScript syntax checks |

The integration tests use `mongodb-memory-server`; its first run may need to download a MongoDB test binary. Production and normal development still use the `MONGODB_URI` database.

## What is included

- Search by hotel, destination or country, dates, guest capacity, price range and minimum rating; the initial page shows featured stays and Clear search resets the filters.
- Hotel details, amenities, room capacities, rates and live room availability.
- Registration, login and logout; passwords are bcrypt-hashed and session tokens are HttpOnly cookies.
- Server-priced reservations and a dashboard for upcoming, completed and cancelled trips.
- Cancellation is allowed before check-in. This demo does not collect payment or issue refunds.
- Admin-only hotel and room create/edit/delete endpoints and a reservation management view.
- Responsive layouts and explicit loading, empty and error feedback.

### Booking concurrency

Each room unit is allocated for each occupied night. MongoDB enforces a unique index on `(room, date, unit)`, so requests racing for the same inventory cannot both reserve the same room unit for the same night. If a multi-night reservation hits a conflict, its partial nightly allocations are removed and the API returns `409 Conflict`. The index is initialized by the server at startup.

## REST API

All request and response bodies use JSON. Authentication uses the `stayease_token` HttpOnly cookie, set by registration/login and cleared by logout. Admin endpoints require a signed-in user with the `admin` role. Errors use `{ "error": "message" }`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register `{ name, email, password }` (password minimum 10 characters) |
| `POST` | `/api/auth/login` | Public | Sign in `{ email, password }` |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `GET` | `/api/auth/me` | Signed in | Current account |
| `GET` | `/api/hotels` | Public | Search; supports `destination`, `checkIn`, `checkOut`, `guests`, `minPrice`, `maxPrice`, `minRating`, `featuredOnly=true` |
| `GET` | `/api/hotels/:id` | Public | Hotel, rooms and availability; optional `checkIn`, `checkOut` and `guests` |
| `POST` | `/api/hotels` | Admin | Create hotel |
| `PATCH` | `/api/hotels/:id` | Admin | Update hotel fields |
| `DELETE` | `/api/hotels/:id` | Admin | Remove a hotel with no active reservations |
| `POST` | `/api/hotels/:hotelId/rooms` | Admin | Add a room type |
| `PATCH` | `/api/rooms/:id` | Admin | Update room details, rate or inventory |
| `DELETE` | `/api/rooms/:id` | Admin | Remove a room type with no active reservations |
| `POST` | `/api/bookings` | Signed in | Create `{ roomId, checkIn, checkOut, guests }`; total is calculated on the server |
| `GET` | `/api/bookings/mine` | Signed in | List the current user's bookings |
| `GET` | `/api/bookings` | Admin | List all bookings |
| `PATCH` | `/api/bookings/:id/cancel` | Owner or admin | Cancel before check-in and release inventory |

Dates use `YYYY-MM-DD` and stays must be 1–30 nights. Seeded rooms start with their configured inventory available; the seed does not create placeholder reservations or nightly allocations. Re-running the seed updates the same named demo hotels and room types without duplicating them or changing existing reservation records. A booking request checks room capacity and current inventory on the server. A conflicting booking returns `409`; invalid input returns `400`; unauthenticated and unauthorized calls return `401` and `403`.

## Git and GitHub

This workspace is initialized as a local Git repository, but no GitHub remote is configured. To publish it, review the files and connect your own GitHub repository:

```sh
git add .
git commit -m "Build StayEase hotel booking app"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Confirm `.env` is not staged before pushing.
