const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database setup
const db = new sqlite3.Database('rsvps.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS rsvps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            guest_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here', // Use environment variable in production
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only send cookies over HTTPS in production
        httpOnly: true,
        sameSite: 'strict'
    }
}));
app.use(flash());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
    const messages = req.flash('message');
    res.render('index', { 
        messages,
        csrfToken: req.csrfToken() // Add CSRF token to the form
    });
});

// Input validation middleware
const validateRSVP = (req, res, next) => {
    const { email, guest_name } = req.body;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        req.flash('message', 'Please enter a valid email address');
        return res.redirect('/');
    }
    
    // Sanitize guest name
    if (guest_name) {
        req.body.guest_name = guest_name.trim().slice(0, 100); // Limit length
    }
    
    next();
};

app.post('/rsvp', validateRSVP, (req, res) => {
    const { email, guest_name } = req.body;
    
    db.run(
        'INSERT INTO rsvps (email, guest_name) VALUES (?, ?)',
        [email, guest_name || null],
        (err) => {
            if (err) {
                console.error('Error inserting RSVP:', err);
                req.flash('message', 'An error occurred. Please try again.');
            } else {
                req.flash('message', 'Thank you for your RSVP!');
            }
            res.redirect('/');
        }
    );
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        req.flash('message', 'Invalid form submission. Please try again.');
        return res.redirect('/');
    }
    next(err);
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 