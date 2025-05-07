import restana from 'restana';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

export const app = restana();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Routes would go here...
// Import the controllers to register routes
import './controllers/battleController';
import './controllers/playerController';
import './controllers/leaderboardController';
