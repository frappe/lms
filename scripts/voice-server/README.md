# Running Learning's voice server on a machine of your own

Lumi's voice (Kokoro-82M) and ears (Whisper) run as one small Python server. Frappe Cloud
cannot host it inside a bench, so it runs on a VM and the site talks to it over HTTPS.
No GPU is needed: 2 CPUs and 4 GB of memory serve a pilot.

## 1. The machine

Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB disk. Open ports 80 and 443 only.

```sh
sudo apt-get update && sudo apt-get install -y ffmpeg caddy
sudo adduser --disabled-password --gecos "" voice
sudo -iu voice bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
```

## 2. The server

```sh
sudo -iu voice
curl -o kokoro_server.py https://raw.githubusercontent.com/frappe/lms/learning-v3-poc/scripts/kokoro_server.py
cat > voice.env <<ENV
LMS_VOICE_TOKEN=$(openssl rand -hex 24)
LMS_VOICE_HOST=127.0.0.1
LMS_VOICE_PORT=8765
LMS_VOICE_MAX_MB=25
LMS_VOICE_WHISPER=small.en
ENV
chmod 600 voice.env
uv run kokoro_server.py   # first run downloads ~550 MB of models; stop it with Ctrl+C once "Whisper ready" prints
exit
```

Keep the token: the site needs it in step 4.

## 3. Keep it running, behind HTTPS

```sh
sudo cp lms-voice.service /etc/systemd/system/
sudo systemctl enable --now lms-voice
sudo cp Caddyfile /etc/caddy/Caddyfile     # change voice.example.com to your name first
sudo systemctl reload caddy
curl https://voice.example.com/health       # {"ok": true, "whisper": true}
```

Point the DNS name at the machine before reloading Caddy; it fetches the certificate itself.

## 4. The site

In the site's `site_config.json` (Frappe Cloud: Site, Config):

```json
"lms_local_tts_url": "https://voice.example.com",
"lms_voice_token": "<the token from voice.env>"
```

Lumi then speaks with Kokoro, learners' voice input and video lessons are transcribed by
Whisper, and nothing is billed per use.

## Sizing

- Kokoro returns a sentence in well under a second on CPU.
- Whisper `small.en` writes a 15 second turn in 2 to 4 seconds and an hour of video in about
  15 to 25 minutes. For a busier site use `medium.en` on 4 CPUs, or a second machine.
- Requests queue one at a time per model, so a class of 30 speaking at once will wait a few
  seconds at peak. That is the point to add a machine.

## Updating

```sh
sudo -iu voice curl -o kokoro_server.py https://raw.githubusercontent.com/frappe/lms/learning-v3-poc/scripts/kokoro_server.py
sudo systemctl restart lms-voice
```
