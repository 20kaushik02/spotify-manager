require("dotenv-flow").config();

const util = require("util");
const express = require("express");
const session = require("express-session");

const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const SQLiteStore = require("connect-sqlite3")(session);

const { sessionName } = require("./constants");
const db = require("./models");

const { isAuthenticated } = require("./middleware/authCheck");
const { getUserProfile } = require("./api/spotify");

const logger = require("./utils/logger")(module);

const app = express();

// Enable this if you run behind a proxy (e.g. nginx)
app.set("trust proxy", process.env.TRUST_PROXY);

// Configure SQLite store file
const sqliteStore = new SQLiteStore({
	table: "session_store",
	db: "spotify-manager.db"
});

// Configure session middleware
app.use(session({
	name: sessionName,
	store: sqliteStore,
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		domain: process.env.BASE_DOMAIN,
		httpOnly: true, // if true prevent client side JS from reading the cookie
		maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
		sameSite: process.env.NODE_ENV === "development" ? "lax" : "none", // cross-site for production
		secure: process.env.NODE_ENV === "development" ? false : true, // if true only transmit cookie over https
	}
}));

app.use(cors({
	origin: process.env.APP_URI,
	credentials: true
}));
app.use(helmet({
	crossOriginOpenerPolicy: { policy: process.env.NODE_ENV === "development" ? "unsafe-none" : "same-origin" }
}));
app.disable("x-powered-by");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(__dirname + "/static"));

// Healthcheck
app.use("/health", (req, res) => {
	res.status(200).send({ message: "OK" });
	return;
});
app.use("/auth-health", isAuthenticated, async (req, res) => {
	try {
		await getUserProfile(req, res);
		if (res.headersSent) return;
		res.status(200).send({ message: "OK" });
		return;
	} catch (error) {
		res.status(500).send({ message: "Internal Server Error" });
		logger.error("authHealthCheck", { error });
		return;
	}
});

// Routes
app.use("/api/auth/", require("./routes/auth"));
app.use("/api/playlists", isAuthenticated, require("./routes/playlists"));
app.use("/api/operations", isAuthenticated, require("./routes/operations"));

// Fallbacks
app.use((req, res) => {
	res.status(404).send(
		"Guess the <a href=\"https://github.com/20kaushik02/spotify-manager\">cat's</a> out of the bag!"
	);
	logger.info("404", { url: req.url });
	return;
});

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
	logger.info(`App Listening on port ${port}`);
});

const cleanupFunc = (signal) => {
	if (signal)
		logger.debug(`${signal} signal received, shutting down now...`);

	Promise.allSettled([
		db.sequelize.close(),
		util.promisify(server.close),
	]).then(() => {
		logger.info("Cleaned up, exiting.");
		process.exit(0);
	});
}

["SIGHUP", "SIGINT", "SIGQUIT", "SIGTERM", "SIGUSR1", "SIGUSR2"].forEach((signal) => {
	process.on(signal, () => cleanupFunc(signal));
});
