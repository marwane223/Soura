let isPlaying = false;
let dailySouras = [];
let currentIndex = 0;
let loadRequestId = 0;
let activeAudioSource = '';
const playbackStateKey = 'playbackState';

const surahNames = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج",
  "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة",
  "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان",
  "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن",
  "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق",
  "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان",
  "المرسلات", "النبأ", "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق",
  "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر",
  "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون",
  "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس"
];

const player = document.getElementById('audioPlayer');
const dailySourasTitle = document.getElementById('dailySourasTitle');
const currentSurahTitle = document.getElementById('souraTitle');
const reciterSelect = document.getElementById('reciterSelect');
const reciterSearch = document.getElementById('reciterSearch');
const reciterSearchStatus = document.getElementById('reciterSearchStatus');
const playPauseButton = document.getElementById('playPauseButton');
const progressBar = document.getElementById('progressBar');
const currentTimeLabel = document.getElementById('currentTime');
const durationLabel = document.getElementById('duration');
const themeToggle = document.getElementById('themeToggle');
const themePreferenceKey = 'themePreference';
let reciters = [];
let dailyTitleDefault = 'جارٍ تحميل قائمة القراء...';
let activeStatusMessage = '';

function setPlayerStatus(message = '', loading = false) {
  activeStatusMessage = message;
  dailySourasTitle.textContent = message || dailyTitleDefault;
  dailySourasTitle.dataset.loading = String(loading);
}

function setDailySourasTitle(title) {
  dailyTitleDefault = title;
  if (!activeStatusMessage) dailySourasTitle.textContent = title;
}

function setTheme(theme, savePreference = false) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي');
  themeToggle.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>`;
  if (savePreference) localStorage.setItem(themePreferenceKey, theme);
}

const savedTheme = localStorage.getItem(themePreferenceKey);
setTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function updateProgress() {
  const duration = player.duration;
  const hasDuration = Number.isFinite(duration) && duration > 0;
  progressBar.disabled = true;
  if (!hasDuration) {
    progressBar.value = '0';
    progressBar.max = '0';
    progressBar.style.setProperty('--progress', '0%');
    currentTimeLabel.textContent = formatTime(0);
    durationLabel.textContent = formatTime(0);
    return;
  }

  const currentTime = Math.min(player.currentTime, duration);
  const progress = (currentTime / duration) * 100;
  progressBar.max = String(duration);
  progressBar.value = String(currentTime);
  progressBar.style.setProperty('--progress', `${progress}%`);
  currentTimeLabel.textContent = formatTime(currentTime);
  durationLabel.textContent = formatTime(duration);
}

function resetProgress() {
  progressBar.disabled = true;
  progressBar.max = '0';
  progressBar.value = '0';
  progressBar.style.setProperty('--progress', '0%');
  currentTimeLabel.textContent = formatTime(0);
  durationLabel.textContent = formatTime(0);
}

function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getSavedPlaybackState() {
  try {
    return JSON.parse(localStorage.getItem(playbackStateKey) || 'null');
  } catch {
    return null;
  }
}

function savePlaybackState(time = player.currentTime, wasPlaying = !player.paused && !player.ended) {
  const reciterId = localStorage.getItem('selectedReciter');
  if (!reciterId || !dailySouras.length) return;

  localStorage.setItem(playbackStateKey, JSON.stringify({
    reciterId,
    date: getDateKey(),
    index: currentIndex,
    time: Number.isFinite(time) ? time : 0,
    wasPlaying
  }));
}

function normalizeSearchText(value) {
  return value
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا');
}

function renderReciters(searchTerm = '') {
  const query = normalizeSearchText(searchTerm.trim());
  const matches = reciters.filter(reciter => normalizeSearchText(reciter.name).includes(query));
  if (query) {
    reciterSearchStatus.textContent = !matches.length
      ? 'لم يتم العثور على قارئ بهذا الاسم.'
      : matches.length === 1
        ? `تم العثور على قارئ واحد: ${matches[0].name}`
        : `تم العثور على ${matches.length} قراء. اختر واحداً من القائمة.`;
  } else {
    reciterSearchStatus.textContent = '';
  }
  const previousValue = reciterSelect.value;
  const selectedReciter = reciters.find(reciter => String(reciter.id) === localStorage.getItem('selectedReciter'));
  reciterSelect.replaceChildren(...matches.map(reciter => {
    const option = document.createElement('option');
    option.value = reciter.id;
    option.textContent = reciter.name;
    return option;
  }));

  if (matches.some(reciter => String(reciter.id) === previousValue)) {
    reciterSelect.value = previousValue;
  } else if (selectedReciter && matches.some(reciter => String(reciter.id) === String(selectedReciter.id))) {
    reciterSelect.value = String(selectedReciter.id);
  } else if (previousValue) {
    reciterSelect.selectedIndex = -1;
  }
  reciterSelect.disabled = matches.length === 0;
  if (!matches.length) {
    reciterSelect.append(new Option('لم يتم العثور على هذا القارئ', ''));
  }
}

async function loadReciters() {
  setPlayerStatus('جارٍ تحميل قائمة القراء...', true);
  try {
    const response = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
    if (!response.ok) throw new Error('تعذر تحميل قائمة القراء');
    ({ reciters } = await response.json());
    if (!reciters?.length) throw new Error('قائمة المقرئين فارغة');

    const savedReciter = localStorage.getItem('selectedReciter');
    const savedState = getSavedPlaybackState();
    const canResumeSavedReciter = savedState?.date === getDateKey()
      && Number.isInteger(savedState.index) && savedState.index >= 0 && savedState.index < 3
      && reciters.some(reciter => String(reciter.id) === String(savedState.reciterId));
    const initialReciter = canResumeSavedReciter
      ? String(savedState.reciterId)
      : savedReciter && reciters.some(reciter => String(reciter.id) === savedReciter)
        ? savedReciter
        : String(reciters[0].id);
    reciterSearch.disabled = false;
    renderReciters();
    reciterSelect.value = initialReciter;
    await loadSoura(reciterSelect.value, false, true);
  } catch (error) {
    setDailySourasTitle('تعذر تحميل قائمة القراء.');
    currentSurahTitle.textContent = '';
    reciterSelect.replaceChildren(new Option('تعذر تحميل القراء', ''));
    setPlayerStatus('تعذر تحميل القراء. تحقق من الاتصال.', false);
    console.error('Error loading reciters:', error);
  }
}

async function loadSoura(reciterId, autoplay = false, restoreProgress = false) {
  const requestId = ++loadRequestId;
  const resumePlayback = !player.paused;
  if (!restoreProgress) savePlaybackState();
  activeAudioSource = '';
  setDailySourasTitle('جارٍ تحميل السور...');
  setPlayerStatus('جارٍ تحميل السور...', true);
  currentSurahTitle.textContent = '';
  player.pause();
  isPlaying = false;
  playPauseButton.disabled = true;
  resetProgress();
  updatePlayButton();

  try {
    const response = await fetch(`https://www.mp3quran.net/api/v3/reciters?language=ar&reciter=${encodeURIComponent(reciterId)}`);
    if (!response.ok) throw new Error('تعذر تحميل تلاوة القارئ');
    const { reciters } = await response.json();
    if (requestId !== loadRequestId) return;
    const moshaf = reciters?.[0]?.moshaf?.find(item => item.server && item.surah_list);
    if (!moshaf) throw new Error('لا توجد تلاوات متاحة لهذا القارئ');

    const surahList = moshaf.surah_list.split(',').map(num => num.trim());
    const all = surahList.map(num => {
      const surahNumber = Number(num);
      return {
        name: surahNames[surahNumber - 1] || `سورة رقم ${surahNumber}`,
        url: `${moshaf.server}${num.padStart(3, '0')}.mp3`
      };
    });

    const start = (new Date().getDate() - 1) * 3;
    dailySouras = all.slice(start, start + 3);
    if (!dailySouras.length) dailySouras = all.slice(0, 3);
    currentIndex = 0;
    let savedState;
    if (restoreProgress) {
      savedState = getSavedPlaybackState();
      if (savedState?.reciterId === String(reciterId) && savedState.date === getDateKey()
          && Number.isInteger(savedState.index) && savedState.index >= 0 && savedState.index < dailySouras.length) {
        currentIndex = savedState.index;
      } else {
        savedState = null;
      }
    }
    setDailySourasTitle(`سُوَر اليوم: ${dailySouras.map(surah => surah.name).join(' • ')}`);
    currentSurahTitle.textContent = dailySouras[currentIndex].name;
    localStorage.setItem('selectedReciter', reciterId);
    if (restoreProgress && savedState && (savedState.time > 0 || savedState.wasPlaying)) {
      player.addEventListener('loadedmetadata', () => {
        if (requestId !== loadRequestId) return;
        const duration = player.duration;
        const targetTime = Number.isFinite(duration) ? Math.min(savedState.time, Math.max(0, duration - 0.5)) : savedState.time;
        player.currentTime = targetTime;
        if (savedState.wasPlaying) {
          player.play().catch(showPlaybackError);
        }
      }, { once: true });
    }
    activeAudioSource = new URL(dailySouras[currentIndex].url, document.baseURI).href;
    player.src = activeAudioSource;
    setPlayerStatus('جارٍ تحميل التلاوة...', true);
    playPauseButton.disabled = false;
    updateProgress();
    if (!restoreProgress || !savedState) savePlaybackState(0, false);
    if ((resumePlayback || autoplay) && requestId === loadRequestId) {
      player.play().catch(showPlaybackError);
    }
  } catch (error) {
    if (requestId !== loadRequestId) return;
    dailySouras = [];
    setDailySourasTitle('تعذر تحميل السور لهذا القارئ.');
    currentSurahTitle.textContent = '';
    setPlayerStatus('تعذر تحميل السور. جرّب قارئاً آخر.', false);
    console.error('Error loading soura:', error);
  }
}

function showPlaybackError(error) {
  setPlayerStatus('تعذر تشغيل الصوت. حاول مرة أخرى.', false);
  console.error('Playback failed:', error);
}

function updatePlayButton() {
  const icon = playPauseButton.querySelector('i');
  icon.classList.toggle('fa-pause', isPlaying);
  icon.classList.toggle('fa-play', !isPlaying);
  playPauseButton.setAttribute('aria-label', isPlaying ? 'إيقاف التلاوة مؤقتاً' : 'تشغيل التلاوة');
}

async function togglePlayPause() {
  try {
    if (player.paused) {
      await player.play();
      isPlaying = true;
    } else {
      player.pause();
      isPlaying = false;
    }
    updatePlayButton();
  } catch (error) {
    showPlaybackError(error);
  }
}

player.addEventListener('ended', () => {
  if (currentIndex < dailySouras.length - 1) {
    currentIndex += 1;
    currentSurahTitle.textContent = dailySouras[currentIndex].name;
    resetProgress();
    activeAudioSource = new URL(dailySouras[currentIndex].url, document.baseURI).href;
    player.src = activeAudioSource;
    setPlayerStatus('جارٍ تحميل التلاوة التالية...', true);
    savePlaybackState(0, true);
    player.play().catch(showPlaybackError);
    return;
  }

  isPlaying = false;
  updatePlayButton();
  updateProgress();
  setPlayerStatus('انتهت سور اليوم.', false);
  savePlaybackState();
});

player.addEventListener('loadedmetadata', updateProgress);
player.addEventListener('durationchange', updateProgress);
player.addEventListener('waiting', () => setPlayerStatus('جارٍ تحميل التلاوة...', true));
player.addEventListener('stalled', () => setPlayerStatus('الاتصال بطيء؛ جارٍ انتظار التلاوة...', true));
player.addEventListener('canplay', () => setPlayerStatus());
player.addEventListener('playing', () => setPlayerStatus());
player.addEventListener('error', () => {
  const currentSource = player.currentSrc || player.src;
  if (activeAudioSource && currentSource === activeAudioSource) {
    setPlayerStatus('تعذر تحميل الصوت. اختر قارئاً آخر.', false);
  }
});
player.addEventListener('timeupdate', () => {
  updateProgress();
  savePlaybackState();
});
player.addEventListener('emptied', resetProgress);
window.addEventListener('pagehide', () => savePlaybackState());
player.addEventListener('play', () => { isPlaying = true; updatePlayButton(); });
player.addEventListener('pause', () => {
  isPlaying = false;
  updatePlayButton();
  savePlaybackState();
});
playPauseButton.addEventListener('click', togglePlayPause);
reciterSelect.addEventListener('change', () => {
  const selectedReciter = reciters.find(reciter => String(reciter.id) === reciterSelect.value);
  if (selectedReciter) reciterSearchStatus.textContent = `القارئ المختار: ${selectedReciter.name}`;
  loadSoura(reciterSelect.value, true);
});
reciterSearch.addEventListener('input', () => {
  renderReciters(reciterSearch.value);
  const query = normalizeSearchText(reciterSearch.value.trim());
  const matchingReciters = reciters.filter(reciter => normalizeSearchText(reciter.name).includes(query));
  const selectedReciter = matchingReciters.find(reciter => String(reciter.id) === reciterSelect.value);
  const exactMatch = matchingReciters.find(reciter => normalizeSearchText(reciter.name.trim()) === query);
  const reciterToLoad = exactMatch || (matchingReciters.length === 1 ? matchingReciters[0] : null);
  if (reciterToLoad) reciterSearchStatus.textContent = `القارئ المختار: ${reciterToLoad.name}`;
  if (reciterToLoad && String(reciterToLoad.id) !== String(selectedReciter?.id || '')) {
    reciterSelect.value = String(reciterToLoad.id);
    loadSoura(String(reciterToLoad.id), true);
  }
});
loadReciters();
