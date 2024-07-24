require('dotenv-flow').config();

const util = require('util');
const express = require('express');
const session = require("express-session");

const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require("helmet");

const SQLiteStore = require("connect-sqlite3")(session);

const logger = require("./utils/logger")(module);

const app = express();

// Enable this if you run behind a proxy (e.g. nginx)
app.set('trust proxy', process.env.TRUST_PROXY);

// Configure SQLite store file
const sqliteStore = new SQLiteStore({
	table: "session_store",
	db: "spotify-manager.db"
});

// Configure session middleware
app.use(session({
	store: sqliteStore,
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
	origin: [process.env.CORS_ORIGIN],
}

app.use(cors(corsOptions));
app.use(cookieParser());

// Configure helmet
app.use(helmet());
app.disable('x-powered-by')

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(__dirname + '/static'));

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

const server = app.listen(port, () => {
	logger.info(`App Listening on port ${port}`);
});

const cleanupFunc = (signal) => {
	Promise.allSettled([
		util.promisify(server.close),
	]).then(() => {
		if (signal)
			logger.info(`Caught ${signal} signal`);
		logger.info("Cleaned up, exiting...");
		process.exit(0);
	});
}

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach((signal) => {
	process.on(signal, () => cleanupFunc(signal));
});
