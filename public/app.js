const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { user: null, search: {}, hotels: [], selectedHotel: null, authMode: 'login', featuredOnly: true };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  $('#toast-region').append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function setLoading(container, message = 'Loading…') {
  container.innerHTML = `<div class="state-card"><span class="spinner"></span><p>${escapeHtml(message)}</p></div>`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function nextIsoDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function setDefaultDates() {
  const today = new Date();
  const localIso = (date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  };
  const checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 3);
  const form = $('#search-form');
  form.elements.checkIn.value = localIso(checkIn);
  form.elements.checkOut.value = localIso(checkOut);
  form.elements.checkIn.min = localIso(today);
  form.elements.checkOut.min = localIso(checkIn);
}

function collectSearch() {
  const form = $('#search-form');
  const data = new FormData(form);
  return {
    destination: String(data.get('destination') || '').trim(),
    checkIn: String(data.get('checkIn')),
    checkOut: String(data.get('checkOut')),
    guests: String(data.get('guests') || '2')
  };
}

function hotelQuery(extra = {}) {
  const query = new URLSearchParams();
  if (state.search.destination) query.set('destination', state.search.destination);
  if (state.search.checkIn) query.set('checkIn', state.search.checkIn);
  if (state.search.checkOut) query.set('checkOut', state.search.checkOut);
  if (state.search.guests) query.set('guests', state.search.guests);
  if (state.featuredOnly) query.set('featuredOnly', 'true');
  const maxPrice = $('#max-price').value;
  const minRating = $('#min-rating').value;
  if (maxPrice) query.set('maxPrice', maxPrice);
  if (minRating) query.set('minRating', minRating);
  Object.entries(extra).forEach(([key, value]) => query.set(key, value));
  return query.toString();
}

async function loadHotels() {
  const grid = $('#hotel-grid');
  setLoading(grid, 'Finding your next favourite place…');
  try {
    const { hotels } = await api(`/hotels?${hotelQuery()}`);
    state.hotels = hotels;
    renderHotels();
    $('#results-title').textContent = state.search.destination ? `Stays in ${state.search.destination}` : 'Places to fall for';
  } catch (error) {
    grid.innerHTML = `<div class="state-card"><p>${escapeHtml(error.message)}</p><button class="button button-dark" id="retry-hotels">Try again</button></div>`;
    $('#retry-hotels')?.addEventListener('click', loadHotels);
  }
}

function renderHotels() {
  const grid = $('#hotel-grid');
  if (!state.hotels.length) {
    grid.innerHTML = '<div class="state-card"><p>No stays match those dates and filters. Try another destination or clear your search.</p><button class="button button-dark clear-search-results" type="button">Clear search</button></div>';
    $('.clear-search-results', grid).addEventListener('click', clearSearch);
    return;
  }
  grid.innerHTML = state.hotels.map((hotel) => `
    <article class="hotel-card" data-hotel="${escapeHtml(hotel._id)}">
      <div class="hotel-photo-wrap">
        <img class="hotel-photo" src="${escapeHtml(hotel.image)}" alt="${escapeHtml(hotel.name)}" loading="lazy">
        ${hotel.featured ? '<span class="photo-tag">StayEase pick</span>' : ''}
        <span class="rating">★ ${Number(hotel.rating).toFixed(1)}</span>
      </div>
      <div class="hotel-info">
        <div>
          <div class="hotel-location">${escapeHtml(hotel.location)}, ${escapeHtml(hotel.country)}</div>
          <h3 class="hotel-name">${escapeHtml(hotel.name)}</h3>
          <div class="hotel-amenities">${(hotel.amenities || []).slice(0, 3).map((amenity) => `<span>${escapeHtml(amenity)}</span>`).join('')}</div>
          <button class="button button-dark hotel-card-action" type="button">View details / select room</button>
        </div>
        <div class="hotel-price">${formatMoney(hotel.startingPrice)}<small>per night</small></div>
      </div>
    </article>`).join('');
  $$('.hotel-card', grid).forEach((card) => {
    card.addEventListener('click', () => openHotel(card.dataset.hotel));
    $('.hotel-card-action', card).addEventListener('click', (event) => {
      event.stopPropagation();
      openHotel(card.dataset.hotel);
    });
  });
}

async function openHotel(hotelId) {
  const content = $('#detail-content');
  setLoading(content, 'Opening this stay…');
  $('#detail-dialog').showModal();
  try {
    const params = new URLSearchParams();
    if (state.search.checkIn) params.set('checkIn', state.search.checkIn);
    if (state.search.checkOut) params.set('checkOut', state.search.checkOut);
    if (state.search.guests) params.set('guests', state.search.guests);
    const { hotel, rooms } = await api(`/hotels/${encodeURIComponent(hotelId)}?${params}`);
    state.selectedHotel = hotel;
    const roomCards = rooms.map((room) => {
      const nights = state.search.checkIn && state.search.checkOut
        ? Math.max(1, Math.round((new Date(`${state.search.checkOut}T00:00:00Z`) - new Date(`${state.search.checkIn}T00:00:00Z`)) / 86400000))
        : 1;
      return `<article class="room-card">
        <div><h4>${escapeHtml(room.name)}</h4><p>${escapeHtml(room.description || `${room.capacity} guest capacity`)} · Sleeps ${room.capacity}</p><p>${(room.amenities || []).map(escapeHtml).join(' · ')}</p></div>
        <div class="room-price">${formatMoney(room.pricePerNight)}<small>per night · ${room.quantity} room${room.quantity === 1 ? '' : 's'}</small>
          ${room.available ? `<button class="button button-dark reserve-button" data-room="${escapeHtml(room._id)}" data-price="${room.pricePerNight}" data-nights="${nights}">Book this room</button>` : '<span class="text-button">Unavailable</span>'}
        </div>
      </article>`;
    }).join('');
    content.innerHTML = `
      <img class="detail-cover" src="${escapeHtml(hotel.image)}" alt="${escapeHtml(hotel.name)}">
      <div class="detail-body">
        <div class="detail-topline"><div><span class="eyebrow">${escapeHtml(hotel.location)} · ${escapeHtml(hotel.country)}</span><h2 class="detail-title">${escapeHtml(hotel.name)}</h2></div><span class="detail-rating">★ ${Number(hotel.rating).toFixed(1)}</span></div>
        <p class="detail-description">${escapeHtml(hotel.description)}</p>
        <div class="amenity-list">${(hotel.amenities || []).map((amenity) => `<span class="amenity-pill">${escapeHtml(amenity)}</span>`).join('')}</div>
        <h3 class="room-heading">Choose your room</h3>
        ${rooms.length ? roomCards : '<p class="empty-state">No rooms have been added to this stay yet.</p>'}
        <p class="form-message">Free cancellation before check-in. Payment is demo-only; no payment is collected.</p>
      </div>`;
    $$('.reserve-button', content).forEach((button) => button.addEventListener('click', () => reserve(button.dataset.room)));
  } catch (error) {
    content.innerHTML = `<div class="state-card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function reserve(roomId) {
  if (!state.user) {
    $('#detail-dialog').close();
    openAuth('login');
    showToast('Log in or create an account to reserve a room.');
    return;
  }
  const guests = Number(state.search.guests || 2);
  try {
    const { booking } = await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({ roomId, checkIn: state.search.checkIn, checkOut: state.search.checkOut, guests })
    });
    $('#detail-dialog').close();
    showToast(`Your stay at ${booking.hotel.name} is confirmed.`);
    openDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
}

function openAuth(mode = 'login') {
  state.authMode = mode;
  setAuthMode(mode);
  $('#auth-message').textContent = '';
  $('#auth-dialog').showModal();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === 'register';
  $('#name-field').hidden = !registering;
  $('#auth-form').elements.name.required = registering;
  $('#auth-title').textContent = registering ? 'Make yourself at home.' : 'Welcome back.';
  $('#auth-form button[type=submit]').textContent = registering ? 'Create account' : 'Log in';
  $('#auth-form').elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  $$('.auth-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
}

function renderSession() {
  $('#auth-nav').hidden = Boolean(state.user);
  $('#logout-nav').hidden = !state.user;
  $('#dashboard-nav').hidden = !state.user;
  $('#admin-nav').hidden = state.user?.role !== 'admin';
  $('#user-label').textContent = state.user ? `Hello, ${state.user.name.split(' ')[0]}` : '';
}

async function refreshSession() {
  try {
    const { user } = await api('/auth/me');
    state.user = user;
  } catch (error) {
    if (error.status !== 401) console.error('Unable to restore session:', error);
    state.user = null;
  }
  renderSession();
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#auth-message');
  message.textContent = '';
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const { user } = await api(`/auth/${state.authMode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.user = user;
    renderSession();
    $('#auth-dialog').close();
    form.reset();
    showToast(`Welcome${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
    state.user = null;
    renderSession();
    showToast('You have been signed out.');
  } catch (error) {
    showToast(error.message, true);
  }
}

function dateLabel(date) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function openDashboard() {
  $('#dashboard-dialog').showModal();
  const content = $('#dashboard-content');
  setLoading(content, 'Loading your trips…');
  try {
    const { bookings } = await api('/bookings/mine');
    const now = new Date();
    const upcoming = bookings.filter((booking) => booking.status === 'confirmed' && new Date(booking.checkOut) > now);
    const completed = bookings.filter((booking) => booking.status === 'confirmed' && new Date(booking.checkOut) <= now);
    const cancelled = bookings.filter((booking) => booking.status === 'cancelled');
    const renderGroup = (title, items) => `<section class="admin-section"><h3>${title}</h3>${items.length ? `<div class="booking-list">${items.map((booking) => bookingCard(booking, true)).join('')}</div>` : '<p class="empty-state">Nothing here just yet.</p>'}</section>`;
    content.innerHTML = `<span class="eyebrow">Your StayEase account</span><h2>Your trips</h2>${renderGroup('Upcoming stays', upcoming)}${renderGroup('Past stays', completed)}${renderGroup('Cancelled stays', cancelled)}`;
    $$('.cancel-booking', content).forEach((button) => button.addEventListener('click', () => cancelBooking(button.dataset.booking, true)));
  } catch (error) {
    content.innerHTML = `<div class="state-card"><p>${escapeHtml(error.message)}</p><button class="button button-dark" id="retry-dashboard">Try again</button></div>`;
    $('#retry-dashboard').addEventListener('click', openDashboard);
  }
}

function bookingCard(booking, showCancel) {
  const canCancel = showCancel && booking.status === 'confirmed' && new Date(booking.checkIn) > new Date();
  return `<article class="booking-card">
    <div><h3>${escapeHtml(booking.hotel?.name || 'Hotel')}</h3><p>${escapeHtml(booking.hotel?.location || '')} · ${escapeHtml(booking.room?.name || 'Room')}</p>
      <p>${dateLabel(booking.checkIn)} — ${dateLabel(booking.checkOut)} · ${booking.nights} night${booking.nights === 1 ? '' : 's'} · ${booking.guests} guest${booking.guests === 1 ? '' : 's'}</p>
      ${booking.user ? `<p>Guest: ${escapeHtml(booking.user.name)} · ${escapeHtml(booking.user.email)}</p>` : ''}
    </div>
    <div class="booking-actions"><span class="booking-status ${booking.status === 'cancelled' ? 'cancelled' : ''}">${escapeHtml(booking.status)}</span><strong>${formatMoney(booking.totalPrice)}</strong>${canCancel ? `<button class="text-button cancel-booking" data-booking="${escapeHtml(booking._id)}">Cancel booking</button>` : ''}</div>
  </article>`;
}

async function cancelBooking(id, refreshDashboard) {
  if (!window.confirm('Cancel this booking? It can only be cancelled before check-in.')) return;
  try {
    await api(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
    showToast('Booking cancelled. No payment was collected in this demo.');
    if (refreshDashboard) await openDashboard();
    else await openAdmin();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function openAdmin() {
  const content = $('#admin-content');
  $('#admin-dialog').showModal();
  setLoading(content, 'Loading management tools…');
  try {
    const [{ hotels }, { bookings }] = await Promise.all([api('/hotels'), api('/bookings')]);
    if (!hotels.length) {
      content.innerHTML = '<span class="eyebrow">StayEase operations</span><h2>Manage stays</h2><p class="empty-state">Add a hotel first to begin managing rooms.</p>';
      renderAdminForm(content, []);
      return;
    }
    content.innerHTML = `
      <span class="eyebrow">StayEase operations</span><h2>Manage stays</h2>
      <section class="admin-section"><h3>Hotel details</h3>
        <label class="stack-form">Choose a hotel<select id="admin-hotel-select"></select></label>
        <form id="edit-hotel-form" class="admin-form"></form>
        <div id="room-admin-list"></div>
        <form id="add-room-form" class="admin-form"></form>
      </section>
      <section class="admin-section"><h3>Add a hotel</h3><form id="add-hotel-form" class="admin-form"></form></section>
      <section class="admin-section"><h3>Reservations</h3>${bookings.length ? `<div class="booking-list">${bookings.map((booking) => bookingCard(booking, true)).join('')}</div>` : '<p class="empty-state">No reservations yet.</p>'}</section>`;
    const select = $('#admin-hotel-select');
    select.innerHTML = hotels.map((hotel) => `<option value="${escapeHtml(hotel._id)}">${escapeHtml(hotel.name)} · ${escapeHtml(hotel.location)}</option>`).join('');
    renderAdminForm(content, hotels);
    $$('.cancel-booking', content).forEach((button) => button.addEventListener('click', () => cancelBooking(button.dataset.booking, false)));
  } catch (error) {
    content.innerHTML = `<div class="state-card"><p>${escapeHtml(error.message)}</p><button class="button button-dark" id="retry-admin">Try again</button></div>`;
    $('#retry-admin').addEventListener('click', openAdmin);
  }
}

function renderAdminForm(content, hotels) {
  const addHotel = $('#add-hotel-form', content);
  addHotel.innerHTML = `
    <label>Hotel name<input name="name" required minlength="2"></label><label>City / destination<input name="location" required></label>
    <label>Country<input name="country" required></label><label>Image URL<input name="image" type="url" required></label>
    <label>Rating<input name="rating" type="number" min="0" max="5" step=".1" value="4.5"></label><label>Amenities (comma separated)<input name="amenities"></label>
    <label class="span-all">Description<textarea name="description" required minlength="10"></textarea></label>
    <button class="button button-dark" type="submit">Add hotel</button>`;
  addHotel.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    values.rating = Number(values.rating);
    values.amenities = values.amenities.split(',').map((item) => item.trim()).filter(Boolean);
    try {
      await api('/hotels', { method: 'POST', body: JSON.stringify(values) });
      showToast('Hotel added.');
      await openAdmin();
    } catch (error) { showToast(error.message, true); }
  });

  if (!hotels.length) return;
  const select = $('#admin-hotel-select', content);
  const editForm = $('#edit-hotel-form', content);
  const roomList = $('#room-admin-list', content);
  const addRoom = $('#add-room-form', content);
  const drawSelected = async () => {
    const hotel = hotels.find((item) => item._id === select.value);
    if (!hotel) return;
    editForm.innerHTML = `
      <label>Hotel name<input name="name" value="${escapeHtml(hotel.name)}" required></label><label>Location<input name="location" value="${escapeHtml(hotel.location)}" required></label>
      <label>Country<input name="country" value="${escapeHtml(hotel.country)}" required></label><label>Image URL<input name="image" type="url" value="${escapeHtml(hotel.image)}" required></label>
      <label>Rating<input name="rating" type="number" min="0" max="5" step=".1" value="${Number(hotel.rating)}"></label><label>Amenities<input name="amenities" value="${escapeHtml((hotel.amenities || []).join(', '))}"></label>
      <label class="span-all">Description<textarea name="description" required>${escapeHtml(hotel.description)}</textarea></label>
      <button class="button button-dark" type="submit">Save hotel</button><button class="button button-quiet" id="delete-hotel" type="button">Remove hotel</button>`;
    const { rooms } = await api(`/hotels/${encodeURIComponent(hotel._id)}`);
    roomList.innerHTML = `<h3>Rooms &amp; rates</h3>${rooms.map((room) => `<div class="admin-room-row" data-room-row="${escapeHtml(room._id)}"><strong>${escapeHtml(room.name)}</strong><input aria-label="Nightly price" type="number" min="1" value="${room.pricePerNight}"><input aria-label="Room count" type="number" min="1" value="${room.quantity}"><div><button class="text-button save-room" type="button">Save</button> <button class="text-button delete-room" type="button">Remove</button></div></div>`).join('') || '<p class="empty-state">No rooms added yet.</p>'}`;
    addRoom.innerHTML = `<label>Room name<input name="name" required></label><label>Capacity<input name="capacity" type="number" min="1" max="20" value="2" required></label><label>Price per night ($)<input name="pricePerNight" type="number" min="1" step="0.01" required></label><label>Quantity<input name="quantity" type="number" min="1" value="1" required></label><label class="span-all">Description<input name="description"></label><label class="span-all">Amenities (comma separated)<input name="amenities"></label><button class="button button-dark" type="submit">Add room</button>`;

    editForm.onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(editForm).entries());
      values.rating = Number(values.rating);
      values.amenities = values.amenities.split(',').map((item) => item.trim()).filter(Boolean);
      try {
        await api(`/hotels/${encodeURIComponent(hotel._id)}`, { method: 'PATCH', body: JSON.stringify(values) });
        showToast('Hotel details saved.');
        await openAdmin();
      } catch (error) { showToast(error.message, true); }
    };
    $('#delete-hotel', editForm).onclick = async () => {
      if (!window.confirm(`Remove ${hotel.name}?`)) return;
      try {
        await api(`/hotels/${encodeURIComponent(hotel._id)}`, { method: 'DELETE' });
        showToast('Hotel removed.');
        await openAdmin();
      } catch (error) { showToast(error.message, true); }
    };
    $$('.save-room', roomList).forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-room-row]');
      const [pricePerNight, quantity] = $$('input', row).map((input) => Number(input.value));
      try {
        await api(`/rooms/${encodeURIComponent(row.dataset.roomRow)}`, { method: 'PATCH', body: JSON.stringify({ pricePerNight, quantity }) });
        showToast('Room rates and inventory saved.');
      } catch (error) { showToast(error.message, true); }
    }));
    $$('.delete-room', roomList).forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-room-row]');
      if (!window.confirm('Remove this room?')) return;
      try {
        await api(`/rooms/${encodeURIComponent(row.dataset.roomRow)}`, { method: 'DELETE' });
        showToast('Room removed.');
        await drawSelected();
      } catch (error) { showToast(error.message, true); }
    }));
    addRoom.onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(addRoom).entries());
      ['capacity', 'pricePerNight', 'quantity'].forEach((field) => { values[field] = Number(values[field]); });
      values.amenities = values.amenities.split(',').map((item) => item.trim()).filter(Boolean);
      try {
        await api(`/hotels/${encodeURIComponent(hotel._id)}/rooms`, { method: 'POST', body: JSON.stringify(values) });
        showToast('Room added.');
        await drawSelected();
      } catch (error) { showToast(error.message, true); }
    };
  };
  select.addEventListener('change', () => drawSelected().catch((error) => showToast(error.message, true)));
  drawSelected().catch((error) => showToast(error.message, true));
}

$('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const search = collectSearch();
  if (search.checkOut <= search.checkIn) {
    showToast('Check-out must be after check-in.', true);
    return;
  }
  state.search = search;
  state.featuredOnly = false;
  loadHotels();
  $('#stays').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#search-form').elements.checkIn.addEventListener('change', (event) => {
  const checkOut = $('#search-form').elements.checkOut;
  checkOut.min = event.target.value;
  if (checkOut.value <= event.target.value) {
    checkOut.value = nextIsoDate(event.target.value);
  }
});
$('#max-price').addEventListener('change', loadHotels);
$('#min-rating').addEventListener('change', loadHotels);
$('#clear-search').addEventListener('click', clearSearch);
$('#auth-nav').addEventListener('click', () => openAuth('login'));
$('#logout-nav').addEventListener('click', logout);
$('#dashboard-nav').addEventListener('click', openDashboard);
$('#admin-nav').addEventListener('click', openAdmin);
$('#auth-form').addEventListener('submit', submitAuth);
$$('.auth-tabs button').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.mode)));

setDefaultDates();
state.search = collectSearch();
refreshSession().finally(loadHotels);

function clearSearch() {
  $('#search-form').reset();
  $('#max-price').value = '';
  $('#min-rating').value = '';
  setDefaultDates();
  state.search = collectSearch();
  state.featuredOnly = true;
  loadHotels();
}
