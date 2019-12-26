import { PbrMaterial } from '../materials/pbr.js';
import { Node } from '../core/node';
import { Primitive, PrimitiveAttribute } from '../core/primitives';
import { ImageTexture, ColorTexture } from '../core/texture';

const GL = WebGLRenderingContext; // For enums

const GLB_MAGIC = 0x46546C67;
const CHUNK_TYPE = {
    JSON: 0x4E4F534A,
    BIN: 0x004E4942,
};

function isAbsoluteUri(uri) {
    const absRegEx = new RegExp('^' + window.location.protocol, 'i');
    return !!uri.match(absRegEx);
}

function isDataUri(uri) {
    const dataRegEx = /^data:/;
    return !!uri.match(dataRegEx);
}

function resolveUri(uri, baseUrl) {
    if (isAbsoluteUri(uri) || isDataUri(uri)) {
        return uri;
    }
    return baseUrl + uri;
}

function getComponentCount(type) {
    switch (type) {
        case 'SCALAR': return 1;
        case 'VEC2': return 2;
        case 'VEC3': return 3;
        case 'VEC4': return 4;
        default: return 0;
    }
}

/**
 * Gltf2SceneLoader
 * Loads glTF 2.0 scenes into a renderable node tree.
 */

export class Gltf2Loader {
    renderer;
    _gl;

    constructor(renderer) {
        this.renderer = renderer;
        this._gl = renderer._gl;
    }

    loadFromUrl(url) {
        return fetch(url)
            .then((response) => {
                const i = url.lastIndexOf('/');
                const baseUrl = (i !== 0) ? url.substring(0, i + 1) : '';

                if (url.endsWith('.gltf')) {
                    return response.json().then((json) => {
                        return this.loadFromJson(json, baseUrl, false);
                    });
                } else if (url.endsWith('.glb')) {
                    return response.arrayBuffer().then((arrayBuffer) => {
                        return this.loadFromBinary(arrayBuffer, baseUrl);
                    });
                } else {
                    throw new Error('Unrecognized file extension');
                }
            });
    }

    loadFromBinary(arrayBuffer, baseUrl) {
        const headerView = new DataView(arrayBuffer, 0, 12);
        const magic = headerView.getUint32(0, true);
        const version = headerView.getUint32(4, true);
        const length = headerView.getUint32(8, true);

        if (magic != GLB_MAGIC) {
            throw new Error('Invalid magic string in binary header.');
        }

        if (version != 2) {
            throw new Error('Incompatible version in binary header.');
        }

        const chunks = {};
        let chunkOffset = 12;
        while (chunkOffset < length) {
            const chunkHeaderView = new DataView(arrayBuffer, chunkOffset, 8);
            const chunkLength = chunkHeaderView.getUint32(0, true);
            const chunkType = chunkHeaderView.getUint32(4, true);
            chunks[chunkType] = arrayBuffer.slice(chunkOffset + 8, chunkOffset + 8 + chunkLength);
            chunkOffset += chunkLength + 8;
        }

        if (!chunks[CHUNK_TYPE.JSON]) {
            throw new Error('File contained no json chunk.');
        }

        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(chunks[CHUNK_TYPE.JSON]);
        const json = JSON.parse(jsonString);
        return this.loadFromJson(json, baseUrl, chunks[CHUNK_TYPE.BIN]);
    }

    loadFromJson(json, baseUrl, binaryChunk) {
        if (!json.asset) {
            throw new Error('Missing asset description.');
        }

        if (json.asset.minVersion != '2.0' && json.asset.version != '2.0') {
            throw new Error('Incompatible asset version.');
        }

        const buffers = [];
        if (binaryChunk) {
            buffers[0] = new Gltf2Resource({}, baseUrl, binaryChunk);
        } else {
            for (const buffer of json.buffers) {
                buffers.push(new Gltf2Resource(buffer, baseUrl, false));
            }
        }

        const bufferViews = [];
        for (const bufferView of json.bufferViews) {
            bufferViews.push(new Gltf2BufferView(bufferView, buffers));
        }

        const images = [];
        if (json.images) {
            for (const image of json.images) {
                images.push(new Gltf2Resource(image, baseUrl, false));
            }
        }

        const textures = [];
        if (json.textures) {
            for (const texture of json.textures) {
                const image = images[texture.source];
                const glTexture = image.texture(bufferViews);
                if (texture.sampler) {
                    /*let sampler = sampler[texture.sampler];
                    glTexture.sampler.minFilter = sampler.minFilter;
                    glTexture.sampler.magFilter = sampler.magFilter;
                    glTexture.sampler.wrapS = sampler.wrapS;
                    glTexture.sampler.wrapT = sampler.wrapT;*/
                }
                textures.push(glTexture);
            }
        }

        function getTexture(textureInfo) {
            if (!textureInfo) {
                return null;
            }
            return textures[textureInfo.index];
        }

        const materials = [];
        if (json.materials) {
            for (const material of json.materials) {
                const glMaterial = new PbrMaterial();
                const pbr = material.pbrMetallicRoughness || {};

                glMaterial.baseColorFactor.value = pbr.baseColorFactor || [1, 1, 1, 1];
                glMaterial.baseColor.texture = getTexture(pbr.baseColorTexture);
                glMaterial.metallicRoughnessFactor.value = [
                    pbr.metallicFactor || 1.0,
                    pbr.roughnessFactor || 1.0,
                ];
                glMaterial.metallicRoughness.texture = getTexture(pbr.metallicRoughnessTexture);
                glMaterial.normal.texture = getTexture(json.normalTexture);
                glMaterial.occlusion.texture = getTexture(json.occlusionTexture);
                glMaterial.occlusionStrength.value = (json.occlusionTexture && json.occlusionTexture.strength) ?
                    json.occlusionTexture.strength : 1.0;
                glMaterial.emissiveFactor.value = material.emissiveFactor || [0, 0, 0];
                glMaterial.emissive.texture = getTexture(json.emissiveTexture);
                if (!glMaterial.emissive.texture && json.emissiveFactor) {
                    glMaterial.emissive.texture = new ColorTexture(1.0, 1.0, 1.0, 1.0);
                }

                switch (material.alphaMode) {
                    case 'BLEND':
                        glMaterial.state.blend = true;
                        break;
                    case 'MASK':
                        // Not really supported.
                        glMaterial.state.blend = true;
                        break;
                    default: // Includes 'OPAQUE'
                        glMaterial.state.blend = false;
                }

                // glMaterial.alpha_mode = material.alphaMode;
                // glMaterial.alpha_cutoff = material.alphaCutoff;
                glMaterial.state.cullFace = !(material.doubleSided);

                materials.push(glMaterial);
            }
        }

        const accessors = json.accessors;

        const meshes = [];
        for (const mesh of json.meshes) {
            const glMesh = new Gltf2Mesh();
            meshes.push(glMesh);

            for (const primitive of mesh.primitives) {
                let material = null;
                if ('material' in primitive) {
                    material = materials[primitive.material];
                } else {
                    // Create a "default" material if the primitive has none.
                    material = new PbrMaterial();
                }

                const attributes = [];
                let elementCount = 0;
                /* let glPrimitive = new Gltf2Primitive(primitive, material);
                glMesh.primitives.push(glPrimitive); */

                let min = null;
                let max = null;

                for (const name in primitive.attributes) {
                    const accessor = accessors[primitive.attributes[name]];
                    const bufferView = bufferViews[accessor.bufferView];
                    elementCount = accessor.count;

                    const glAttribute = new PrimitiveAttribute(
                        name,
                        bufferView.renderBuffer(this.renderer, GL.ARRAY_BUFFER),
                        getComponentCount(accessor.type),
                        accessor.componentType,
                        bufferView.byteStride || 0,
                        accessor.byteOffset || 0
                    );
                    glAttribute.normalized = accessor.normalized || false;

                    if (name == 'POSITION') {
                        min = accessor.min;
                        max = accessor.max;
                    }

                    attributes.push(glAttribute);
                }

                const glPrimitive = new Primitive(attributes, elementCount, primitive.mode);

                if ('indices' in primitive) {
                    const accessor = accessors[primitive.indices];
                    const bufferView = bufferViews[accessor.bufferView];

                    glPrimitive.setIndexBuffer(
                        bufferView.renderBuffer(this.renderer, GL.ELEMENT_ARRAY_BUFFER),
                        accessor.byteOffset || 0,
                        accessor.componentType
                    );
                    glPrimitive.indexType = accessor.componentType;
                    glPrimitive.indexByteOffset = accessor.byteOffset || 0;
                    glPrimitive.elementCount = accessor.count;
                }

                if (min && max) {
                    glPrimitive.setBounds(min, max);
                }

                // After all the attributes have been processed, get a program that is
                // appropriate for both the material and the primitive attributes.
                glMesh.primitives.push(
                    this.renderer.createRenderPrimitive(glPrimitive, material));
            }
        }

        const sceneNode = new Node();
        const scene = json.scenes[json.scene];
        for (const nodeId of scene.nodes) {
            const node = json.nodes[nodeId];
            sceneNode.addNode(
                this.processNodes(node, json.nodes, meshes));
        }

        return sceneNode;
    }

    processNodes(node, nodes, meshes) {
        const glNode = new Node();
        glNode.name = node.name;

        if ('mesh' in node) {
            const mesh = meshes[node.mesh];
            for (const primitive of mesh.primitives) {
                glNode.addRenderPrimitive(primitive);
            }
        }

        if (node.matrix) {
            glNode.matrix = new Float32Array(node.matrix);
        } else if (node.translation || node.rotation || node.scale) {
            if (node.translation) {
                glNode.translation = new Float32Array(node.translation);
            }

            if (node.rotation) {
                glNode.rotation = new Float32Array(node.rotation);
            }

            if (node.scale) {
                glNode.scale = new Float32Array(node.scale);
            }
        }

        if (node.children) {
            for (const nodeId of node.children) {
                const node = nodes[nodeId];
                glNode.addNode(this.processNodes(node, nodes, meshes));
            }
        }

        return glNode;
    }
}

class Gltf2Mesh {
    primitives;
    constructor() {
        this.primitives = [];
    }
}

class Gltf2BufferView {
    buffer;
    byteOffset;
    byteLength;
    byteStride;
    _viewPromise;
    _renderBuffer;
    constructor(json, buffers) {
        this.buffer = buffers[json.buffer];
        this.byteOffset = json.byteOffset || 0;
        this.byteLength = json.byteLength || null;
        this.byteStride = json.byteStride;

        this._viewPromise = null;
        this._renderBuffer = null;
    }

    dataView() {
        if (!this._viewPromise) {
            this._viewPromise = this.buffer.arrayBuffer().then((arrayBuffer) => {
                return new DataView(arrayBuffer, this.byteOffset, this.byteLength);
            });
        }
        return this._viewPromise;
    }

    renderBuffer(renderer, target) {
        if (!this._renderBuffer) {
            this._renderBuffer = renderer.createRenderBuffer(target, this.dataView());
        }
        return this._renderBuffer;
    }
}

class Gltf2Resource {
    json;
    baseUrl;
    _dataPromise;
    _texture;
    constructor(json, baseUrl, arrayBuffer) {
        this.json = json;
        this.baseUrl = baseUrl;

        this._dataPromise = null;
        this._texture = null;
        if (arrayBuffer) {
            this._dataPromise = Promise.resolve(arrayBuffer);
        }
    }

    arrayBuffer() {
        if (!this._dataPromise) {
            if (isDataUri(this.json.uri)) {
                const base64String = this.json.uri.replace('data:application/octet-stream;base64,', '');
                const binaryArray = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
                this._dataPromise = Promise.resolve(binaryArray.buffer);
                return this._dataPromise;
            }

            this._dataPromise = fetch(resolveUri(this.json.uri, this.baseUrl))
                .then((response) => response.arrayBuffer());
        }
        return this._dataPromise;
    }

    texture(bufferViews) {
        if (!this._texture) {
            const img = new Image();
            this._texture = new ImageTexture(img);

            if (this.json.uri) {
                if (isDataUri(this.json.uri)) {
                    img.src = this.json.uri;
                } else {
                    img.src = `${this.baseUrl}${this.json.uri}`;
                }
            } else {
                const view = bufferViews[this.json.bufferView];
                view.dataView().then((dataView) => {
                    const blob = new Blob([dataView], { type: this.json.mimeType });
                    img.src = window.URL.createObjectURL(blob);
                });
            }
        }
        return this._texture;
    }
}
