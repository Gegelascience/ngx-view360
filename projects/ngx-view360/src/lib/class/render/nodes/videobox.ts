import { Material, MaterialSampler, MaterialUniform } from '../core/material';
import { Primitive, PrimitiveAttribute } from '../core/primitives';
import { Node } from '../core/node';
import { VideoTexture } from '../core/texture';
import { Renderer } from '../core/renderer';

const GL = WebGLRenderingContext; // For enums

class VideoMaterial extends Material {
    image: MaterialSampler;
    texCoordScaleOffset: MaterialUniform;
    constructor() {
        super();

        this.image = this.defineSampler('diffuse');

        this.texCoordScaleOffset = this.defineUniform('texCoordScaleOffset',
            [1.0, 1.0, 0.0, 0.0,
                1.0, 1.0, 0.0, 0.0], 4);
    }

    get materialName() {
        return 'VIDEO_PLAYER';
    }

    get vertexSource() {
        return `
    uniform int EYE_INDEX;
    uniform vec4 texCoordScaleOffset[2];
    attribute vec3 POSITION;
    attribute vec2 TEXCOORD_0;
    varying vec2 vTexCoord;
    vec4 vertex_main(mat4 proj, mat4 view, mat4 model) {
      vec4 scaleOffset = texCoordScaleOffset[EYE_INDEX];
      vTexCoord = (TEXCOORD_0 * scaleOffset.xy) + scaleOffset.zw;
      vec4 out_vec = proj * view * model * vec4(POSITION, 1.0);
      return out_vec;
    }`;
    }

    get fragmentSource() {
        return `
    uniform sampler2D diffuse;
    varying vec2 vTexCoord;
    vec4 fragment_main() {
      return texture2D(diffuse, vTexCoord);
    }`;
    }
}

export class VideoNode extends Node {
    video: HTMLVideoElement;
    displayMode: string;
    videoTexture: VideoTexture;
    constructor(options) {
        super();

        this.video = options.video;
        this.displayMode = options.displayMode || 'mono';

        this.videoTexture = new VideoTexture(this.video);
    }

    get aspectRatio() {
        let width = this.video.videoWidth;
        let height = this.video.videoHeight;

        switch (this.displayMode) {
            case 'stereoTopBottom': height *= 0.5; break;
            case 'stereoLeftRight': width *= 0.5; break;
        }

        if (!height || !width) {
            return 1;
        }

        return width / height;
    }

    onRendererChanged(renderer: Renderer) {
        const vertices = [
            -1.0, 1.0, 0.0, 0.0, 0.0,
            1.0, 1.0, 0.0, 1.0, 0.0,
            1.0, -1.0, 0.0, 1.0, 1.0,
            -1.0, -1.0, 0.0, 0.0, 1.0,
        ];
        const indices = [
            0, 2, 1,
            0, 3, 2,
        ];

        const vertexBuffer = renderer.createRenderBuffer(GL.ARRAY_BUFFER, new Float32Array(vertices));
        const indexBuffer = renderer.createRenderBuffer(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));

        const attribs = [
            new PrimitiveAttribute('POSITION', vertexBuffer, 3, GL.FLOAT, 20, 0),
            new PrimitiveAttribute('TEXCOORD_0', vertexBuffer, 2, GL.FLOAT, 20, 12),
        ];

        const primitive = new Primitive(attribs, indices.length, 4);
        primitive.setIndexBuffer(indexBuffer, 0, 5123);
        primitive.setBounds([-1.0, -1.0, 0.0], [1.0, 1.0, 0.015]);

        const material = new VideoMaterial();
        material.image.texture = this.videoTexture;

        switch (this.displayMode) {
            case 'mono':
                material.texCoordScaleOffset.value = [1.0, 1.0, 0.0, 0.0,
                    1.0, 1.0, 0.0, 0.0];
                break;
            case 'stereoTopBottom':
                material.texCoordScaleOffset.value = [1.0, 0.5, 0.0, 0.0,
                    1.0, 0.5, 0.0, 0.5];
                break;
            case 'stereoLeftRight':
                material.texCoordScaleOffset.value = [0.5, 1.0, 0.0, 0.0,
                    0.5, 1.0, 0.5, 0.0];
                break;
        }

        const renderPrimitive = renderer.createRenderPrimitive(primitive, material);
        this.addRenderPrimitive(renderPrimitive);
    }
}
