#!/usr/bin/env bash
# Simple wrapper to restream an RTMP source to YouTube Live via ffmpeg
# Usage: ./ffmpeg_restream_to_youtube.sh <source_rtmp_url> <YOUTUBE_STREAM_KEY>

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <source_rtmp_url> <YOUTUBE_STREAM_KEY>"
  exit 1
fi

SOURCE="$1"
YKEY="$2"

echo "Restreaming $SOURCE to YouTube with key $YKEY"

ffmpeg -re -i "$SOURCE" -c:v copy -c:a aac -b:a 128k -f flv "rtmp://a.rtmp.youtube.com/live2/$YKEY"
