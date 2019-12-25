import { vec3 } from '../math/gl-matrix';

export class PrimitiveAttribute {
    name;
    buffer;
    componentCount;
    componentType;
    stride;
    byteOffset;
    normalized;

    constructor(name, buffer, componentCount, componentType, stride, byteOffset) {
        this.name = name;
        this.buffer = buffer;
        this.componentCount = componentCount || 3;
        this.componentType = componentType || 5126; // gl.FLOAT;
        this.stride = stride || 0;
        this.byteOffset = byteOffset || 0;
        this.normalized = false;
    }
}

export class Primitive {
    attributes;
    elementCount;
    mode;
    indexBuffer;
    indexByteOffset;
    indexType;
    _min;
    _max;

    constructor(attributes, elementCount, mode) {
        this.attributes = attributes || [];
        this.elementCount = elementCount || 0;
        this.mode = mode || 4; // gl.TRIANGLES;
        this.indexBuffer = null;
        this.indexByteOffset = 0;
        this.indexType = 0;
        this._min = null;
        this._max = null;
    }

    setIndexBuffer(indexBuffer, byteOffset, indexType) {
        this.indexBuffer = indexBuffer;
        this.indexByteOffset = byteOffset || 0;
        this.indexType = indexType || 5123; // gl.UNSIGNED_SHORT;
    }

    setBounds(min, max) {
        this._min = vec3.clone(min);
        this._max = vec3.clone(max);
    }
}
