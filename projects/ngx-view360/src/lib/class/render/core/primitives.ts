import { vec3 } from 'gl-matrix';
import { RenderBuffer } from './renderer';

export class PrimitiveAttribute {
    name: string;
    buffer: RenderBuffer;
    componentCount: number;
    componentType: number;
    stride: number;
    byteOffset: number;
    normalized: boolean;

    constructor(name: string, buffer: RenderBuffer, componentCount: number, componentType: number, stride: number, byteOffset: number) {
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
    attributes: PrimitiveAttribute[];
    elementCount: number;
    mode: number;
    indexBuffer: RenderBuffer;
    indexByteOffset: number;
    indexType: number;
    min: vec3;
    max: vec3;

    constructor(attributes: PrimitiveAttribute[], elementCount: number, mode: number) {
        this.attributes = attributes || [];
        this.elementCount = elementCount || 0;
        this.mode = mode || 4; // gl.TRIANGLES;
        this.indexBuffer = null;
        this.indexByteOffset = 0;
        this.indexType = 0;
        this.min = null;
        this.max = null;
    }

    setIndexBuffer(indexBuffer: RenderBuffer, byteOffset: number, indexType: number) {
        this.indexBuffer = indexBuffer;
        this.indexByteOffset = byteOffset || 0;
        this.indexType = indexType || 5123; // gl.UNSIGNED_SHORT;
    }

    setBounds(min: vec3, max: vec3) {
        this.min = vec3.clone(min);
        this.max = vec3.clone(max);
    }
}
