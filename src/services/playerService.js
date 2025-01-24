const db = require('../database/db');
const { generateToken, createSoapFault } = require('../middleware/auth');

// Debug flag and last generated token for curl examples
const DEBUG = true;
let lastGeneratedToken = null;
let lastAuthType = 'Basic'; // Track the authentication type used

// Custom error classes
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 422;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConflictError';
        this.statusCode = 409;
    }
}

// Helper function to validate player data
const validatePlayer = (player) => {
    if (!player.name || typeof player.name !== 'string') {
        throw new ValidationError('Invalid player name');
    }
    if (!player.country || typeof player.country !== 'string') {
        throw new ValidationError('Invalid country');
    }
    if (!player.club || typeof player.club !== 'string') {
        throw new ValidationError('Invalid club');
    }
    if (!player.position || !['Forward', 'Midfielder', 'Defender', 'Goalkeeper'].includes(player.position)) {
        throw new ValidationError('Invalid position');
    }
    if (!player.age || player.age < 15 || player.age > 45) {
        throw new ValidationError('Invalid age');
    }

    // Validate statistics if provided
    if (player.statistics) {
        player.statistics.forEach(stat => {
            if (!stat.season || typeof stat.goals !== 'number' || typeof stat.matches !== 'number') {
                throw new ValidationError('Invalid statistics data');
            }
        });
    }

    // Validate awards if provided
    if (player.awards) {
        player.awards.forEach(award => {
            if (!award.awardName || !award.year || !award.category) {
                throw new ValidationError('Invalid award data');
            }
        });
    }
};

// Helper function to check for duplicate player
const checkDuplicatePlayer = async (name, club, excludeId = null) => {
    return new Promise((resolve, reject) => {
        const query = excludeId
            ? 'SELECT id FROM players WHERE name = ? AND club = ? AND id != ?'
            : 'SELECT id FROM players WHERE name = ? AND club = ?';
        const params = excludeId ? [name, club, excludeId] : [name, club];

        db.get(query, params, (err, row) => {
            if (err) reject(err);
            if (row) throw new ConflictError(`Player ${name} already exists in ${club}`);
            resolve();
        });
    });
};

// Helper function to generate request/response logs
const generateRequestLog = (operation, args, authType = lastAuthType) => {
    // Generate SOAP envelope for request
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soapenv:Body>
      <tns:${operation}Request>
         ${Object.entries(args).map(([key, value]) => {
             if (typeof value === 'object') {
                 return `<${key}>${JSON.stringify(value, null, 6).replace(/"/g, '')}</${key}>`;
             }
             return `<${key}>${value}</${key}>`;
         }).join('\n         ')}
      </tns:${operation}Request>
   </soapenv:Body>
</soapenv:Envelope>`;

    // Generate auth header based on type
    const authHeader = authType === 'Bearer'
        ? `Authorization: Bearer ${lastGeneratedToken || 'YOUR_AUTH_TOKEN_HERE'}`
        : `Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=`; // Base64 of admin:password123

    return `Input Request:
=================
Headers:
Content-Type: text/xml
${authHeader}

Body:
${soapEnvelope}

Example curl:
=================
curl --location 'http://localhost:3000/soap/player' \\
--header 'Content-Type: text/xml' \\
--header '${authHeader}' \\
--data '${soapEnvelope}'`;
};

const generateResponseLog = (operation, response) => {
    // Generate SOAP envelope for response
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soapenv:Body>
      <tns:${operation}Response>
         ${JSON.stringify(response, null, 6)}
      </tns:${operation}Response>
   </soapenv:Body>
</soapenv:Envelope>`;

    return `Output Response:
=================
Headers:
Content-Type: text/xml
Status: 200 OK

Body:
${soapEnvelope}`;
};

const playerService = {
    PlayerService: {
        PlayerPort: {
            // Get player with statistics and awards
            getPlayer: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Get Player Service Start ===');
                    console.log(generateRequestLog('getPlayer', { id: args.id }));
                }
                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT
                            p.*,
                            (
                                SELECT json_group_array(
                                    json_object(
                                        'season', s.season,
                                        'goals', s.goals,
                                        'assists', s.assists,
                                        'matches', s.matches,
                                        'yellowCards', s.yellow_cards,
                                        'redCards', s.red_cards,
                                        'minutesPlayed', s.minutes_played
                                    )
                                )
                                FROM statistics s
                                WHERE s.player_id = p.id
                            ) as statistics,
                            (
                                SELECT json_group_array(
                                    json_object(
                                        'awardName', a.award_name,
                                        'year', a.year,
                                        'category', a.category
                                    )
                                )
                                FROM awards a
                                WHERE a.player_id = p.id
                            ) as awards
                        FROM players p
                        WHERE p.id = ?`,
                        [args.id],
                        (err, row) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            if (!row) {
                                reject(new Error('Player not found'));
                                return;
                            }

                            try {
                                // Handle statistics
                                if (row.statistics) {
                                    row.statistics = JSON.parse(row.statistics);
                                    if (!Array.isArray(row.statistics)) {
                                        row.statistics = [];
                                    }
                                } else {
                                    row.statistics = [];
                                }

                                // Handle awards
                                if (row.awards) {
                                    row.awards = JSON.parse(row.awards);
                                    if (!Array.isArray(row.awards)) {
                                        row.awards = [];
                                    }
                                } else {
                                    row.awards = [];
                                }

                                // Handle boolean
                                row.isActive = Boolean(row.is_active);
                                delete row.is_active;

                                if (DEBUG) {
                                    console.log('\n' + generateResponseLog('getPlayer', { player: row }));
                                }
                                resolve({ player: row });
                            } catch (error) {
                                row.statistics = [];
                                row.awards = [];
                                row.isActive = Boolean(row.is_active);
                                delete row.is_active;
                                resolve({ player: row });
                            }
                        }
                    );
                });
            },

            // Create new player with statistics and awards
            createPlayer: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Create Player Service Start ===');
                    console.log(generateRequestLog('createPlayer', { player: args }));
                }
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        db.run(
                            `INSERT INTO players (name, country, club, position, age, is_active)
                            VALUES (?, ?, ?, ?, ?, ?)`,
                            [args.name, args.country, args.club, args.position, args.age, args.isActive],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }

                                const playerId = this.lastID;

                                // Insert statistics if provided
                                if (args.statistics) {
                                    const statsStmt = db.prepare(
                                        `INSERT INTO statistics
                                        (player_id, season, goals, assists, matches, yellow_cards, red_cards, minutes_played)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                                    );

                                    args.statistics.forEach(stat => {
                                        statsStmt.run([
                                            playerId,
                                            stat.season,
                                            stat.goals,
                                            stat.assists,
                                            stat.matches,
                                            stat.yellowCards,
                                            stat.redCards,
                                            stat.minutesPlayed
                                        ]);
                                    });

                                    statsStmt.finalize();
                                }

                                // Insert awards if provided
                                if (args.awards) {
                                    const awardsStmt = db.prepare(
                                        `INSERT INTO awards
                                        (player_id, award_name, year, category)
                                        VALUES (?, ?, ?, ?)`
                                    );

                                    args.awards.forEach(award => {
                                        awardsStmt.run([
                                            playerId,
                                            award.awardName,
                                            award.year,
                                            award.category
                                        ]);
                                    });

                                    awardsStmt.finalize();
                                }

                                // Get the complete player data for response
                                db.get(
                                    `SELECT
                                        p.*,
                                        (
                                            SELECT json_group_array(
                                                json_object(
                                                    'season', s.season,
                                                    'goals', s.goals,
                                                    'assists', s.assists,
                                                    'matches', s.matches,
                                                    'yellowCards', s.yellow_cards,
                                                    'redCards', s.red_cards,
                                                    'minutesPlayed', s.minutes_played
                                                )
                                            )
                                            FROM statistics s
                                            WHERE s.player_id = p.id
                                        ) as statistics,
                                        (
                                            SELECT json_group_array(
                                                json_object(
                                                    'awardName', a.award_name,
                                                    'year', a.year,
                                                    'category', a.category
                                                )
                                            )
                                            FROM awards a
                                            WHERE a.player_id = p.id
                                        ) as awards
                                    FROM players p
                                    WHERE p.id = ?`,
                                    [playerId],
                                    (err, row) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }

                                        try {
                                            // Handle statistics
                                            if (row.statistics) {
                                                row.statistics = JSON.parse(row.statistics);
                                                if (!Array.isArray(row.statistics)) {
                                                    row.statistics = [];
                                                }
                                            } else {
                                                row.statistics = [];
                                            }

                                            // Handle awards
                                            if (row.awards) {
                                                row.awards = JSON.parse(row.awards);
                                                if (!Array.isArray(row.awards)) {
                                                    row.awards = [];
                                                }
                                            } else {
                                                row.awards = [];
                                            }

                                            // Handle boolean
                                            row.isActive = Boolean(row.is_active);
                                            delete row.is_active;

                                            if (DEBUG) {
                                                console.log('\n' + generateResponseLog('createPlayer', {
                                                    success: true,
                                                    message: 'Player created successfully',
                                                    player: row
                                                }));
                                            }
                                            db.run('COMMIT');
                                            resolve({
                                                success: true,
                                                message: 'Player created successfully',
                                                player: row
                                            });
                                        } catch (error) {
                                            db.run('ROLLBACK');
                                            reject(error);
                                        }
                                    }
                                );
                            }
                        );
                    });
                });
            },

            // Update player with statistics and awards
            updatePlayer: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Update Player Service Start ===');
                    console.log(generateRequestLog('updatePlayer', { player: args }));
                }
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        db.run(
                            `UPDATE players
                            SET name = ?, country = ?, club = ?, position = ?, age = ?, is_active = ?
                            WHERE id = ?`,
                            [args.name, args.country, args.club, args.position, args.age, args.isActive, args.id],
                            (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }

                                // Update statistics
                                if (args.statistics) {
                                    db.run('DELETE FROM statistics WHERE player_id = ?', [args.id]);
                                    const statsStmt = db.prepare(
                                        `INSERT INTO statistics
                                        (player_id, season, goals, assists, matches, yellow_cards, red_cards, minutes_played)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                                    );

                                    args.statistics.forEach(stat => {
                                        statsStmt.run([
                                            args.id,
                                            stat.season,
                                            stat.goals,
                                            stat.assists,
                                            stat.matches,
                                            stat.yellowCards,
                                            stat.redCards,
                                            stat.minutesPlayed
                                        ]);
                                    });

                                    statsStmt.finalize();
                                }

                                // Update awards
                                if (args.awards) {
                                    db.run('DELETE FROM awards WHERE player_id = ?', [args.id]);
                                    const awardsStmt = db.prepare(
                                        `INSERT INTO awards
                                        (player_id, award_name, year, category)
                                        VALUES (?, ?, ?, ?)`
                                    );

                                    args.awards.forEach(award => {
                                        awardsStmt.run([
                                            args.id,
                                            award.awardName,
                                            award.year,
                                            award.category
                                        ]);
                                    });

                                    awardsStmt.finalize();
                                }

                                // Get the updated player data for response
                                db.get(
                                    `SELECT
                                        p.*,
                                        (
                                            SELECT json_group_array(
                                                json_object(
                                                    'season', s.season,
                                                    'goals', s.goals,
                                                    'assists', s.assists,
                                                    'matches', s.matches,
                                                    'yellowCards', s.yellow_cards,
                                                    'redCards', s.red_cards,
                                                    'minutesPlayed', s.minutes_played
                                                )
                                            )
                                            FROM statistics s
                                            WHERE s.player_id = p.id
                                        ) as statistics,
                                        (
                                            SELECT json_group_array(
                                                json_object(
                                                    'awardName', a.award_name,
                                                    'year', a.year,
                                                    'category', a.category
                                                )
                                            )
                                            FROM awards a
                                            WHERE a.player_id = p.id
                                        ) as awards
                                    FROM players p
                                    WHERE p.id = ?`,
                                    [args.id],
                                    (err, row) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }

                                        try {
                                            // Handle statistics
                                            if (row.statistics) {
                                                row.statistics = JSON.parse(row.statistics);
                                                if (!Array.isArray(row.statistics)) {
                                                    row.statistics = [];
                                                }
                                            } else {
                                                row.statistics = [];
                                            }

                                            // Handle awards
                                            if (row.awards) {
                                                row.awards = JSON.parse(row.awards);
                                                if (!Array.isArray(row.awards)) {
                                                    row.awards = [];
                                                }
                                            } else {
                                                row.awards = [];
                                            }

                                            // Handle boolean
                                            row.isActive = Boolean(row.is_active);
                                            delete row.is_active;

                                            if (DEBUG) {
                                                console.log('\n' + generateResponseLog('updatePlayer', {
                                                    success: true,
                                                    message: 'Player updated successfully',
                                                    player: row
                                                }));
                                            }
                                            db.run('COMMIT');
                                            resolve({
                                                success: true,
                                                message: 'Player updated successfully',
                                                player: row
                                            });
                                        } catch (error) {
                                            db.run('ROLLBACK');
                                            reject(error);
                                        }
                                    }
                                );
                            }
                        );
                    });
                });
            },

            // Delete player and all associated data
            deletePlayer: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Delete Player Service Start ===');
                    console.log(generateRequestLog('deletePlayer', { id: args.id }));
                }
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        // Delete awards first
                        db.run('DELETE FROM awards WHERE player_id = ?', [args.id]);

                        // Delete statistics
                        db.run('DELETE FROM statistics WHERE player_id = ?', [args.id]);

                        // Delete player
                        db.run(
                            'DELETE FROM players WHERE id = ?',
                            [args.id],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }

                                if (this.changes === 0) {
                                    db.run('ROLLBACK');
                                    reject(new Error('Player not found'));
                                    return;
                                }

                                if (DEBUG) {
                                    console.log('\n' + generateResponseLog('deletePlayer', {
                                        success: true,
                                        message: 'Player deleted successfully'
                                    }));
                                }
                                db.run('COMMIT');
                                resolve({
                                    success: true,
                                    message: 'Player deleted successfully'
                                });
                            }
                        );
                    });
                });
            },

            // List all players with their statistics and awards
            listPlayers: async () => {
                if (DEBUG) {
                    console.log('\n=== List Players Service Start ===');
                    console.log(generateRequestLog('listPlayers', {}));
                }
                return new Promise((resolve, reject) => {
                    if (DEBUG) console.log('=== List Players Service Start ===');
                    if (DEBUG) console.log('Executing database query...');
                    db.all(
                        `SELECT
                            p.*,
                            (
                                SELECT json_group_array(
                                    json_object(
                                        'season', s.season,
                                        'goals', s.goals,
                                        'assists', s.assists,
                                        'matches', s.matches,
                                        'yellowCards', s.yellow_cards,
                                        'redCards', s.red_cards,
                                        'minutesPlayed', s.minutes_played
                                    )
                                )
                                FROM statistics s
                                WHERE s.player_id = p.id
                            ) as statistics,
                            (
                                SELECT json_group_array(
                                    json_object(
                                        'awardName', a.award_name,
                                        'year', a.year,
                                        'category', a.category
                                    )
                                )
                                FROM awards a
                                WHERE a.player_id = p.id
                            ) as awards
                        FROM players p`,
                        [],
                        (err, rows) => {
                            if (err) {
                                console.error('Database error:', err);
                                reject(err);
                                return;
                            }

                            if (DEBUG) {
                                console.log('Query executed successfully');
                                console.log('Number of rows returned:', rows?.length || 0);
                            }

                            try {
                                // Process each row
                                rows.forEach(row => {
                                    try {
                                        // Handle statistics
                                        if (row.statistics) {
                                            row.statistics = JSON.parse(row.statistics);
                                            if (!Array.isArray(row.statistics)) {
                                                row.statistics = [];
                                            }
                                        } else {
                                            row.statistics = [];
                                        }

                                        // Handle awards
                                        if (row.awards) {
                                            row.awards = JSON.parse(row.awards);
                                            if (!Array.isArray(row.awards)) {
                                                row.awards = [];
                                            }
                                        } else {
                                            row.awards = [];
                                        }

                                        // Handle boolean
                                        row.isActive = Boolean(row.is_active);
                                        delete row.is_active;

                                        if (DEBUG) {
                                            console.log('Processed row:', {
                                                id: row.id,
                                                name: row.name,
                                                statsCount: row.statistics.length,
                                                awardsCount: row.awards.length
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Row processing error:', error);
                                        row.statistics = [];
                                        row.awards = [];
                                        row.isActive = Boolean(row.is_active);
                                        delete row.is_active;
                                    }
                                });

                                if (DEBUG) console.log('All rows processed successfully');
                                if (DEBUG) {
                                    console.log('\n' + generateResponseLog('listPlayers', { players: rows || [] }));
                                }
                                resolve({ players: rows || [] });
                            } catch (error) {
                                console.error('Error processing results:', error);
                                reject(error);
                            }
                        }
                    );
                });
            },

            // Update player statistics
            updatePlayerStats: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Update Player Stats Service Start ===');
                    console.log(generateRequestLog('updatePlayerStats', {
                        id: args.id,
                        statistics: args.statistics
                    }));
                }
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        try {
                            db.run('BEGIN TRANSACTION');

                            // First check if player exists
                            db.get(
                                'SELECT * FROM players WHERE id = ?',
                                [args.id],
                                (err, player) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    if (!player) {
                                        db.run('ROLLBACK');
                                        return reject(new NotFoundError(`Player with ID ${args.id} not found`));
                                    }

                                    // Delete existing statistics
                                    db.run(
                                        'DELETE FROM statistics WHERE player_id = ?',
                                        [args.id],
                                        (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            // Insert new statistics
                                            const statsPromises = args.statistics.map(stat => {
                                                return new Promise((resolveStats, rejectStats) => {
                                                    db.run(
                                                        `INSERT INTO statistics (
                                                            player_id, season, goals, assists, matches,
                                                            yellow_cards, red_cards, minutes_played
                                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                                        [
                                                            args.id,
                                                            stat.season,
                                                            stat.goals,
                                                            stat.assists,
                                                            stat.matches,
                                                            stat.yellowCards,
                                                            stat.redCards,
                                                            stat.minutesPlayed
                                                        ],
                                                        (err) => {
                                                            if (err) rejectStats(err);
                                                            else resolveStats();
                                                        }
                                                    );
                                                });
                                            });

                                            Promise.all(statsPromises)
                                                .then(() => {
                                                    // Get updated player data with statistics and awards
                                                    db.get(
                                                        `SELECT
                                                            p.*,
                                                            json_group_array(DISTINCT json_object(
                                                                'season', s.season,
                                                                'goals', s.goals,
                                                                'assists', s.assists,
                                                                'matches', s.matches,
                                                                'yellowCards', s.yellow_cards,
                                                                'redCards', s.red_cards,
                                                                'minutesPlayed', s.minutes_played
                                                            )) as statistics,
                                                            json_group_array(DISTINCT json_object(
                                                                'awardName', a.award_name,
                                                                'year', a.year,
                                                                'category', a.category
                                                            )) as awards
                                                        FROM players p
                                                        LEFT JOIN statistics s ON p.id = s.player_id
                                                        LEFT JOIN awards a ON p.id = a.player_id
                                                        WHERE p.id = ?
                                                        GROUP BY p.id`,
                                                        [args.id],
                                                        (err, row) => {
                                                            if (err) {
                                                                db.run('ROLLBACK');
                                                                return reject(err);
                                                            }

                                                            try {
                                                                // Parse JSON strings
                                                                row.statistics = JSON.parse(row.statistics).filter(s => s.season !== null);
                                                                row.awards = JSON.parse(row.awards).filter(a => a.awardName !== null);

                                                                // Handle boolean
                                                                row.isActive = Boolean(row.is_active);
                                                                delete row.is_active;

                                                                if (DEBUG) {
                                                                    console.log('\n' + generateResponseLog('updatePlayerStats', {
                                                                        success: true,
                                                                        message: 'Player statistics updated successfully',
                                                                        player: row
                                                                    }));
                                                                }
                                                                db.run('COMMIT');
                                                                resolve({
                                                                    success: true,
                                                                    message: 'Player statistics updated successfully',
                                                                    player: row
                                                                });
                                                            } catch (error) {
                                                                db.run('ROLLBACK');
                                                                reject(error);
                                                            }
                                                        }
                                                    );
                                                })
                                                .catch(err => {
                                                    db.run('ROLLBACK');
                                                    reject(err);
                                                });
                                        }
                                    );
                                }
                            );
                        } catch (error) {
                            db.run('ROLLBACK');
                            reject(error);
                        }
                    });
                });
            },

            // Bulk create players
            bulkCreatePlayers: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Bulk Create Players Service Start ===');
                    console.log(generateRequestLog('bulkCreatePlayers', { players: args.players }));
                }
                return new Promise((resolve, reject) => {
                    if (!args.players || !Array.isArray(args.players) || args.players.length === 0) {
                        reject(new ValidationError('No players provided for bulk creation'));
                        return;
                    }

                    // Validate all players first
                    try {
                        args.players.forEach(player => validatePlayer(player));
                    } catch (error) {
                        reject(error);
                        return;
                    }

                    db.serialize(() => {
                        try {
                            db.run('BEGIN TRANSACTION');

                            const createdPlayers = [];
                            let currentPlayerIndex = 0;

                            const processNextPlayer = () => {
                                if (currentPlayerIndex >= args.players.length) {
                                    // All players processed successfully
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Error committing transaction:', err);
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }
                                        if (DEBUG) {
                                            console.log('\n' + generateResponseLog('bulkCreatePlayers', {
                                                success: true,
                                                message: `Successfully created ${createdPlayers.length} players`,
                                                players: createdPlayers
                                            }));
                                        }
                                        resolve({
                                            success: true,
                                            message: `Successfully created ${createdPlayers.length} players`,
                                            players: createdPlayers
                                        });
                                    });
                                    return;
                                }

                                const playerData = args.players[currentPlayerIndex];

                                // Check for duplicate player
                                db.get(
                                    'SELECT id FROM players WHERE name = ? AND club = ?',
                                    [playerData.name, playerData.club],
                                    (err, row) => {
                                        if (err) {
                                            console.error('Error checking duplicate:', err);
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }
                                        if (row) {
                                            db.run('ROLLBACK');
                                            reject(new ConflictError(`Player ${playerData.name} already exists in ${playerData.club}`));
                                            return;
                                        }

                                        // Insert player
                                        db.run(
                                            `INSERT INTO players (
                                                name, country, club, position, age, is_active
                                            ) VALUES (?, ?, ?, ?, ?, ?)`,
                                            [
                                                playerData.name,
                                                playerData.country,
                                                playerData.club,
                                                playerData.position,
                                                playerData.age,
                                                playerData.isActive
                                            ],
                                            function(err) {
                                                if (err) {
                                                    console.error('Error inserting player:', err);
                                                    db.run('ROLLBACK');
                                                    reject(err);
                                                    return;
                                                }

                                                const playerId = this.lastID;
                                                let pendingOperations = 0;
                                                let operationError = null;

                                                // Insert statistics if provided
                                                if (playerData.statistics && playerData.statistics.length > 0) {
                                                    pendingOperations += playerData.statistics.length;
                                                    playerData.statistics.forEach(stat => {
                                                        db.run(
                                                            `INSERT INTO statistics (
                                                                player_id, season, goals, assists, matches,
                                                                yellow_cards, red_cards, minutes_played
                                                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                                            [
                                                                playerId,
                                                                stat.season,
                                                                stat.goals,
                                                                stat.assists,
                                                                stat.matches,
                                                                stat.yellowCards,
                                                                stat.redCards,
                                                                stat.minutesPlayed
                                                            ],
                                                            (err) => {
                                                                if (err && !operationError) {
                                                                    operationError = err;
                                                                }
                                                                pendingOperations--;
                                                                checkOperationsComplete();
                                                            }
                                                        );
                                                    });
                                                }

                                                // Insert awards if provided
                                                if (playerData.awards && playerData.awards.length > 0) {
                                                    pendingOperations += playerData.awards.length;
                                                    playerData.awards.forEach(award => {
                                                        db.run(
                                                            `INSERT INTO awards (
                                                                player_id, award_name, year, category
                                                            ) VALUES (?, ?, ?, ?)`,
                                                            [
                                                                playerId,
                                                                award.awardName,
                                                                award.year,
                                                                award.category
                                                            ],
                                                            (err) => {
                                                                if (err && !operationError) {
                                                                    operationError = err;
                                                                }
                                                                pendingOperations--;
                                                                checkOperationsComplete();
                                                            }
                                                        );
                                                    });
                                                }

                                                const checkOperationsComplete = () => {
                                                    if (pendingOperations === 0) {
                                                        if (operationError) {
                                                            console.error('Error in auxiliary data:', operationError);
                                                            db.run('ROLLBACK');
                                                            reject(operationError);
                                                            return;
                                                        }

                                                        // Get created player data
                                                        db.get(
                                                            `SELECT
                                                                p.*,
                                                                json_group_array(DISTINCT json_object(
                                                                    'season', s.season,
                                                                    'goals', s.goals,
                                                                    'assists', s.assists,
                                                                    'matches', s.matches,
                                                                    'yellowCards', s.yellow_cards,
                                                                    'redCards', s.red_cards,
                                                                    'minutesPlayed', s.minutes_played
                                                                )) as statistics,
                                                                json_group_array(DISTINCT json_object(
                                                                    'awardName', a.award_name,
                                                                    'year', a.year,
                                                                    'category', a.category
                                                                )) as awards
                                                            FROM players p
                                                            LEFT JOIN statistics s ON p.id = s.player_id
                                                            LEFT JOIN awards a ON p.id = a.player_id
                                                            WHERE p.id = ?
                                                            GROUP BY p.id`,
                                                            [playerId],
                                                            (err, row) => {
                                                                if (err) {
                                                                    console.error('Error retrieving player data:', err);
                                                                    db.run('ROLLBACK');
                                                                    reject(err);
                                                                    return;
                                                                }

                                                                try {
                                                                    // Parse JSON strings
                                                                    row.statistics = JSON.parse(row.statistics).filter(s => s.season !== null);
                                                                    row.awards = JSON.parse(row.awards).filter(a => a.awardName !== null);

                                                                    // Handle boolean
                                                                    row.isActive = Boolean(row.is_active);
                                                                    delete row.is_active;

                                                                    createdPlayers.push(row);
                                                                    currentPlayerIndex++;
                                                                    processNextPlayer();
                                                                } catch (error) {
                                                                    console.error('Error processing player data:', error);
                                                                    db.run('ROLLBACK');
                                                                    reject(error);
                                                                }
                                                            }
                                                        );
                                                    }
                                                };

                                                // If no auxiliary data, check completion immediately
                                                if (pendingOperations === 0) {
                                                    checkOperationsComplete();
                                                }
                                            }
                                        );
                                    }
                                );
                            };

                            // Start processing players
                            processNextPlayer();
                        } catch (error) {
                            console.error('Unexpected error in bulk create:', error);
                            db.run('ROLLBACK');
                            reject(error);
                        }
                    });
                });
            },

            // Generate token
            generateToken: async (args) => {
                if (DEBUG) {
                    console.log('\n=== Generate Token Service Start ===');
                    console.log(generateRequestLog('generateToken', {
                        username: args.username,
                        password: '***' // Mask password in logs
                    }, 'Basic')); // Use Basic auth for generateToken
                }
                return new Promise((resolve, reject) => {
                    try {
                        // Validate credentials
                        if (args.username !== 'admin' || args.password !== 'password123') {
                            if (DEBUG) console.log('Invalid credentials');
                            reject(new Error('Invalid credentials'));
                            return;
                        }

                        if (DEBUG) console.log('Credentials validated successfully');

                        // Generate token
                        const user = { username: args.username, role: 'admin' };
                        const token = generateToken(user);
                        lastGeneratedToken = token;
                        lastAuthType = 'Bearer'; // Update auth type after token generation

                        if (DEBUG) {
                            console.log('Token generated successfully');
                            console.log('Token:', token.substring(0, 20) + '...');
                            console.log('\nExample curl command:');
                            console.log(generateRequestLog('generateToken', {
                                username: args.username,
                                password: '***' // Mask password in logs
                            }, 'Basic')); // Use Basic auth for generateToken
                        }

                        if (DEBUG) {
                            console.log('\n' + generateResponseLog('generateToken', {
                                success: true,
                                message: 'Token generated successfully',
                                token: token,
                                expiresIn: 86400
                            }));
                        }
                        resolve({
                            token: token,
                            expiresIn: 86400 // 24 hours in seconds
                        });
                    } catch (error) {
                        if (DEBUG) console.error('Token generation error:', error);
                        reject(error);
                    }
                });
            },

            // Delete all player statistics
            deleteAllPlayerStats: async () => {
                if (DEBUG) {
                    console.log('\n=== Delete All Data Service Start ===');
                    console.log(generateRequestLog('deleteAllPlayerStats', {}));
                }
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        // Delete all data in the correct order (due to foreign key constraints)
                        db.run('DELETE FROM statistics', function(err) {
                            if (err) {
                                console.error('Error deleting statistics:', err);
                                db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            db.run('DELETE FROM awards', function(err) {
                                if (err) {
                                    console.error('Error deleting awards:', err);
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }

                                db.run('DELETE FROM players', function(err) {
                                    if (err) {
                                        console.error('Error deleting players:', err);
                                        db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }

                                    const response = {
                                        statusCode: 200,
                                        success: true,
                                        message: 'All data deleted successfully',
                                        deletedCount: this.changes
                                    };

                                    if (DEBUG) {
                                        console.log('\n' + generateResponseLog('deleteAllPlayerStats', response));
                                    }

                                    db.run('COMMIT');
                                    resolve(response);
                                });
                            });
                        });
                    });
                });
            }
        }
    }
};

module.exports = playerService;