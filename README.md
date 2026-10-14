# StayEase — Hotel Booking App

StayEase is a full-stack hotel booking web application built with **Node.js, Express, MongoDB, and Mongoose**. It provides a simple way for users to discover stays, search by destination and travel dates, review room options, and manage reservations.

# project live link :
https://stay-ease-zeta.vercel.app/

## Features

- Browse featured hotels and search by destination.
- Search stays using check-in/check-out dates and guest count.
- Filter results by price and rating.
- View hotel and room information, including nightly prices and capacity.
- User authentication and protected routes.
- Reservation and availability management.
- Booking history and cancellation workflows.
- Administrative hotel, room, and booking management (where enabled by the current app configuration).
- MongoDB persistence through Mongoose.
- Automated tests for core API behavior.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas / MongoDB, Mongoose
- **Validation and configuration:** Zod, dotenv
- **Authentication and security:** JSON Web Tokens, bcryptjs, cookie-parser, Helmet, CORS, express-rate-limit
- **Testing:** Node.js test runner, Supertest, mongodb-memory-server
- **Deployment:** Vercel-compatible deployment setup (verify production routes and environment variables after deployment)

## Project Structure

```text
hotel-booking-app/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server/
│   ├── middleware/
│   ├── models/
│   │   ├── Booking.js
│   │   ├── Hotel.js
│   │   ├── Room.js
│   │   ├── RoomNight.js
│   │   └── User.js
│   ├── services/
│   │   ├── availability.js
│   │   └── reservations.js
│   ├── utils/
│   ├── app.js
│   ├── config.js
│   ├── db.js
│   ├── index.js
│   └── seed.js
├── tests/
│   └── api.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- [Node.js](https://nodejs.org/) **20 or later**
- npm (included with Node.js)
- A MongoDB database. [MongoDB Atlas](https://www.mongodb.com/atlas) is suitable for a hosted database.

## Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd hotel-booking-app
```

Replace `<YOUR_GITHUB_REPOSITORY_URL>` with the URL of your GitHub repository.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root, alongside `package.json`. Use `.env.example` as a guide if it contains the current required keys.

Example:

```dotenv
PORT=3000
MONGODB_URI="mongodb+srv://<database-user>:<password>@<cluster-host>/stayease?retryWrites=true&w=majority"
JWT_SECRET="replace-with-a-unique-random-secret-of-at-least-32-characters"
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:3000
# Optional, only if your app's admin setup uses these:
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Update the MongoDB URI with the credentials and cluster host from MongoDB Atlas. The database name (`stayease` in this example) should appear before the `?` query parameters. If the password contains URL-reserved characters, URL-encode them in the URI.

Generate a JWT secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `JWT_SECRET` in your local `.env` file. Do not use the example secret in a real deployment.

**Never commit `.env` or share database credentials.** Ensure `.env` is listed in `.gitignore`; commit `.env.example` only with placeholders, never real secrets.

### 4. Configure MongoDB Atlas

1. Create a MongoDB Atlas cluster and a dedicated database user for the application.
2. Grant the app user only the database permissions it needs (for example, `readWrite` on the `stayease` database).
3. Add the appropriate network access rules for your development or hosting environment.
4. Store the Atlas connection string in `MONGODB_URI`.

For production, avoid broad IP access rules when possible. Use the narrowest network access configuration supported by your hosting setup.

### 5. Run database seed data (if needed)

If the project includes demo records in `server/seed.js`, and your database is configured, run:

```bash
npm run seed
```

Seed data is not automatically copied to a deployed database just because the application is deployed. Run the seed script deliberately against the intended database. Confirm the seed script is safe to rerun before running it repeatedly.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Keep the terminal running while using the app.

For a standard start without watch mode:

```bash
npm start
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the server using Node.js watch mode. |
| `npm start` | Starts the application. |
| `npm run seed` | Runs the database seed script. |
| `npm test` | Runs the automated tests using Node's test runner. |
| `npm run check` | Checks syntax in selected server and frontend entry files. |

Before pushing changes, run:

```bash
npm run check
npm test
```

## Deployment on Vercel

1. Push the project to GitHub and make sure `.env` is not tracked.
2. In [Vercel](https://vercel.com/), choose **Add New → Project** and import the repository.
3. Use the repository root (the directory containing `package.json`) as the project root unless your deployment configuration specifies otherwise.
4. Configure the required environment variables in **Project Settings → Environment Variables**:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `CLIENT_ORIGIN` set to the deployed site's actual origin, such as `https://your-project.vercel.app`
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` only if required by your setup
5. Deploy, then review the Vercel build and runtime logs.
6. Test the homepage, hotel search, authentication, availability, booking, and cancellation flows on the deployed URL.
7. If environment variables change, redeploy so the new values are picked up.


## Security

- Do not commit `.env`, database passwords, JWT secrets, tokens, or other credentials.
- Use a dedicated database account with the minimum required permissions.
- Keep production secrets in the hosting provider's environment-variable settings.
- Do not use publicly open database network access as a permanent security solution.
- Do not store real customer or payment data in a demo environment.

## Contributing

1. Create a branch for your change.
2. Make and test the change locally.
3. Run `npm run check` and `npm test`.
4. Open a pull request describing what changed and how it was tested.

