# FIFA Player Statistics SOAP API Documentation

## Features

- **Authentication & Authorization**: JWT token-based authentication with role-based access control
- **Player Management**: Complete CRUD operations for player profiles
- **Statistics Tracking**: Season-wise player statistics including goals, assists, matches, cards
- **Awards Management**: Track player achievements and awards
- **Bulk Operations**: Support for creating multiple players in a single request
- **Data Validation**: Comprehensive input validation with detailed error messages
- **Error Handling**: Standardized SOAP fault responses
- **Rate Limiting**: Request rate limiting per IP address
- **Documentation**: Complete WSDL documentation and API examples
- **Security**: HTTPS support, token expiration, and secure password handling

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- SQLite3

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/fifa-player-stats-soap.git
cd fifa-player-stats-soap
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env file with your configuration
```

4. Generate SSL certificates (optional, for HTTPS):

```bash
mkdir certs
cd certs
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

5. Start the server:

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Default Configuration

- HTTP Port: 3000
- HTTPS Port: 3001
- Default Admin Credentials:
  - Username: admin
  - Password: password123
- JWT Secret: your-secret-key-123 (change in production)

### Testing the Installation

1. Generate an authentication token:

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -d '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:generateTokenRequest>
         <username>admin</username>
         <password>password123</password>
      </tns:generateTokenRequest>
   </soap:Body>
</soap:Envelope>'
```

2. Test the API with the token:

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:listPlayersRequest/>
   </soap:Body>
</soap:Envelope>'
```

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [Common Headers](#common-headers)
5. [API Operations](#api-operations)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Best Practices](#best-practices)

## Introduction

The FIFA Player Statistics SOAP API provides a comprehensive interface for managing football player data, including their statistics and awards. This API follows SOAP protocol standards and uses JWT tokens for authentication.

### Version Information

- **API Version**: 1.0.0
- **WSDL Version**: 1.0.0
- **Last Updated**: 2024

## Authentication

### Generate Token Endpoint

The generateToken endpoint is used to obtain a JWT token for accessing protected endpoints.

#### Operation Details

- **Operation Name**: `generateToken`
- **SOAP Action**: `http://example.com/player-service/generateToken`
- **Authentication**: Basic (username/password)
- **Protocol**: HTTP/HTTPS
- **Method**: POST

#### Request Format

```xml
POST /soap/player HTTP/1.1
Host: localhost:3000
Content-Type: text/xml
Content-Length: [length]

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:generateTokenRequest>
         <username>admin</username>
         <password>password123</password>
      </tns:generateTokenRequest>
   </soap:Body>
</soap:Envelope>
```

#### Request Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| username  | string | Yes      | Admin username (min length: 3) |
| password  | string | Yes      | Admin password (min length: 8) |

#### Success Response (200 OK)

```xml
HTTP/1.1 200 OK
Content-Type: text/xml
Content-Length: [length]

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:generateTokenResponse>
         <statusCode>200</statusCode>
         <success>true</success>
         <message>Token generated successfully</message>
         <token>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</token>
         <expiresIn>86400</expiresIn>
      </tns:generateTokenResponse>
   </soap:Body>
</soap:Envelope>
```

#### Response Fields

| Field      | Type    | Description                          |
| ---------- | ------- | ------------------------------------ |
| statusCode | integer | HTTP status code (200 for success)   |
| success    | boolean | Operation success status             |
| message    | string  | Human-readable success/error message |
| token      | string  | JWT token for authentication         |
| expiresIn  | integer | Token expiration time in seconds     |

#### Error Responses

1. Invalid Credentials (401 Unauthorized)

```xml
HTTP/1.1 401 Unauthorized
Content-Type: text/xml

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
   <soap:Body>
      <soap:Fault>
         <faultcode>soap:AuthenticationError</faultcode>
         <faultstring>Invalid credentials</faultstring>
         <detail>
            <error>
               <statusCode>401</statusCode>
               <type>AuthenticationError</type>
               <message>Invalid username or password</message>
            </error>
         </detail>
      </soap:Fault>
   </soap:Body>
</soap:Envelope>
```

2. Validation Error (400 Bad Request)

```xml
HTTP/1.1 400 Bad Request
Content-Type: text/xml

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
   <soap:Body>
      <soap:Fault>
         <faultcode>soap:ValidationError</faultcode>
         <faultstring>Validation failed</faultstring>
         <detail>
            <error>
               <statusCode>400</statusCode>
               <type>ValidationError</type>
               <message>Username and password are required</message>
            </error>
         </detail>
      </soap:Fault>
   </soap:Body>
</soap:Envelope>
```

#### Token Usage

After obtaining the token, include it in the Authorization header for all subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Token Management

1. **Expiration**:

   - Tokens expire after 24 hours (86400 seconds)
   - Monitor the `expiresIn` value in the response
   - Generate a new token before expiration

2. **Security Considerations**:

   - Store tokens securely
   - Never share tokens in URLs or logs
   - Use HTTPS in production
   - Implement token rotation for enhanced security

3. **Error Handling**:
   - 401 responses indicate token expiration or invalidation
   - Generate a new token when receiving 401 errors
   - Implement automatic token refresh logic in your client

## Common Headers

All requests must include:

```
Content-Type: text/xml
```

Protected endpoints require:

```
Authorization: Bearer <token>
```

## Rate Limiting

- Rate limit: 100 requests per minute per IP
- Token generation: 10 requests per minute per IP
- Headers included in response:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset

## Best Practices

1. **Token Management**:

   - Implement token refresh mechanism
   - Store tokens securely
   - Clear tokens on logout
   - Handle token expiration gracefully

2. **Error Handling**:

   - Implement retry logic with exponential backoff
   - Handle all SOAP faults appropriately
   - Log errors for debugging
   - Provide user-friendly error messages

3. **Security**:

   - Use HTTPS in production
   - Implement request signing
   - Validate all inputs
   - Keep dependencies updated

4. **Performance**:
   - Cache tokens appropriately
   - Implement connection pooling
   - Monitor response times
   - Handle timeouts gracefully

## Support

For API support, contact:

- Email: support@example.com
- Documentation: https://example.com/api-docs
- Status Page: https://status.example.com

## Base URL

`http://localhost:3000/soap/player`

## API Endpoints

### 1. Create Player

Creates a new player with statistics and awards.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:createPlayerRequest>
         <name>Lionel Messi</name>
         <country>Argentina</country>
         <club>Inter Miami</club>
         <position>Forward</position>
         <age>36</age>
         <isActive>true</isActive>
         <statistics>
            <season>2023-2024</season>
            <goals>15</goals>
            <assists>10</assists>
            <matches>20</matches>
            <yellowCards>2</yellowCards>
            <redCards>0</redCards>
            <minutesPlayed>1800</minutesPlayed>
         </statistics>
         <awards>
            <awardName>Ballon d Or</awardName>
            <year>2023</year>
            <category>Best Player</category>
         </awards>
      </tns:createPlayerRequest>
   </soap:Body>
</soap:Envelope>'
```

### 2. Get Player

Retrieves a player by ID with their statistics and awards.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:getPlayerRequest>
         <id>1</id>
      </tns:getPlayerRequest>
   </soap:Body>
</soap:Envelope>'
```

### 3. Update Player

Updates an existing player's information.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:updatePlayerRequest>
         <id>1</id>
         <name>Lionel Messi</name>
         <country>Argentina</country>
         <club>Inter Miami</club>
         <position>Forward</position>
         <age>36</age>
         <isActive>true</isActive>
         <statistics>
            <season>2023-2024</season>
            <goals>20</goals>
            <assists>15</assists>
            <matches>25</matches>
            <yellowCards>2</yellowCards>
            <redCards>0</redCards>
            <minutesPlayed>2250</minutesPlayed>
         </statistics>
      </tns:updatePlayerRequest>
   </soap:Body>
</soap:Envelope>'
```

### 4. Delete Player

Deletes a player and their associated data.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:deletePlayerRequest>
         <id>1</id>
      </tns:deletePlayerRequest>
   </soap:Body>
</soap:Envelope>'
```

### 5. List Players

Retrieves all players with their statistics and awards.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:listPlayersRequest>
      </tns:listPlayersRequest>
   </soap:Body>
</soap:Envelope>'
```

### 6. Bulk Create Players

Creates multiple players in a single request.

**Request:**

```bash
curl -X POST \
  http://localhost:3000/soap/player \
  -H 'Content-Type: text/xml' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:bulkCreatePlayersRequest>
         <players>
            <name>Erling Haaland</name>
            <country>Norway</country>
            <club>Manchester City</club>
            <position>Forward</position>
            <age>23</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>20</goals>
               <assists>5</assists>
               <matches>18</matches>
               <yellowCards>1</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1620</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Kylian Mbappe</name>
            <country>France</country>
            <club>Paris Saint-Germain</club>
            <position>Forward</position>
            <age>25</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>18</goals>
               <assists>8</assists>
               <matches>17</matches>
               <yellowCards>2</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1530</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Jude Bellingham</name>
            <country>England</country>
            <club>Real Madrid</club>
            <position>Midfielder</position>
            <age>20</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>15</goals>
               <assists>6</assists>
               <matches>20</matches>
               <yellowCards>3</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1800</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Kevin De Bruyne</name>
            <country>Belgium</country>
            <club>Manchester City</club>
            <position>Midfielder</position>
            <age>32</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>5</goals>
               <assists>15</assists>
               <matches>15</matches>
               <yellowCards>1</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1350</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Mohamed Salah</name>
            <country>Egypt</country>
            <club>Liverpool</club>
            <position>Forward</position>
            <age>31</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>14</goals>
               <assists>8</assists>
               <matches>19</matches>
               <yellowCards>0</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1710</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Vinicius Jr</name>
            <country>Brazil</country>
            <club>Real Madrid</club>
            <position>Forward</position>
            <age>23</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>12</goals>
               <assists>7</assists>
               <matches>16</matches>
               <yellowCards>4</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1440</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Rodri</name>
            <country>Spain</country>
            <club>Manchester City</club>
            <position>Midfielder</position>
            <age>27</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>4</goals>
               <assists>3</assists>
               <matches>20</matches>
               <yellowCards>5</yellowCards>
               <redCards>1</redCards>
               <minutesPlayed>1800</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Bruno Fernandes</name>
            <country>Portugal</country>
            <club>Manchester United</club>
            <position>Midfielder</position>
            <age>29</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>8</goals>
               <assists>12</assists>
               <matches>21</matches>
               <yellowCards>3</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1890</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Victor Osimhen</name>
            <country>Nigeria</country>
            <club>Napoli</club>
            <position>Forward</position>
            <age>25</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>16</goals>
               <assists>4</assists>
               <matches>17</matches>
               <yellowCards>2</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1530</minutesPlayed>
            </statistics>
         </players>
         <players>
            <name>Trent Alexander-Arnold</name>
            <country>England</country>
            <club>Liverpool</club>
            <position>Defender</position>
            <age>25</age>
            <isActive>true</isActive>
            <statistics>
               <season>2023-2024</season>
               <goals>3</goals>
               <assists>10</assists>
               <matches>19</matches>
               <yellowCards>2</yellowCards>
               <redCards>0</redCards>
               <minutesPlayed>1710</minutesPlayed>
            </statistics>
         </players>
      </tns:bulkCreatePlayersRequest>
   </soap:Body>
</soap:Envelope>'
```

### Delete All Data

The deleteAllPlayerStats endpoint is used to delete all data from the system, including players, statistics, and awards.

#### Operation Details

- **Operation Name**: `deleteAllPlayerStats`
- **Authentication**: Bearer Token or Basic Auth
- **Protocol**: HTTP/HTTPS
- **Method**: POST
- **Description**: Deletes all data from the system, including players, their statistics, and awards. This operation cannot be undone.

#### Request Format

```xml
POST /soap/player HTTP/1.1
Host: localhost:3000
Content-Type: text/xml
Authorization: Bearer YOUR_TOKEN_HERE
Content-Length: [length]

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:deleteAllPlayerStatsRequest/>
   </soap:Body>
</soap:Envelope>
```

#### Success Response (200 OK)

```xml
HTTP/1.1 200 OK
Content-Type: text/xml
Content-Length: [length]

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="http://example.com/player-service">
   <soap:Body>
      <tns:deleteAllPlayerStatsResponse>
         <statusCode>200</statusCode>
         <success>true</success>
         <message>All data deleted successfully</message>
         <deletedCount>42</deletedCount>
      </tns:deleteAllPlayerStatsResponse>
   </soap:Body>
</soap:Envelope>
```

#### Response Fields

| Field        | Type    | Description                                |
| ------------ | ------- | ------------------------------------------ |
| statusCode   | integer | HTTP status code (200 for success)         |
| success      | boolean | Operation success status                   |
| message      | string  | Human-readable success/error message       |
| deletedCount | integer | Number of player records that were deleted |

#### Important Notes

- This operation deletes ALL data from the system:
  - All players
  - All player statistics
  - All player awards
- This operation cannot be undone
- Requires administrative privileges
- Should be used with caution

#### Error Responses

1. Authentication Error (401 Unauthorized)

```xml
HTTP/1.1 401 Unauthorized
Content-Type: text/xml

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
   <soap:Body>
      <soap:Fault>
         <faultcode>soap:AuthenticationError</faultcode>
         <faultstring>Authentication failed</faultstring>
         <detail>
            <e>
               <statusCode>401</statusCode>
               <type>AuthenticationError</type>
               <message>Invalid or missing authentication token</message>
            </e>
         </detail>
      </soap:Fault>
   </soap:Body>
</soap:Envelope>
```

2. Server Error (500 Internal Server Error)

```xml
HTTP/1.1 500 Internal Server Error
Content-Type: text/xml

<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
   <soap:Body>
      <soap:Fault>
         <faultcode>soap:ServerError</faultcode>
         <faultstring>Internal server error</faultstring>
         <detail>
            <e>
               <statusCode>500</statusCode>
               <type>ServerError</type>
               <message>Error deleting data</message>
            </e>
         </detail>
      </soap:Fault>
   </soap:Body>
</soap:Envelope>
```

## Data Types

### Player

```xml
<PlayerType>
    <id>integer</id>
    <name>string</name>
    <country>string</country>
    <club>string</club>
    <position>string</position>
    <age>integer</age>
    <isActive>boolean</isActive>
    <statistics>StatisticsType[]</statistics>
    <awards>AwardType[]</awards>
</PlayerType>
```

### Statistics

```xml
<StatisticsType>
    <season>string</season>
    <goals>integer</goals>
    <assists>integer</assists>
    <matches>integer</matches>
    <yellowCards>integer</yellowCards>
    <redCards>integer</redCards>
    <minutesPlayed>integer</minutesPlayed>
</StatisticsType>
```

### Award

```xml
<AwardType>
    <awardName>string</awardName>
    <year>integer</year>
    <category>string</category>
</AwardType>
```

## Response Status Codes

| Status Code | Description           | Example Scenarios                                 |
| ----------- | --------------------- | ------------------------------------------------- |
| 200         | Success               | Successful GET, UPDATE, DELETE operations         |
| 201         | Created               | Successful creation of new player(s)              |
| 400         | Bad Request           | Invalid XML format, missing required fields       |
| 401         | Unauthorized          | Invalid or missing authentication credentials     |
| 403         | Forbidden             | Valid authentication but insufficient permissions |
| 404         | Not Found             | Player ID not found                               |
| 409         | Conflict              | Duplicate player (same name and club)             |
| 422         | Unprocessable Entity  | Validation errors (invalid age, position, etc.)   |
| 500         | Internal Server Error | Database errors, server issues                    |

## Validation Rules

### Player Data

- Name: Required, string
- Country: Required, string
- Club: Required, string
- Position: Required, must be one of: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']
- Age: Required, integer between 15 and 45
- IsActive: Required, boolean

### Statistics Data

- Season: Required, string
- Goals: Required, integer
- Matches: Required, integer
- Other fields (assists, cards, etc.): Optional, integer

### Awards Data

- AwardName: Required, string
- Year: Required, integer
- Category: Required, string

## Error Response Format

All errors are returned in SOAP Fault format with detailed information:

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
   <soap:Body>
      <soap:Fault>
         <faultcode>soap:Server</faultcode>
         <faultstring>Error Message</faultstring>
         <detail>
            <error>
               <statusCode>422</statusCode>
               <type>ValidationError</type>
               <message>Invalid player position. Must be one of: Forward, Midfielder, Defender, Goalkeeper</message>
            </error>
         </detail>
      </soap:Fault>
   </soap:Body>
</soap:Envelope>
```

### Common Error Examples

1. Validation Error (422):

```xml
<soap:Fault>
   <detail>
      <error>
         <statusCode>422</statusCode>
         <type>ValidationError</type>
         <message>Invalid age. Must be between 15 and 45</message>
      </error>
   </detail>
</soap:Fault>
```

2. Duplicate Player Error (409):

```xml
<soap:Fault>
   <detail>
      <error>
         <statusCode>409</statusCode>
         <type>ConflictError</type>
         <message>Player Lionel Messi already exists in Inter Miami</message>
      </error>
   </detail>
</soap:Fault>
```

3. Player Not Found Error (404):

```xml
<soap:Fault>
   <detail>
      <error>
         <statusCode>404</statusCode>
         <type>NotFoundError</type>
         <message>Player with ID 123 not found</message>
      </error>
   </detail>
</soap:Fault>
```
