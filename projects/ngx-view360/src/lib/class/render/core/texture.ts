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
    sampler: TextureSampler;
    mipmap: boolean;
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
    img: HTMLImageElement;
    imgBitmap: ImageBitmap;
    promise: Promise<any>;

    constructor(img: HTMLImageElement) {
        super();

        this.img = img;
        this.imgBitmap = null;

        if (img.src && img.complete) {
            if (img.naturalWidth) {
                this.promise = this._finishImage();
            } else {
                this.promise = Promise.reject('Image provided had failed to load.');
            }
        } else {
            this.promise = new Promise((resolve, reject) => {
                img.addEventListener('load', () => resolve(this._finishImage()));
                img.addEventListener('error', reject);
            });
        }
    }

    _finishImage() {
        if (window.createImageBitmap) {
            return window.createImageBitmap(this.img).then((imgBitmap) => {
                this.imgBitmap = imgBitmap;
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
        return this.img.width;
    }

    get height() {
        return this.img.height;
    }

    waitForComplete() {
        return this.promise;
    }

    get textureKey() {
        return this.img.src;
    }

    get source() {
        return this.imgBitmap || this.img;
    }
}

export class ImageUrlTexture extends ImageTexture {
    constructor(url: string) {
        const img = new Image();
        super(img);
        img.crossOrigin = 'anonymous';
        img.src = url;
    }
}

let nextDataTextureIndex = 0;

export class DataTexture extends Texture {
    data;
    _width: number;
    _height: number;
    _format;
    _type;
    _key: string;

    constructor(data, width: number, height: number, format = GL.RGBA, type = GL.UNSIGNED_BYTE) {
        super();

        this.data = data;
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

export class VideoTexture extends Texture {
    video: HTMLVideoElement;
    promise: Promise<any>;
    constructor(video) {
        super();

        this.video = video;

        if (video.readyState >= 2) {
            this.promise = Promise.resolve(this);
        } else if (video.error) {
            this.promise = Promise.reject(video.error);
        } else {
            this.promise = new Promise((resolve, reject) => {
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
        return this.video.videoWidth;
    }

    get height() {
        return this.video.videoHeight;
    }

    waitForComplete() {
        return this.promise;
    }

    get textureKey() {
        return this.video.src;
    }

    get source() {
        return this.video;
    }
}

export class VideoUrlTexture extends VideoTexture {
    constructor(url: string) {
        const video: HTMLVideoElement = document.createElement('video');
        super(video);
        video.crossOrigin = 'anonymous';
        video.src = url;
        video.controls = true;
    }
}
