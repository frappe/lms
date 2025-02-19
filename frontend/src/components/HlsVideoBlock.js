// HlsVideoBlock.js
import Hls from 'hls.js';

class HlsVideoBlock {
    readOnly;
    constructor({ data, config, api }) {
        this.data = data || {};
        this.config = config || {};
        this.api = api;
        this.wrapper = null;
        this.video = null;
        this.hls = null;
        this.readOnly = true;
    }

    static get isReadOnlySupported() {
        return true
    }
    static get toolbox() {
        return {
            title: 'HLS Video',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6H4zm7 3h2v2h-2V9z"/></svg>'
        };
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('hls-video-block');

        this.video = document.createElement('video');
        this.video.controls = true;
        this.video.style.width = '100%'; // Make the video fill the container

        this.wrapper.appendChild(this.video);

        if (this.data.url) {
            this.loadVideo(this.data.url);
        }

        return this.wrapper;
    }

    loadVideo(url) {
        if (Hls.isSupported()) {
            this.hls = new Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.video.play();
            });
            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.warn('HLS error:', data);
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = url;
            this.video.addEventListener('loadedmetadata', () => {
                this.video.play();
            });
        } else {
            console.error('HLS is not supported in this browser.');
        }
    }

    save(blockContent) {
        return {
            url: this.data.url
        };
    }

    static get input() {
        return 'url';
    }

    validate(savedData) {
        if (!savedData.url || savedData.url.trim() === '') {
            return false;
        }
        return true;
    }

    renderSettings() {
        const wrapper = document.createElement('div');

        const label = document.createElement('label');
        label.textContent = 'HLS URL:';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter HLS URL';
        input.value = this.data.url || '';
        input.style.width = '100%';

        input.addEventListener('change', (event) => {
            this.data.url = event.target.value;
            if (this.data.url) {
                this.loadVideo(this.data.url);
            }
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        return wrapper;
    }
}

export default HlsVideoBlock;

