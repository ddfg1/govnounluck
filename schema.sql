CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  nickname VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(64),
  password_hash VARCHAR(255) NOT NULL,
  created_at DATE NOT NULL
);

CREATE TABLE staff (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL
);

CREATE TABLE products (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  stock VARCHAR(64) NOT NULL,
  cpu VARCHAR(255),
  gpu VARCHAR(255),
  ram VARCHAR(255),
  storage VARCHAR(255),
  image MEDIUMTEXT,
  description TEXT
);

CREATE TABLE services (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  price INT NOT NULL,
  price_text VARCHAR(255),
  description TEXT
);

CREATE TABLE orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  item_title VARCHAR(255) NOT NULL,
  amount INT NOT NULL,
  ordered_at DATETIME NOT NULL,
  parts_eta VARCHAR(64),
  delivery_eta VARCHAR(64),
  status VARCHAR(64) NOT NULL,
  responsible_id VARCHAR(64),
  comment TEXT
);
