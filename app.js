const express = require("express");
const helmet = require("helmet");
const ytdl = require("ytdl-core");
const bodyParser = require('body-parser');
const { URL } = require('url');


const port = process.env.PORT || 8085;
const app = express();
app.use(helmet());
app.use(bodyParser.text());


const isValidURL = (string) => {
	try {
	  new URL(string);
	  return true;
	} catch (error) {
	  return false;
	}
  };

app.post("/ytaudio", async (req, res) => {
	const bodyText = req.body;

	if (!isValidURL(bodyText)) {
		res.status(400).send('Not a valid URL');
	}

	let data;
	let audioUrl;
	try {
		data = await ytdl.getInfo(bodyText);
	} catch (err) {
		res.status(500).send('Error getting yt data.');
	}

	try {
		audioUrl = ytdl.chooseFormat(data.formats, {
			filter: "audioonly",
			quality: "highest"
		}).url;
	} catch (err) {
		res.status(500).send('Error getting audio only url.');
	}

	res.send(audioUrl);
});

app.get("/*", (req, res) => {
	res.status(400).send('they fooled ME, jerry');
});

app.post("/*", (req, res) => {
	res.status(400).send('they FOOLED me, jerry');
});

app.listen(port, "0.0.0.0", () => console.log(`Listening on port ${port}`));