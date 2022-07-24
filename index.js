require('dotenv').config();
const express = require('express');
const session = require("express-session");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require("helmet");
const redis = require('redis');
const connectRedis = require('connect-redis');
const logger = require("./utils/logger")(module);

const app = express();

// Enable this if you run behind a proxy (e.g. nginx)
app.set('trust proxy', 1);

const RedisStore = connectRedis(session);

// Configure Redis client
const redisClient = redis.createClient({
	// host: process.env.NODE_ENV === 'development'? 'localhost' : process.env.LIVE_URL,
	host: 'localhost',
	port: 6379,
	legacyMode: true,
});

redisClient.connect()
	.then(() => {
		logger.info("Connected to Redis store");
	})
	.catch((error) => {
		logger.error("Redis connection error", { error });
	});

// Configure session middleware
app.use(session({
	store: new RedisStore({ client: redisClient }),
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: 'auto', // if true only transmit cookie over https
		httpOnly: true, // if true prevent client side JS from reading the cookie 
	}
}));

// Configure CORS options
const corsOptions = {
	origin: process.env.NODE_ENV === 'development' ? 'localhost:' + (process.env.PORT || 3000) : process.env.LIVE_URL,
}

app.use(cors(corsOptions));
app.use(cookieParser());

// Configure helmet
app.use(helmet());
app.disable('x-powered-by')

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(__dirname + '/public'));

// Routes
app.use("/api/auth/", require("./routes/auth"));
app.use("/api/playlists", require("./routes/playlists"));

// Fallbacks
app.use((_req, res) => {
	return res.status(404).send(
		"Guess the <a href=\"https://github.com/20kaushik02/spotify-manager\">cat's</a> out of the bag!"
	);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`App Listening on port ${port}`);
});
