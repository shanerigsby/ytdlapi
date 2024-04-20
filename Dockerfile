### from https://bun.sh/guides/ecosystem/docker
# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 as base


# Install curl, python3, and ffmpeg
RUN apt-get update && \
    apt-get install -y curl python3 ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /usr/src/app

# Create directories and set permissions
RUN mkdir -p /usr/src/app/mp3s /usr/src/app/logs /usr/src/app/bin && \
    chmod -R 777 /usr/src/app

# yt-dlp executable
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/src/app/bin/yt-dlp && \
    chmod a+rx /usr/src/app/bin/yt-dlp && \
    /usr/src/app/bin/yt-dlp --update-to nightly

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# tests & build
# note: if build script doesn't exist or outputs to a different file path
# then ./dist/app.js, adjust accordingly the path in the next section
ENV NODE_ENV=production
RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/dist/app.js .
COPY --from=prerelease /usr/src/app/package.json .

# run the app
USER bun
EXPOSE 8085/tcp
ENTRYPOINT [ "bun", "run", "app.js" ]