import * as vec3 from 'gl-matrix/cjs/vec3';

export class PrimitiveAttribute {
    name: string;
    buffer;
    componentCount: number;
    componentType: number;
    stride: number;
    byteOffset: number;
    normalized: boolean;

    constructor(name: string, buffer, componentCount: number, componentType: number, stride: number, byteOffset: number) {
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
    elementCount: number;
    mode: number;
    indexBuffer;
    indexByteOffset: number;
    indexType: number;
    _min;
    _max;

    constructor(attributes, elementCount: number, mode: number) {
        this.attributes = attributes || [];
        this.elementCount = elementCount || 0;
        this.mode = mode || 4; // gl.TRIANGLES;
        this.indexBuffer = null;
        this.indexByteOffset = 0;
        this.indexType = 0;
        this._min = null;
        this._max = null;
    }

    setIndexBuffer(indexBuffer, byteOffset: number, indexType: number) {
        this.indexBuffer = indexBuffer;
        this.indexByteOffset = byteOffset || 0;
        this.indexType = indexType || 5123; // gl.UNSIGNED_SHORT;
    }

    setBounds(min, max) {
        this._min = vec3.clone(min);
        this._max = vec3.clone(max);
    }
}
