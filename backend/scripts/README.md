This folder contains helper scripts for running migrations and restreaming to YouTube.

Files:
- `run_migrations_safe.sh`: Runs `npx sequelize-cli db:migrate`. Ensure DB env vars are configured.
- `ffmpeg_restream_to_youtube.sh`: Restreams an RTMP source to YouTube using ffmpeg. Usage: `./ffmpeg_restream_to_youtube.sh rtmp://localhost:1935/live/<streamKey> <YOUTUBE_KEY>`

Notes:
- These scripts are intended to be executed locally or on the production host with proper env vars set.
- Always backup DB before running migrations in production.
