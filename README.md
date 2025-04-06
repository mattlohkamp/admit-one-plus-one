# Simple RSVP Web App

A minimal web application for collecting RSVPs to an event, built with Node.js and Express.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run the application:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Features

- Simple email collection
- Optional guest name
- SQLite database for storing RSVPs
- Clean, responsive design
- Flash messages for user feedback

## Database

The RSVPs are stored in a SQLite database file (`rsvps.db`) in the project directory. You can view the data using any SQLite browser or through the Node.js REPL.

## Deployment

For production deployment:

1. Change the `secret` in the session configuration in `app.js`
2. Set the `NODE_ENV` environment variable to `production`
3. Use a process manager like PM2
4. Consider using a proper database server for production

## Tech Stack

- Node.js
- Express.js
- SQLite3
- EJS (templating)
- Express Session & Flash
