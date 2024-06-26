const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const ytdl = require("ytdl-core");
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { readdir, stat } = require('fs/promises');
const glob = require('glob')
const winston = require('winston');


const port = process.env.PORT || 8085;
const webAddress = "https://warp.rigsby.casa";
const mp3Folder = path.join(__dirname, "/mp3s");
const dlExecutable = path.join(__dirname, "bin", "yt-dlp");
const maxStorage = 500000000;

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
	  winston.format.timestamp(),
	  winston.format.json()
	),
	transports: [
	  new winston.transports.Console(),
	  new winston.transports.File({ filename: path.join(__dirname, 'logs', 'app.log') })
	]
  });
  
const app = express();
app.use(cors());
app.use(helmet());
app.use(bodyParser.text());
app.use('/files', express.static(mp3Folder));

logger.info('Express app started');


const isValidURL = (string) => {
	try {
	  new URL(string);
	  return true;
	} catch (error) {
	  return false;
	}
  };

const getVideoId = (string) => {
	const urlPattern = /^https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)$/;
	const match = string.match(urlPattern);
	
	if (match) {
	  const videoId = match[1];
	  logger.info(videoId);
	  return videoId
	}
	const queryString = new URL(string).searchParams;
	const videoId = queryString.get('v');
	if (videoId) {
		return videoId;
	}
	return undefined;
};


const getSongUrl = (fileName) => {
	return `${webAddress}/files/${fileName}`;
};

const dirSize = async directory => {
	const files = await readdir(directory);
	const stats = files.map(file => stat(path.join(directory, file)));
  
	return ( await Promise.all(stats)).reduce((accumulator, { size }) => accumulator + size, 0 );
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

app.post('/dl', (req, res) => {
	const bodyText = req.body;

	if (!isValidURL(bodyText)) {
		res.status(400).send('Not a valid URL');
	}
	const videoId = getVideoId(bodyText);
	if (!videoId) {
		res.status(400).send('Bad url');
	}


	const filePath = `${mp3Folder}/${videoId}.mp3`;
	if (fs.existsSync(filePath)) {
		logger.info(`file exists: ${filePath}`);
		res.send(getSongUrl(`${videoId}.mp3`));
		return;
	} else {
		logger.info(`file not yet downloaded: ${filePath}`);
	}
	
	logger.info('downloading file...');
	exec(`${dlExecutable} ${bodyText} -x --audio-format mp3 -o ${mp3Folder}/${videoId}`, (error, stdout, stderr) => {
	  if (error) {
		logger.error(`Error executing command: ${error}`);
		return res.status(500).json({ error: 'Internal server error' });
	  }
	  if (stderr) {
		logger.error(`Command stderr: ${stderr}`);
		return res.status(500).json({ error: 'Internal server error' });
	  }

	  res.send(getSongUrl(`${videoId}.mp3`));

	  // check size of mp3 folder, delete oldest file if over capacity
	  (async () => {
		const size = await dirSize(mp3Folder);
		logger.info(`mp3 folder size: ${size}`);
		if (size > maxStorage) {
			const oldestFile = glob.sync(`${mp3Folder}/*mp3`)
				.map(name => ({name, ctime: fs.statSync(name).ctime}))
				.sort((a, b) => a.ctime - b.ctime)[0].name
			logger.info(`deleting oldest file: ${oldestFile}`);
			fs.unlink(oldestFile, (err) => {
				if (err) {
				  logger.error('Error deleting file');
				} else {
				  logger.info('File deleted successfully');
				}
			});
		}
	  })();
	});
  });


app.get("/*", (req, res) => {
	res.status(400).send('they fooled ME, jerry');
});

app.post("/*", (req, res) => {
	res.status(400).send('they FOOLED me, jerry');
});

app.listen(port, "0.0.0.0", () => logger.info(`Listening on port ${port}`));