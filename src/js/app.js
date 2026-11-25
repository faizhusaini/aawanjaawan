(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const iso = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const cityCodes = { Lucknow: 'LKO', Hyderabad: 'HYD' };
  const isLucknowRoute = (route) => route === 'lko' || route === 'hyd';
  const routes = {
    lko: ['Lucknow', 'Hyderabad'],
    hyd: ['Hyderabad', 'Lucknow'],
    'aligarh-hyd': ['Aligarh', 'Hyderabad'],
    'hyd-aligarh': ['Hyderabad', 'Aligarh'],
    'delhi-hyd': ['Delhi', 'Hyderabad'],
    'hyd-delhi': ['Hyderabad', 'Delhi'],
    'allahabad-hyd': ['Allahabad', 'Hyderabad'],
    'hyd-allahabad': ['Hyderabad', 'Allahabad'],
    'gorakhpur-hyd': ['Gorakhpur', 'Hyderabad'],
    'hyd-gorakhpur': ['Hyderabad', 'Gorakhpur'],
  };
  const examples = [
    {
      id: 'ex1',
      type: 'trip',
      name: 'Ayesha Khan',
      route: 'lko',
      date: iso(2),
      mode: 'Flight',
      help: 'A small parcel',
      note: 'Heading back to Hyderabad this weekend. Happy to carry a small parcel or some ghar ka khaana! 😊',
      color: '#e1cbbb',
    },
    {
      id: 'ex2',
      type: 'request',
      name: 'Saif Rahman',
      route: 'hyd',
      date: iso(4),
      mode: 'Not decided',
      help: 'A small parcel',
      note: 'Anyone going to Lucknow soon? Need to send a small package to my parents. Would really appreciate it.',
      color: '#d1d9c4',
    },
    {
      id: 'ex3',
      type: 'trip',
      name: 'Faraz Ahmed',
      route: 'hyd',
      date: iso(5),
      mode: 'Train',
      help: 'Travel company',
      note: 'Travelling by Gorakhpur Express. Would be lovely to have some company for the journey home.',
      color: '#e4d9bf',
    },
    {
      id: 'ex4',
      type: 'request',
      name: 'Nida Siddiqui',
      route: 'lko',
      date: iso(7),
      mode: 'Not decided',
      help: 'Travel company',
      note: 'My mother is travelling to Hyderabad. Looking for someone on the same route to help her along the way.',
      color: '#d7d7ca',
    },
    {
      id: 'ex5',
      type: 'trip',
      name: 'Zaid Ali',
      route: 'lko',
      date: iso(9),
      mode: 'Flight',
      help: 'Anything I can',
      note: 'Lucknow to Hyderabad, evening flight. Have a little room in my bag if anyone needs something brought over.',
      color: '#cbd8d3',
    },
    {
      id: 'ex6',
      type: 'trip',
      name: 'Sana Mirza',
      route: 'hyd',
      date: iso(12),
      mode: 'Flight',
      help: 'A small parcel',
      note: 'A quick visit home! Happy to take a small parcel for your family. Just reach out a day before.',
      color: '#e9d3c6',
    },
  ];
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };
  let own = read('aj-posts', []);
  if (!Array.isArray(own)) own = [];
  let saved = read('aj-saved', []);
  if (!Array.isArray(saved)) saved = [];
  const sheetsMode =
    typeof google !== 'undefined' && google.script && google.script.run;
  // HTTP(S) always uses shared storage, including our custom domain and workers.dev.
  // Only opening index.html as a local file uses the demo.
  const localApiMode = !sheetsMode && location.protocol !== 'file:';
  let tab = 'all',
    savedOnly = false,
    createType = 'trip',
    shared = !!sheetsMode || localApiMode;
  let community = shared ? [] : examples;
  let postRevision = 0,
    submitting = false;
  const sheetsCall = (method, data) =>
    new Promise((resolve, reject) => {
      const runner = google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject);
      if (method === 'listPosts') runner.listPosts();
      else runner.createPost(data);
    });
  async function postsRequest(options) {
    const response = await fetch('/api/posts', options);
    let data;
    try {
      data = await response.json();
    } catch {
      const host = location.hostname;
      if (
        ['localhost', '127.0.0.1', '[::1]'].includes(host) ||
        host.endsWith('.localhost')
      ) {
        throw new Error(
          'The local posts API returned an unexpected response. Run npm run dev and open the URL printed by Wrangler.',
        );
      }
      throw new Error(
        'The community board returned an unexpected response. Check the board before retrying a post.',
      );
    }
    if (!response.ok)
      throw new Error(data?.error || 'Unable to connect to the community board.');
    return data;
  }
  const allPosts = () => (shared ? community : [...examples, ...own]);
  const persist = () => {
    try {
      localStorage.setItem('aj-posts', JSON.stringify(own));
      localStorage.setItem('aj-saved', JSON.stringify(saved));
    } catch {
      toast('Storage is unavailable. Posts will remain for this visit.');
    }
  };
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  let timer;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(timer);
    timer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
  }
  const highlightDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  let highlightedTrip = '';
  let rotationPaused =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  function renderHighlights(advance = false) {
    const today = iso(0);
    const trips = allPosts()
      .filter(
        (p) =>
          p.type === 'trip' &&
          p.date >= today &&
          !p.id.startsWith('ex') &&
          Object.hasOwn(routes, p.route),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    $('#trip-carousel').hidden = !trips.length;
    $('#trip-carousel-controls').hidden = trips.length < 2;
    if (!trips.length) {
      highlightedTrip = '';
      $('#trip-highlight').textContent = '';
      return;
    }
    const current = trips.findIndex((p) => p.id === highlightedTrip);
    const index = current < 0 ? 0 : (current + Number(advance)) % trips.length;
    const trip = trips[index];
    highlightedTrip = trip.id;
    const [from, to] = routes[trip.route];
    const date = highlightDate.format(new Date(trip.date + 'T00:00:00'));
    const highlight = $('#trip-highlight');
    const message = `${trip.name} is going from ${from} to ${to} on ${date}.`;
    if (highlight.textContent !== message) highlight.textContent = message;
  }

  function render() {
    renderHighlights();
    let items = allPosts();
    $('#all-count').textContent = items.length;
    $('#saved-count').textContent = saved.filter((id) =>
      items.some((p) => p.id === id),
    ).length;
    const route = $('#route').value;
    items = items.filter(
      (p) =>
        (tab === 'all' || p.type === tab) &&
        (!savedOnly || saved.includes(p.id)) &&
        (route === 'all' ||
          p.route === route ||
          (route === 'lucknow' && isLucknowRoute(p.route))),
    );
    const days = $('#dates').value;
    if (days !== 'all')
      items = items.filter(
        (p) => p.date >= iso(0) && p.date <= iso(Number(days)),
      );
    const query = $('#search').value.trim().toLowerCase();
    if (query)
      items = items.filter((p) =>
        [
          p.name,
          p.note,
          p.help,
          p.mode,
          routes[p.route]?.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    items.sort(
      $('#sort').value === 'soon'
        ? (a, b) => a.date.localeCompare(b.date)
        : (a, b) => (b.created || 0) - (a.created || 0),
    );
    $('#result-count').textContent =
      `${items.length} ${savedOnly ? 'saved ' : ''}${tab === 'all' ? 'posts' : tab === 'trip' ? 'trips' : 'requests'} · a little help goes a long way`;
    $('#empty').hidden = items.length > 0;
    $('#posts').innerHTML = items
      .map((p) => {
        const [from, to] = routes[p.route] || [];
        const date = new Date(p.date + 'T12:00:00').toLocaleDateString(
          'en-IN',
          { day: 'numeric', month: 'short', year: 'numeric' },
        );
        const initials = p.name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((x) => x[0])
          .join('');
        return `<article class="card"><div class="card-top"><span class="badge ${p.type === 'request' ? 'request' : ''}">${p.type === 'trip' ? '↗ &nbsp; Travelling soon' : '♡ &nbsp; Looking for a traveller'}</span><button class="save ${saved.includes(p.id) ? 'saved' : ''}" data-save="${escape(p.id)}" aria-label="${saved.includes(p.id) ? 'Unsave' : 'Save'} post by ${escape(p.name)}" aria-pressed="${saved.includes(p.id)}">${saved.includes(p.id) ? '▣' : '♧'}</button></div><div class="route-line">${from} <span>→</span> ${to}</div><div class="route-codes">${cityCodes[from] || from} &nbsp; ───────── &nbsp; ${cityCodes[to] || to}</div><div class="date-line"><span>▦ &nbsp; ${p.type === 'request' ? 'By ' : ''}${date}</span><span>${p.mode === 'Flight' ? '✈' : p.mode === 'Train' ? '▤' : '↗'} &nbsp; ${escape(p.mode)}</span></div><p class="card-note">${escape(p.note)}</p><span class="help-tag">${p.type === 'trip' ? '♧ Offering · ' : '♡ Request · '}${escape(p.help)}</span><div class="card-bottom"><span class="person-avatar" style="background:${p.color || '#e0e5d6'}">${escape(initials)}</span><span class="person-name">${escape(p.name)}<small>${p.id.startsWith('ex') ? 'Example community member' : shared ? 'Community member' : 'Posted by you'}</small></span><button class="connect" data-connect="${escape(p.id)}">Connect ↗</button></div></article>`;
      })
      .join('');
    document.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('selected', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    $('#saved-nav').classList.toggle('active', savedOnly);
  }
  document.addEventListener('click', (e) => {
    const create = e.target.closest('[data-create]');
    if (create) {
      if (submitting) return;
      createType = create.dataset.create;
      const request = createType === 'request';
      $('#post-form').reset();
      $('#post-form [name="route"]').value = 'lko';
      $('#form-title').textContent = request
        ? 'Find a traveller'
        : 'Share your trip';
      $('#form-description').textContent = request
        ? 'Ask who’s travelling on your route, or request a little help.'
        : 'Let our people know when you’re travelling. Offering help is optional.';
      $('#date-label span').textContent = request ? 'Needed by' : 'Travel date';
      $('#date-hint').hidden = !request;
      $('#mode-label span').textContent = request
        ? 'Preferred transport'
        : 'Travelling by';
      $('#help-label span').textContent = request
        ? 'What do you need?'
        : 'Happy to help with';
      $('#note-label').textContent = request
        ? 'Request details (optional)'
        : 'Trip details (optional)';
      const mode = $('#post-form [name="mode"]');
      const help = $('#post-form [name="help"]');
      const modes = request
        ? ['Any mode', 'Flight', 'Train', 'Car']
        : ['Flight', 'Train', 'Car', 'Not decided'];
      const helps = request
        ? ['Find a traveller', 'A small parcel', 'Travel company', 'Other']
        : [
            'Just sharing my trip',
            'A small parcel',
            'Travel company',
            'Anything I can',
          ];
      mode.innerHTML = modes
        .map((value) => `<option>${value}</option>`)
        .join('');
      mode.value = modes[0];
      help.innerHTML = helps
        .map((value) => `<option>${value}</option>`)
        .join('');
      help.value = helps[0];
      $('#post-form [name="note"]').placeholder = request
        ? 'For example: Is anyone coming from Lucknow by Friday?'
        : 'Flight or train number, departure time, or anything else you’d like to share…';
      $('#post-form [name="date"]').min = iso(0);
      $('#post-form [name="date"]').value = iso(1);
      $('.submit').textContent = request
        ? 'Post your request ↗'
        : 'Share your trip ↗';
      $('#post-dialog').showModal();
    }
    const save = e.target.closest('[data-save]');
    if (save) {
      const id = save.dataset.save;
      saved = saved.includes(id)
        ? saved.filter((x) => x !== id)
        : [...saved, id];
      persist();
      render();
    }
    const connect = e.target.closest('[data-connect]');
    if (connect) {
      const p = allPosts().find((x) => x.id === connect.dataset.connect);
      if (!p) return;
      if (!p.phone) {
        toast(
          'This is an example post. Add a real trip to try WhatsApp contact.',
        );
        return;
      }
      const number = p.phone.replace(/\D/g, '');
      const text = `Hi ${p.name}! I saw your ${p.type === 'trip' ? 'trip' : 'request'} on Aawan Jaawan ${routes[p.route]?.join(' to ') || ''} ${p.type === 'request' ? 'needed by' : 'on'} ${p.date}. Could we connect?`;
      window.open(
        `https://wa.me/${number.length === 10 ? '91' : ''}${number}?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = t.dataset.tab;
      savedOnly = false;
      render();
    }
    if (e.target.closest('.close')) e.target.closest('dialog').close();
  });
  $('#post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.name.trim()) {
      toast('Please add your name.');
      return;
    }
    const digits = data.phone.replace(/\D/g, '');
    if (
      !/^[+0-9 ()-]+$/.test(data.phone) ||
      digits.length < 10 ||
      digits.length > 15
    ) {
      toast('Please enter a valid WhatsApp number including country code.');
      return;
    }
    const post = {
      ...data,
      name: data.name.trim(),
      note: data.note.trim(),
      type: createType,
      id: 'post-' + Date.now(),
      created: Date.now(),
    };
    const submit = $('.submit');
    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Sharing…';
    try {
      if (shared) {
        let result;
        if (sheetsMode) result = await sheetsCall('createPost', post);
        else {
          result = await postsRequest({
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(post),
          });
        }
        if (typeof result?.id !== 'string' || !result.id)
          throw new Error(
            'Unable to confirm your post was saved. Check the board before retrying.',
          );
        postRevision++;
        community = community.filter((p) => p.id !== result.id);
        community.push(result);
      } else {
        own.push(post);
        persist();
      }
      tab = 'all';
      savedOnly = false;
      $('#route').value = isLucknowRoute(post.route) ? 'lucknow' : post.route;
      $('#dates').value = 'all';
      $('#search').value = '';
      $('#sort').value = 'new';
      render();
      $('#post-dialog').close();
      $('#board').scrollIntoView({ behavior: 'smooth' });
      toast(
        shared
          ? 'Your post is live on the community board.'
          : 'Your post is on the board. Saved on this device.',
      );
    } catch (error) {
      toast(error.message || 'Unable to connect. Please try again.');
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.textContent =
        createType === 'request'
          ? 'Post your request ↗'
          : 'Share your trip ↗';
    }
  });
  ['route', 'dates', 'sort'].forEach((id) =>
    $('#' + id).addEventListener('change', render),
  );
  $('#search').addEventListener('input', render);
  $('#clear').addEventListener('click', () => {
    $('#route').value = 'lucknow';
    $('#dates').value = 'all';
    $('#search').value = '';
    savedOnly = false;
    tab = 'all';
    render();
  });
  $('#saved-nav').addEventListener('click', () => {
    savedOnly = !savedOnly;
    $('#route').value = savedOnly ? 'all' : 'lucknow';
    tab = 'all';
    render();
    $('#board').scrollIntoView({ behavior: 'smooth' });
  });
  $('#about').addEventListener('click', () => $('#info-dialog').showModal());
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
  if (shared) {
    $('.demo-note').textContent = 'Connecting to our community board…';
    $('#post-form .form-info').textContent =
      'Your post and WhatsApp contact will be visible to everyone who can access this community board.';
    $('#info-dialog .form-info').textContent =
      'Posts are saved in shared community storage. Your contact number is available to people who can access the board. Saved items stay personal to this browser.';
  }
  render();
  async function refresh() {
    const revision = postRevision;
    try {
      let posts;
      if (sheetsMode) posts = await sheetsCall('listPosts');
      else {
        posts = await postsRequest({
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
      }
      if (!Array.isArray(posts))
        throw new Error('Unable to read the community board.');
      if (postRevision !== revision) return;
      shared = true;
      community = posts;
      $('.demo-note').textContent = sheetsMode
        ? '● Connected to our community sheet'
        : '● Community board · shared with our people';
      $('#post-form .form-info').textContent =
        'Your post and WhatsApp contact will be visible to everyone who can access this community board.';
      $('#info-dialog .form-info').textContent =
        'This community board stores posts in shared community storage. Your contact number is available to people who can access the board. Saved items stay personal to this browser.';
      render();
    } catch (error) {
      if (shared) {
        $('.demo-note').textContent =
          'Unable to refresh · retrying automatically';
        toast(
          error.message ||
            'Unable to read the community sheet. Please try again.',
        );
      }
    }
  }
  const pause = $('#trip-carousel-pause');
  const updateRotationLabel = () => {
    pause.textContent = rotationPaused ? 'Play' : 'Pause';
    $('#trip-highlight').setAttribute('aria-live', rotationPaused ? 'polite' : 'off');
  };
  updateRotationLabel();
  pause.addEventListener('click', () => {
    rotationPaused = !rotationPaused;
    updateRotationLabel();
  });
  $('#trip-carousel-next').addEventListener('click', () => {
    rotationPaused = true;
    updateRotationLabel();
    renderHighlights(true);
  });
  refresh();
  setInterval(() => {
    if (shared && !document.hidden) refresh();
  }, 30000);
  setInterval(() => {
    if (!rotationPaused && !document.hidden) renderHighlights(true);
  }, 6000);
})();
