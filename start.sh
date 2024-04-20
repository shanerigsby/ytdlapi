#!/bin/bash

# Remove the container if it exists, silently
docker container rm --force yt >/dev/null 2>&1

docker build -t ytdlapi .

# Start the container only if the build was successful
if [ $? -eq 0 ]; then
    docker run -d --name yt \
    --restart unless-stopped \
    --network host \
    ytdlapi
else
    echo "Docker build failed. Exiting script."
    exit 1
fi
