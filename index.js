require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors());
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname + '/public'));

app.use("/api/auth/", require("./routes/auth"));

app.use((_req, res) => {
	return res.status(404).send(
		"Oops! You're not supposed to know about <a href=\"https://github.com/20kaushik02/spotify-manager\">this</a>..."
	);
})

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`App Listening on port ${port}`);
});
