// ==================== ERS Podcast Player ====================
// Episode management and player controls for Spotify podcast

const PODCAST_EPISODES = [
    {
        id: "64p0iWxrrnWsH6GUGSkjkA",
        title: "الحلقة 1",
        description: "Running Cast Egypt - Episode 1",
        date: "2024-01-20"
    },
    {
        id: "16Oxe5EbbyUyPpWYPB0YiF",
        title: "الحلقة 2",
        description: "Running Cast Egypt - Episode 2",
        date: "2024-01-25"
    },
    {
        id: "27Q2oe9T3JgpChCC0xEg3e",
        title: "الحلقة 3",
        description: "Running Cast Egypt - Episode 3",
        date: "2024-01-30"
    }
];

// Show ID for the full podcast
const PODCAST_SHOW_ID = "4cYIPTsFZa3cBIyHLTgcui";

// Current episode state
let currentEpisodeIndex = 0;

/**
 * Load a specific episode by index
 */
function loadPodcastEpisode(index) {
    if (index < 0 || index >= PODCAST_EPISODES.length) return;

    currentEpisodeIndex = index;
    const episode = PODCAST_EPISODES[index];

    // Update iframe
    const iframe = document.querySelector('.spotify-embed');
    if (iframe) {
        iframe.src = `https://open.spotify.com/embed/episode/${episode.id}`;
    }

    // Update episode info display
    updateEpisodeInfo(episode);

    // Save to localStorage
    localStorage.setItem('lastPodcastEpisode', index.toString());

    // Update navigation buttons state
    updateNavigationButtons();
}

/**
 * Update episode info display
 */
function updateEpisodeInfo(episode) {
    const titleEl = document.getElementById('current-episode-title');
    const countEl = document.getElementById('episode-count');

    if (titleEl) titleEl.textContent = episode.title;
    if (countEl) countEl.textContent = `${currentEpisodeIndex + 1} / ${PODCAST_EPISODES.length}`;
}

/**
 * Update navigation button states
 */
function updateNavigationButtons() {
    const prevBtn = document.getElementById('podcast-prev');
    const nextBtn = document.getElementById('podcast-next');

    if (prevBtn) {
        prevBtn.disabled = currentEpisodeIndex === 0;
        prevBtn.style.opacity = currentEpisodeIndex === 0 ? '0.5' : '1';
    }

    if (nextBtn) {
        nextBtn.disabled = currentEpisodeIndex === PODCAST_EPISODES.length - 1;
        nextBtn.style.opacity = currentEpisodeIndex === PODCAST_EPISODES.length - 1 ? '0.5' : '1';
    }
}

/**
 * Navigate to previous episode
 */
function podcastPrevious() {
    if (currentEpisodeIndex > 0) {
        loadPodcastEpisode(currentEpisodeIndex - 1);
    }
}

/**
 * Navigate to next episode
 */
function podcastNext() {
    if (currentEpisodeIndex < PODCAST_EPISODES.length - 1) {
        loadPodcastEpisode(currentEpisodeIndex + 1);
    }
}

/**
 * Show episode list modal
 */
function showEpisodeList() {
    const list = document.getElementById('episode-list');
    if (!list) return;

    // Build episode list HTML
    let html = '';
    PODCAST_EPISODES.forEach((ep, index) => {
        const isActive = index === currentEpisodeIndex;
        html += `
        <div class="episode-item ${isActive ? 'active' : ''}" onclick="selectEpisode(${index})">
            <div class="episode-number">${index + 1}</div>
            <div class="episode-details">
                <div class="episode-title">${ep.title}</div>
                <div class="episode-desc">${ep.description}</div>
            </div>
            ${isActive ? '<i class="ri-play-circle-fill"></i>' : '<i class="ri-play-circle-line"></i>'}
        </div>`;
    });

    list.innerHTML = html;

    // Show modal
    const modal = document.getElementById('modal-episodes');
    if (modal) modal.style.display = 'flex';
}

/**
 * Select episode from list
 */
function selectEpisode(index) {
    loadPodcastEpisode(index);
    closeModal('modal-episodes');
}

/**
 * Switch between show view and episode view
 */
function togglePodcastView(showFullPodcast = false) {
    const iframe = document.querySelector('.spotify-embed');
    if (!iframe) return;

    if (showFullPodcast) {
        iframe.src = `https://open.spotify.com/embed/show/${PODCAST_SHOW_ID}`;
        localStorage.setItem('podcastViewMode', 'show');
    } else {
        // Load last episode or first episode
        const lastIndex = parseInt(localStorage.getItem('lastPodcastEpisode')) || 0;
        loadPodcastEpisode(lastIndex);
        localStorage.setItem('podcastViewMode', 'episode');
    }
}

/**
 * Initialize podcast player on page load
 */
function initPodcastPlayer() {
    // Check view mode preference
    const viewMode = localStorage.getItem('podcastViewMode') || 'episode';

    if (viewMode === 'episode') {
        // Load last played episode
        const lastIndex = parseInt(localStorage.getItem('lastPodcastEpisode')) || 0;
        loadPodcastEpisode(lastIndex);
    }

    // Setup keyboard shortcuts (optional)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && e.ctrlKey) podcastPrevious();
        if (e.key === 'ArrowRight' && e.ctrlKey) podcastNext();
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPodcastPlayer);
} else {
    initPodcastPlayer();
}
