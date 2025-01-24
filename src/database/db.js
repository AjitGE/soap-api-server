const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fifa.db');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        club TEXT NOT NULL,
        position TEXT NOT NULL,
        age INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Statistics table
    db.run(`CREATE TABLE IF NOT EXISTS statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        season TEXT NOT NULL,
        goals INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        matches INTEGER DEFAULT 0,
        yellow_cards INTEGER DEFAULT 0,
        red_cards INTEGER DEFAULT 0,
        minutes_played INTEGER DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players(id)
    )`);

    // Awards table for array data type example
    db.run(`CREATE TABLE IF NOT EXISTS awards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        award_name TEXT NOT NULL,
        year INTEGER NOT NULL,
        category TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
    )`);

    // Users table for authentication
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Handle database errors
db.on('error', (err) => {
    console.error('Database error:', err);
});

module.exports = db;