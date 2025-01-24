# FIFA Player Statistics SOAP API

A modern SOAP-based web service for managing football player statistics and awards. Built with Node.js and SQLite.

## ✨ Features

- 🔐 **Secure Authentication**

  - JWT token-based authentication
  - Role-based access control
  - Token expiration and rotation

- 👥 **Player Management**

  - Complete CRUD operations
  - Bulk player creation
  - Detailed player profiles

- 📊 **Statistics & Awards**

  - Season-wise statistics tracking
  - Player achievements and awards
  - Historical data management

- 🛡️ **Security & Performance**

  - HTTPS support
  - Rate limiting
  - Input validation
  - Error handling

- 📚 **Documentation**
  - Complete WSDL documentation
  - API examples
  - Comprehensive error guides

## 🚀 Quick Start

### Prerequisites

- Node.js (v14+)
- npm (v6+)
- SQLite3

### Setup

1. **Clone & Install**

```bash
# Clone repository
git clone https://github.com/yourusername/fifa-player-stats-soap.git
cd fifa-player-stats-soap

# Install dependencies
npm install
```

2. **Configure**

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
# Default values:
# HTTP_PORT=3000
# HTTPS_PORT=3001
# JWT_SECRET=your-secret-key-123
```

3. **SSL Setup (Optional)**

```bash
# Generate certificates
mkdir certs
cd certs
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

4. **Run**

```bash
# Development
npm run dev

# Production
npm start
```

## 🔑 Authentication

Default admin credentials:

- Username: `admin`
- Password: `password123`

Generate a token:

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

## 📖 Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [WSDL Documentation](./src/services/player.wsdl)

## 🧪 testing api server

- [collection To Test Soap Api server](./test-api/soaptest.postman_collection.json)

## 🛠️ Development

### Project Structure

```
fifa-player-stats-soap/
├── src/
│   ├── services/      # SOAP service definitions
│   ├── middleware/    # Authentication & validation
│   ├── routes/        # API routes
│   └── db/           # Database setup & models
├── certs/            # SSL certificates
├── tests/            # Test suites
└── package.json
```

### Available Scripts

```bash
npm run dev      # Start development server
npm start        # Start production server
npm test         # Run tests
npm run lint     # Run linter
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Node.js SOAP library
- SQLite3
- JWT implementation
- Express.js framework

## Available Operations

1. generateToken - Generate authentication token
2. createPlayer - Create a new player
3. getPlayer - Get player details by ID
4. listPlayers - List all players
5. updatePlayer - Update player details
6. deletePlayer - Delete a player
7. updatePlayerStats - Update player statistics
8. bulkCreatePlayers - Create multiple players at once
9. deleteAllPlayerStats - Delete all data from the system (players, statistics, and awards)

⚠️ **Warning**: The `deleteAllPlayerStats` operation deletes ALL data from the system and cannot be undone. Use with caution.
