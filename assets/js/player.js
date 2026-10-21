let isPlaying = false;
let dailySouras = [];
let currentIndex = 0;
let loadRequestId = 0;
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
const title = document.getElementById('souraTitle');
const reciterSelect = document.getElementById('reciterSelect');
const reciterSearch = document.getElementById('reciterSearch');
let reciters = [];

function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function savePlaybackState() {
  const reciterId = localStorage.getItem('selectedReciter');
  if (!reciterId || !dailySouras.length) return;

  localStorage.setItem(playbackStateKey, JSON.stringify({
    reciterId,
    date: getDateKey(),
    index: currentIndex,
    time: Number.isFinite(player.currentTime) ? player.currentTime : 0,
    wasPlaying: !player.paused && !player.ended
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
  try {
    const response = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
    if (!response.ok) throw new Error('تعذر تحميل قائمة القراء');
    ({ reciters } = await response.json());
    if (!reciters?.length) throw new Error('قائمة المقرئين فارغة');

    const savedReciter = localStorage.getItem('selectedReciter');
    const initialReciter = savedReciter && reciters.some(reciter => String(reciter.id) === savedReciter)
      ? savedReciter
      : String(reciters[0].id);
    reciterSearch.disabled = false;
    renderReciters();
    reciterSelect.value = initialReciter;
    await loadSoura(reciterSelect.value, false, true);
  } catch (error) {
    title.textContent = 'تعذر تحميل قائمة القراء. يرجى تحديث الصفحة.';
    reciterSelect.replaceChildren(new Option('تعذر تحميل القراء', ''));
    console.error('Error loading reciters:', error);
  }
}

async function loadSoura(reciterId, autoplay = false, restoreProgress = false) {
  const requestId = ++loadRequestId;
  const resumePlayback = !player.paused;
  if (!restoreProgress) savePlaybackState();
  title.textContent = 'جارٍ تحميل السور...';
  player.pause();
  isPlaying = false;
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
      try {
        savedState = JSON.parse(localStorage.getItem(playbackStateKey) || 'null');
      } catch {
        savedState = null;
      }
      if (savedState?.reciterId === String(reciterId) && savedState.date === getDateKey()
          && Number.isInteger(savedState.index) && savedState.index >= 0 && savedState.index < dailySouras.length) {
        currentIndex = savedState.index;
      } else {
        savedState = null;
      }
    }
    title.textContent = `سُوَر اليوم: ${dailySouras.map(surah => surah.name).join(' • ')}`;
    localStorage.setItem('selectedReciter', reciterId);
    if (restoreProgress && savedState && (savedState.time > 0 || savedState.wasPlaying)) {
      player.addEventListener('loadedmetadata', () => {
        if (requestId !== loadRequestId) return;
        const duration = player.duration;
        const targetTime = Number.isFinite(duration) ? Math.min(savedState.time, Math.max(0, duration - 0.5)) : savedState.time;
        player.currentTime = targetTime;
        if (savedState.wasPlaying) {
          player.play().catch(error => console.error('Playback failed:', error));
        }
      }, { once: true });
    }
    player.src = dailySouras[currentIndex].url;
    savePlaybackState();
    if ((resumePlayback || autoplay) && requestId === loadRequestId) {
      player.play().catch(error => console.error('Playback failed:', error));
    }
  } catch (error) {
    if (requestId !== loadRequestId) return;
    dailySouras = [];
    title.textContent = 'تعذر تحميل السور لهذا القارئ.';
    console.error('Error loading soura:', error);
  }
}

function updatePlayButton() {
  const icon = document.querySelector('#playPauseButton i');
  icon.classList.toggle('fa-pause', isPlaying);
  icon.classList.toggle('fa-play', !isPlaying);
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
    console.error('Playback failed:', error);
  }
}

player.addEventListener('ended', () => {
  if (!dailySouras.length) return;
  currentIndex = (currentIndex + 1) % dailySouras.length;
  player.src = dailySouras[currentIndex].url;
  savePlaybackState();
  player.play().catch(error => console.error('Playback failed:', error));
});

player.addEventListener('timeupdate', savePlaybackState);
window.addEventListener('pagehide', savePlaybackState);
player.addEventListener('play', () => { isPlaying = true; updatePlayButton(); });
player.addEventListener('pause', () => { isPlaying = false; updatePlayButton(); });
reciterSelect.addEventListener('change', () => loadSoura(reciterSelect.value, true));
reciterSearch.addEventListener('input', () => {
  renderReciters(reciterSearch.value);
  const query = normalizeSearchText(reciterSearch.value.trim());
  const matchingReciters = reciters.filter(reciter => normalizeSearchText(reciter.name).includes(query));
  const selectedReciter = matchingReciters.find(reciter => String(reciter.id) === reciterSelect.value);
  const exactMatch = matchingReciters.find(reciter => normalizeSearchText(reciter.name.trim()) === query);
  const reciterToLoad = exactMatch || (matchingReciters.length === 1 ? matchingReciters[0] : null);
  if (reciterToLoad && String(reciterToLoad.id) !== String(selectedReciter?.id || '')) {
    reciterSelect.value = String(reciterToLoad.id);
    loadSoura(String(reciterToLoad.id), true);
  }
});
loadReciters();
