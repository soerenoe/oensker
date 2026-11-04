CREATE TABLE lists (
  list_id TEXT PRIMARY KEY,
  creator_token TEXT NOT NULL,
  title TEXT,
  event_name TEXT,
  event_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  creator_name TEXT,
  recipient_name TEXT
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