require('dotenv').config();
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
        const { error } = await supabase
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

// Basic middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session middleware
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

// Flash middleware (must come after session)
app.use(flash());

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com", "https://www.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "https://maps.googleapis.com", "https://maps.gstatic.com"],
            connectSrc: ["'self'", "https://maps.googleapis.com"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(csrf({ cookie: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many RSVP attempts from this IP, please try again later'
});

// Input validation middleware
const validateRSVP = (req, res, next) => {
    const { email, phone, primary_guest_name, secondary_guest_name, additional_info } = req.body;
    
    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
        return res.render('index', { 
            messages: ['error: Please enter a valid email address'],
            formData: req.body,
            csrfToken: req.csrfToken()
        });
    }
    
    // Phone validation (optional)
    if (phone && !/^[\d\s()-]{10,15}$/.test(phone)) {
        return res.render('index', { 
            messages: ['error: Please enter a valid phone number'],
            formData: req.body,
            csrfToken: req.csrfToken()
        });
    }
    
    // Name validation
    if (!primary_guest_name || primary_guest_name.trim().length === 0 || primary_guest_name.length > 100) {
        return res.render('index', { 
            messages: ['error: Please enter a valid name (max 100 characters)'],
            formData: req.body,
            csrfToken: req.csrfToken()
        });
    }
    
    // Sanitize inputs
    const sanitizeInput = (input, maxLength) => {
        if (!input) return null;
        return input.trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .slice(0, maxLength);
    };
    
    req.body.primary_guest_name = sanitizeInput(primary_guest_name, 100);
    req.body.secondary_guest_name = sanitizeInput(secondary_guest_name, 100);
    req.body.phone = sanitizeInput(phone, 15);
    req.body.additional_info = sanitizeInput(additional_info, 500);
    
    next();
};

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
    const messages = req.flash('message');
    res.render('index', { 
        messages,
        formData: {},
        csrfToken: req.csrfToken()
    });
});

// Handle form submission at root
app.post('/', process.env.NODE_ENV === 'production' ? limiter : (req, res, next) => next(), validateRSVP, async (req, res) => {
    const { 
        email, 
        phone, 
        primary_guest_name, 
        secondary_guest_name, 
        additional_info,
        'need-lodging': needLodging,
        'willing-to-volunteer': willingToVolunteer,
        volunteer
    } = req.body;
    
    try {
        console.log('Attempting to insert RSVP:', { 
            email, 
            phone, 
            primary_guest_name, 
            secondary_guest_name, 
            additional_info,
            needLodging,
            willingToVolunteer,
            volunteer
        });
        
        const { data, error } = await supabase
            .from('rsvps')
            .insert([
                { 
                    email,
                    phone: phone || null,
                    primary_guest_name,
                    secondary_guest_name: secondary_guest_name || null,
                    additional_info: additional_info || null,
                    needs_lodging: needLodging === 'on',
                    willing_to_volunteer: willingToVolunteer === 'on',
                    volunteer_info: volunteer || null
                }
            ])
            .select();
            
        if (error) {
            console.error('Supabase insert error:', error);
            return res.render('index', { 
                messages: ['error: An error occurred while saving your RSVP. Please try again.'],
                formData: req.body,
                csrfToken: req.csrfToken()
            });
        }
        
        console.log('Successfully inserted RSVP:', data);
        return res.render('index', {
            messages: ['Thank you for your RSVP!'],
            formData: {},
            csrfToken: req.csrfToken()
        });
    } catch (err) {
        console.error('Error in RSVP submission:', err);
        return res.render('index', { 
            messages: ['error: An error occurred. Please try again.'],
            formData: req.body,
            csrfToken: req.csrfToken()
        });
    }
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