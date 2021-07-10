import { CAP, Material, MaterialSampler, MaterialUniform, MAT_STATE, RENDER_ORDER, stateToBlendFunc } from './material';
import { Node } from './node';
import { Program } from './program';
import { DataTexture, ImageUrlTexture, Texture, VideoTexture } from './texture';
import { mat4, vec3 } from 'gl-matrix';
import { Primitive } from './primitives';

declare var XRRigidTransform: any;

export const ATTRIB = {
    POSITION: 1,
    NORMAL: 2,
    TANGENT: 3,
    TEXCOORD_0: 4,
    TEXCOORD_1: 5,
    COLOR_0: 6,
};

export const ATTRIB_MASK = {
    POSITION: 0x0001,
    NORMAL: 0x0002,
    TANGENT: 0x0004,
    TEXCOORD_0: 0x0008,
    TEXCOORD_1: 0x0010,
    COLOR_0: 0x0020,
};

const GL = WebGLRenderingContext; // For enums

const DEF_LIGHT_DIR = new Float32Array([-0.1, -1.0, -0.2]);
const DEF_LIGHT_COLOR = new Float32Array([3.0, 3.0, 3.0]);

const PRECISION_REGEX = new RegExp('precision (lowp|mediump|highp) float;');

const VERTEX_SHADER_SINGLE_ENTRY = `
uniform mat4 PROJECTION_MATRIX, VIEW_MATRIX, MODEL_MATRIX;

void main() {
  gl_Position = vertex_main(PROJECTION_MATRIX, VIEW_MATRIX, MODEL_MATRIX);
}
`;

const VERTEX_SHADER_MULTI_ENTRY = `
#ERROR Multiview rendering is not implemented
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_ENTRY = `
void main() {
  gl_FragColor = fragment_main();
}
`;

function isPowerOfTwo(n) {
    // tslint:disable-next-line:no-bitwise
    return (n & (n - 1)) === 0;
}

// Creates a WebGL context and initializes it with some common default state.
export function createWebGLContext(glAttribs, canvas) {
    glAttribs = glAttribs || { alpha: false };

    const contextTypes = glAttribs.webgl2 ? ['webgl2'] : ['webgl', 'experimental-webgl'];
    let context = null;

    for (const contextType of contextTypes) {
        context = canvas.getContext(contextType, glAttribs);
        if (context) {
            break;
        }
    }

    if (!context) {
        const webglType = (glAttribs.webgl2 ? 'WebGL 2' : 'WebGL');
        console.error('This browser does not support ' + webglType + '.');
        return null;
    }

    return context;
}

export class RenderView {
    projectionMatrix;
    viewport;
    _eye: string;
    eyeIndex: number;
    viewMatrix;
    viewTransform;

    constructor(projectionMatrix, viewTransform, viewport = null, eye = 'left') {
        this.projectionMatrix = projectionMatrix;
        this.viewport = viewport;
        // If an eye isn't given the left eye is assumed.
        this._eye = eye;
        this.eyeIndex = (eye === 'left' ? 0 : 1);

        // Compute the view matrix
        if (viewTransform instanceof Float32Array) {
            this.viewMatrix = mat4.clone(viewTransform);
            this.viewTransform = new XRRigidTransform(); // TODO
        } else {
            this.viewTransform = viewTransform;
            this.viewMatrix = viewTransform.inverse.matrix;
        }
    }

    get eye() {
        return this._eye;
    }

    set eye(value) {
        this._eye = value;
        this.eyeIndex = (value === 'left' ? 0 : 1);
    }
}

export class RenderBuffer {
    target: number;
    usage: number;
    length: number;
    buffer: WebGLBuffer;
    promise: Promise<any>;
    constructor(target: number, usage: number, buffer: WebGLBuffer, length = 0) {
        this.target = target;
        this.usage = usage;
        this.length = length;
        if (buffer instanceof Promise) {
            this.buffer = null;
            this.promise = buffer.then((buff) => {
                this.buffer = buff;
                return this;
            });
        } else {
            this.buffer = buffer;
            this.promise = Promise.resolve(this);
        }
    }

    waitForComplete() {
        return this.promise;
    }
}

class RenderPrimitiveAttribute {
    attribIndex: number;
    componentCount: number;
    componentType: number;
    stride: number;
    byteOffset: number;
    normalized: boolean;

    constructor(primitiveAttribute) {
        this.attribIndex = ATTRIB[primitiveAttribute.name];
        this.componentCount = primitiveAttribute.componentCount;
        this.componentType = primitiveAttribute.componentType;
        this.stride = primitiveAttribute.stride;
        this.byteOffset = primitiveAttribute.byteOffset;
        this.normalized = primitiveAttribute.normalized;
    }
}

class RenderPrimitiveAttributeBuffer {
    buffer: RenderBuffer;
    attributes: RenderPrimitiveAttribute[];
    constructor(buffer: RenderBuffer) {
        this.buffer = buffer;
        this.attributes = [];
    }
}

export class RenderPrimitive {
    activeFrameId: number;
    instances: Node[];
    material: RenderMaterial;
    mode: number;
    elementCount: number;
    promise: Promise<any>;
    vao: WebGLVertexArrayObjectOES;
    complete: boolean;
    attributeBuffers: RenderPrimitiveAttributeBuffer[];
    attributeMask: number;
    indexBuffer: RenderBuffer;
    indexByteOffset: number;
    indexType: number;
    min: vec3;
    max: vec3;

    constructor(primitive: Primitive) {
        this.activeFrameId = 0;
        this.instances = [];
        this.material = null;

        this.setPrimitive(primitive);
    }

    setPrimitive(primitive: Primitive) {
        this.mode = primitive.mode;
        this.elementCount = primitive.elementCount;
        this.promise = null;
        this.vao = null;
        this.complete = false;
        this.attributeBuffers = [];
        this.attributeMask = 0;

        for (const attribute of primitive.attributes) {
            // tslint:disable-next-line:no-bitwise
            this.attributeMask |= ATTRIB_MASK[attribute.name];
            const renderAttribute = new RenderPrimitiveAttribute(attribute);
            let foundBuffer = false;
            for (const attributeBuffer of this.attributeBuffers) {
                if (attributeBuffer.buffer === attribute.buffer) {
                    attributeBuffer.attributes.push(renderAttribute);
                    foundBuffer = true;
                    break;
                }
            }
            if (!foundBuffer) {
                const attributeBuffer = new RenderPrimitiveAttributeBuffer(attribute.buffer);
                attributeBuffer.attributes.push(renderAttribute);
                this.attributeBuffers.push(attributeBuffer);
            }
        }

        this.indexBuffer = null;
        this.indexByteOffset = 0;
        this.indexType = 0;

        if (primitive.indexBuffer) {
            this.indexByteOffset = primitive.indexByteOffset;
            this.indexType = primitive.indexType;
            this.indexBuffer = primitive.indexBuffer;
        }

        if (primitive.min) {
            this.min = vec3.clone(primitive.min);
            this.max = vec3.clone(primitive.max);
        } else {
            this.min = null;
            this.max = null;
        }

        if (this.material != null) {
            this.waitForComplete(); // To flip the complete flag.
        }
    }

    setRenderMaterial(material: RenderMaterial) {
        this.material = material;
        this.promise = null;
        this.complete = false;

        if (this.material != null) {
            this.waitForComplete(); // To flip the complete flag.
        }
    }

    markActive(frameId: number) {
        if (this.complete && this.activeFrameId !== frameId) {
            if (this.material) {
                if (!this.material.markActive(frameId)) {
                    return;
                }
            }
            this.activeFrameId = frameId;
        }
    }

    get samplers() {
        return this.material.samplerDictionary;
    }

    get uniforms() {
        return this.material.uniformDictionary;
    }

    waitForComplete() {
        if (!this.promise) {
            if (!this.material) {
                return Promise.reject('RenderPrimitive does not have a material');
            }

            const completionPromises = [];

            for (const attributeBuffer of this.attributeBuffers) {
                if (!attributeBuffer.buffer.buffer) {
                    completionPromises.push(attributeBuffer.buffer.promise);
                }
            }

            if (this.indexBuffer && !this.indexBuffer.buffer) {
                completionPromises.push(this.indexBuffer.promise);
            }

            this.promise = Promise.all(completionPromises).then(() => {
                this.complete = true;
                return this;
            });
        }
        return this.promise;
    }
}

export class RenderTexture {
    texture: WebGLTexture;
    complete: boolean;
    activeFrameId: number;
    _activeCallback;

    constructor(texture: WebGLTexture) {
        this.texture = texture;
        this.complete = false;
        this.activeFrameId = 0;
        this._activeCallback = null;
    }

    markActive(frameId: number) {
        if (this._activeCallback && this.activeFrameId !== frameId) {
            this.activeFrameId = frameId;
            this._activeCallback(this);
        }
    }
}

const inverseMatrix = mat4.create();

function setCap(gl, glEnum, cap, prevState, state) {
    // tslint:disable-next-line:no-bitwise
    const change = (state & cap) - (prevState & cap);
    if (!change) {
        return;
    }

    if (change > 0) {
        gl.enable(glEnum);
    } else {
        gl.disable(glEnum);
    }
}

class RenderMaterialSampler {
    renderer: Renderer;
    uniformName: string;
    renderTexture: RenderTexture;
    index: number;

    constructor(renderer: Renderer, materialSampler: MaterialSampler, index: number) {
        this.renderer = renderer;
        this.uniformName = materialSampler.uniformName;
        this.renderTexture = renderer._getRenderTexture(materialSampler.texture);
        this.index = index;
    }

    set texture(value: Texture) {
        this.renderTexture = this.renderer._getRenderTexture(value);
    }
}

class RenderMaterialUniform {
    uniformName: string;
    uniform: WebGLUniformLocation;
    length: number;
    _value;

    constructor(materialUniform: MaterialUniform) {
        this.uniformName = materialUniform.uniformName;
        this.uniform = null;
        this.length = materialUniform.length;
        if (materialUniform.value instanceof Array) {
            this._value = new Float32Array(materialUniform.value);
        } else {
            this._value = new Float32Array([materialUniform.value]);
        }
    }

    set value(value) {
        if (this._value.length === 1) {
            this._value[0] = value;
        } else {
            for (let i = 0; i < this._value.length; ++i) {
                this._value[i] = value[i];
            }
        }
    }
}

class RenderMaterial {
    program: Program;
    state: number;
    activeFrameId: number;
    completeForActiveFrame: boolean;
    samplerDictionary;
    samplers: RenderMaterialSampler[];
    uniformDictionary;
    uniforms: RenderMaterialUniform[];
    firstBind: boolean;
    renderOrder: number;

    constructor(renderer: Renderer, material: Material, program: Program) {
        this.program = program;
        this.state = material.state.state;
        this.activeFrameId = 0;
        this.completeForActiveFrame = false;

        this.samplerDictionary = {};
        this.samplers = [];
        for (let i = 0; i < material.samplers.length; ++i) {
            const renderSampler = new RenderMaterialSampler(renderer, material.samplers[i], i);
            this.samplers.push(renderSampler);
            this.samplerDictionary[renderSampler.uniformName] = renderSampler;
        }

        this.uniformDictionary = {};
        this.uniforms = [];
        for (const uniform of material.uniforms) {
            const renderUniform = new RenderMaterialUniform(uniform);
            this.uniforms.push(renderUniform);
            this.uniformDictionary[renderUniform.uniformName] = renderUniform;
        }

        this.firstBind = true;

        this.renderOrder = material.renderOrder;
        if (this.renderOrder === RENDER_ORDER.DEFAULT) {
            // tslint:disable-next-line:no-bitwise
            if (this.state & CAP.BLEND) {
                this.renderOrder = RENDER_ORDER.TRANSPARENT;
            } else {
                this.renderOrder = RENDER_ORDER.OPAQUE;
            }
        }
    }

    bind(gl: WebGLRenderingContext) {
        // First time we do a binding, cache the uniform locations and remove
        // unused uniforms from the list.
        if (this.firstBind) {
            for (let i = 0; i < this.samplers.length;) {
                const sampler = this.samplers[i];
                if (!this.program.uniform[sampler.uniformName]) {
                    this.samplers.splice(i, 1);
                    continue;
                }
                ++i;
            }

            for (let i = 0; i < this.uniforms.length;) {
                const uniform = this.uniforms[i];
                uniform.uniform = this.program.uniform[uniform.uniformName];
                if (!uniform.uniform) {
                    this.uniforms.splice(i, 1);
                    continue;
                }
                ++i;
            }
            this.firstBind = false;
        }

        for (const sampler of this.samplers) {
            gl.activeTexture(gl.TEXTURE0 + sampler.index);
            if (sampler.renderTexture && sampler.renderTexture.complete) {
                gl.bindTexture(gl.TEXTURE_2D, sampler.renderTexture.texture);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
        }

        for (const uniform of this.uniforms) {
            switch (uniform.length) {
                case 1: gl.uniform1fv(uniform.uniform, uniform._value); break;
                case 2: gl.uniform2fv(uniform.uniform, uniform._value); break;
                case 3: gl.uniform3fv(uniform.uniform, uniform._value); break;
                case 4: gl.uniform4fv(uniform.uniform, uniform._value); break;
            }
        }
    }

    markActive(frameId: number) {
        if (this.activeFrameId !== frameId) {
            this.activeFrameId = frameId;
            this.completeForActiveFrame = true;
            for (const sampler of this.samplers) {
                if (sampler.renderTexture) {
                    if (!sampler.renderTexture.complete) {
                        this.completeForActiveFrame = false;
                        break;
                    }
                    sampler.renderTexture.markActive(frameId);
                }
            }
        }
        return this.completeForActiveFrame;
    }

    // Material State fetchers
    get cullFace() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.CULL_FACE);
    }
    get blend() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.BLEND);
    }
    get depthTest() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.DEPTH_TEST);
    }
    get stencilTest() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.STENCIL_TEST);
    }
    get colorMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.COLOR_MASK);
    }
    get depthMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.DEPTH_MASK);
    }
    get stencilMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.STENCIL_MASK);
    }
    get depthFunc() {
        // tslint:disable-next-line:no-bitwise
        return ((this.state & MAT_STATE.DEPTH_FUNC_RANGE) >> MAT_STATE.DEPTH_FUNC_SHIFT) + GL.NEVER;
    }
    get blendFuncSrc() {
        return stateToBlendFunc(this.state, MAT_STATE.BLEND_SRC_RANGE, MAT_STATE.BLEND_SRC_SHIFT);
    }
    get blendFuncDst() {
        return stateToBlendFunc(this.state, MAT_STATE.BLEND_DST_RANGE, MAT_STATE.BLEND_DST_SHIFT);
    }

    // Only really for use from the renderer
    _capsDiff(otherState: number) {
        // tslint:disable-next-line:no-bitwise
        return (otherState & MAT_STATE.CAPS_RANGE) ^ (this.state & MAT_STATE.CAPS_RANGE);
    }

    _blendDiff(otherState: number) {
        // tslint:disable-next-line:no-bitwise
        if (!(this.state & CAP.BLEND)) {
            return 0;
        }
        // tslint:disable-next-line:no-bitwise
        return (otherState & MAT_STATE.BLEND_FUNC_RANGE) ^ (this.state & MAT_STATE.BLEND_FUNC_RANGE);
    }

    _depthFuncDiff(otherState: number) {
        // tslint:disable-next-line:no-bitwise
        if (!(this.state & CAP.DEPTH_TEST)) {
            return 0;
        }
        // tslint:disable-next-line:no-bitwise
        return (otherState & MAT_STATE.DEPTH_FUNC_RANGE) ^ (this.state & MAT_STATE.DEPTH_FUNC_RANGE);
    }
}

export class Renderer {
    gl: WebGLRenderingContext;
    frameId: number;
    programCache;
    textureCache;
    renderPrimitives: RenderPrimitive[][];
    cameraPositions;
    vaoExt: OES_vertex_array_object;
    defaultFragPrecision: string;
    depthMaskNeedsReset: boolean;
    colorMaskNeedsReset: boolean;
    _globalLightColor;
    _globalLightDir;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.frameId = 0;
        this.programCache = {};
        this.textureCache = {};
        this.renderPrimitives = Array(RENDER_ORDER.DEFAULT);
        this.cameraPositions = [];

        this.vaoExt = gl.getExtension('OES_vertex_array_object');

        const fragHighPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        this.defaultFragPrecision = fragHighPrecision.precision > 0 ? 'highp' : 'mediump';

        this.depthMaskNeedsReset = false;
        this.colorMaskNeedsReset = false;

        this._globalLightColor = vec3.clone(DEF_LIGHT_COLOR);
        this._globalLightDir = vec3.clone(DEF_LIGHT_DIR);
    }

    set globalLightColor(value) {
        vec3.copy(this._globalLightColor, value);
    }

    get globalLightColor() {
        return vec3.clone(this._globalLightColor);
    }

    set globalLightDir(value) {
        vec3.copy(this._globalLightDir, value);
    }

    get globalLightDir() {
        return vec3.clone(this._globalLightDir);
    }

    createRenderBuffer(target: number, data, usage = GL.STATIC_DRAW) {
        const gl = this.gl;
        const glBuffer = gl.createBuffer();

        if (data instanceof Promise) {
            const renderBuffer = new RenderBuffer(target, usage, data.then((d) => {
                gl.bindBuffer(target, glBuffer);
                gl.bufferData(target, d, usage);
                renderBuffer.length = d.byteLength;
                return glBuffer;
            }));
            return renderBuffer;
        } else {
            gl.bindBuffer(target, glBuffer);
            gl.bufferData(target, data, usage);
            return new RenderBuffer(target, usage, glBuffer, data.byteLength);
        }
    }

    updateRenderBuffer(buffer: RenderBuffer, data, offset = 0) {
        if (buffer.buffer) {
            const gl = this.gl;
            gl.bindBuffer(buffer.target, buffer.buffer);
            if (offset === 0 && buffer.length === data.byteLength) {
                gl.bufferData(buffer.target, data, buffer.usage);
            } else {
                gl.bufferSubData(buffer.target, offset, data);
            }
        } else {
            buffer.waitForComplete().then((buff) => {
                this.updateRenderBuffer(buff, data, offset);
            });
        }
    }

    createRenderPrimitive(primitive: Primitive, material: Material) {
        const renderPrimitive = new RenderPrimitive(primitive);

        const program = this._getMaterialProgram(material, renderPrimitive);
        const renderMaterial = new RenderMaterial(this, material, program);
        renderPrimitive.setRenderMaterial(renderMaterial);

        if (!this.renderPrimitives[renderMaterial.renderOrder]) {
            this.renderPrimitives[renderMaterial.renderOrder] = [];
        }

        this.renderPrimitives[renderMaterial.renderOrder].push(renderPrimitive);

        return renderPrimitive;
    }

    createMesh(primitive: Primitive, material: Material) {
        const meshNode = new Node();
        meshNode.addRenderPrimitive(this.createRenderPrimitive(primitive, material));
        return meshNode;
    }

    drawViews(views: RenderView[], rootNode: Node) {
        if (!rootNode) {
            return;
        }

        const gl = this.gl;
        this.frameId++;

        rootNode.markActive(this.frameId);

        // If there's only one view then flip the algorithm a bit so that we're only
        // setting the viewport once.
        if (views.length === 1 && views[0].viewport) {
            const vp = views[0].viewport;
            this.gl.viewport(vp.x, vp.y, vp.width, vp.height);
        }

        // Get the positions of the 'camera' for each view matrix.
        for (let i = 0; i < views.length; ++i) {
            if (this.cameraPositions.length <= i) {
                this.cameraPositions.push(vec3.create());
            }
            const p = views[i].viewTransform.position;
            this.cameraPositions[i][0] = p.x;
            this.cameraPositions[i][1] = p.y;
            this.cameraPositions[i][2] = p.z;

            /*mat4.invert(inverseMatrix, views[i].viewMatrix);
            let cameraPosition = this.cameraPositions[i];
            vec3.set(cameraPosition, 0, 0, 0);
            vec3.transformMat4(cameraPosition, cameraPosition, inverseMatrix);*/
        }

        // Draw each set of render primitives in order
        for (const renderPrimitives of this.renderPrimitives) {
            if (renderPrimitives && renderPrimitives.length) {
                this._drawRenderPrimitiveSet(views, renderPrimitives);
            }
        }

        if (this.vaoExt) {
            this.vaoExt.bindVertexArrayOES(null);
        }

        if (this.depthMaskNeedsReset) {
            gl.depthMask(true);
        }
        if (this.colorMaskNeedsReset) {
            gl.colorMask(true, true, true, true);
        }
    }

    _drawRenderPrimitiveSet(views: RenderView[], renderPrimitives: RenderPrimitive[]) {
        const gl = this.gl;
        let program = null;
        let material = null;
        let attribMask = 0;

        // Loop through every primitive known to the renderer.
        for (const primitive of renderPrimitives) {
            // Skip over those that haven't been marked as active for this frame.
            if (primitive.activeFrameId !== this.frameId) {
                continue;
            }

            // Bind the primitive material's program if it's different than the one we
            // were using for the previous primitive.
            // TODO: The ording of this could be more efficient.
            if (program !== primitive.material.program) {
                program = primitive.material.program;
                program.use();

                if (program.uniform.LIGHT_DIRECTION) {
                    gl.uniform3fv(program.uniform.LIGHT_DIRECTION, this._globalLightDir);
                }

                if (program.uniform.LIGHT_COLOR) {
                    gl.uniform3fv(program.uniform.LIGHT_COLOR, this._globalLightColor);
                }

                if (views.length === 1) {
                    gl.uniformMatrix4fv(program.uniform.PROJECTION_MATRIX, false, views[0].projectionMatrix);
                    gl.uniformMatrix4fv(program.uniform.VIEW_MATRIX, false, views[0].viewMatrix);
                    gl.uniform3fv(program.uniform.CAMERA_POSITION, this.cameraPositions[0]);
                    gl.uniform1i(program.uniform.EYE_INDEX, views[0].eyeIndex);
                }
            }

            if (material !== primitive.material) {
                this._bindMaterialState(primitive.material, material);
                primitive.material.bind(gl);
                // primitive.material.bind(gl, program, material);
                material = primitive.material;
            }

            if (this.vaoExt) {
                if (primitive.vao) {
                    this.vaoExt.bindVertexArrayOES(primitive.vao);
                } else {
                    primitive.vao = this.vaoExt.createVertexArrayOES();
                    this.vaoExt.bindVertexArrayOES(primitive.vao);
                    this._bindPrimitive(primitive, undefined);
                }
            } else {
                this._bindPrimitive(primitive, attribMask);
                attribMask = primitive.attributeMask;
            }

            for (let i = 0; i < views.length; ++i) {
                const view = views[i];
                if (views.length > 1) {
                    if (view.viewport) {
                        const vp = view.viewport;
                        gl.viewport(vp.x, vp.y, vp.width, vp.height);
                    }
                    gl.uniformMatrix4fv(program.uniform.PROJECTION_MATRIX, false, view.projectionMatrix);
                    gl.uniformMatrix4fv(program.uniform.VIEW_MATRIX, false, view.viewMatrix);
                    gl.uniform3fv(program.uniform.CAMERA_POSITION, this.cameraPositions[i]);
                    gl.uniform1i(program.uniform.EYE_INDEX, view.eyeIndex);
                }

                for (const instance of primitive.instances) {
                    if (instance.activeFrameId !== this.frameId) {
                        continue;
                    }

                    gl.uniformMatrix4fv(program.uniform.MODEL_MATRIX, false, instance.worldMatrix);

                    if (primitive.indexBuffer) {
                        gl.drawElements(primitive.mode, primitive.elementCount,
                            primitive.indexType, primitive.indexByteOffset);
                    } else {
                        gl.drawArrays(primitive.mode, 0, primitive.elementCount);
                    }
                }
            }
        }
    }

    _getRenderTexture(texture: Texture) {
        if (!texture) {
            return null;
        }

        const key = texture.textureKey;
        if (!key) {
            throw new Error('Texure does not have a valid key');
        }

        if (key in this.textureCache) {
            return this.textureCache[key];
        } else {
            const gl = this.gl;
            const textureHandle = gl.createTexture();

            const renderTexture = new RenderTexture(textureHandle);
            this.textureCache[key] = renderTexture;

            if (texture instanceof DataTexture) {
                gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.width, texture.height,
                    0, texture.format, texture.type, texture.data);
                this._setSamplerParameters(texture);
                renderTexture.complete = true;
            } else if (texture instanceof ImageUrlTexture) {
                texture.waitForComplete().then(() => {
                    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                    const limitTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                    const dimensionsLimit = limitTexture * limitTexture;
                    const imgDimensions = texture.width * texture.height;
                    if (imgDimensions > dimensionsLimit) {
                        console.warn('texture too big for your browser, containing more than ' + dimensionsLimit + 'px');
                    }
                    gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.format, gl.UNSIGNED_BYTE, texture.source);
                    this._setSamplerParameters(texture);
                    renderTexture.complete = true;
                });
            } else if (texture instanceof VideoTexture) {
                texture.video.addEventListener('playing', () => {
                    renderTexture._activeCallback = () => {
                        if (!texture.video.paused && !texture.video.onwaiting) {
                            gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                            gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.format, gl.UNSIGNED_BYTE, texture.source);
                        }
                    };
                });
            } /*else {
                texture.waitForComplete().then(() => {
                    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                    gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.format, gl.UNSIGNED_BYTE, texture.source);
                    this._setSamplerParameters(texture);
                    renderTexture.complete = true;
                });
            }*/

            return renderTexture;
        }
    }

    _setSamplerParameters(texture: Texture) {
        const gl = this.gl;

        const sampler = texture.sampler;
        const powerOfTwo = isPowerOfTwo(texture.width) && isPowerOfTwo(texture.height);
        const mipmap = powerOfTwo && texture.mipmap;
        if (mipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        const minFilter = sampler.minFilter || (mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        const wrapS = sampler.wrapS || (powerOfTwo ? gl.REPEAT : gl.CLAMP_TO_EDGE);
        const wrapT = sampler.wrapT || (powerOfTwo ? gl.REPEAT : gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, sampler.magFilter || gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    }

    _getProgramKey(name, defines) {
        let key = `${name}:`;

        for (const define in defines) {
            if (define) {
                key += `${define}=${defines[define]},`;
            }
        }

        return key;
    }

    _getMaterialProgram(material: Material, renderPrimitive: RenderPrimitive) {
        const materialName = material.materialName;
        const vertexSource = material.vertexSource;
        const fragmentSource = material.fragmentSource;

        // These should always be defined for every material
        if (materialName == null) {
            throw new Error('Material does not have a name');
        }
        if (vertexSource == null) {
            throw new Error(`Material "${materialName}" does not have a vertex source`);
        }
        if (fragmentSource == null) {
            throw new Error(`Material "${materialName}" does not have a fragment source`);
        }

        const defines = material.getProgramDefines(renderPrimitive);
        const key = this._getProgramKey(materialName, defines);

        if (key in this.programCache) {
            return this.programCache[key];
        } else {
            const multiview = false; // Handle this dynamically later
            let fullVertexSource = vertexSource;
            fullVertexSource += multiview ? VERTEX_SHADER_MULTI_ENTRY :
                VERTEX_SHADER_SINGLE_ENTRY;

            const precisionMatch = fragmentSource.match(PRECISION_REGEX);
            const fragPrecisionHeader = precisionMatch ? '' : `precision ${this.defaultFragPrecision} float;\n`;

            let fullFragmentSource = fragPrecisionHeader + fragmentSource;
            fullFragmentSource += FRAGMENT_SHADER_ENTRY;

            const program = new Program(this.gl, fullVertexSource, fullFragmentSource, ATTRIB, defines);
            this.programCache[key] = program;

            program.onNextUse((prog: Program) => {
                // Bind the samplers to the right texture index. This is constant for
                // the lifetime of the program.
                for (let i = 0; i < material.samplers.length; ++i) {
                    const sampler = material.samplers[i];
                    const uniform = prog.uniform[sampler.uniformName];
                    if (uniform) {
                        this.gl.uniform1i(uniform, i);
                    }
                }
            });

            return program;
        }
    }

    _bindPrimitive(primitive: RenderPrimitive, attribMask) {
        const gl = this.gl;

        // If the active attributes have changed then update the active set.
        if (attribMask !== primitive.attributeMask) {
            for (const attrib in ATTRIB) {
                // tslint:disable-next-line:no-bitwise
                if (primitive.attributeMask & ATTRIB_MASK[attrib]) {
                    gl.enableVertexAttribArray(ATTRIB[attrib]);
                } else {
                    gl.disableVertexAttribArray(ATTRIB[attrib]);
                }
            }
        }

        // Bind the primitive attributes and indices.
        for (const attributeBuffer of primitive.attributeBuffers) {
            gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer.buffer.buffer);
            for (const attrib of attributeBuffer.attributes) {
                gl.vertexAttribPointer(
                    attrib.attribIndex, attrib.componentCount, attrib.componentType,
                    attrib.normalized, attrib.stride, attrib.byteOffset);
            }
        }

        if (primitive.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer.buffer);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }

    _bindMaterialState(material: RenderMaterial, prevMaterial = null) {
        const gl = this.gl;

        const state = material.state;
        // tslint:disable-next-line:no-bitwise
        const prevState = prevMaterial ? prevMaterial.state : ~state;

        // Return early if both materials use identical state
        if (state === prevState) {
            return;
        }

        // Any caps bits changed?
        if (material._capsDiff(prevState)) {
            setCap(gl, gl.CULL_FACE, CAP.CULL_FACE, prevState, state);
            setCap(gl, gl.BLEND, CAP.BLEND, prevState, state);
            setCap(gl, gl.DEPTH_TEST, CAP.DEPTH_TEST, prevState, state);
            setCap(gl, gl.STENCIL_TEST, CAP.STENCIL_TEST, prevState, state);

            // tslint:disable-next-line:no-bitwise
            const colorMaskChange = (state & CAP.COLOR_MASK) - (prevState & CAP.COLOR_MASK);
            if (colorMaskChange) {
                const mask = colorMaskChange > 1;
                this.colorMaskNeedsReset = !mask;
                gl.colorMask(mask, mask, mask, mask);
            }

            // tslint:disable-next-line:no-bitwise
            const depthMaskChange = (state & CAP.DEPTH_MASK) - (prevState & CAP.DEPTH_MASK);
            if (depthMaskChange) {
                this.depthMaskNeedsReset = !(depthMaskChange > 1);
                gl.depthMask(depthMaskChange > 1);
            }

            // tslint:disable-next-line:no-bitwise
            const stencilMaskChange = (state & CAP.STENCIL_MASK) - (prevState & CAP.STENCIL_MASK);
            if (stencilMaskChange) {
                gl.stencilMask(Number(stencilMaskChange > 1));
            }
        }

        // Blending enabled and blend func changed?
        if (material._blendDiff(prevState)) {
            gl.blendFunc(material.blendFuncSrc, material.blendFuncDst);
        }

        // Depth testing enabled and depth func changed?
        if (material._depthFuncDiff(prevState)) {
            gl.depthFunc(material.depthFunc);
        }
    }
}
