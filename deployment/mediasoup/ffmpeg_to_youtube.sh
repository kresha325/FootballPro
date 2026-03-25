#!/usr/bin/env bash
# ffmpeg_to_youtube.sh
# Example to take RTP/SDP input and push to YouTube RTMP. Adjust paths and stream key.
# Usage: ./ffmpeg_to_youtube.sh input.sdp YOUR_YOUTUBE_STREAM_KEY

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 input.sdp YOUTUBE_STREAM_KEY"
  exit 1
fi

INPUT_SDP="$1"
YOUTUBE_KEY="$2"

ffmpeg -protocol_whitelist file,udp,rtp -i "$INPUT_SDP" -c:v copy -c:a aac -b:a 128k -f flv "rtmp://a.rtmp.youtube.com/live2/${YOUTUBE_KEY}"
