const GL = WebGLRenderingContext; // For enums

export class TextureSampler {
    minFilter;
    magFilter;
    wrapS;
    wrapT;
    constructor() {
        this.minFilter = null;
        this.magFilter = null;
        this.wrapS = null;
        this.wrapT = null;
    }
}

export class Texture {
    sampler;
    mipmap;
    constructor() {
        this.sampler = new TextureSampler();
        this.mipmap = true;
        // TODO: Anisotropy
    }

    get format() {
        return GL.RGBA;
    }

    get width() {
        return 0;
    }

    get height() {
        return 0;
    }

    get textureKey() {
        return null;
    }
}

export class ImageTexture extends Texture {
    _img;
    _imgBitmap;
    _promise;

    constructor(img) {
        super();

        this._img = img;
        this._imgBitmap = null;

        if (img.src && img.complete) {
            if (img.naturalWidth) {
                this._promise = this._finishImage();
            } else {
                this._promise = Promise.reject('Image provided had failed to load.');
            }
        } else {
            this._promise = new Promise((resolve, reject) => {
                img.addEventListener('load', () => resolve(this._finishImage()));
                img.addEventListener('error', reject);
            });
        }
    }

    _finishImage() {
        if (window.createImageBitmap) {
            return window.createImageBitmap(this._img).then((imgBitmap) => {
                this._imgBitmap = imgBitmap;
                return Promise.resolve(this);
            });
        }
        return Promise.resolve(this);
    }

    get format() {
        // TODO: Can be RGB in some cases.
        return GL.RGBA;
    }

    get width() {
        return this._img.width;
    }

    get height() {
        return this._img.height;
    }

    waitForComplete() {
        return this._promise;
    }

    get textureKey() {
        return this._img.src;
    }

    get source() {
        return this._imgBitmap || this._img;
    }
}

export class UrlTexture extends ImageTexture {
    constructor(url) {
        const img = new Image();
        super(img);
        img.src = url;
    }
}

export class BlobTexture extends ImageTexture {
    constructor(blob) {
        const img = new Image();
        super(img);
        img.src = window.URL.createObjectURL(blob);
    }
}

export class VideoTexture extends Texture {
    _video;
    _promise;

    constructor(video) {
        super();

        this._video = video;

        if (video.readyState >= 2) {
            this._promise = Promise.resolve(this);
        } else if (video.error) {
            this._promise = Promise.reject(video.error);
        } else {
            this._promise = new Promise((resolve, reject) => {
                video.addEventListener('loadeddata', () => resolve(this));
                video.addEventListener('error', reject);
            });
        }
    }

    get format() {
        // TODO: Can be RGB in some cases.
        return GL.RGBA;
    }

    get width() {
        return this._video.videoWidth;
    }

    get height() {
        return this._video.videoHeight;
    }

    waitForComplete() {
        return this._promise;
    }

    get textureKey() {
        return this._video.src;
    }

    get source() {
        return this._video;
    }
}

let nextDataTextureIndex = 0;

export class DataTexture extends Texture {
    _data;
    _width;
    _height;
    _format;
    _type;
    _key;

    constructor(data, width, height, format = GL.RGBA, type = GL.UNSIGNED_BYTE) {
        super();

        this._data = data;
        this._width = width;
        this._height = height;
        this._format = format;
        this._type = type;
        this._key = `DATA_${nextDataTextureIndex}`;
        nextDataTextureIndex++;
    }

    get format() {
        return this._format;
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get textureKey() {
        return this._key;
    }
}

export class ColorTexture extends DataTexture {

    constructor(r, g, b, a) {
        const colorData = new Uint8Array([r * 255.0, g * 255.0, b * 255.0, a * 255.0]);
        super(colorData, 1, 1);

        this.mipmap = false;
        this._key = `COLOR_${colorData[0]}_${colorData[1]}_${colorData[2]}_${colorData[3]}`;
    }
}
