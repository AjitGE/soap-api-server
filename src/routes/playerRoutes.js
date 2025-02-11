const express = require('express');
const router = express.Router();
const { PlayerService: { PlayerPort } } = require('../services/playerService');
const { generateToken, createSoapFaultResponse } = require('../middleware/auth');

// Debug flag
const DEBUG = true;

// Handle all SOAP requests
router.post('/', async (req, res) => {
    if (DEBUG) {
        console.log('\n=== SOAP Request Handler Start ===');
        console.log('Request path:', req.path);
        console.log('Request method:', req.method);
        console.log('Content-Type:', req.get('Content-Type'));
        console.log('Authorization:', req.get('Authorization') ? req.get('Authorization').substring(0, 20) + '...' : 'none');
    }

    try {
        const xmlData = req.body;
        if (DEBUG) {
            console.log('Received XML body length:', xmlData.length);
            console.log('Received XML excerpt:', xmlData.substring(0, 200) + '...');
        }

        // Check if this is a token generation request
        if (xmlData.includes('generateTokenRequest')) {
            if (DEBUG) console.log('=== Processing Token Generation Request ===');

            // Extract username and password from XML
            const username = xmlData.match(/<username>(.*?)<\/username>/)?.[1];
            const password = xmlData.match(/<password>(.*?)<\/password>/)?.[1];

            if (DEBUG) {
                console.log('Extracted credentials:');
                console.log('Username:', username);
                console.log('Password length:', password ? password.length : 0);
            }

            if (!username || !password) {
                return res.status(400).type('application/xml')
                    .send(createSoapFaultResponse(400, 'ValidationError', 'Username and password are required'));
            }

            try {
                // Validate credentials and generate token
                if (username === 'admin' && password === 'password123') {
                    const user = { username, role: 'admin' };
                    const token = generateToken(user);

                    const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:generateTokenResponse>
            <success>true</success>
            <message>Token generated successfully</message>
            <token>${token}</token>
            <expiresIn>86400</expiresIn>
        </tns:generateTokenResponse>
    </soap:Body>
</soap:Envelope>`;
                    if (DEBUG) console.log('Sending success response');
                    return res.type('application/xml').send(response);
                } else {
                    return res.status(401).type('application/xml')
                        .send(createSoapFaultResponse(401, 'AuthenticationError', 'Invalid credentials'));
                }
            } catch (error) {
                if (DEBUG) {
                    console.error('Token generation error:', error);
                }
                return res.status(500).type('application/xml')
                    .send(createSoapFaultResponse(500, 'ServerError', error.message || 'Error generating token'));
            }
        }

        // Handle list players request
        if (xmlData.includes('listPlayersRequest')) {
            if (DEBUG) console.log('Processing listPlayers request');
            try {
                const result = await PlayerPort.listPlayers();
                if (DEBUG) console.log('Players retrieved:', result.players?.length || 0);

                const playersXml = result.players?.map(player => `
                    <player>
                        <id>${player.id}</id>
                        <name>${player.name}</name>
                        <country>${player.country}</country>
                        <club>${player.club}</club>
                        <position>${player.position}</position>
                        <age>${player.age}</age>
                        <isActive>${player.isActive ? 'true' : 'false'}</isActive>
                        ${player.statistics && player.statistics.length > 0 ? player.statistics.map(stat => `
                        <statistics>
                            <season>${stat.season}</season>
                            <goals>${stat.goals}</goals>
                            <assists>${stat.assists}</assists>
                            <matches>${stat.matches}</matches>
                            ${stat.yellowCards ? `<yellowCards>${stat.yellowCards}</yellowCards>` : ''}
                            ${stat.redCards ? `<redCards>${stat.redCards}</redCards>` : ''}
                            ${stat.minutesPlayed ? `<minutesPlayed>${stat.minutesPlayed}</minutesPlayed>` : ''}
                        </statistics>`).join('') : ''}
                        ${player.awards && player.awards.length > 0 ? player.awards.map(award => `
                        <award>
                            <awardName>${award.awardName}</awardName>
                            <year>${award.year}</year>
                            <category>${award.category}</category>
                        </award>`).join('') : ''}
                    </player>
                `).join('') || '';

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:listPlayersResponse>
            <success>true</success>
            <message>Players retrieved successfully</message>
            <players>${playersXml}</players>
        </tns:listPlayersResponse>
    </soap:Body>
</soap:Envelope>`;
                if (DEBUG) console.log('Sending listPlayers response');
                return res.type('application/xml').send(response);
            } catch (error) {
                console.error('Error in listPlayers:', error);
                return res.status(500).type('application/xml')
                    .send(createSoapFaultResponse(500, 'ServerError', error.message));
            }
        }

        // Handle create player request
        if (xmlData.includes('createPlayerRequest')) {
            if (DEBUG) console.log('Processing createPlayer request');
            try {
                // Extract player data from XML
                const name = xmlData.match(/<name>(.*?)<\/name>/)?.[1];
                const country = xmlData.match(/<country>(.*?)<\/country>/)?.[1];
                const club = xmlData.match(/<club>(.*?)<\/club>/)?.[1];
                const position = xmlData.match(/<position>(.*?)<\/position>/)?.[1];
                const age = parseInt(xmlData.match(/<age>(.*?)<\/age>/)?.[1]);
                const isActive = xmlData.match(/<isActive>(.*?)<\/isActive>/)?.[1] === 'true';

                // Validate required fields
                if (!name) {
                    return res.status(422).type('application/xml')
                        .send(createSoapFaultResponse(422, 'ValidationError', 'Player name is required'));
                }
                if (!country) {
                    return res.status(422).type('application/xml')
                        .send(createSoapFaultResponse(422, 'ValidationError', 'Player country is required'));
                }
                if (!club) {
                    return res.status(422).type('application/xml')
                        .send(createSoapFaultResponse(422, 'ValidationError', 'Player club is required'));
                }
                if (!position || !['Forward', 'Midfielder', 'Defender', 'Goalkeeper'].includes(position)) {
                    return res.status(422).type('application/xml')
                        .send(createSoapFaultResponse(422, 'ValidationError', 'Invalid position. Must be one of: Forward, Midfielder, Defender, Goalkeeper'));
                }
                if (!age || age < 15 || age > 45) {
                    return res.status(422).type('application/xml')
                        .send(createSoapFaultResponse(422, 'ValidationError', 'Invalid age. Must be between 15 and 45'));
                }

                // Extract statistics
                const statistics = [];
                const statsMatch = xmlData.match(/<statistics>(.*?)<\/statistics>/s);
                if (statsMatch) {
                    statistics.push({
                        season: statsMatch[1].match(/<season>(.*?)<\/season>/)?.[1],
                        goals: parseInt(statsMatch[1].match(/<goals>(.*?)<\/goals>/)?.[1]),
                        assists: parseInt(statsMatch[1].match(/<assists>(.*?)<\/assists>/)?.[1]),
                        matches: parseInt(statsMatch[1].match(/<matches>(.*?)<\/matches>/)?.[1]),
                        yellowCards: parseInt(statsMatch[1].match(/<yellowCards>(.*?)<\/yellowCards>/)?.[1] || '0'),
                        redCards: parseInt(statsMatch[1].match(/<redCards>(.*?)<\/redCards>/)?.[1] || '0'),
                        minutesPlayed: parseInt(statsMatch[1].match(/<minutesPlayed>(.*?)<\/minutesPlayed>/)?.[1] || '0')
                    });
                }

                // Extract awards
                const awards = [];
                const awardsMatch = xmlData.match(/<awards>(.*?)<\/awards>/s);
                if (awardsMatch) {
                    awards.push({
                        awardName: awardsMatch[1].match(/<awardName>(.*?)<\/awardName>/)?.[1],
                        year: parseInt(awardsMatch[1].match(/<year>(.*?)<\/year>/)?.[1]),
                        category: awardsMatch[1].match(/<category>(.*?)<\/category>/)?.[1]
                    });
                }

                const playerData = {
                    name,
                    country,
                    club,
                    position,
                    age,
                    isActive,
                    statistics,
                    awards
                };

                if (DEBUG) {
                    console.log('Extracted player data:', JSON.stringify(playerData, null, 2));
                }

                const result = await PlayerPort.createPlayer(playerData);
                if (DEBUG) console.log('Player created:', result);

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:createPlayerResponse>
            <statusCode>201</statusCode>
            <success>${result.success}</success>
            <message>${result.message}</message>
            <player>
                <id>${result.player.id}</id>
                <name>${result.player.name}</name>
                <country>${result.player.country}</country>
                <club>${result.player.club}</club>
                <position>${result.player.position}</position>
                <age>${result.player.age}</age>
                <isActive>${result.player.isActive}</isActive>
                ${result.player.statistics.map(stat => `
                <statistics>
                    <season>${stat.season}</season>
                    <goals>${stat.goals}</goals>
                    <assists>${stat.assists}</assists>
                    <matches>${stat.matches}</matches>
                    <yellowCards>${stat.yellowCards}</yellowCards>
                    <redCards>${stat.redCards}</redCards>
                    <minutesPlayed>${stat.minutesPlayed}</minutesPlayed>
                </statistics>`).join('')}
                ${result.player.awards.map(award => `
                <award>
                    <awardName>${award.awardName}</awardName>
                    <year>${award.year}</year>
                    <category>${award.category}</category>
                </award>`).join('')}
            </player>
        </tns:createPlayerResponse>
    </soap:Body>
</soap:Envelope>`;

                if (DEBUG) console.log('Sending createPlayer response');
                return res.status(201).type('application/xml').send(response);
            } catch (error) {
                console.error('Error creating player:', error);
                const statusCode = error.statusCode || 500;
                const errorType = error.name || 'Error';
                res.status(statusCode).type('application/xml')
                    .send(createSoapFaultResponse(statusCode, errorType, error.message));
            }
        }

        // Handle delete player request
        if (xmlData.includes('deletePlayerRequest')) {
            if (DEBUG) console.log('Processing deletePlayer request');
            try {
                // Extract player ID from XML
                const id = parseInt(xmlData.match(/<id>(.*?)<\/id>/)?.[1]);

                if (!id) {
                    return res.status(400).type('application/xml')
                        .send(createSoapFaultResponse(400, 'ValidationError', 'Player ID is required'));
                }

                const result = await PlayerPort.deletePlayer({ id });
                if (DEBUG) console.log('Player deleted:', result);

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:deletePlayerResponse>
            <statusCode>200</statusCode>
            <success>true</success>
            <message>${result.message}</message>
        </tns:deletePlayerResponse>
    </soap:Body>
</soap:Envelope>`;

                if (DEBUG) console.log('Sending deletePlayer response');
                return res.type('application/xml').send(response);
            } catch (error) {
                console.error('Error in deletePlayer:', error);
                const statusCode = error.statusCode || 500;
                return res.status(statusCode).type('application/xml')
                    .send(createSoapFaultResponse(statusCode, error.name || 'ServerError', error.message));
            }
        }

        // Handle get player request
        if (xmlData.includes('getPlayerRequest')) {
            if (DEBUG) console.log('Processing getPlayer request');
            try {
                // Extract player ID from XML
                const id = parseInt(xmlData.match(/<id>(.*?)<\/id>/)?.[1]);

                if (!id) {
                    return res.status(400).type('application/xml')
                        .send(createSoapFaultResponse(400, 'ValidationError', 'Player ID is required'));
                }

                try {
                    const result = await PlayerPort.getPlayer({ id });
                    if (DEBUG) console.log('Player retrieved:', result);

                    const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:getPlayerResponse>
            <statusCode>200</statusCode>
            <success>true</success>
            <message>Player retrieved successfully</message>
            <player>
                <id>${result.player.id}</id>
                <name>${result.player.name}</name>
                <country>${result.player.country}</country>
                <club>${result.player.club}</club>
                <position>${result.player.position}</position>
                <age>${result.player.age}</age>
                <isActive>${result.player.isActive}</isActive>
                ${result.player.statistics && result.player.statistics.length > 0 ? result.player.statistics.map(stat => `
                <statistics>
                    <season>${stat.season}</season>
                    <goals>${stat.goals}</goals>
                    <assists>${stat.assists}</assists>
                    <matches>${stat.matches}</matches>
                    ${stat.yellowCards ? `<yellowCards>${stat.yellowCards}</yellowCards>` : ''}
                    ${stat.redCards ? `<redCards>${stat.redCards}</redCards>` : ''}
                    ${stat.minutesPlayed ? `<minutesPlayed>${stat.minutesPlayed}</minutesPlayed>` : ''}
                </statistics>`).join('') : ''}
                ${result.player.awards && result.player.awards.length > 0 ? result.player.awards.map(award => `
                <award>
                    <awardName>${award.awardName}</awardName>
                    <year>${award.year}</year>
                    <category>${award.category}</category>
                </award>`).join('') : ''}
            </player>
        </tns:getPlayerResponse>
    </soap:Body>
</soap:Envelope>`;

                    if (DEBUG) console.log('Sending getPlayer response');
                    return res.type('application/xml').send(response);
                } catch (error) {
                    if (error.message === 'Player not found') {
                        return res.status(404).type('application/xml')
                            .send(createSoapFaultResponse(404, 'NotFoundError', 'Player not found'));
                    }
                    throw error;
                }
            } catch (error) {
                console.error('Error in getPlayer:', error);
                const statusCode = error.statusCode || 500;
                return res.status(statusCode).type('application/xml')
                    .send(createSoapFaultResponse(statusCode, error.name || 'ServerError', error.message));
            }
        }

        // Handle update player stats request
        if (xmlData.includes('updatePlayerStatsRequest')) {
            if (DEBUG) console.log('Processing updatePlayerStats request');
            try {
                // Extract player ID and statistics from XML
                const id = parseInt(xmlData.match(/<id>(.*?)<\/id>/)?.[1]);
                const statistics = [];

                // Extract all statistics elements
                const statsMatches = xmlData.match(/<statistics>(.*?)<\/statistics>/gs);
                if (statsMatches) {
                    statsMatches.forEach(statsMatch => {
                        statistics.push({
                            season: statsMatch.match(/<season>(.*?)<\/season>/)?.[1],
                            goals: parseInt(statsMatch.match(/<goals>(.*?)<\/goals>/)?.[1]),
                            assists: parseInt(statsMatch.match(/<assists>(.*?)<\/assists>/)?.[1]),
                            matches: parseInt(statsMatch.match(/<matches>(.*?)<\/matches>/)?.[1]),
                            yellowCards: parseInt(statsMatch.match(/<yellowCards>(.*?)<\/yellowCards>/)?.[1] || '0'),
                            redCards: parseInt(statsMatch.match(/<redCards>(.*?)<\/redCards>/)?.[1] || '0'),
                            minutesPlayed: parseInt(statsMatch.match(/<minutesPlayed>(.*?)<\/minutesPlayed>/)?.[1] || '0')
                        });
                    });
                }

                if (!id) {
                    return res.status(400).type('application/xml')
                        .send(createSoapFaultResponse(400, 'ValidationError', 'Player ID is required'));
                }

                if (!statistics.length) {
                    return res.status(400).type('application/xml')
                        .send(createSoapFaultResponse(400, 'ValidationError', 'At least one statistics entry is required'));
                }

                const result = await PlayerPort.updatePlayerStats({ id, statistics });
                if (DEBUG) console.log('Player stats updated:', result);

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:updatePlayerStatsResponse>
            <statusCode>200</statusCode>
            <success>true</success>
            <message>${result.message}</message>
            <player>
                <id>${result.player.id}</id>
                <name>${result.player.name}</name>
                <country>${result.player.country}</country>
                <club>${result.player.club}</club>
                <position>${result.player.position}</position>
                <age>${result.player.age}</age>
                <isActive>${result.player.isActive}</isActive>
                ${result.player.statistics.map(stat => `
                <statistics>
                    <season>${stat.season}</season>
                    <goals>${stat.goals}</goals>
                    <assists>${stat.assists}</assists>
                    <matches>${stat.matches}</matches>
                    <yellowCards>${stat.yellowCards}</yellowCards>
                    <redCards>${stat.redCards}</redCards>
                    <minutesPlayed>${stat.minutesPlayed}</minutesPlayed>
                </statistics>`).join('')}
                ${result.player.awards ? result.player.awards.map(award => `
                <award>
                    <awardName>${award.awardName}</awardName>
                    <year>${award.year}</year>
                    <category>${award.category}</category>
                </award>`).join('') : ''}
            </player>
        </tns:updatePlayerStatsResponse>
    </soap:Body>
</soap:Envelope>`;

                if (DEBUG) console.log('Sending updatePlayerStats response');
                return res.type('application/xml').send(response);
            } catch (error) {
                console.error('Error in updatePlayerStats:', error);
                const statusCode = error.statusCode || 500;
                return res.status(statusCode).type('application/xml')
                    .send(createSoapFaultResponse(statusCode, error.name || 'ServerError', error.message));
            }
        }

        // Handle bulk create players request
        if (xmlData.includes('bulkCreatePlayersRequest')) {
            if (DEBUG) console.log('Processing bulkCreatePlayers request');
            try {
                const players = [];

                // Extract all player elements
                const playerMatches = xmlData.match(/<players>(.*?)<\/players>/gs);
                if (playerMatches) {
                    playerMatches.forEach(playerMatch => {
                        const player = {
                            name: playerMatch.match(/<name>(.*?)<\/name>/)?.[1],
                            country: playerMatch.match(/<country>(.*?)<\/country>/)?.[1],
                            club: playerMatch.match(/<club>(.*?)<\/club>/)?.[1],
                            position: playerMatch.match(/<position>(.*?)<\/position>/)?.[1],
                            age: parseInt(playerMatch.match(/<age>(.*?)<\/age>/)?.[1]),
                            isActive: playerMatch.match(/<isActive>(.*?)<\/isActive>/)?.[1] === 'true',
                            statistics: [],
                            awards: []
                        };

                        // Extract statistics for this player
                        const statsMatches = playerMatch.match(/<statistics>(.*?)<\/statistics>/gs);
                        if (statsMatches) {
                            statsMatches.forEach(statsMatch => {
                                const season = statsMatch.match(/<season>(.*?)<\/season>/)?.[1];
                                const goals = parseInt(statsMatch.match(/<goals>(.*?)<\/goals>/)?.[1]);
                                const matches = parseInt(statsMatch.match(/<matches>(.*?)<\/matches>/)?.[1]);

                                // Only add statistics if required fields are present and valid
                                if (season && !isNaN(goals) && !isNaN(matches)) {
                                    player.statistics.push({
                                        season,
                                        goals,
                                        matches,
                                        assists: parseInt(statsMatch.match(/<assists>(.*?)<\/assists>/)?.[1] || '0'),
                                        yellowCards: parseInt(statsMatch.match(/<yellowCards>(.*?)<\/yellowCards>/)?.[1] || '0'),
                                        redCards: parseInt(statsMatch.match(/<redCards>(.*?)<\/redCards>/)?.[1] || '0'),
                                        minutesPlayed: parseInt(statsMatch.match(/<minutesPlayed>(.*?)<\/minutesPlayed>/)?.[1] || '0')
                                    });
                                }
                            });
                        }

                        // Extract awards for this player
                        const awardsMatches = playerMatch.match(/<award>(.*?)<\/award>/gs);
                        if (awardsMatches) {
                            awardsMatches.forEach(awardMatch => {
                                player.awards.push({
                                    awardName: awardMatch.match(/<awardName>(.*?)<\/awardName>/)?.[1],
                                    year: parseInt(awardMatch.match(/<year>(.*?)<\/year>/)?.[1]),
                                    category: awardMatch.match(/<category>(.*?)<\/category>/)?.[1]
                                });
                            });
                        }

                        players.push(player);
                    });
                }

                if (!players.length) {
                    return res.status(400).type('application/xml')
                        .send(createSoapFaultResponse(400, 'ValidationError', 'At least one player is required'));
                }

                const result = await PlayerPort.bulkCreatePlayers({ players });
                if (DEBUG) console.log('Players created:', result);

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:bulkCreatePlayersResponse>
            <statusCode>200</statusCode>
            <success>true</success>
            <message>${result.message}</message>
            ${result.players.map(player => `
            <player>
                <id>${player.id}</id>
                <name>${player.name}</name>
                <country>${player.country}</country>
                <club>${player.club}</club>
                <position>${player.position}</position>
                <age>${player.age}</age>
                <isActive>${player.isActive}</isActive>
                ${player.statistics.map(stat => `
                <statistics>
                    <season>${stat.season}</season>
                    <goals>${stat.goals}</goals>
                    <assists>${stat.assists}</assists>
                    <matches>${stat.matches}</matches>
                    <yellowCards>${stat.yellowCards}</yellowCards>
                    <redCards>${stat.redCards}</redCards>
                    <minutesPlayed>${stat.minutesPlayed}</minutesPlayed>
                </statistics>`).join('')}
                ${player.awards.map(award => `
                <award>
                    <awardName>${award.awardName}</awardName>
                    <year>${award.year}</year>
                    <category>${award.category}</category>
                </award>`).join('')}
            </player>`).join('')}
        </tns:bulkCreatePlayersResponse>
    </soap:Body>
</soap:Envelope>`;

                if (DEBUG) console.log('Sending bulkCreatePlayers response');
                return res.type('application/xml').send(response);
            } catch (error) {
                console.error('Error in bulkCreatePlayers:', error);
                console.error('Stack trace:', error.stack);

                // Handle specific error types
                const statusCode = error.statusCode || 500;
                let errorType = 'ServerError';
                let errorMessage = error.message || 'An unexpected error occurred';

                if (error.name === 'ConflictError') {
                    errorType = 'DuplicatePlayer';
                } else if (error.name === 'ValidationError') {
                    errorType = 'ValidationError';
                }

                const soapFaultResponse = createSoapFaultResponse(statusCode, errorType, errorMessage);
                if (DEBUG) {
                    console.log('Sending SOAP fault response:', {
                        statusCode,
                        errorType,
                        errorMessage,
                        response: soapFaultResponse
                    });
                }

                return res.status(statusCode)
                    .type('application/xml')
                    .send(soapFaultResponse);
            }
        }

        // Handle delete all player stats request
        if (xmlData.includes('deleteAllPlayerStatsRequest')) {
            if (DEBUG) console.log('Processing deleteAllPlayerStats request');
            try {
                const result = await PlayerPort.deleteAllPlayerStats();
                if (DEBUG) console.log('All player stats deleted:', result);

                const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
    <soap:Body>
        <tns:deleteAllPlayerStatsResponse>
            <statusCode>${result.statusCode}</statusCode>
            <success>${result.success}</success>
            <message>${result.message}</message>
            <deletedCount>${result.deletedCount}</deletedCount>
        </tns:deleteAllPlayerStatsResponse>
    </soap:Body>
</soap:Envelope>`;

                if (DEBUG) console.log('Sending deleteAllPlayerStats response');
                return res.type('application/xml').send(response);
            } catch (error) {
                console.error('Error in deleteAllPlayerStats:', error);
                const statusCode = error.statusCode || 500;
                return res.status(statusCode).type('application/xml')
                    .send(createSoapFaultResponse(statusCode, error.name || 'ServerError', error.message));
            }
        }

        // Handle other operations here...
        if (DEBUG) console.log('Unhandled operation');
        return res.status(400).type('application/xml')
            .send(createSoapFaultResponse(400, 'InvalidOperation', 'Operation not supported'));

    } catch (error) {
        console.error('=== Route Error ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);

        return res.status(500).type('application/xml')
            .send(createSoapFaultResponse(500, 'ServerError', error.message));
    }
});

module.exports = router;
