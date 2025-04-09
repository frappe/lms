import Hls from "hls.js";
import { Video } from "lucide-vue-next";
import { createApp, h } from 'vue'

class HlsVideoTool {
    static get toolbox() {
        const app = createApp({
            render: () =>
                h(Video, { size: 18, strokeWidth: 1.5, color: 'black' }),
        })

        const div = document.createElement('div')
        app.mount(div)

        return {
            title: __('HLS Video'),
            icon: div.innerHTML,
        }
    }

    constructor({data, api, config}) {
        this.data = data;
        this.api = api;
        this.config = config;
        this.wrapper = undefined;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('hls-video-wrapper');

        if (this.data && this.data.url) {
            this._createVideo(this.data.url);
        } else {
            this._createPlaceholder();
        }

        return this.wrapper;
    }

    _createPlaceholder() {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Paste HLS URL here...';
        input.classList.add('hls-video-input');
        input.addEventListener('paste', (event) => {
            const url = (event.clipboardData || window.clipboardData).getData('text');
            this._createVideo(url);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this._createVideo(input.value);
            }
        });

        this.wrapper.appendChild(input);
    }

    _createVideo(url) {
        this.wrapper.innerHTML = '';
        const video = document.createElement('video');
        video.controls = true;
        video.classList.add('hls-video');
        this.wrapper.appendChild(video);

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
        }

        this.data.url = url;
    }


    save() {
        return this.data;
    }

    static get isReadOnlySupported() {
        return true;
    }

    renderSettings() {
        const wrapper = document.createElement('div');
        return wrapper;
    }
}

export default HlsVideoTool;