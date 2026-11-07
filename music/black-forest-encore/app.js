(() => {
  'use strict';

  const audio = document.getElementById('band-audio');
  const seek = document.getElementById('audio-seek');
  const currentTime = document.getElementById('audio-current');
  const totalTime = document.getElementById('audio-duration');
  const status = document.getElementById('audio-status');
  const volume = document.getElementById('audio-volume');
  const mute = document.getElementById('audio-mute');
  const announcement = document.getElementById('player-announcement');
  const audioButtons = [...document.querySelectorAll('.audio-toggle')];
  let duration = 47.8302;
  let pendingPlay = false;
  let wantsPlayback = false;
  let previousVolume = 0.8;

  const timeLabel = (seconds) => {
    const value = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };

  function setStatus(message, announce = false) {
    status.textContent = message;
    if (announce) announcement.textContent = message;
  }

  function updateTransport() {
    const playing = !audio.paused && !audio.ended;
    document.body.classList.toggle('is-playing', playing);
    audioButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? '暂停当前单曲' : audio.ended ? '再次播放当前单曲' : '播放当前单曲');
    });
    document.querySelectorAll('.play-label').forEach((label) => {
      label.textContent = playing ? '暂停，留个心眼儿' : audio.ended ? '再来一遍' : '听听他们怎么唱';
    });
    document.querySelectorAll('.inline-play-label').forEach((label) => {
      label.textContent = playing ? '暂停播放' : audio.ended ? '再来一遍' : '播放这首';
    });
    const headerLabel = document.querySelector('.header-listen > span:nth-child(2)');
    if (headerLabel) headerLabel.textContent = playing ? '唱着呢' : '开场了';
  }

  function updateProgress() {
    const seconds = audio.currentTime || 0;
    currentTime.textContent = timeLabel(seconds);
    totalTime.textContent = timeLabel(duration);
    const progress = Math.max(0, Math.min(1000, duration ? seconds / duration * 1000 : 0));
    seek.value = String(progress);
    seek.style.setProperty('--progress', `${progress / 10}%`);
    seek.setAttribute('aria-valuetext', `${timeLabel(seconds)}，共 ${timeLabel(duration)}`);
  }

  async function toggleAudio() {
    if (!audio.paused || pendingPlay) {
      wantsPlayback = false;
      audio.pause();
      pendingPlay = false;
      setStatus('暂停了，算盘还没停。');
      updateTransport();
      return;
    }
    wantsPlayback = true;
    pendingPlay = true;
    if (audio.error) audio.load();
    if (audio.ended || audio.currentTime >= duration - 0.05) audio.currentTime = 0;
    setStatus('乐队就位中……');
    try {
      await audio.play();
      if (!wantsPlayback) audio.pause();
    } catch (error) {
      if (error.name !== 'AbortError' && wantsPlayback) {
        setStatus('这段没响起来，点一下重试。', true);
      }
    } finally {
      pendingPlay = false;
      updateTransport();
    }
  }

  audio.volume = 0.8;
  audioButtons.forEach((button) => button.addEventListener('click', toggleAudio));
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
    updateProgress();
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
    updateProgress();
  });
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('play', () => {
    updateTransport();
    setStatus('这就唱上了。', true);
  });
  audio.addEventListener('playing', () => setStatus('这就唱上了。'));
  audio.addEventListener('waiting', () => {
    if (wantsPlayback) setStatus('乐队就位中……');
  });
  audio.addEventListener('pause', () => {
    updateTransport();
    if (!audio.ended && !audio.error) setStatus('暂停了，算盘还没停。');
  });
  audio.addEventListener('ended', () => {
    wantsPlayback = false;
    updateTransport();
    updateProgress();
    setStatus('还没听够？再来一遍。', true);
  });
  audio.addEventListener('error', () => {
    pendingPlay = false;
    wantsPlayback = false;
    updateTransport();
    setStatus('这段没响起来，点一下重试。', true);
  });
  seek.addEventListener('input', () => {
    const seconds = Number(seek.value) / 1000 * duration;
    if (audio.readyState > 0) audio.currentTime = seconds;
    currentTime.textContent = timeLabel(seconds);
    seek.style.setProperty('--progress', `${Number(seek.value) / 10}%`);
    seek.setAttribute('aria-valuetext', `${timeLabel(seconds)}，共 ${timeLabel(duration)}`);
  });

  function updateVolume() {
    const muted = audio.muted || audio.volume === 0;
    mute.classList.toggle('is-muted', muted);
    mute.setAttribute('aria-label', muted ? '取消静音' : '静音');
    mute.setAttribute('aria-pressed', String(muted));
    volume.value = muted ? '0' : String(audio.volume);
    volume.setAttribute('aria-valuetext', `${muted ? 0 : Math.round(audio.volume * 100)}%`);
  }
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    audio.muted = audio.volume === 0;
    if (audio.volume > 0) previousVolume = audio.volume;
    updateVolume();
  });
  mute.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = previousVolume || 0.8;
    } else {
      previousVolume = audio.volume;
      audio.muted = true;
    }
    updateVolume();
  });
  audio.addEventListener('volumechange', updateVolume);
  updateVolume();
  updateTransport();
  updateProgress();

  const header = document.getElementById('site-header');
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  function closeMenu() {
    header.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.querySelector('.sr-only').textContent = '打开导航';
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.querySelector('.sr-only').textContent = isOpen ? '关闭导航' : '打开导航';
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      closeMenu();
      menuToggle.focus();
    }
  });

  const verses = {
    wolf: {
      label: '狼的算盘',
      lines: ['表面心连心，特么背后玩儿脑筋', '水有源，树有根，特么看不透人心呐', '花帽一戴 就是亲，骗你进门儿呐', '茶一斟，门一关，特么今晚开昏呐'],
      aside: '外婆还躺在床上，窗外那位已经把晚饭安排好了。'
    },
    red: {
      label: '红帽的算盘',
      lines: ['俩眼儿一瞧，你又在打算盘', '今日量量腰和肩，不知明日穿不穿', '狼最悲哀就是皮毛让人穿', '你扮外婆笑得欢，我拿你当披肩呐'],
      aside: '墙上挂着左轮、弹药和狼皮衣，红帽正给新披肩留位置。'
    }
  };
  function setStory(key, focusTab = false) {
    if (!verses[key]) return;
    const verse = verses[key];
    document.querySelectorAll('[data-story]').forEach((button) => {
      const selected = button.dataset.story === key;
      if (button.getAttribute('role') === 'tab') {
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (focusTab && selected) button.focus();
      } else {
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
    });
    document.getElementById('story-panel').setAttribute('aria-labelledby', `tab-${key}`);
    document.getElementById('story-view-label').textContent = verse.label;
    const lyrics = document.getElementById('story-lyrics');
    lyrics.replaceChildren();
    verse.lines.forEach((line, index) => {
      if (index) lyrics.append(document.createElement('br'));
      lyrics.append(document.createTextNode(line));
    });
    document.getElementById('story-aside').textContent = verse.aside;
  }
  document.querySelectorAll('[data-story]').forEach((button) => {
    button.addEventListener('click', () => setStory(button.dataset.story));
    if (button.getAttribute('role') === 'tab') {
      button.addEventListener('keydown', (event) => {
        let next;
        if (['ArrowRight', 'ArrowLeft'].includes(event.key)) next = button.dataset.story === 'wolf' ? 'red' : 'wolf';
        if (event.key === 'Home') next = 'wolf';
        if (event.key === 'End') next = 'red';
        if (next) {
          event.preventDefault();
          setStory(next, true);
        }
      });
    }
  });
  setStory('wolf');

  const dialog = document.getElementById('content-dialog');
  const dialogBody = document.getElementById('dialog-body');
  let dialogTrigger = null;
  let previousOverflow = '';
  const members = {
    red: {name:'小红帽', nickname:'红帽儿', role:'主唱 · 裁缝铺老板', line:'嘴上喊狼哥，心里量肩宽。', detail:'甜声是她的门面，彪悍是她的本事。花袄穿上，枪套收好；这回看上的，是一件还没做完的狼皮披肩。', image:'assets/red-character.jpg'},
    rabbit: {name:'白兔', nickname:'兔不齐', role:'吉他手 · 蓝黄机车花袄', line:'耳朵前后站，刘海有点乱，吉他可没乱。', detail:'一前一后的兔耳，配上蓝黄花棉袄。别人忙着试探，他先把弦拨响；台上的热闹，得有人接得住。', image:'assets/rabbit-character.jpg'},
    wolf: {name:'大灰狼', nickname:'狼姥姥', role:'鼓手 · 沧桑男声', line:'戴上外婆帽，打鼓也不耽误惦记晚饭。', detail:'一张哈士奇似的脸，一顶借来的外婆帽。话说得客气，鼓打得响；他以为披上这身，就没人看得出肚子里的打算。', image:'assets/wolf-character.jpg'},
    frog: {name:'青蛙王子', nickname:'蛙小王', role:'贝斯手 · 歪冠小王', line:'王冠戴歪了，低音一直稳着。', detail:'圆眼绿脸，黑棉坎肩，荷花长褂。个头不大，低音不轻；至于王冠为什么总是歪着，他觉得这样挺好。', image:'assets/frog-character.jpg'}
  };
  const posters = {
    red:{name:'小红帽', image:'assets/red-poster.jpg', download:'assets/red-poster-original.png', filename:'黑森林不散场_小红帽海报.png'},
    wolf:{name:'大灰狼', image:'assets/wolf-poster.jpg', download:'assets/wolf-poster-original.png', filename:'黑森林不散场_大灰狼海报.png'}
  };

  function openDialog(content, trigger) {
    dialogBody.replaceChildren(content);
    dialogTrigger = trigger || document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('.dialog-close').focus();
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function openLyrics(trigger) {
    const content = element('div', 'lyrics-modal');
    content.append(element('p', 'eyebrow', '首支单曲 / 完整歌词'));
    const title = element('h2', '', '做人别忘本 · 狼也别忘形');
    title.id = 'dialog-title';
    content.append(title);
    const voices = element('div', 'lyric-voices');
    Object.values(verses).forEach((verse) => {
      const voice = element('section', 'lyric-voice');
      voice.append(element('span', '', verse.label), element('p', '', verse.lines.join('\n')));
      voices.append(voice);
    });
    content.append(voices, element('p', 'modal-note', '好话照说，小算盘照打。'));
    openDialog(content, trigger);
  }
  function openPoster(key, trigger) {
    const poster = posters[key];
    if (!poster) return;
    const content = element('div', 'poster-modal');
    const img = element('img');
    img.src = poster.image;
    img.alt = `${poster.name}的完整单曲海报`;
    const footer = element('div', 'poster-modal-footer');
    const title = element('h2', '', `${poster.name} · 单曲海报`);
    title.id = 'dialog-title';
    const download = element('a', 'download-button', '保存海报 ↓');
    download.href = poster.download;
    download.download = poster.filename;
    footer.append(title, download);
    content.append(img, footer);
    openDialog(content, trigger);
  }
  function openMember(key, trigger) {
    const member = members[key];
    if (!member) return;
    const content = element('div', 'character-modal');
    const heading = element('div', 'character-modal-heading');
    const name = element('div');
    const title = element('h2', '', member.name);
    title.id = 'dialog-title';
    name.append(element('p', 'eyebrow', `${member.role} / 绰号：${member.nickname}`), title);
    const description = element('div', 'character-modal-description');
    description.append(element('p', '', member.line), element('p', '', member.detail));
    heading.append(name, description);
    const img = element('img', 'character-sheet');
    img.src = member.image;
    img.alt = `${member.name}的完整人物三视图`;
    content.append(heading, img, element('p', 'modal-note', '前后左右都看过，下回进林子就认得了。'));
    openDialog(content, trigger);
  }
  document.querySelectorAll('[data-open="lyrics"]').forEach((button) => button.addEventListener('click', () => openLyrics(button)));
  document.querySelectorAll('[data-poster]').forEach((button) => button.addEventListener('click', () => openPoster(button.dataset.poster, button)));
  document.querySelectorAll('[data-member]').forEach((button) => button.addEventListener('click', () => openMember(button.dataset.member, button)));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    if (dialogTrigger && document.contains(dialogTrigger)) dialogTrigger.focus();
    dialogBody.replaceChildren();
  });
})();
