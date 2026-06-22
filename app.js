const state = {
  token: localStorage.getItem('restart_pc_token') || '',
  user: null,
  products: [],
  services: [],
  orders: [],
  staff: [],
  clients: [],
  statusLabels: {},
  dashboard: null,
  view: 'home',
  modal: null,
  adminTab: 'dashboard',
  notice: '',
  noticeType: 'success',
  loading: true,
  editProductId: '',
  editServiceId: '',
  clientSearchResult: null,
};

const app = document.getElementById('app');

start();

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal) {
    state.modal = null;
    render();
  }
});

document.addEventListener('click', async (event) => {
  const viewButton = event.target.closest('[data-view]');
  const actionButton = event.target.closest('[data-action]');
  const tabButton = event.target.closest('[data-admin-tab]');

  if (viewButton) {
    state.view = viewButton.dataset.view;
    state.modal = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (tabButton) {
    state.adminTab = tabButton.dataset.adminTab;
    render();
    return;
  }

  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id || '';

  if (action === 'open-login') return openModal('login');
  if (action === 'open-register') return openModal('register');
  if (action === 'open-admin-login') return openModal('admin');
  if (action === 'open-client-create') return openModal('client');
  if (action === 'close-modal') return openModal(null);
  if (action === 'close-notice') return clearNotice();
  if (action === 'logout') return logout();
  if (action === 'order-product') return createOrder('product', id);
  if (action === 'order-service') return createOrder('service', id);
  if (action === 'delete-product') return deleteProduct(id);
  if (action === 'delete-service') return deleteService(id);
  if (action === 'edit-product') {
    state.editProductId = id;
    state.adminTab = 'stock';
    render();
    return;
  }
  if (action === 'cancel-product-edit') {
    state.editProductId = '';
    render();
    return;
  }
  if (action === 'edit-service') {
    state.editServiceId = id;
    state.adminTab = 'services';
    render();
    return;
  }
  if (action === 'cancel-service-edit') {
    state.editServiceId = '';
    render();
    return;
  }
  if (action === 'check-client') return checkClient();
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  const formName = form.dataset.form;
  if (!formName) return;
  event.preventDefault();

  if (formName === 'login') return login(form);
  if (formName === 'register') return register(form);
  if (formName === 'admin-login') return adminLogin(form);
  if (formName === 'client-create') return createClient(form);
  if (formName === 'product') return saveProduct(form);
  if (formName === 'service') return saveService(form);
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.dataset.productImageInput !== undefined) {
    previewProductImage(target);
    return;
  }
  if (!target.dataset.orderId || !target.dataset.orderField) return;
  await patchOrder(target.dataset.orderId, { [target.dataset.orderField]: target.value });
});

async function start() {
  await loadData();
  state.loading = false;
  render();
}

async function loadData() {
  try {
    const data = await api('/api/bootstrap');
    state.user = data.user || null;
    state.products = data.products || [];
    state.services = data.services || [];
    state.orders = data.orders || [];
    state.staff = data.staff || [];
    state.clients = data.clients || [];
    state.statusLabels = data.statusLabels || {};
    state.dashboard = data.dashboard || null;
  } catch (error) {
    state.notice = 'Не удалось загрузить данные сайта. Проверьте запуск сервера и обновите страницу.';
    state.noticeType = 'error';
  }
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || 'Не удалось выполнить действие.');
  return data;
}

function render() {
  app.innerHTML = `
    <div class="app">
      ${renderTopbar()}
      <main class="main">
        ${renderNotice()}
        ${state.loading ? renderLoading() : renderCurrentView()}
      </main>
      ${renderFooter()}
      ${renderModal()}
    </div>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand-row">
          <button class="brand" data-view="home" type="button" aria-label="Restart-PC">
            <span class="logo-symbol">${uiIcon('wrench')}</span>
            <span class="logo-text">Restart-<span>PC</span></span>
          </button>
        </div>
        <div class="header-actions">
          <div class="contact-row">
            <span class="contact-item">${uiIcon('phone')} +7 (924) 007-67-77</span>
            <span class="contact-item">${uiIcon('mail')} restartpc@mail.ru</span>
          </div>
          <div class="account-actions">
            ${state.user ? renderUserActions() : renderGuestActions()}
          </div>
        </div>
        <nav class="nav" aria-label="Навигация">
          ${navButton('home', 'В наличии')}
          ${navButton('services', 'Услуги')}
          ${navButton('how', 'Как мы работаем')}
          ${navButton('contacts', 'Контакты')}
          ${navButton('faq', 'Часто спрашивают')}
          ${state.user ? navButton('profile', 'Профиль') : ''}
        </nav>
      </div>
    </header>
  `;
}

function navButton(view, label) {
  return `<button class="nav-link ${state.view === view ? 'active' : ''}" data-view="${view}" type="button">${label}</button>`;
}

function renderGuestActions() {
  return `
    <button class="btn btn-ghost" data-action="open-login" type="button">Вход</button>
    <button class="btn btn-primary" data-action="open-register" type="button">Регистрация</button>
  `;
}

function renderUserActions() {
  const roleLabel = state.user.role === 'admin' ? 'Админ' : 'Профиль';
  return `
    <button class="btn btn-ghost" data-view="profile" type="button">${uiIcon('user')} ${escapeHtml(roleLabel)}</button>
    <button class="btn btn-primary" data-action="logout" type="button">Выйти</button>
  `;
}

function renderNotice() {
  if (!state.notice) return '';
  return `
    <div class="notice ${state.noticeType}">
      <span>${escapeHtml(state.notice)}</span>
      <button data-action="close-notice" type="button" aria-label="Закрыть">×</button>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="loading">
      <div>
        <div class="spinner"></div>
        <div>Загрузка...</div>
      </div>
    </div>
  `;
}

function renderCurrentView() {
  if (state.view === 'services') return renderServicesPage();
  if (state.view === 'how') return renderHowPage();
  if (state.view === 'contacts') return renderContactsPage();
  if (state.view === 'faq') return renderFaqPage();
  if (state.view === 'profile') return renderProfilePage();
  return renderHomePage();
}

function renderHomePage() {
  return `
    <section class="hero">
      <div class="hero-card">
        <div>
          <h1 class="hero-title">Restart-PC</h1>
          <p class="hero-text">Профессиональный ремонт и сборка компьютеров</p>
          <p class="hero-subtext">Соберём ПК из новых и б/у деталей на любой вкус</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-view="home" type="button">Компьютеры в наличии</button>
            <button class="btn btn-ghost" data-view="services" type="button">Посмотреть услуги</button>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2 class="section-title"><span class="section-icon">${uiIcon('monitor')}</span>Компьютеры в наличии</h2>
      </div>
      ${renderProductsGrid(state.products)}
    </section>

    <section style="margin-top: 44px;">
      <div class="section-head">
        <h2 class="section-title"><span class="section-icon">${uiIcon('tools')}</span>Популярные услуги</h2>
        <button class="section-link" data-view="services" type="button">Все услуги</button>
      </div>
      ${renderServicesGrid(state.services.slice(0, 6))}
    </section>
  `;
}

function renderProductsGrid(products) {
  if (!products.length) return `<div class="empty">Сейчас витрина обновляется. Скоро товары появятся здесь.</div>`;
  return `<div class="product-grid">${products.map(renderProductCard).join('')}</div>`;
}

function renderProductCard(product) {
  const unavailable = isProductUnavailable(product);
  const stockText = stockLabel(product);
  const imageSrc = productImageSrc(product);
  return `
    <article class="product-card">
      <div class="product-visual">
        <img src="${escapeAttr(imageSrc)}" alt="${escapeAttr(product.title)}" loading="lazy" onerror="this.src='/assets/products/pc-default.svg'">
      </div>
      <div class="product-top">
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        <span class="badge ${stockClass(product)}">${escapeHtml(stockText)}</span>
      </div>
      <ul class="spec-list">
        <li>${escapeHtml(product.cpu || 'Процессор уточняется')}</li>
        <li>${escapeHtml(product.gpu || 'Видеокарта уточняется')}</li>
        <li>${escapeHtml(product.ram || 'Оперативная память уточняется')}</li>
        <li>${escapeHtml(product.storage || 'Накопитель уточняется')}</li>
      </ul>
      <p class="price">${formatMoney(product.price)}</p>
      <p class="price-note">Без учёта доставки</p>
      <div class="product-actions">
        <button class="btn ${unavailable ? 'btn-ghost' : 'btn-primary'}" data-action="order-product" data-id="${escapeAttr(product.id)}" ${unavailable ? 'disabled' : ''} type="button">
          ${unavailable ? 'Узнать о поступлении' : 'Заказать'}
        </button>
      </div>
    </article>
  `;
}

function renderServicesPage() {
  return `
    <section>
      <div class="section-head">
        <h1 class="section-title"><span class="section-icon">${uiIcon('tools')}</span>Услуги Restart-PC</h1>
      </div>
      ${renderServicesGrid(state.services)}
    </section>
    ${renderWorkSteps()}
  `;
}

function renderServicesGrid(services) {
  if (!services.length) return `<div class="empty">Раздел услуг обновляется.</div>`;
  return `<div class="service-grid">${services.map(renderServiceCard).join('')}</div>`;
}

function renderServiceCard(service) {
  return `
    <article class="service-card">
      <div class="service-top">
        <div class="service-icon">${serviceIcon(service)}</div>
        <h3 class="service-title">${escapeHtml(service.title)}</h3>
      </div>
      <div class="service-desc">${escapeHtml(service.description || '')}</div>
      <div class="service-bottom">
        <span class="service-price">${escapeHtml(service.priceText || formatMoney(service.price))}</span>
        <button class="btn btn-primary btn-small" data-action="order-service" data-id="${escapeAttr(service.id)}" type="button">Заказать</button>
      </div>
    </article>
  `;
}

function renderHowPage() {
  return `
    <section>
      <div class="section-head">
        <h1 class="section-title"><span class="section-icon">${uiIcon('settings')}</span>Как мы работаем</h1>
      </div>
      ${renderWorkSteps()}
    </section>
  `;
}

function renderWorkSteps() {
  return `
    <div class="info-grid" style="margin-top: 18px;">
      <div class="info-card">
        <h3>1. Заявка</h3>
        <p>Вы выбираете компьютер или услугу, оставляете заявку через сайт или связываетесь с нами напрямую.</p>
      </div>
      <div class="info-card">
        <h3>2. Согласование</h3>
        <p>Мы уточняем задачу, стоимость, сроки и удобный способ передачи техники или получения заказа.</p>
      </div>
      <div class="info-card">
        <h3>3. Выполнение</h3>
        <p>Статус заказа отображается в личном кабинете: принято, диагностика, ремонт, готово или выдано.</p>
      </div>
    </div>
  `;
}

function renderContactsPage() {
  return `
    <section>
      <div class="section-head">
        <h1 class="section-title"><span class="section-icon">${uiIcon('location')}</span>Контакты</h1>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <h3>Телефон</h3>
          <p>+7 (924) 007-67-77</p>
        </div>
        <div class="info-card">
          <h3>Почта</h3>
          <p>restartpc@mail.ru</p>
        </div>
        <div class="info-card">
          <h3>График</h3>
          <p>Ежедневно с 10:00 до 20:00</p>
        </div>
      </div>
    </section>
  `;
}

function renderFaqPage() {
  return `
    <section>
      <div class="section-head">
        <h1 class="section-title"><span class="section-icon">${uiIcon('question')}</span>Часто спрашивают</h1>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <h3>Можно ли заказать сборку под бюджет?</h3>
          <p>Да. Подбираем комплектующие под игры, работу, монтаж, учёбу или офисные задачи.</p>
        </div>
        <div class="info-card">
          <h3>Где смотреть статус?</h3>
          <p>После входа в аккаунт откройте профиль. Там отображаются все ваши заявки и примерные сроки.</p>
        </div>
        <div class="info-card">
          <h3>Есть ли ремонт ноутбуков?</h3>
          <p>Да. Выполняем диагностику, чистку, замену термопасты, установку комплектующих и настройку ПО.</p>
        </div>
      </div>
    </section>
  `;
}

function renderProfilePage() {
  if (!state.user) {
    return `
      <section>
        <div class="section-head">
          <h1 class="section-title"><span class="section-icon">${uiIcon('user')}</span>Профиль</h1>
        </div>
        <div class="panel">
          <div class="panel-body" style="text-align: center; padding: 46px 22px;">
            <h2>Войдите в аккаунт</h2>
            <p style="color: var(--text-soft);">В профиле отображаются ваши заказы, статусы и примерные сроки.</p>
            <div class="hero-actions">
              <button class="btn btn-primary" data-action="open-login" type="button">Войти</button>
              <button class="btn btn-ghost" data-action="open-register" type="button">Создать аккаунт</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  if (state.user.role === 'admin') return renderAdminProfile();
  return renderClientProfile();
}

function renderClientProfile() {
  return `
    <section class="profile-layout">
      <aside class="panel profile-card">
        <h2>${escapeHtml(state.user.nickname)}</h2>
        <div class="profile-meta">
          <span>Почта: ${escapeHtml(state.user.email)}</span>
          <span>Телефон: ${escapeHtml(state.user.phone || 'не указан')}</span>
          <span>Аккаунт создан: ${formatDate(state.user.createdAt)}</span>
        </div>
      </aside>
      <div class="panel">
        <div class="panel-head">
          <h1 class="panel-title">Что за заказы у меня</h1>
        </div>
        <div class="panel-body">
          ${renderClientOrders(state.orders)}
        </div>
      </div>
    </section>
  `;
}

function renderClientOrders(orders) {
  if (!orders.length) {
    return `<div class="empty">У вас пока нет заказов. Выберите компьютер или услугу и оформите заявку.</div>`;
  }
  return `<div class="order-list">${orders.map(renderOrderCard).join('')}</div>`;
}

function renderOrderCard(order) {
  const person = state.staff.find((item) => item.id === order.responsibleId);
  return `
    <article class="order-card">
      <div>
        <p class="order-title">${escapeHtml(cleanOrderId(order.id))} · ${escapeHtml(order.itemTitle)}</p>
        <p class="order-meta">
          Заказано: ${formatDate(order.orderedAt)}<br>
          Детали придут: ${escapeHtml(formatDate(order.partsEta))}<br>
          Примерный срок: ${escapeHtml(formatDate(order.deliveryEta))}<br>
          Ответственный: ${escapeHtml(person?.name || 'назначается')}
        </p>
        ${order.comment ? `<p class="order-meta">${escapeHtml(order.comment)}</p>` : ''}
      </div>
      <div>
        <div class="order-price">${formatMoney(order.amount)}</div>
        <div style="margin-top: 10px; text-align: right;">${renderStatus(order.status)}</div>
      </div>
    </article>
  `;
}

function renderAdminProfile() {
  return `
    <section class="admin-shell">
      <div class="admin-hero">
        <h1><span class="admin-title-icon">${uiIcon('wrench')}</span> Restart-PC | Операционный центр</h1>
        <p>${formatDate(new Date().toISOString().slice(0, 10))} | Управление клиентами, складом и заказами</p>
      </div>
      <div class="admin-tabs">
        ${adminTab('dashboard', 'Дашборд')}
        ${adminTab('clients', 'Проверка клиентов')}
        ${adminTab('stock', 'Склад')}
        ${adminTab('services', 'Услуги')}
        ${adminTab('orders', 'Текущие заказы')}
      </div>
      ${renderAdminTab()}
    </section>
  `;
}

function adminTab(tab, label) {
  return `<button class="admin-tab ${state.adminTab === tab ? 'active' : ''}" data-admin-tab="${tab}" type="button">${label}</button>`;
}

function renderAdminTab() {
  if (state.adminTab === 'clients') return renderAdminClients();
  if (state.adminTab === 'stock') return renderAdminStock();
  if (state.adminTab === 'services') return renderAdminServices();
  if (state.adminTab === 'orders') return renderAdminOrders();
  return renderAdminDashboard();
}

function renderAdminDashboard() {
  const metrics = state.dashboard?.metrics || {};
  return `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Ключевые метрики</h2>
      </div>
      <div class="panel-body">
        <div class="metric-grid">
          ${metricCard('chart', metrics.totalOrders || 0, 'Всего заказов')}
          ${metricCard('wallet', formatMoney(metrics.revenue || 0), 'Выручка')}
          ${metricCard('users', metrics.clients || 0, 'Клиентов')}
          ${metricCard('star', '4.8', 'Рейтинг')}
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Заказы и услуги по ответственным</h2>
      </div>
      <div class="panel-body">
        <div class="staff-grid">
          ${(state.dashboard?.byStaff || []).map(renderStaffCard).join('')}
        </div>
      </div>
    </div>
  `;
}

function metricCard(iconName, value, label) {
  return `
    <div class="metric-card">
      <span class="metric-icon">${uiIcon(iconName)}</span>
      <div class="metric-value">${escapeHtml(String(value))}</div>
      <div class="metric-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function renderStaffCard(person) {
  return `
    <article class="staff-card">
      <h3>${escapeHtml(person.name)}</h3>
      <p class="staff-role">${escapeHtml(person.position)}</p>
      <div class="split-columns">
        ${renderStaffSplit('Заказы', person.productOrders || [])}
        ${renderStaffSplit('Услуги', person.serviceOrders || [])}
      </div>
    </article>
  `;
}

function renderStaffSplit(title, orders) {
  return `
    <div class="split-box">
      <h4>${escapeHtml(title)} · ${orders.length}</h4>
      <div class="compact-list">
        ${orders.length ? orders.slice(0, 4).map(renderCompactOrder).join('') : '<span class="card-note">Нет активных позиций</span>'}
      </div>
    </div>
  `;
}

function renderCompactOrder(order) {
  return `
    <div class="compact-order">
      <strong>${escapeHtml(cleanOrderId(order.id))} · ${escapeHtml(order.itemTitle)}</strong>
      <span>${renderStatus(order.status)} · ${formatMoney(order.amount)}</span>
    </div>
  `;
}

function renderAdminClients() {
  return `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Проверка клиента в базе</h2>
        <button class="btn btn-green" data-action="open-client-create" type="button">＋ Новый клиент</button>
      </div>
      <div class="panel-body">
        <div class="client-check">
          <input id="clientPhone" type="text" placeholder="Введите телефон">
          <input id="clientEmail" type="email" placeholder="Email клиента">
          <button class="btn btn-primary" data-action="check-client" type="button">Проверить</button>
          <button class="btn btn-ghost" data-action="open-register" type="button">Регистрация</button>
        </div>
        ${renderClientSearchResult()}
        <div style="margin-top: 22px;" class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Клиент</th><th>Почта</th><th>Телефон</th><th>Заказов</th><th>Дата регистрации</th></tr></thead>
            <tbody>${state.clients.map(renderClientRow).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderClientSearchResult() {
  if (!state.clientSearchResult) return '';
  if (state.clientSearchResult === 'not-found') return `<div class="client-result">Клиент не найден. Можно создать нового клиента.</div>`;
  const client = state.clientSearchResult;
  return `
    <div class="client-result">
      <strong>${escapeHtml(client.nickname)}</strong><br>
      ${escapeHtml(client.email)} · ${escapeHtml(client.phone || 'телефон не указан')}<br>
      Заказов: ${client.orderCount || 0}
    </div>
  `;
}

function renderClientRow(client) {
  return `
    <tr>
      <td>${escapeHtml(client.nickname)}</td>
      <td>${escapeHtml(client.email)}</td>
      <td>${escapeHtml(client.phone || '—')}</td>
      <td>${client.orderCount || 0}</td>
      <td>${formatDate(client.createdAt)}</td>
    </tr>
  `;
}

function renderAdminStock() {
  return `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Складской учёт</h2>
      </div>
      <div class="panel-body">
        ${renderProductForm()}
        <div style="margin-top: 24px;" class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Товар</th><th>Характеристики</th><th>Цена</th><th>Наличие</th><th>Действия</th></tr></thead>
            <tbody>${state.products.map(renderProductRow).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderProductForm() {
  const product = state.products.find((item) => item.id === state.editProductId) || null;
  const preview = productImageSrc(product || {});
  return `
    <form class="form-grid" data-form="product">
      <input type="hidden" name="id" value="${escapeAttr(product?.id || '')}">
      <input type="hidden" name="image" value="${escapeAttr(product?.image || '')}">
      <div class="field wide-2"><label>Название</label><input name="title" value="${escapeAttr(product?.title || '')}" placeholder="Gaming Beast" required></div>
      <div class="field"><label>Цена</label><input name="price" type="number" min="0" step="100" value="${escapeAttr(product?.price || '')}" placeholder="450000" required></div>
      <div class="field"><label>Количество</label><input name="quantity" type="number" min="0" step="1" value="${escapeAttr(product?.quantity ?? '')}" placeholder="8"></div>
      <div class="field"><label>Процессор</label><input name="cpu" value="${escapeAttr(product?.cpu || '')}" placeholder="Intel i9-14900K"></div>
      <div class="field"><label>Видеокарта</label><input name="gpu" value="${escapeAttr(product?.gpu || '')}" placeholder="RTX 4090"></div>
      <div class="field"><label>ОЗУ</label><input name="ram" value="${escapeAttr(product?.ram || '')}" placeholder="32GB DDR5"></div>
      <div class="field"><label>Накопитель</label><input name="storage" value="${escapeAttr(product?.storage || '')}" placeholder="2TB NVMe SSD"></div>
      <div class="field"><label>Наличие</label><select name="stock">${stockOptions(product?.stock)}</select></div>
      <div class="field wide-2"><label>Фото товара</label><input name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-product-image-input><span class="field-help">Загрузите фото компьютера — оно появится на карточке товара.</span></div>
      <div class="field product-preview-field"><label>Предпросмотр</label><div class="admin-product-preview" id="productImagePreview"><img src="${escapeAttr(preview)}" alt="${escapeAttr(product?.title || 'Компьютер')}" onerror="this.src='/assets/products/pc-default.svg'"></div></div>
      ${product?.image && !String(product.image).startsWith('/assets/') ? `<label class="check-field"><input type="checkbox" name="removeImage"> Убрать загруженное фото</label>` : '<div></div>'}
      <div class="field wide-3"><label>Описание</label><input name="description" value="${escapeAttr(product?.description || '')}" placeholder="Краткое описание товара"></div>
      <div class="field" style="align-self: end;"><button class="btn btn-green btn-wide" type="submit">${product ? 'Сохранить' : 'Добавить товар'}</button></div>
      ${product ? `<div class="wide-4"><button class="btn btn-ghost" data-action="cancel-product-edit" type="button">Отменить редактирование</button></div>` : ''}
    </form>
  `;
}

function stockOptions(value = 'В наличии') {
  return ['В наличии', 'Под заказ', 'Нет в наличии'].map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('');
}

function renderProductRow(product) {
  return `
    <tr>
      <td>
        <div class="product-row-title">
          <img class="product-thumb" src="${escapeAttr(productImageSrc(product))}" alt="${escapeAttr(product.title)}" onerror="this.src='/assets/products/pc-default.svg'">
          <div><strong>${escapeHtml(product.title)}</strong><br><span class="card-note">${escapeHtml(product.description || '')}</span></div>
        </div>
      </td>
      <td>${escapeHtml(product.cpu || '—')}<br>${escapeHtml(product.gpu || '—')}<br>${escapeHtml(product.ram || '—')} · ${escapeHtml(product.storage || '—')}</td>
      <td><strong>${formatMoney(product.price)}</strong></td>
      <td>${stockLabel(product)}<br><span class="card-note">${Number(product.quantity || 0)} шт.</span></td>
      <td><div class="table-actions"><button class="btn btn-ghost btn-small" data-action="edit-product" data-id="${escapeAttr(product.id)}" type="button">Изменить</button><button class="btn btn-red btn-small" data-action="delete-product" data-id="${escapeAttr(product.id)}" type="button">Удалить</button></div></td>
    </tr>
  `;
}

function renderAdminServices() {
  return `
    <div class="panel">
      <div class="panel-head"><h2 class="panel-title">Услуги</h2></div>
      <div class="panel-body">
        ${renderServiceForm()}
        <div style="margin-top: 24px;" class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Услуга</th><th>Категория</th><th>Цена</th><th>Описание</th><th>Действия</th></tr></thead>
            <tbody>${state.services.map(renderServiceRow).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderServiceForm() {
  const service = state.services.find((item) => item.id === state.editServiceId) || null;
  return `
    <form class="form-grid" data-form="service">
      <input type="hidden" name="id" value="${escapeAttr(service?.id || '')}">
      <div class="field wide-2"><label>Название</label><input name="title" value="${escapeAttr(service?.title || '')}" placeholder="Настройка Windows" required></div>
      <div class="field"><label>Категория</label><input name="category" value="${escapeAttr(service?.category || '')}" placeholder="ПО"></div>
      <div class="field"><label>Цена</label><input name="price" type="number" min="0" step="100" value="${escapeAttr(service?.price || '')}" placeholder="5000"></div>
      <div class="field"><label>Текст цены</label><input name="priceText" value="${escapeAttr(service?.priceText || '')}" placeholder="от 5 000 ₽"></div>
      <div class="field wide-2"><label>Описание</label><input name="description" value="${escapeAttr(service?.description || '')}" placeholder="Что входит в услугу"></div>
      <div class="field" style="align-self: end;"><button class="btn btn-green btn-wide" type="submit">${service ? 'Сохранить' : 'Добавить услугу'}</button></div>
      ${service ? `<div class="wide-4"><button class="btn btn-ghost" data-action="cancel-service-edit" type="button">Отменить редактирование</button></div>` : ''}
    </form>
  `;
}

function renderServiceRow(service) {
  return `
    <tr>
      <td><strong>${serviceIcon(service)} ${escapeHtml(service.title)}</strong></td>
      <td>${escapeHtml(service.category || '—')}</td>
      <td><strong>${escapeHtml(service.priceText || formatMoney(service.price))}</strong></td>
      <td>${escapeHtml(service.description || '')}</td>
      <td><div class="table-actions"><button class="btn btn-ghost btn-small" data-action="edit-service" data-id="${escapeAttr(service.id)}" type="button">Изменить</button><button class="btn btn-red btn-small" data-action="delete-service" data-id="${escapeAttr(service.id)}" type="button">Удалить</button></div></td>
    </tr>
  `;
}

function renderAdminOrders() {
  return `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Активные заказы (${state.orders.length})</h2>
      </div>
      <div class="panel-body table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Клиент</th><th>Позиция</th><th>Сумма</th><th>Статус</th><th>Ответственный</th><th>Срок</th><th>Комментарий</th></tr></thead>
          <tbody>${state.orders.map(renderAdminOrderRow).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminOrderRow(order) {
  return `
    <tr>
      <td><strong>${escapeHtml(cleanOrderId(order.id))}</strong></td>
      <td>${escapeHtml(order.clientName)}</td>
      <td>${escapeHtml(order.itemTitle)}<br><span class="card-note">${order.type === 'product' ? 'ПК' : 'Услуга'}</span></td>
      <td><strong>${formatMoney(order.amount)}</strong></td>
      <td>${renderStatusSelect(order)}</td>
      <td>${renderStaffSelect(order)}</td>
      <td><input class="inline-input" type="date" data-order-id="${escapeAttr(order.id)}" data-order-field="deliveryEta" value="${escapeAttr(dateInputValue(order.deliveryEta))}"></td>
      <td><input class="inline-input" data-order-id="${escapeAttr(order.id)}" data-order-field="comment" value="${escapeAttr(order.comment || '')}" placeholder="Комментарий"></td>
    </tr>
  `;
}

function renderStatusSelect(order) {
  return `
    <select class="inline-select" data-order-id="${escapeAttr(order.id)}" data-order-field="status">
      ${Object.entries(state.statusLabels).map(([key, label]) => `<option value="${escapeAttr(key)}" ${key === order.status ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
    </select>
  `;
}

function renderStaffSelect(order) {
  return `
    <select class="inline-select" data-order-id="${escapeAttr(order.id)}" data-order-field="responsibleId">
      ${state.staff.map((person) => `<option value="${escapeAttr(person.id)}" ${person.id === order.responsibleId ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('')}
    </select>
  `;
}

function renderModal() {
  if (!state.modal) return '';
  if (state.modal === 'register') return renderRegisterModal();
  if (state.modal === 'admin') return renderAdminLoginModal();
  if (state.modal === 'client') return renderClientCreateModal();
  return renderLoginModal();
}

function renderLoginModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h2 class="modal-title">Вход</h2>
          <button class="modal-close" data-action="close-modal" type="button">×</button>
        </div>
        <form class="modal-form" data-form="login">
          <div class="modal-field"><label>Email или телефон</label><input name="identifier" type="text" placeholder="example@mail.ru или +79240076777" required></div>
          <div class="modal-field"><label>Пароль</label><input name="password" type="password" placeholder="Ваш пароль" required></div>
          <button class="btn btn-primary btn-wide" type="submit">Войти</button>
        </form>
        <div class="modal-foot">
          Нет аккаунта? <button class="link-button" data-action="open-register" type="button">Создайте его</button>
          <div class="login-options"><button class="link-button" data-action="open-admin-login" type="button">Вход сотрудника</button></div>
        </div>
      </div>
    </div>
  `;
}

function renderRegisterModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h2 class="modal-title">Регистрация</h2>
          <button class="modal-close" data-action="close-modal" type="button">×</button>
        </div>
        <form class="modal-form" data-form="register">
          <div class="modal-field"><label>Никнейм</label><input name="nickname" type="text" placeholder="Иван Иванов" required></div>
          <div class="modal-field"><label>Email</label><input name="email" type="email" placeholder="example@mail.ru" required></div>
          <div class="modal-field"><label>Телефон</label><input name="phone" type="tel" placeholder="+7 (924) 007-67-77"></div>
          <div class="modal-field"><label>Пароль</label><input name="password" type="password" placeholder="Минимум 6 символов" required></div>
          <div class="modal-field"><label>Подтвердите пароль</label><input name="passwordRepeat" type="password" placeholder="Повторите пароль" required></div>
          <button class="btn btn-primary btn-wide" type="submit">Создать аккаунт</button>
        </form>
        <div class="modal-foot">Уже есть аккаунт? <button class="link-button" data-action="open-login" type="button">Войдите</button></div>
      </div>
    </div>
  `;
}

function renderAdminLoginModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h2 class="modal-title">Вход сотрудника</h2>
          <button class="modal-close" data-action="close-modal" type="button">×</button>
        </div>
        <form class="modal-form" data-form="admin-login">
          <div class="modal-field"><label>Логин</label><input name="login" type="text" placeholder="Restart-PC" required></div>
          <div class="modal-field"><label>Пароль</label><input name="password" type="password" placeholder="Пароль" required></div>
          <div class="modal-field"><label>Повторите пароль</label><input name="passwordRepeat" type="password" placeholder="Повторите пароль" required></div>
          <button class="btn btn-primary btn-wide" type="submit">Войти</button>
        </form>
      </div>
    </div>
  `;
}

function renderClientCreateModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h2 class="modal-title">Новый клиент</h2>
          <button class="modal-close" data-action="close-modal" type="button">×</button>
        </div>
        <form class="modal-form" data-form="client-create">
          <div class="modal-field"><label>Никнейм</label><input name="nickname" type="text" placeholder="Имя клиента" required></div>
          <div class="modal-field"><label>Email</label><input name="email" type="email" placeholder="example@mail.ru" required></div>
          <div class="modal-field"><label>Телефон</label><input name="phone" type="tel" placeholder="+7 (924) 007-67-77"></div>
          <div class="modal-field"><label>Пароль</label><input name="password" type="password" placeholder="Пароль для клиента" required></div>
          <button class="btn btn-green btn-wide" type="submit">Создать клиента</button>
        </form>
      </div>
    </div>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-grid">
        <div>
          <div class="footer-title"><span class="footer-icon">${uiIcon('wrench')}</span> Restart-PC</div>
          <p>Компьютеры, ремонт, настройка и обслуживание техники.</p>
        </div>
        <div>
          <div class="footer-title">Покупателям</div>
          <a href="#" data-view="home">В наличии</a>
          <a href="#" data-view="services">Услуги</a>
        </div>
        <div>
          <div class="footer-title">Компания</div>
          <a href="#" data-view="how">Как мы работаем</a>
          <a href="#" data-view="faq">Вопросы</a>
        </div>
        <div>
          <div class="footer-title">Контакты</div>
          <p>+7 (924) 007-67-77</p>
          <p>restartpc@mail.ru</p>
        </div>
      </div>
    </footer>
  `;
}

async function login(form) {
  try {
    const body = formData(form);
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.token = data.token;
    localStorage.setItem('restart_pc_token', state.token);
    state.modal = null;
    state.view = 'profile';
    await loadData();
    showNotice('Вы вошли в аккаунт.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function register(form) {
  try {
    const body = formData(form);
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
    state.token = data.token;
    localStorage.setItem('restart_pc_token', state.token);
    state.modal = null;
    state.view = 'profile';
    await loadData();
    showNotice('Аккаунт создан.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function adminLogin(form) {
  try {
    const body = formData(form);
    const data = await api('/api/auth/admin', { method: 'POST', body: JSON.stringify(body) });
    state.token = data.token;
    localStorage.setItem('restart_pc_token', state.token);
    state.modal = null;
    state.view = 'profile';
    state.adminTab = 'dashboard';
    await loadData();
    showNotice('Панель управления открыта.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // локальный выход всё равно выполнится
  }
  state.token = '';
  localStorage.removeItem('restart_pc_token');
  state.user = null;
  state.orders = [];
  state.dashboard = null;
  state.view = 'home';
  showNotice('Вы вышли из аккаунта.');
  await loadData();
}

async function createOrder(type, itemId) {
  if (!state.user) {
    openModal('login');
    showNotice('Войдите или зарегистрируйтесь, чтобы оформить заказ.', 'error');
    return;
  }
  if (state.user.role === 'admin') {
    showNotice('Заказы клиентов управляются в профиле администратора.', 'error');
    return;
  }
  try {
    await api('/api/orders', { method: 'POST', body: JSON.stringify({ type, itemId }) });
    state.view = 'profile';
    await loadData();
    showNotice('Заявка оформлена. Статус появился в профиле.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function saveProduct(form) {
  try {
    const body = await productFormData(form);
    const id = body.id;
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `/api/products/${encodeURIComponent(id)}` : '/api/products';
    await api(url, { method, body: JSON.stringify(body) });
    state.editProductId = '';
    await loadData();
    showNotice(id ? 'Товар обновлён.' : 'Товар добавлен.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар из витрины?')) return;
  try {
    await api(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadData();
    showNotice('Товар удалён.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function saveService(form) {
  try {
    const body = formData(form);
    const id = body.id;
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `/api/services/${encodeURIComponent(id)}` : '/api/services';
    await api(url, { method, body: JSON.stringify(body) });
    state.editServiceId = '';
    await loadData();
    showNotice(id ? 'Услуга обновлена.' : 'Услуга добавлена.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function deleteService(id) {
  if (!confirm('Удалить услугу?')) return;
  try {
    await api(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadData();
    showNotice('Услуга удалена.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function patchOrder(id, patch) {
  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await loadData();
    showNotice('Заказ обновлён.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function createClient(form) {
  try {
    const body = formData(form);
    await api('/api/admin/clients', { method: 'POST', body: JSON.stringify(body) });
    state.modal = null;
    await loadData();
    showNotice('Клиент создан.');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function checkClient() {
  const phone = normalizePhone(document.getElementById('clientPhone')?.value || '');
  const email = (document.getElementById('clientEmail')?.value || '').trim().toLowerCase();
  const found = state.clients.find((client) => {
    const clientPhone = normalizePhone(client.phone || '');
    const clientEmail = String(client.email || '').toLowerCase();
    return (phone && clientPhone.includes(phone)) || (email && clientEmail === email);
  });
  state.clientSearchResult = found || 'not-found';
  render();
}

function openModal(name) {
  state.modal = name;
  render();
}

function clearNotice() {
  state.notice = '';
  render();
}

function showNotice(message, type = 'success') {
  state.notice = message;
  state.noticeType = type;
  render();
}

function productImageSrc(product) {
  if (product && typeof product.image === 'string' && product.image.trim()) return product.image.trim();
  return fallbackProductImage(product || {});
}

function fallbackProductImage(product) {
  const key = String(product.id || product.title || '').toLowerCase();
  if (key.includes('gaming-beast')) return '/assets/products/gaming-beast.svg';
  if (key.includes('office-pro')) return '/assets/products/office-pro.svg';
  if (key.includes('budget-builder')) return '/assets/products/budget-builder.svg';
  if (key.includes('ryzen-power')) return '/assets/products/ryzen-power.svg';
  if (key.includes('high-end-gaming')) return '/assets/products/high-end-gaming.svg';
  if (key.includes('workstation-ultra')) return '/assets/products/workstation-ultra.svg';
  return '/assets/products/pc-default.svg';
}


function previewSelectedProductPhoto(input) {
  const file = input.files && input.files[0];
  const form = input.closest('form');
  const preview = form?.querySelector('.admin-product-preview img');
  const helper = input.closest('.field')?.querySelector('.field-help');
  const removeBox = form?.querySelector('input[name="removeImage"]');
  if (!file || !preview) return;
  if (!file.type.startsWith('image/')) {
    if (helper) helper.textContent = 'Выберите изображение в формате JPG, PNG, WebP или SVG.';
    input.value = '';
    return;
  }
  if (removeBox) removeBox.checked = false;
  const url = URL.createObjectURL(file);
  preview.onload = () => URL.revokeObjectURL(url);
  preview.src = url;
  if (helper) helper.textContent = `Выбрано: ${file.name}. Нажмите «Сохранить», чтобы обновить карточку.`;
}

async function productFormData(form) {
  const data = formData(form);
  const fileInput = form.querySelector('input[name="photo"]');
  delete data.photo;

  if (fileInput?.files?.[0]) {
    data.imageData = await imageFileToDataUrl(fileInput.files[0]);
    data.imageName = fileInput.files[0].name;
  } else if (data.removeImage === 'on') {
    data.image = '/assets/products/pc-default.svg';
  }

  delete data.removeImage;
  return data;
}

function previewProductImage(input) {
  const file = input.files?.[0];
  const preview = document.getElementById('productImagePreview') || input.closest('form')?.querySelector('.admin-product-preview');
  if (!file || !preview) return;

  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="Предпросмотр выбранного фото">`;
  const img = preview.querySelector('img');
  if (img) img.onload = () => URL.revokeObjectURL(url);
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Выберите файл изображения.'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Фото слишком большое. Выберите изображение до 12 МБ.'));

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxWidth = 1100;
      const maxHeight = 760;
      const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b0317';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось открыть фото товара.'));
    };
    img.src = url;
  });
}

function serviceIcon(service) {
  const text = `${service?.title || ''} ${service?.category || ''}`.toLowerCase();
  let name = 'tools';
  if (text.includes('switch') || text.includes('консол')) name = 'gamepad';
  else if (text.includes('vr') || text.includes('meta')) name = 'vr';
  else if (text.includes('windows') || text.includes('по')) name = 'monitor';
  else if (text.includes('видеокарт')) name = 'gpu';
  else if (text.includes('ноут')) name = 'laptop';
  else if (text.includes('данн') || text.includes('копирован')) name = 'folder';
  else if (text.includes('комплект') || text.includes('апгрейд')) name = 'chip';
  return uiIcon(name);
}

function uiIcon(name) {
  const common = 'class="ui-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  const icons = {
    wrench: `<svg ${common}><path d="M14.7 5.3a4.8 4.8 0 0 0 5.5 6.5l-8.8 8.8a2.5 2.5 0 0 1-3.5 0l-4.5-4.5a2.5 2.5 0 0 1 0-3.5l8.8-8.8a4.8 4.8 0 0 0 2.5 1.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m7.5 13.5 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    phone: `<svg ${common}><path d="M7 4.5 9.2 7c.6.7.5 1.7-.1 2.3l-1 1c1.4 2.8 3.6 5 6.4 6.4l1-1c.6-.6 1.6-.7 2.3-.1l2.5 2.2c.5.5.6 1.3.2 1.9-.7 1-1.8 1.8-3.1 1.8C9.5 21.5 2.5 14.5 2.5 6.6c0-1.3.8-2.4 1.8-3.1.6-.4 1.4-.3 1.9.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mail: `<svg ${common}><path d="M4 6.5h16v11H4v-11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m5 7 7 6 7-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    user: `<svg ${common}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    monitor: `<svg ${common}><path d="M4 5h16v11H4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    tools: `<svg ${common}><path d="m5 19 6.2-6.2M14 6l4 4M12.7 8.3l3-3 3 3-3 3-3-3ZM4.5 6.5l3 3 2-2-3-3H4.5v2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings: `<svg ${common}><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.8"/><path d="m19.4 13.5.1-3-2.2-.5a6 6 0 0 0-.7-1.6l1.2-1.9-2.1-2.1-1.9 1.2c-.5-.3-1-.5-1.6-.7L11.7 2h-3l-.5 2.2c-.6.2-1.1.4-1.6.7L4.7 3.7 2.6 5.8l1.2 1.9c-.3.5-.5 1-.7 1.6L1 9.8v3l2.2.5c.2.6.4 1.1.7 1.6l-1.2 1.9 2.1 2.1 1.9-1.2c.5.3 1 .5 1.6.7l.5 2.2h3l.5-2.2c.6-.2 1.1-.4 1.6-.7l1.9 1.2 2.1-2.1-1.2-1.9c.3-.5.5-1 .7-1.6l2-.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    location: `<svg ${common}><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.8"/></svg>`,
    question: `<svg ${common}><path d="M9.8 8a2.5 2.5 0 0 1 4.4 1.6c0 2.2-2.6 2.2-2.6 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 18h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>`,
    chart: `<svg ${common}><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    wallet: `<svg ${common}><path d="M4 7.5h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-12a2 2 0 0 0 2 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 13h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    users: `<svg ${common}><path d="M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 11a3 3 0 0 0 0-6M17.5 19a5 5 0 0 0-3-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    star: `<svg ${common}><path d="m12 3 2.6 5.3 5.9.8-4.2 4.1 1 5.8-5.3-2.8L6.7 19l1-5.8L3.5 9.1l5.9-.8L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    gamepad: `<svg ${common}><path d="M7 10h10a5 5 0 0 1 4.7 6.7l-.5 1.5a2.1 2.1 0 0 1-3.6.7L15.7 17H8.3l-1.9 1.9a2.1 2.1 0 0 1-3.6-.7l-.5-1.5A5 5 0 0 1 7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 13v3M6.5 14.5h3M16.5 14h.01M18.5 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    vr: `<svg ${common}><path d="M4 9.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v5.2c0 1.5-1.2 2.8-2.8 2.8h-2c-1 0-1.8-.5-2.3-1.3l-.9-1.4-.9 1.4c-.5.8-1.3 1.3-2.3 1.3h-2C5.2 17.5 4 16.2 4 14.7V9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.5 12.5h3M13.5 12.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    gpu: `<svg ${common}><path d="M5 7h12v10H5V7Z" stroke="currentColor" stroke-width="1.8"/><path d="M17 10h3M17 14h3M8 10h6M8 14h3M7 4v3M10 4v3M13 4v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    laptop: `<svg ${common}><path d="M6 6h12v9H6V6Z" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 18h17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    folder: `<svg ${common}><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 11h18" stroke="currentColor" stroke-width="1.8"/></svg>`,
    chip: `<svg ${common}><path d="M7 7h10v10H7V7Z" stroke="currentColor" stroke-width="1.8"/><path d="M10 10h4v4h-4v-4ZM4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
  };
  return icons[name] || icons.tools;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function renderStatus(status) {
  const label = state.statusLabels[status] || status || 'Принят';
  return `<span class="status ${escapeAttr(status || 'accepted')}">${escapeHtml(label)}</span>`;
}

function stockClass(product) {
  const stock = String(product.stock || '').toLowerCase();
  const quantity = Number(product.quantity || 0);
  if (stock.includes('нет') || quantity <= 0) return 'stock-no';
  if (stock.includes('заказ')) return 'stock-warn';
  return 'stock-ok';
}

function stockLabel(product) {
  const quantity = Number(product.quantity || 0);
  const stock = product.stock || 'В наличии';
  if (String(stock).toLowerCase().includes('нет') || quantity <= 0) return 'Нет в наличии';
  if (String(stock).toLowerCase().includes('заказ')) return 'Под заказ';
  return 'В наличии';
}

function isProductUnavailable(product) {
  return stockClass(product) === 'stock-no';
}

function cleanOrderId(id) {
  return `#${String(id || '').replace(/^RP-/, '')}`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat('ru-RU').format(number)} ₽`;
}

function formatDate(value) {
  if (!value || value === '—') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function dateInputValue(value) {
  if (!value || value === '—') return '';
  return String(value).slice(0, 10);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
