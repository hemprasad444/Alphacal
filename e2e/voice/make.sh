#!/bin/sh
# The spoken lines for the voice tests, made with macOS `say` (48 kHz WAV for live calls, m4a like the phone records).
cd "$(dirname "$0")"
say -v Daniel -o u1.wav --data-format=LEI16@48000 "It was awesome bro, the visuals were insane. Hey, I just ate two boiled eggs and a banana."
say -v Daniel -o u2.wav --data-format=LEI16@48000 "What should I eat for dinner tonight? Keep it short."
say -v Daniel -o u3.wav --data-format=LEI16@48000 "Cool, thanks man. Bye."
say -v Daniel -o clip.m4a --data-format=aac "I just had two boiled eggs and a cup of black coffee for breakfast"
