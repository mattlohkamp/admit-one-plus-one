const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('rsvps.db');

console.log('Checking database contents...');

db.all('SELECT * FROM rsvps', [], (err, rows) => {
    if (err) {
        console.error('Error reading database:', err);
        return;
    }
    
    if (rows.length === 0) {
        console.log('No RSVPs found in the database.');
    } else {
        console.log(`Found ${rows.length} RSVP(s):`);
        rows.forEach((row, index) => {
            console.log(`\nRSVP #${index + 1}:`);
            console.log(`Email: ${row.email}`);
            console.log(`Guest Name: ${row.guest_name || 'None'}`);
            console.log(`Created At: ${row.created_at}`);
        });
    }
    
    db.close();
}); 