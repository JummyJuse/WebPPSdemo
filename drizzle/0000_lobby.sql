CREATE TABLE rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL, seen INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE players (room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, token TEXT NOT NULL, name TEXT NOT NULL, seen INTEGER NOT NULL, PRIMARY KEY (room, token));
