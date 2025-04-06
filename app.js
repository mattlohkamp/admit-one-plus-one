const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables!');
    process.exit(1);
}

console.log('Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey);

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('rsvps')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('Supabase connection test failed:', error);
            process.exit(1);
        }
        
        console.log('Successfully connected to Supabase!');
    } catch (err) {
        console.error('Error testing Supabase connection:', err);
        process.exit(1);
    }
}

testSupabaseConnection();

// Security middleware
app.use(helmet());
app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
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
        csrfToken: req.csrfToken()
    });
});

// Input validation middleware
const validateRSVP = (req, res, next) => {
    const { email, guest_name } = req.body;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        req.flash('message', 'Please enter a valid email address');
        return res.redirect('/');
    }
    
    if (guest_name) {
        req.body.guest_name = guest_name.trim().slice(0, 100);
    }
    
    next();
};

app.post('/rsvp', validateRSVP, async (req, res) => {
    const { email, guest_name } = req.body;
    
    try {
        console.log('Attempting to insert RSVP:', { email, guest_name });
        
        const { data, error } = await supabase
            .from('rsvps')
            .insert([
                { email, guest_name: guest_name || null }
            ]);
            
        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }
        
        console.log('Successfully inserted RSVP:', data);
        req.flash('message', 'Thank you for your RSVP!');
    } catch (err) {
        console.error('Error in RSVP submission:', err);
        req.flash('message', 'An error occurred. Please try again.');
    }
    
    res.redirect('/');
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