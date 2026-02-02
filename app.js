// ====== Config ======
const LEVELS = [
    { words: 6, time: 30 },
    { words: 7, time: 30 },
    { words: 8, time: 28 },
    { words: 9, time: 28 },
    { words: 10, time: 25 },
    { words: 11, time: 25 },
    { words: 12, time: 22 },
    { words: 13, time: 22 },
    { words: 14, time: 20 },
    { words: 16, time: 18 },
  ];
  
  // Un banco inicial simple. Luego lo cambias por categorías/temas.
  const WORD_BANK = [
    "manzana","montaña","coche","ventana","reloj","ciudad","nube","pintura","puente","bosque",
    "libro","café","cuchara","mariposa","teléfono","camisa","zapato","lámpara","isla","tren",
    "perro","gato","piano","carta","llave","cámara","jardín","avión","pelota","camino",
    "sal","azúcar","fuego","agua","tierra","viento","oro","plata","música","torre",
    "pluma","caja","silla","mesa","rueda","río","lago","playa","sol","luna"
  ];
  
  // ====== Storage ======
  const STORAGE_KEY = "memoria_listas_v0";
  
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { level: 1, sessions: [], bestPct: null };
    }
    try { return JSON.parse(raw); } catch { return { level: 1, sessions: [], bestPct: null }; }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  
  // ====== Helpers ======
  function todayKey() {
    const d = new Date();
    // yyyy-mm-dd local
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  
  function normalizeToken(s) {
    return s
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // quitar acentos
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function uniqueNonEmpty(arr) {
    const set = new Set();
    for (const x of arr) {
      const n = normalizeToken(x);
      if (n) set.add(n);
    }
    return [...set];
  }
  
  function sampleWords(n) {
    const pool = [...WORD_BANK];
    // shuffle simple
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }
  
  function computeStreak(sessions) {
    // streak: días consecutivos con al menos 1 sesión
    if (!sessions.length) return 0;
    const days = new Set(sessions.map(s => s.dayKey));
    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0,10);
      // ojo: toISOString usa UTC; para MVP aceptable. Si quieres exacto local, lo afinamos.
      if (days.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }
  
  // ====== UI refs ======
  const screenHome = document.getElementById("screenHome");
  const screenStudy = document.getElementById("screenStudy");
  const screenRecall = document.getElementById("screenRecall");
  
  const startBtn = document.getElementById("startBtn");
  const historyBtn = document.getElementById("historyBtn");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  
  const streakValue = document.getElementById("streakValue");
  const levelValue = document.getElementById("levelValue");
  const bestValue = document.getElementById("bestValue");
  
  const studyLevel = document.getElementById("studyLevel");
  const studyTime = document.getElementById("studyTime");
  const timerValue = document.getElementById("timerValue");
  const wordList = document.getElementById("wordList");
  const readyBtn = document.getElementById("readyBtn");
  
  const recallInput = document.getElementById("recallInput");
  const gradeBtn = document.getElementById("gradeBtn");
  const giveUpBtn = document.getElementById("giveUpBtn");
  
  const resultCard = document.getElementById("resultCard");
  const scorePct = document.getElementById("scorePct");
  const correctCount = document.getElementById("correctCount");
  const totalCount = document.getElementById("totalCount");
  const missingList = document.getElementById("missingList");
  const extraList = document.getElementById("extraList");
  const againBtn = document.getElementById("againBtn");
  const homeBtn = document.getElementById("homeBtn");
  
  // ====== App state ======
  let state = loadState();
  let currentTarget = [];
  let remaining = 0;
  let intervalId = null;
  
  // ====== Render ======
  function showScreen(name) {
    screenHome.hidden = name !== "home";
    screenStudy.hidden = name !== "study";
    screenRecall.hidden = name !== "recall";
  }
  
  function renderHome() {
    const streak = computeStreak(state.sessions);
    streakValue.textContent = String(streak);
    levelValue.textContent = String(state.level);
    bestValue.textContent = state.bestPct == null ? "—" : `${state.bestPct}%`;
  
    // history list
    historyList.innerHTML = "";
    const last = [...state.sessions].slice(-10).reverse();
    if (!last.length) {
      historyList.innerHTML = `<div class="historyItem">Aún no hay sesiones.</div>`;
    } else {
      for (const s of last) {
        const el = document.createElement("div");
        el.className = "historyItem";
        el.textContent = `${s.dayKey} · Nivel ${s.level} · ${s.pct}% (${s.correct}/${s.total})`;
        historyList.appendChild(el);
      }
    }
  }
  
  function startSession() {
    const levelIdx = Math.max(1, Math.min(10, state.level)) - 1;
    const cfg = LEVELS[levelIdx];
  
    currentTarget = sampleWords(cfg.words);
    remaining = cfg.time;
  
    studyLevel.textContent = String(state.level);
    studyTime.textContent = String(cfg.time);
    timerValue.textContent = String(remaining);
  
    wordList.innerHTML = "";
    currentTarget.forEach(w => {
      const sp = document.createElement("span");
      sp.textContent = w;
      wordList.appendChild(sp);
    });
  
    showScreen("study");
    beginTimer();
  }
  
  function beginTimer() {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
      remaining--;
      timerValue.textContent = String(remaining);
      if (remaining <= 0) {
        clearInterval(intervalId);
        goRecall();
      }
    }, 1000);
  }
  
  function goRecall() {
    clearInterval(intervalId);
    recallInput.value = "";
    resultCard.hidden = true;
    showScreen("recall");
    recallInput.focus();
  }
  
  // ====== Scoring ======
  function grade() {
    const userLines = recallInput.value.split(/\r?\n/);
    const user = uniqueNonEmpty(userLines);
    const target = uniqueNonEmpty(currentTarget);
  
    const targetSet = new Set(target);
    const userSet = new Set(user);
  
    const correct = user.filter(x => targetSet.has(x));
    const missing = target.filter(x => !userSet.has(x));
    const extras = user.filter(x => !targetSet.has(x));
  
    const pct = Math.round((correct.length / target.length) * 100);
  
    // update UI
    scorePct.textContent = String(pct);
    correctCount.textContent = String(correct.length);
    totalCount.textContent = String(target.length);
  
    missingList.innerHTML = "";
    extraList.innerHTML = "";
    const chip = (t) => {
      const d = document.createElement("div");
      d.className = "chip";
      d.textContent = t;
      return d;
    };
  
    if (!missing.length) missingList.appendChild(chip("—"));
    else missing.forEach(m => missingList.appendChild(chip(m)));
  
    if (!extras.length) extraList.appendChild(chip("—"));
    else extras.forEach(e => extraList.appendChild(chip(e)));
  
    resultCard.hidden = false;
  
    // persist session
    const session = {
      dayKey: todayKey(),
      ts: Date.now(),
      mode: "listas",
      level: state.level,
      correct: correct.length,
      total: target.length,
      pct
    };
    state.sessions.push(session);
  
    // best
    if (state.bestPct == null || pct > state.bestPct) state.bestPct = pct;
  
    // adapt level
    if (pct >= 80 && state.level < 10) state.level++;
    else if (pct < 50 && state.level > 1) state.level--;
  
    saveState(state);
  }
  
  // ====== Events ======
  startBtn.addEventListener("click", startSession);
  
  readyBtn.addEventListener("click", () => goRecall());
  
  gradeBtn.addEventListener("click", grade);
  
  giveUpBtn.addEventListener("click", () => {
    // muestra la lista objetivo en el textarea (sin calificar)
    recallInput.value = currentTarget.join("\n");
  });
  
  againBtn.addEventListener("click", startSession);
  
  homeBtn.addEventListener("click", () => {
    renderHome();
    showScreen("home");
  });
  
  historyBtn.addEventListener("click", () => {
    historyPanel.hidden = !historyPanel.hidden;
  });
  
  // ====== PWA: service worker ======
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try { await navigator.serviceWorker.register("service-worker.js"); } catch {}
    });
  }
  
  // (Opcional) Botón instalar
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  
  // ====== Init ======
  renderHome();
  showScreen("home");
  