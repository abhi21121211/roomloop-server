# RoomLoop - Virtual Events and Meetups Platform (Server)

Backend server for the RoomLoop platform, providing API endpoints, real-time communication, and AI-powered features.

## 🚀 Live Demo

**🌐 Live Application**: [RoomLoop App](https://roomloop-client.vercel.app/)

## 🚀 Features

### Core Features

- **RESTful API**: Full-featured API for room management and user authentication
- **Real-time Communication**: WebSocket integration for live chat and notifications
- **User Authentication**: Secure authentication using JWT tokens
- **Room Management**: Create, join, and manage public/private rooms
- **Chat System**: Message storage and retrieval with real-time updates
- **Reaction System**: Support for emoji reactions in rooms
- **Data Persistence**: MongoDB integration for storing user data and room information

### AI-Powered Features 🤖

- **Ted AI Assistant**: Built-in AI assistant with context awareness
- **Multiple AI Providers**: Support for OpenRouter, Ollama, and Hugging Face
- **Smart Context**: AI understands room details, participants, and conversation history
- **Fallback Systems**: Graceful degradation when AI services are unavailable
- **Text Processing**: HTML entity decoding and emoji enhancement for AI responses

### Security Features

- **Rate Limiting**: Configurable rate limits for different endpoints
- **Input Validation**: Comprehensive input sanitization and validation
- **CORS Protection**: Configurable CORS policies
- **JWT Security**: Secure token-based authentication
- **Account Lockout**: Protection against brute force attacks
- **XSS Prevention**: Input sanitization to prevent cross-site scripting

### Performance Features

- **Caching**: Redis-based caching for improved performance
- **Connection Pooling**: Optimized database connections
- **Compression**: Response compression for faster data transfer
- **Logging**: Comprehensive logging with different levels
- **Error Handling**: Graceful error handling and recovery

## 🛠 Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO for WebSocket communication
- **Authentication**: JWT (JSON Web Tokens)
- **AI Services**: OpenRouter, Ollama, Hugging Face APIs
- **Caching**: Redis for session and data caching
- **Validation**: Input validation and sanitization
- **Error Handling**: Comprehensive error handling and logging
- **Security**: Helmet, rate limiting, CORS protection

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- MongoDB (local or Atlas connection)
- Redis (optional, for caching)
- npm or yarn

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/abhi21121211/roomloop-server.git
   cd roomloop-server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create environment file:**
   Create a `.env` file in the root directory:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/roomloop

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   JWT_EXPIRES_IN=7d

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000

   # AI Service Configuration
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   HUGGINGFACE_API_KEY=hf_your_huggingface_key_here
   OLLAMA_BASE_URL=http://localhost:11434

   # Redis Configuration (optional)
   REDIS_URL=redis://localhost:6379

   # Logging
   LOG_LEVEL=debug
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🤖 AI Configuration

### Setting Up AI Services

#### Option 1: OpenRouter (Recommended)

1. **Sign up** at [OpenRouter.ai](https://openrouter.ai/)
2. **Get your API key** from the dashboard
3. **Add to `.env`**: `OPENROUTER_API_KEY=your_key_here`
4. **Free tier**: 10,000 requests/month

#### Option 2: Ollama (Local)

1. **Install Ollama** from [ollama.ai](https://ollama.ai/)
2. **Start service**: `ollama serve`
3. **Download model**: `ollama pull llama2:7b`
4. **Add to `.env`**: `OLLAMA_BASE_URL=http://localhost:11434`

#### Option 3: Hugging Face

1. **Sign up** at [HuggingFace.co](https://huggingface.co/)
2. **Get API token** from Settings → Access Tokens
3. **Add to `.env`**: `HUGGINGFACE_API_KEY=hf_your_token_here`

### AI Provider Priority

The system tries providers in this order:

1. **OpenRouter** (most reliable)
2. **Ollama** (local, free)
3. **Hugging Face** (fallback)

## 🌐 Deployment

### Deploying to Render.com

#### Option 1: Quick Deploy with render.yaml

1. **Fork this repository** to your GitHub account
2. **Log in** to [Render.com](https://render.com)
3. **Navigate** to "Blueprints" section
4. **Click** "New Blueprint Instance"
5. **Connect** your GitHub account and select the forked repository
6. **Set up environment variables**:
   - `MONGODB_URI`: Your MongoDB connection string (Atlas recommended)
   - `JWT_SECRET`: A strong random string for JWT token encryption
   - `CORS_ORIGIN`: Your frontend URL
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
7. **Click** "Apply" to deploy

#### Option 2: Manual Deploy

1. **Log in** to [Render.com](https://render.com)
2. **Navigate** to "Web Services" section
3. **Click** "New Web Service"
4. **Connect** your GitHub repository
5. **Configure** the service:
   - Name: roomloop-api
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. **Add environment variables**:
   - `NODE_ENV`: production
   - `PORT`: 10000 (Render will override this)
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A strong random string
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
   - `CORS_ORIGIN`: Your frontend URL
7. **Choose** the Free plan
8. **Click** "Create Web Service"

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile

### Rooms

- `POST /api/rooms` - Create a new room
- `GET /api/rooms/public` - Get all public rooms
- `GET /api/rooms/all` - Get all accessible rooms (public + user's private)
- `GET /api/rooms/user` - Get user's rooms (created, joined, invited)
- `GET /api/rooms/:id` - Get room by ID
- `POST /api/rooms/:roomId/join` - Join a room
- `POST /api/rooms/:roomId/invite` - Invite users to a room
- `PUT /api/rooms/:roomId` - Update room details

### Messages

- `GET /api/rooms/:roomId/messages` - Get messages for a room
- `POST /api/rooms/:roomId/messages` - Send a message to a room

### Reactions

- `GET /api/rooms/:roomId/reactions` - Get reactions for a room
- `POST /api/rooms/:roomId/reactions` - Send a reaction to a room

### AI Services

- `GET /api/ai/status` - Check AI service availability
- `POST /api/ai/chat` - Send message to AI assistant
- `POST /api/ai/moderate` - Moderate content
- `GET /api/ai/suggestions` - Get room suggestions
- `GET /api/ai/summary/:roomId` - Generate room summary

### Health & Status

- `GET /health` - Health check endpoint
- `GET /api/status` - API status and version

## 🔌 WebSocket Events

### Room Events

- `join_room` - User joins a room
- `leave_room` - User leaves a room
- `room_status_changed` - Room status changes (scheduled → live → closed)
- `room_invitation` - User receives an invitation
- `user_joined_room` - Notification when user joins
- `user_left_room` - Notification when user leaves

### Message Events

- `send_message` - Send a message to a room
- `receive_message` - Receive a new message
- `send_reaction` - Send a reaction to a room
- `receive_reaction` - Receive a new reaction

### Connection Events

- `connect` - User connects to WebSocket
- `disconnect` - User disconnects from WebSocket
- `error` - WebSocket error occurred

## 📊 Data Models

### User

```typescript
{
  _id: ObjectId,
  username: string,
  email: string,
  password: string (hashed),
  bio?: string,
  avatar?: string,
  createdRooms: ObjectId[],
  joinedRooms: ObjectId[],
  invitedToRooms: ObjectId[],
  createdAt: Date,
  updatedAt: Date
}
```

### Room

```typescript
{
  _id: ObjectId,
  title: string,
  description: string,
  roomType: "public" | "private",
  status: "scheduled" | "live" | "closed",
  creator: ObjectId,
  startTime: Date,
  endTime: Date,
  maxParticipants?: number,
  participants: ObjectId[],
  invitedUsers: ObjectId[],
  tags: string[],
  code: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Message

```typescript
{
  _id: ObjectId,
  content: string,
  sender: ObjectId,
  room: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Reaction

```typescript
{
  _id: ObjectId,
  emoji: string,
  user: ObjectId,
  room: ObjectId,
  createdAt: Date
}
```

## 🔒 Security Features

### Rate Limiting

- **General**: 500 requests per 15 minutes
- **Authentication**: 20 login attempts per 15 minutes
- **Messages**: 30 messages per minute
- **Room Creation**: 10 rooms per hour

### Account Protection

- **Lockout**: Account locked after 10 failed login attempts
- **Lockout Duration**: 5 minutes
- **Auto-reset**: Successful login resets failed attempts

### Input Validation

- **Sanitization**: XSS prevention with input sanitization
- **Validation**: Comprehensive input validation
- **Type Checking**: TypeScript type safety

## 🐛 Troubleshooting

### Common Issues

1. **AI not working:**

   - Check AI provider configuration in `.env`
   - Verify API keys are valid
   - Check server logs for AI initialization errors

2. **WebSocket connection issues:**

   - Verify CORS configuration
   - Check if Socket.IO is properly initialized
   - Ensure client is connecting to correct URL

3. **Database connection issues:**

   - Verify MongoDB connection string
   - Check if MongoDB is running
   - Ensure network connectivity

4. **Rate limiting issues:**
   - Check rate limit configuration
   - Verify client IP detection
   - Monitor request frequency

### Development Issues

1. **Build errors:**

   - Run `npm install` to update dependencies
   - Check TypeScript compilation
   - Verify all imports are correct

2. **Runtime errors:**
   - Check server logs for detailed errors
   - Verify environment variables are set
   - Ensure all required services are running

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run build` - Build TypeScript to JavaScript
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## 🏗 Project Structure

```
src/
├── config/           # Configuration files
│   └── database.ts   # Database connection setup
├── controllers/      # Route controllers
│   ├── aiController.ts      # AI service endpoints
│   ├── authController.ts    # Authentication endpoints
│   ├── messageController.ts # Message management
│   ├── reactionController.ts # Reaction management
│   └── roomController.ts    # Room management
├── middleware/       # Express middleware
│   ├── auth.ts       # Authentication middleware
│   ├── cache.ts      # Caching middleware
│   ├── security.ts   # Security middleware
│   ├── staticCache.ts # Static file caching
│   └── validation.ts # Input validation
├── models/          # Database models
│   ├── Message.ts   # Message model
│   ├── Reaction.ts  # Reaction model
│   ├── Room.ts      # Room model
│   └── User.ts      # User model
├── routes/          # API routes
│   ├── ai.ts        # AI service routes
│   ├── auth.ts      # Authentication routes
│   ├── rooms.ts     # Room management routes
│   └── users.ts     # User management routes
├── services/        # Business logic
│   ├── aiService.ts # AI service integration
│   └── cache.ts     # Caching service
├── utils/           # Utility functions
│   └── logger.ts    # Logging utilities
└── index.ts         # Main application entry point
```

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow TypeScript best practices
- Add proper error handling
- Include comprehensive logging
- Write tests for new features
- Update documentation for API changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Links

- **Live Demo**: [RoomLoop App](https://roomloop-client.vercel.app/)
- **Frontend Repository**: [roomloop-client](https://github.com/abhi21121211/roomloop-client)
- **AI Setup Guide**: [FREE_AI_SETUP.md](FREE_AI_SETUP.md)
- **API Documentation**: [API Reference](docs/api.md)
