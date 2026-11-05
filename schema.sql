CREATE TABLE creators (
  creator_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lists (
  list_id TEXT PRIMARY KEY,
  creator_token TEXT NOT NULL,
  title TEXT,
  event_name TEXT,
  event_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  creator_name TEXT,
  recipient_name TEXT,
  creator_id TEXT,
  FOREIGN KEY (creator_id) REFERENCES creators(creator_id)
);

CREATE TABLE items (
  item_id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  price TEXT,
  category TEXT,
  remark TEXT,
  link TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (list_id) REFERENCES lists(list_id)
);

CREATE TABLE reservations (
  reservation_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  guest_token TEXT NOT NULL,
  guest_name TEXT,
  reserved_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(item_id)
);

CREATE TABLE list_views (
  view_id TEXT PRIMARY KEY,
  list_id TEXT,
  ip_address TEXT,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES lists(list_id)
);