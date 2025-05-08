# Scopely-test

This backend service manages player registration, leaderboard rankings, and battle simulations. It is built using **TypeScript**, **Restana**, **Redis**, and **Docker**. The service handles player requests, manages resources (gold, silver, etc.), and simulates turn-based battles with predefined logic.

## Technologies Used

- **TypeScript**: A statically typed superset of JavaScript.
- **Restana**: A high-performance HTTP framework for Node.js.
- **Redis**: A fast, in-memory database used to store player data and battle results.
- **Pino**: A logging library used for efficient logging.
- **Docker**: Containerization for consistent environments across development, testing, and production.

## Setup & Installation

### Prerequisites

Ensure you have the following installed:
- Docker
- Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/AndreVolpi/scopely-test.git
cd scopely-test
```

### 2. Dotenv

Create a `.env` file based on the example below to configure environment variables:

```
NODE_ENV=dev
PORT=3000
REDIS_URL=redis://redis:6379
JWT_SECRET=supersecuresecretkey
```

- **NODE_ENV**: Defines the environment the app is running in (e.g., dev, production).
- **PORT**: The port on which the application will run.
- **REDIS_URL**: The URL for the Redis server.
- **JWT_SECRET**: Secret key for signing JWT tokens for authentication.

### 3. Running the project

To start the application in development mode inside docker, use the following command:

```bash
make dev-start
```

### 4. Testing the project
 
To run tests in docker, use the following command:

```bash
make test
```

### 5. Stopping the project

To stop all running containers:

```bash
docker-compose down
```

## API Documentation

The service exposes several endpoints for interacting with the players and leaderboard:

- **POST /battle/:targetId**: Enqueue a battle between the logged-in player and the target player.
- **GET /battle/:battleId**: Retrieve the result of a battle using the battle ID.
- **GET /leaderboard**: Fetch the current leaderboard with player rankings.

Authentication is required for the player-related endpoints. Ensure that a valid JWT token is provided in the `Authorization` header of each request.

### Example Request: Battle

```bash
curl -X POST \
  http://localhost:3000/battle/target-player-id \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

This request will start a battle between the logged-in player and the target player.

### Example Request: Leaderboard

```bash
curl -X GET \
  http://localhost:3000/leaderboard?page=1&perPage=10 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

This will fetch the leaderboard, showing the top players.

## Development Notes

- The service uses Redis for fast data retrieval and efficient queue management for battle simulations.
- The battle logic simulates a turn-based battle between two players, with the result affecting the leaderboard.
- The leaderboard ranks players based on their scores, with ties broken alphabetically by player name.
