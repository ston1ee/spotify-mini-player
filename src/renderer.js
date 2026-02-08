let isAuthenticated = false;
let currentTrack = null;
let updateInterval = null;
let isMinimized = false;

// UI Elements
const authBtn = document.getElementById('auth-btn');
const notAuthScreen = document.getElementById('not-auth');
const playerContent = document.getElementById('player-content');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const lyricsBtn = document.getElementById('lyrics-btn');
const lyricsView = document.getElementById('lyrics-view');
const backToPlayerBtn = document.getElementById('back-to-player');
const mainPlayer = document.getElementById('main-player');
const minimizeBtn = document.getElementById('minimize-btn');

// Track info elements
const albumArt = document.getElementById('album-art');
const trackName = document.getElementById('track-name');
const artistName = document.getElementById('artist-name');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress');
const currentTime = document.getElementById('current-time');
const totalTime = document.getElementById('total-time');
const nextTrackSpan = document.getElementById('next-track');

// Settings elements
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
const widthSlider = document.getElementById('width-slider');
const widthValue = document.getElementById('width-value');
const heightSlider = document.getElementById('height-slider');
const heightValue = document.getElementById('height-value');
const lockToggle = document.getElementById('lock-toggle');

// Authentication
authBtn.addEventListener('click', async () => {
    await window.electronAPI.startAuth();
});

window.electronAPI.onAuthSuccess(() => {
    isAuthenticated = true;
    notAuthScreen.classList.add('hidden');
    playerContent.classList.remove('hidden');
    startUpdating();
});

// Settings
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
});

opacitySlider.addEventListener('input', (e) => {
    const opacity = e.target.value / 100;
    opacityValue.textContent = e.target.value + '%';
    window.electronAPI.setWindowOpacity(opacity);
});

widthSlider.addEventListener('input', (e) => {
    const width = parseInt(e.target.value);
    widthValue.textContent = width + 'px';
    const height = parseInt(heightSlider.value);
    window.electronAPI.setWindowSize(width, height);
});

heightSlider.addEventListener('input', (e) => {
    const height = parseInt(e.target.value);
    heightValue.textContent = height + 'px';
    const width = parseInt(widthSlider.value);
    window.electronAPI.setWindowSize(width, height);
});

lockToggle.addEventListener('change', (e) => {
    window.electronAPI.setWindowLock(e.target.checked);
    if (e.target.checked) {
        document.body.style.pointerEvents = 'none';
        settingsBtn.style.pointerEvents = 'none';
    } else {
        document.body.style.pointerEvents = 'auto';
        settingsBtn.style.pointerEvents = 'auto';
    }
});

// Minimize
minimizeBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
        playerContent.classList.add('hidden');
        minimizeBtn.textContent = '➕';
        const width = parseInt(widthSlider.value);
        window.electronAPI.setWindowSize(width, 50);
    } else {
        playerContent.classList.remove('hidden');
        minimizeBtn.textContent = '➖';
        const width = parseInt(widthSlider.value);
        const height = parseInt(heightSlider.value);
        window.electronAPI.setWindowSize(width, height);
    }
});

// Player controls
playPauseBtn.addEventListener('click', async () => {
    await window.electronAPI.togglePlayPause();
    setTimeout(updatePlayback, 500);
});

prevBtn.addEventListener('click', async () => {
    await window.electronAPI.previousTrack();
    setTimeout(updatePlayback, 500);
});

nextBtn.addEventListener('click', async () => {
    await window.electronAPI.nextTrack();
    setTimeout(updatePlayback, 500);
});

// Lyrics
lyricsBtn.addEventListener('click', async () => {
    if (currentTrack) {
        playerContent.classList.add('hidden');
        lyricsView.classList.remove('hidden');
        
        const lyricsResult = await window.electronAPI.getLyrics(currentTrack.id);
        const lyricsContent = document.getElementById('lyrics-content');
        
        if (lyricsResult.error) {
            lyricsContent.innerHTML = '<p>Lyrics not available for this track.</p><p style="margin-top: 10px; font-size: 12px;">Note: Spotify\'s lyrics API requires special access. You can integrate with Genius API or Musixmatch for lyrics functionality.</p>';
        } else {
            lyricsContent.innerHTML = lyricsResult.lyrics;
        }
    }
});

backToPlayerBtn.addEventListener('click', () => {
    lyricsView.classList.add('hidden');
    playerContent.classList.remove('hidden');
});

// Update playback info
async function updatePlayback() {
    if (!isAuthenticated) return;
    
    const playback = await window.electronAPI.getCurrentPlayback();
    
    if (playback.error) {
        console.error('Playback error:', playback.error);
        return;
    }
    
    if (!playback.item) {
        trackName.textContent = 'No track playing';
        artistName.textContent = '-';
        albumArt.src = '';
        return;
    }
    
    currentTrack = playback.item;
    
    // Update track info
    trackName.textContent = currentTrack.name;
    artistName.textContent = currentTrack.artists.map(a => a.name).join(', ');
    
    if (currentTrack.album && currentTrack.album.images && currentTrack.album.images.length > 0) {
        albumArt.src = currentTrack.album.images[0].url;
    }
    
    // Update play/pause button
    playPauseBtn.textContent = playback.is_playing ? '⏸️' : '▶️';
    
    // Update progress
    const progress = (playback.progress_ms / currentTrack.duration_ms) * 100;
    progressBar.style.width = progress + '%';
    
    currentTime.textContent = formatTime(playback.progress_ms);
    totalTime.textContent = formatTime(currentTrack.duration_ms);
    
    // Show lyrics button
    lyricsBtn.classList.remove('hidden');
}

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function startUpdating() {
    updatePlayback();
    updateInterval = setInterval(updatePlayback, 2000); // Update every 2 seconds
}

// Clean up on window close
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});