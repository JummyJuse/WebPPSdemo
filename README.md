# PPS — Power Plant Lobby

A shareable, real-time six-operator power plant lobby. The host creates a room and displays a QR code; up to six players join from their own devices using a code or link.

## Run
```sh
npm install
npm start
```

Open http://localhost:3000 on the host computer. For phones on the same Wi-Fi network, use the computer's LAN IP address instead of localhost. For a public website deploy to a Node hosting provider and set `PUBLIC_ORIGIN` to the site's HTTPS URL.

## Features
- Host room with a unique six-character code and scannable QR invite
- Six dedicated player slots, synchronized live via Socket.IO
- Players join with a name and share a lobby roster
- Full rooms reject new players; leaving frees a slot
- Host departure closes the room
- Lobby only: gameplay is intentionally not implemented

## Deploy on Render
- New Web Service, connect this repository
- Node runtime, build command: `npm install`, start command: `npm start`
- Free instance for a demo, region nearest players
- When deployed, optionally set `PUBLIC_ORIGIN=https://YOUR-SERVICE.onrender.com`

Prototype notes: rooms are stored in server memory and reset upon restart, browser refresh requires rejoining, and host disconnection closes the room. For production, add durable state, reconnect support, rate limiting, and authentication.

## ChatGPT Sites

Run `npm run dev` with Node 24 to preview the Sites edition with a temporary SQLite database. Run `npm run build` to build the Worker. The hosted edition uses the `DB` D1 binding and the schema in `drizzle/`. Clients refresh the roster every 1.5 seconds. Inactive sessions expire after 45 seconds, and the host can close a room immediately.
