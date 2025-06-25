export default class NoSkipVideoPlayer {
    constructor(videoId) {
        this.video = document.getElementById(videoId);
        this.playBtn = document.getElementById('playBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressContainer = document.getElementById('progressContainer');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.eventsLog = document.getElementById('eventsLog');

        // Progress tracking
        this.watchedSegments = [];
        this.maxWatchedTime = 0;
        this.skipAttempts = 0;
        this.startTime = Date.now();
        this.isCompleted = false;

        this.init();
    }

    init() {
        this.video.controls = false; // Disable default controls
        this.setupEventListeners();
        this.emitEvent('player_initialized', { timestamp: Date.now() });
    }

    setupEventListeners() {
        // Play/Pause button
        this.playBtn.addEventListener('click', () => {
            if (this.video.paused) {
                this.video.play();
                this.emitEvent('play_started', { currentTime: this.video.currentTime });
            } else {
                this.video.pause();
                this.emitEvent('play_paused', { currentTime: this.video.currentTime });
            }
        });

        // Video events
        this.video.addEventListener('play', () => {
            this.playBtn.textContent = '⏸️';
        });

        this.video.addEventListener('pause', () => {
            this.playBtn.textContent = '▶️';
        });

        this.video.addEventListener('timeupdate', () => {
            this.handleTimeUpdate();
        });

        this.video.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplay();
        });

        this.video.addEventListener('ended', () => {
            this.handleVideoEnd();
        });

        // Prevent seeking (skip protection)
        this.video.addEventListener('seeking', (e) => {
            this.handleSeekAttempt();
        });

        this.video.addEventListener('seeked', (e) => {
            this.handleSeekAttempt();
        });

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value;
        });

        // Prevent progress bar interaction
        this.progressContainer.addEventListener('click', (e) => {
            e.preventDefault();
            this.skipAttempts++;
            this.updateProgressStats();
            this.emitEvent('skip_attempt_blocked', {
                currentTime: this.video.currentTime,
                attemptNumber: this.skipAttempts
            });
        });

        // Prevent keyboard shortcuts for seeking
        document.addEventListener('keydown', (e) => {
            if (e.target === this.video || e.target === document.body) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                    e.key === 'PageUp' || e.key === 'PageDown' ||
                    (e.key >= '0' && e.key <= '9')) {
                    e.preventDefault();
                    this.skipAttempts++;
                    this.updateProgressStats();
                    this.emitEvent('keyboard_skip_blocked', {
                        key: e.key,
                        attemptNumber: this.skipAttempts
                    });
                }
            }
        });
    }

    handleTimeUpdate() {
        const currentTime = this.video.currentTime;
        const duration = this.video.duration;

        // Only allow forward progress
        if (currentTime > this.maxWatchedTime) {
            this.maxWatchedTime = currentTime;
            this.recordWatchedSegment(currentTime);
        }

        // Update progress bar based on max watched time
        const progressPercent = (this.maxWatchedTime / duration) * 100;
        this.progressBar.style.width = progressPercent + '%';

        this.updateTimeDisplay();
        this.updateProgressStats();

        // Emit progress events at intervals
        if (Math.floor(currentTime) % 10 === 0 && currentTime > 0) {
            this.emitEvent('progress_milestone', {
                currentTime: currentTime,
                progress: progressPercent,
                maxWatchedTime: this.maxWatchedTime
            });
        }
    }

    handleSeekAttempt() {
        const currentTime = this.video.currentTime;

        // If user tries to skip ahead, reset to max watched time
        if (currentTime > this.maxWatchedTime) {
            this.video.currentTime = this.maxWatchedTime;
            this.skipAttempts++;
            this.updateProgressStats();
            this.emitEvent('seek_blocked', {
                attemptedTime: currentTime,
                resetToTime: this.maxWatchedTime,
                attemptNumber: this.skipAttempts
            });
        }
    }

    recordWatchedSegment(currentTime) {
        const segment = {
            time: currentTime,
            timestamp: Date.now()
        };
        this.watchedSegments.push(segment);
    }

    handleVideoEnd() {
        this.isCompleted = true;
        this.updateProgressStats();
        this.emitEvent('video_completed', {
            totalWatchTime: this.video.duration,
            skipAttempts: this.skipAttempts,
            completionTime: Date.now() - this.startTime
        });
    }

    updateTimeDisplay() {
        const current = this.formatTime(this.video.currentTime);
        const duration = this.formatTime(this.video.duration);
        this.timeDisplay.textContent = `${current} / ${duration}`;
    }

    updateProgressStats() {
        const duration = this.video.duration || 1;
        const progressPercent = Math.round((this.maxWatchedTime / duration) * 100);

        document.getElementById('watchProgress').textContent = progressPercent + '%';
        document.getElementById('timeWatched').textContent = this.formatTime(this.maxWatchedTime);
        document.getElementById('skipAttempts').textContent = this.skipAttempts;
        document.getElementById('completionStatus').textContent =
            this.isCompleted ? 'Completed ✅' : 'In Progress ⏳';
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    emitEvent(eventType, data = {}) {
        const event = {
            type: eventType,
            timestamp: Date.now(),
            videoCurrentTime: this.video.currentTime,
            maxWatchedTime: this.maxWatchedTime,
            ...data
        };

        // Log to console for external tracking
        console.log('VideoPlayerEvent:', event);

        // Add to visual log
        this.addEventToLog(event);

        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('videoPlayerProgress', { detail: event }));
    }

    addEventToLog(event) {
        const logEntry = document.createElement('div');
        logEntry.className = 'event-item';

        const time = new Date(event.timestamp).toLocaleTimeString();
        const eventDescription = this.getEventDescription(event);

        logEntry.innerHTML = `
                    <span class="event-time">[${time}]</span> ${eventDescription}
                `;

        this.eventsLog.appendChild(logEntry);
        this.eventsLog.scrollTop = this.eventsLog.scrollHeight;

        // Keep only last 20 events
        if (this.eventsLog.children.length > 20) {
            this.eventsLog.removeChild(this.eventsLog.firstChild);
        }
    }

    getEventDescription(event) {
        const descriptions = {
            player_initialized: 'Player initialized and ready',
            play_started: `Playback started at ${this.formatTime(event.currentTime)}`,
            play_paused: `Playback paused at ${this.formatTime(event.currentTime)}`,
            progress_milestone: `Watched ${Math.round((event.currentTime / this.video.duration) * 100)}% of video`,
            skip_attempt_blocked: `Skip attempt #${event.attemptNumber} blocked`,
            keyboard_skip_blocked: `Keyboard skip (${event.key}) blocked`,
            seek_blocked: `Seeking blocked - reset from ${this.formatTime(event.attemptedTime)} to ${this.formatTime(event.resetToTime)}`,
            video_completed: `Video completed! Total skip attempts: ${event.skipAttempts}`
        };
        return descriptions[event.type] || `Event: ${event.type}`;
    }

    // Public API for external tracking
    getProgressData() {
        return {
            maxWatchedTime: this.maxWatchedTime,
            totalDuration: this.video.duration,
            progressPercent: (this.maxWatchedTime / this.video.duration) * 100,
            skipAttempts: this.skipAttempts,
            isCompleted: this.isCompleted,
            watchedSegments: this.watchedSegments
        };
    }
}
