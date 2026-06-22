const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(`restart-pc:${password}`).digest('hex');
}

function clean(value) {
  return String(value ?? '').trim().slice(0, 1000);
}

function cleanProductImage(value) {
  const image = String(value ?? '').trim();
  if (!image) return '';
  if (image.startsWith('/assets/')) return image.slice(0, 1000);
  const isImageData = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/i.test(image);
  if (!isImageData) fail(400, 'Не удалось сохранить фото товара.');
  if (image.length > 7 * 1024 * 1024) fail(413, 'Фото товара слишком большое.');
  return image;
}

function email(value) {
  return clean(value).toLowerCase();
}

function phone(value) {
  return clean(value).replace(/\D/g, '');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) reject(Object.assign(new Error('Слишком большой запрос.'), { status: 413 }));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(Object.assign(new Error('Некорректные данные.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function tokenFromReq(req) {
  const auth = req.headers.authorization || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function currentUser(db, req) {
  const token = tokenFromReq(req);
  if (!token) return null;
  const session = db.sessions.find(item => item.token === token);
  if (!session) return null;
  return db.users.find(user => user.id === session.userId) || null;
}

function createSession(db, userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions.push({ token, userId, createdAt: new Date().toISOString() });
  return token;
}

function publicUser(user, db = null) {
  const result = {
    id: user.id,
    role: user.role,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone || '',
    createdAt: user.createdAt
  };
  if (db && user.role === 'client') {
    result.orderCount = db.orders.filter(order => order.userId === user.id).length;
  }
  return result;
}

function requireAdmin(user) {
  if (!user || user.role !== 'admin') fail(403, 'Доступ запрещён.');
}

function requireClient(user) {
  if (!user) fail(401, 'Нужно войти в профиль.');
  if (user.role !== 'client') fail(403, 'Оформление доступно клиентскому профилю.');
}

function buildDashboard(db) {
  const byStaff = db.staff.map(person => {
    const assigned = db.orders.filter(order => order.responsibleId === person.id);
    return {
      ...person,
      productOrders: assigned.filter(order => order.type === 'product'),
      serviceOrders: assigned.filter(order => order.type === 'service')
    };
  });
  return {
    metrics: {
      totalOrders: db.orders.length,
      revenue: db.orders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      clients: db.users.filter(user => user.role === 'client').length,
      products: db.products.length,
      services: db.services.length
    },
    byStaff
  };
}

function bootstrap(db, user) {
  const base = {
    user: user ? publicUser(user, db) : null,
    products: db.products,
    services: db.services,
    staff: db.staff,
    statusLabels: db.statusLabels
  };
  if (!user) return { ...base, orders: [], clients: [], dashboard: null };
  if (user.role === 'admin') {
    return {
      ...base,
      orders: db.orders,
      clients: db.users.filter(item => item.role === 'client').map(item => publicUser(item, db)),
      dashboard: buildDashboard(db)
    };
  }
  return {
    ...base,
    orders: db.orders.filter(order => order.userId === user.id),
    clients: [],
    dashboard: null
  };
}

function makeClient(db, body) {
  const nickname = clean(body.nickname);
  const userEmail = email(body.email);
  const userPhone = clean(body.phone || '');
  const password = String(body.password || '');
  const repeat = String(body.passwordRepeat || body.confirmPassword || body.password || '');

  if (!nickname || nickname.length < 2) fail(400, 'Введите никнейм.');
  if (!userEmail || !userEmail.includes('@')) fail(400, 'Введите корректную почту.');
  if (password.length < 6) fail(400, 'Пароль должен быть не короче 6 символов.');
  if (password !== repeat) fail(400, 'Пароли не совпадают.');
  if (db.users.some(user => email(user.email) === userEmail)) fail(409, 'Пользователь с такой почтой уже существует.');
  if (userPhone && db.users.some(user => phone(user.phone) === phone(userPhone))) fail(409, 'Пользователь с таким телефоном уже существует.');

  const user = {
    id: `user-${crypto.randomBytes(6).toString('hex')}`,
    role: 'client',
    nickname,
    email: userEmail,
    phone: userPhone,
    passwordHash: hashPassword(password),
    createdAt: today()
  };
  db.users.push(user);
  return user;
}

function loginClient(db, body) {
  const identifier = clean(body.identifier || body.login || '').toLowerCase();
  const phoneId = phone(body.identifier || body.login || '');
  const password = String(body.password || '');
  const user = db.users.find(item => item.role === 'client' && (email(item.email) === identifier || phone(item.phone) === phoneId || clean(item.nickname).toLowerCase() === identifier));
  if (!user || user.passwordHash !== hashPassword(password)) fail(401, 'Неверный логин или пароль.');
  const token = createSession(db, user.id);
  return { token, user: publicUser(user, db) };
}

function loginAdmin(db, body) {
  const login = clean(body.login || body.identifier || '').toLowerCase();
  const password = String(body.password || '');
  const repeat = String(body.passwordRepeat || body.passwordConfirm || body.repeatPassword || '');
  const user = db.users.find(item => item.role === 'admin' && (clean(item.nickname).toLowerCase() === login || email(item.email) === login || login === 'admin' || login === 'restart-pc'));
  if (!user || user.passwordHash !== hashPassword(password)) fail(401, 'Неверный логин или пароль.');
  if (repeat !== password) fail(401, 'Повторите пароль администратора.');
  const token = createSession(db, user.id);
  return { token, user: publicUser(user, db) };
}

function staffFor(db, type) {
  const ids = type === 'product' ? ['kasyanov', 'molchanov'] : ['molchanov', 'kasyanov'];
  return ids.map(id => ({ id, count: db.orders.filter(order => order.type === type && order.responsibleId === id).length }))
    .sort((a, b) => a.count - b.count)[0].id;
}

function createOrder(db, user, body) {
  const type = clean(body.type) === 'service' ? 'service' : 'product';
  const itemId = clean(body.itemId);
  const collection = type === 'service' ? db.services : db.products;
  const item = collection.find(entry => entry.id === itemId);
  if (!item) fail(404, 'Позиция не найдена.');
  if (type === 'product') {
    if (Number(item.quantity || 0) <= 0 || String(item.stock || '').toLowerCase().includes('нет')) fail(400, 'Товара нет в наличии.');
    item.quantity = Math.max(0, Number(item.quantity || 0) - 1);
    item.stock = item.quantity > 0 ? 'В наличии' : 'Нет в наличии';
  }
  const number = Number(db.meta.nextOrderNumber || 1249);
  db.meta.nextOrderNumber = number + 1;
  const order = {
    id: `RP-${number}`,
    userId: user.id,
    clientName: user.nickname,
    type,
    itemId: item.id,
    itemTitle: item.title,
    amount: Number(item.price || 0),
    orderedAt: new Date().toISOString(),
    partsEta: type === 'product' ? addDays(5) : '—',
    deliveryEta: type === 'product' ? addDays(9) : addDays(2),
    status: 'accepted',
    responsibleId: staffFor(db, type),
    comment: type === 'product' ? 'Заказ принят. Комплектация и сроки уточняются.' : 'Заявка принята. Специалист свяжется для уточнения деталей.'
  };
  db.orders.unshift(order);
  return order;
}

function productFromBody(body, old = {}) {
  const quantity = Number(body.quantity ?? old.quantity ?? 0);
  const imageChanged = Object.prototype.hasOwnProperty.call(body, 'imageData') || Object.prototype.hasOwnProperty.call(body, 'image');
  const imageValue = Object.prototype.hasOwnProperty.call(body, 'imageData') ? body.imageData : body.image;
  const product = {
    ...old,
    title: clean(body.title || old.title),
    price: Number(body.price ?? old.price ?? 0),
    quantity,
    stock: clean(body.stock || (quantity > 0 ? 'В наличии' : 'Нет в наличии')),
    cpu: clean(body.cpu || old.cpu),
    gpu: clean(body.gpu || old.gpu),
    ram: clean(body.ram || old.ram),
    storage: clean(body.storage || old.storage),
    description: clean(body.description || old.description || ''),
    image: imageChanged ? cleanProductImage(imageValue) : cleanProductImage(old.image || '')
  };
  if (!product.title) fail(400, 'Введите название товара.');
  if (!Number.isFinite(product.price) || product.price < 0) fail(400, 'Введите корректную цену.');
  if (!Number.isFinite(product.quantity) || product.quantity < 0) fail(400, 'Введите корректное количество.');
  return product;
}

function serviceFromBody(body, old = {}) {
  const price = Number(body.price ?? old.price ?? 0);
  const service = {
    ...old,
    icon: clean(body.icon || old.icon || 'tools'),
    title: clean(body.title || old.title),
    category: clean(body.category || old.category || ''),
    price,
    priceText: clean(body.priceText || old.priceText || `от ${formatMoney(price)}`),
    description: clean(body.description || old.description || '')
  };
  if (!service.title) fail(400, 'Введите название услуги.');
  if (!Number.isFinite(service.price) || service.price < 0) fail(400, 'Введите корректную цену.');
  return service;
}

function patchOrder(db, id, patch) {
  const order = db.orders.find(item => item.id === id);
  if (!order) fail(404, 'Заказ не найден.');
  if (patch.status !== undefined && db.statusLabels[patch.status]) order.status = patch.status;
  if (patch.responsibleId !== undefined && db.staff.some(item => item.id === patch.responsibleId)) order.responsibleId = patch.responsibleId;
  if (patch.deliveryEta !== undefined) order.deliveryEta = clean(patch.deliveryEta);
  if (patch.partsEta !== undefined) order.partsEta = clean(patch.partsEta);
  if (patch.comment !== undefined) order.comment = clean(patch.comment);
  return order;
}

async function handleApi(req, res, url) {
  const db = readDb();
  const user = currentUser(db, req);
  const method = req.method || 'GET';
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/bootstrap') return sendJson(res, 200, bootstrap(db, user));

  if (method === 'POST' && pathname === '/api/auth/register') {
    const newUser = makeClient(db, await readBody(req));
    const token = createSession(db, newUser.id);
    writeDb(db);
    return sendJson(res, 201, { token, user: publicUser(newUser, db) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const result = loginClient(db, await readBody(req));
    writeDb(db);
    return sendJson(res, 200, result);
  }

  if (method === 'POST' && pathname === '/api/auth/admin') {
    const result = loginAdmin(db, await readBody(req));
    writeDb(db);
    return sendJson(res, 200, result);
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = tokenFromReq(req);
    db.sessions = db.sessions.filter(session => session.token !== token);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/clients') {
    requireAdmin(user);
    const newUser = makeClient(db, await readBody(req));
    writeDb(db);
    return sendJson(res, 201, { user: publicUser(newUser, db) });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    requireClient(user);
    const order = createOrder(db, user, await readBody(req));
    writeDb(db);
    return sendJson(res, 201, { order });
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && method === 'PATCH') {
    requireAdmin(user);
    const order = patchOrder(db, decodeURIComponent(orderMatch[1]), await readBody(req));
    writeDb(db);
    return sendJson(res, 200, { order });
  }

  if (method === 'POST' && pathname === '/api/products') {
    requireAdmin(user);
    const product = productFromBody(await readBody(req));
    product.id = `pc-${crypto.randomBytes(5).toString('hex')}`;
    db.products.unshift(product);
    writeDb(db);
    return sendJson(res, 201, { product });
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === 'PATCH') {
    requireAdmin(user);
    const id = decodeURIComponent(productMatch[1]);
    const index = db.products.findIndex(item => item.id === id);
    if (index === -1) fail(404, 'Товар не найден.');
    db.products[index] = productFromBody(await readBody(req), db.products[index]);
    writeDb(db);
    return sendJson(res, 200, { product: db.products[index] });
  }

  if (productMatch && method === 'DELETE') {
    requireAdmin(user);
    const id = decodeURIComponent(productMatch[1]);
    db.products = db.products.filter(item => item.id !== id);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/services') {
    requireAdmin(user);
    const service = serviceFromBody(await readBody(req));
    service.id = `service-${crypto.randomBytes(5).toString('hex')}`;
    db.services.unshift(service);
    writeDb(db);
    return sendJson(res, 201, { service });
  }

  const serviceMatch = pathname.match(/^\/api\/services\/([^/]+)$/);
  if (serviceMatch && method === 'PATCH') {
    requireAdmin(user);
    const id = decodeURIComponent(serviceMatch[1]);
    const index = db.services.findIndex(item => item.id === id);
    if (index === -1) fail(404, 'Услуга не найдена.');
    db.services[index] = serviceFromBody(await readBody(req), db.services[index]);
    writeDb(db);
    return sendJson(res, 200, { service: db.services[index] });
  }

  if (serviceMatch && method === 'DELETE') {
    requireAdmin(user);
    const id = decodeURIComponent(serviceMatch[1]);
    db.services = db.services.filter(item => item.id !== id);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  fail(404, 'Маршрут не найден.');
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    serveStatic(req, res, url);
  } catch (error) {
    const status = Number(error.status || 500);
    const message = status >= 500 ? 'Внутренняя ошибка сервера.' : error.message;
    sendJson(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Restart-PC запущен: http://localhost:${PORT}`);
});
