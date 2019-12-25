import { Node } from '../core/node';
import { Gltf2Loader } from '../loader/gltf2';

// Using a weak map here allows us to cache a loader per-renderer without
// modifying the renderer object or leaking memory when it's garbage collected.
let gltfLoaderMap = new WeakMap();

export class Gltf2Node extends Node {
    _url;
    _promise;
    _resolver;
    _rejecter;

    constructor(options) {
        super();
        this._url = options.url;

        this._promise = null;
        this._resolver = null;
        this._rejecter = null;
    }

    onRendererChanged(renderer) {
        let loader = gltfLoaderMap.get(renderer);
        if (!loader) {
            loader = new Gltf2Loader(renderer);
            gltfLoaderMap.set(renderer, loader);
        }

        // Do we have a previously resolved promise? If so clear it.
        if (!this._resolver && this._promise) {
            this._promise = null;
        }

        this._ensurePromise();

        loader.loadFromUrl(this._url).then((sceneNode) => {
            this.addNode(sceneNode);
            this._resolver(sceneNode.waitForComplete());
            this._resolver = null;
            this._rejecter = null;
        }).catch((err) => {
            this._rejecter(err);
            this._resolver = null;
            this._rejecter = null;
        });
    }

    _ensurePromise() {
        if (!this._promise) {
            this._promise = new Promise((resolve, reject) => {
                this._resolver = resolve;
                this._rejecter = reject;
            });
        }
        return this._promise;
    }

    waitForComplete() {
        return this._ensurePromise();
    }
}
