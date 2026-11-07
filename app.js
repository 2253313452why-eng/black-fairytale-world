(() => {
  'use strict';
  const data = window.FOREST_CONTENT;
  if (!data) return;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const characters = new Map(data.characters.map(item => [item.id, item]));
  const scenes = new Map(data.scenes.map(item => [item.id, item]));
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name, extra = '') => `<svg aria-hidden="true" ${extra}><use href="#i-${name}"/></svg>`;
  const pageStatus = $('#pageStatus');
  const dialogs = $$('dialog');
  const audio = $('#songAudio');
  const seek = $('#audioSeek');
  let currentCharacter = data.characters[0].id;
  let currentFilter = 'all';
  let isSeeking = false;
  let playAttempt = 0;
  let activeScene = null;

  function announce(text) { pageStatus.textContent = text; }
  function syncDialogState() {
    document.body.classList.toggle('dialog-open', dialogs.some(dialog => dialog.open));
  }
  function openDialog(dialog) {
    dialogs.forEach(other => { if (other !== dialog && other.open) other.close(); });
    if (!dialog.open) dialog.showModal();
    syncDialogState();
    dialog.scrollTop = 0;
    requestAnimationFrame(() => $('[data-close-dialog]', dialog)?.focus({ preventScroll: true }));
  }
  function stopPreview() {
    playAttempt += 1;
    audio.pause();
  }
  dialogs.forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (dialog.id === 'tavernDialog') stopPreview();
      syncDialogState();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });

  function openTavern() {
    openDialog($('#tavernDialog'));
    announce('已进入掉毛酒馆，吧台有第一首歌的黑胶与磁带。');
  }

  function openScene(id) {
    const scene = scenes.get(id);
    if (!scene) return;
    activeScene = id;
    $$('.map-pin').forEach(pin => pin.classList.toggle('active', pin.dataset.scene === id));
    const image = $('#sceneDialogImage');
    image.src = scene.image;
    image.alt = `${scene.name}：${scene.summary}`;
    $('#sceneDialogKicker').textContent = scene.kicker;
    $('#sceneDialogTitle').textContent = scene.name;
    $('#sceneDialogDetail').textContent = scene.detail;
    $('#sceneResidents').innerHTML = scene.residents.map(residentId => {
      const person = characters.get(residentId);
      return person ? `<button class="neighbor-chip" data-character="${person.id}"><img src="${person.image}" alt="" loading="lazy"><span>找${escapeHTML(person.name)}聊聊</span>${icon('arrow')}</button>` : '';
    }).join('');
    $('#sceneTavernButton').hidden = id !== 'street';
    openDialog($('#sceneDialog'));
  }

  function openCharacter(id) {
    const person = characters.get(id);
    if (!person) return;
    currentCharacter = id;
    $('#characterDialogImage').src = person.image;
    $('#characterDialogImage').alt = `${person.name}，${person.role}`;
    $('#characterDialogRole').textContent = person.role;
    $('#characterDialogTitle').textContent = person.name;
    $('#characterDialogQuote').textContent = `“${person.quote}”`;
    $('#characterDialogTags').innerHTML = person.tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    $('#characterDialogIntro').textContent = person.intro;
    $('#characterDialogStory').textContent = person.story;
    const place = scenes.get(person.place);
    const placeButton = $('#characterPlaceButton');
    placeButton.dataset.scene = person.place;
    placeButton.innerHTML = `去${escapeHTML(place?.name || '邻居家')}串门${icon('arrow')}`;
    openDialog($('#characterDialog'));
  }

  // The illustrated atlas keeps its original proportions; markers remain at the same places on small screens.
  $('#mapPins').innerHTML = data.scenes.map((scene, index) => `<button class="map-pin ${scene.id === 'street' ? 'map-pin-tavern' : ''}" data-${scene.id === 'street' ? 'open-tavern' : `scene="${scene.id}"`} style="--x:${scene.map.x}%;--y:${scene.map.y}%" aria-label="${escapeHTML(scene.id === 'street' ? '进入掉毛酒馆，翻看唱片与磁带' : `去${scene.name}串门`)}"><span class="dot"><span class="pin-num">${index + 1}</span></span><span class="pin-label">${escapeHTML(scene.name)}${icon('arrow')}</span></button>`).join('');
  $('#destinationList').innerHTML = data.scenes.map((scene, index) => `<button class="destination-card" data-scene="${scene.id}"><span class="destination-number">0${index + 1}</span><span>${escapeHTML(scene.name)}<small>${escapeHTML(scene.kicker)}</small></span>${icon('arrow')}</button>`).join('');

  const rail = $('#residentsRail');
  function renderResidents(filter = 'all') {
    currentFilter = filter;
    const visible = data.characters.filter(person => filter === 'all' || person.group === filter);
    rail.innerHTML = visible.map(person => {
      const number = data.characters.indexOf(person) + 1;
      return `<button class="resident-card" data-character="${person.id}" aria-label="认识${escapeHTML(person.name)}，${escapeHTML(person.role)}"><span class="portrait-frame"><img src="${person.image}" alt="${escapeHTML(person.name)}的${escapeHTML(person.role)}造型" width="960" height="1440" loading="lazy"><span class="quote">“${escapeHTML(person.quote)}”</span></span><span class="resident-caption"><span class="number">${String(number).padStart(2, '0')}</span><h3>${escapeHTML(person.name)}</h3><p class="role">${escapeHTML(person.role)}</p><span class="card-arrow">${icon('arrow')}</span></span></button>`;
    }).join('');
    rail.scrollLeft = 0;
    $$('[data-filter]').forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#residentCount').textContent = filter === 'band' ? '四位乐队成员，白天也各有各的事。' : filter === 'neighbors' ? '八组隔壁邻居，随时可能串门。' : '十二组街坊，各有各的算盘。';
    requestAnimationFrame(updateRailControls);
  }
  function updateRailControls() {
    const remaining = rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
    $('#railPrev').disabled = rail.scrollLeft < 4;
    $('#railNext').disabled = remaining < 4;
  }
  function moveRail(direction) {
    const card = $('.resident-card', rail);
    const distance = card ? card.getBoundingClientRect().width + 24 : 290;
    rail.scrollBy({ left: direction * distance, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  $('#railPrev').addEventListener('click', () => moveRail(-1));
  $('#railNext').addEventListener('click', () => moveRail(1));
  rail.addEventListener('scroll', updateRailControls, { passive: true });
  window.addEventListener('resize', updateRailControls, { passive: true });
  $('#nextCharacterButton').addEventListener('click', () => {
    const visible = data.characters.filter(person => currentFilter === 'all' || person.group === currentFilter);
    const pool = visible.some(person => person.id === currentCharacter) ? visible : data.characters;
    const index = pool.findIndex(person => person.id === currentCharacter);
    openCharacter(pool[(index + 1) % pool.length].id);
  });

  const rumorPictures = ['assets/s04-pumpkin-crossroad-v03.jpg', 'assets/c09-cinderella-driver-v04.jpg', 'assets/s05-castle-heights-v03.jpg'];
  $('#rumorGrid').innerHTML = data.stories.map((story, index) => `<article class="rumor-card reveal"><div class="rumor-image"><img src="${rumorPictures[index]}" alt="${escapeHTML(story.title)}的故事场景" loading="lazy"><span class="rumor-number">传闻 · 0${index + 1}</span></div><div class="paper-body"><span class="rumor-tag">${escapeHTML(story.tag)}</span><h3>${escapeHTML(story.title)}</h3><p>${escapeHTML(story.body)}</p><button class="text-link" data-character="${escapeHTML(story.residentIds[0])}">去找当事人${icon('arrow')}</button></div></article>`).join('');
  $('#worldRules').innerHTML = data.rules.map((rule, index) => `<div class="rule-item"><span class="rule-number">${['壹', '贰', '叁', '肆'][index]}</span><div><h3>${escapeHTML(rule.title)}</h3><p>${escapeHTML(rule.body)}</p></div></div>`).join('');

  document.addEventListener('click', event => {
    const button = event.target.closest('button, a');
    if (!button) return;
    if (button.matches('[data-close-dialog]')) button.closest('dialog')?.close();
    else if (button.matches('[data-open-tavern]')) openTavern();
    else if (button.dataset.character) openCharacter(button.dataset.character);
    else if (button.dataset.scene) openScene(button.dataset.scene);
    else if (button.dataset.filter) renderResidents(button.dataset.filter);
    else if (button.dataset.format) {
      const format = button.dataset.format;
      $('#recordShelf').dataset.format = format;
      $$('[data-format].format-tabs button, .format-tabs [data-format]').forEach(tab => {
        const selected = tab.dataset.format === format;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-pressed', String(selected));
      });
      announce(format === 'vinyl' ? '已翻到黑胶架，首张唱片是做人别忘本，狼也别忘形。' : '已打开磁带盒，可以试听或进入同一首歌曲的完整页面。');
    }
    if (button.matches('a[href^="#"]')) closeMenu();
  });
  $('#openWorldPoster').addEventListener('click', () => openDialog($('#posterDialog')));

  // One actual audio source, shared by the record preview and its small transport controls.
  const formatTime = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  function syncAudio() {
    const playing = !audio.paused && !audio.ended;
    $('#audioPlayButton').innerHTML = icon(playing ? 'pause' : 'play');
    $('#audioPlayButton').setAttribute('aria-label', playing ? '暂停试听' : '播放试听');
    $('#previewSong').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? '暂停试听' : audio.currentTime > 0 ? '接着试听' : '先试听一段'}</span>`;
    $('#recordShelf').classList.toggle('is-playing', playing);
    $('#tavernDialog').classList.toggle('has-audio', playing);
    $('#audioCurrent').textContent = formatTime(audio.currentTime);
    $('#audioDuration').textContent = formatTime(audio.duration);
    seek.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
    if (Number.isFinite(audio.duration)) seek.max = audio.duration;
    if (!isSeeking) seek.value = audio.currentTime || 0;
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)}，共${formatTime(audio.duration)}`);
  }
  async function toggleAudio() {
    $('#audioPreview').hidden = false;
    requestAnimationFrame(() => $('#audioPreview').scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    $('#audioStatus').textContent = '';
    if (!audio.paused) { audio.pause(); return; }
    if (audio.ended) audio.currentTime = 0;
    const attempt = ++playAttempt;
    try {
      await audio.play();
      if (attempt !== playAttempt || !$('#tavernDialog').open) audio.pause();
    } catch (error) {
      if (error.name !== 'AbortError') $('#audioStatus').textContent = '这张唱片暂时没转起来，再点一次试试，也可以进入完整歌曲页。';
    }
  }
  $('#previewSong').addEventListener('click', toggleAudio);
  $('#audioPlayButton').addEventListener('click', toggleAudio);
  ['play', 'pause', 'loadedmetadata', 'durationchange', 'timeupdate', 'ended', 'emptied'].forEach(name => audio.addEventListener(name, syncAudio));
  audio.addEventListener('error', () => { $('#audioStatus').textContent = '音频暂时没有载入，请重试或进入完整歌曲页。'; syncAudio(); });
  seek.addEventListener('input', () => {
    isSeeking = true;
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(seek.value);
      $('#audioCurrent').textContent = formatTime(audio.currentTime);
      seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)}，共${formatTime(audio.duration)}`);
    }
  });
  ['change', 'pointerup', 'keyup'].forEach(name => seek.addEventListener(name, () => { isSeeking = false; syncAudio(); }));
  $('#audioMuteButton').addEventListener('click', () => {
    audio.muted = !audio.muted;
    $('#audioMuteButton').classList.toggle('muted', audio.muted);
    $('#audioMuteButton').setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
    $('#audioMuteButton').setAttribute('aria-pressed', String(audio.muted));
  });
  window.addEventListener('pagehide', stopPreview);
  syncAudio();

  // Navigation, quiet entrance animation, and focus stay usable with reduced motion enabled.
  const header = $('#siteHeader');
  function closeMenu() {
    header.classList.remove('menu-open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    $('#menuToggle').setAttribute('aria-label', '打开导航');
  }
  $('#menuToggle').addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', open ? '收起导航' : '打开导航');
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
  renderResidents();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.06 });
    $$('.reveal').forEach(item => observer.observe(item));
  } else $$('.reveal').forEach(item => item.classList.add('is-visible'));
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) $$('.main-nav a').forEach(link => link.classList.toggle('current', link.hash === `#${entry.target.id}`));
    }), { rootMargin: '-20% 0px -55% 0px' });
    ['forest', 'residents', 'tavern', 'rumors'].forEach(id => navObserver.observe(document.getElementById(id)));
  }
})();
