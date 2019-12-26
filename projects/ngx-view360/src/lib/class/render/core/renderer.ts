import { CAP, MAT_STATE, RENDER_ORDER, stateToBlendFunc } from './material';
import { Node } from './node';
import { Program } from './program';
import { DataTexture, VideoTexture } from './texture';
import { mat4, vec3 } from '../math/gl-matrix';

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
    return (n & (n - 1)) === 0;
}

// Creates a WebGL context and initializes it with some common default state.
export function createWebGLContext(glAttribs) {
    glAttribs = glAttribs || { alpha: false };

    const webglCanvas = document.createElement('canvas');
    const contextTypes = glAttribs.webgl2 ? ['webgl2'] : ['webgl', 'experimental-webgl'];
    let context = null;

    for (const contextType of contextTypes) {
        context = webglCanvas.getContext(contextType, glAttribs);
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
    _eye;
    _eyeIndex;
    _viewMatrix;
    viewTransform;

    constructor(projectionMatrix, viewTransform, viewport = null, eye = 'left') {
        this.projectionMatrix = projectionMatrix;
        this.viewport = viewport;
        // If an eye isn't given the left eye is assumed.
        this._eye = eye;
        this._eyeIndex = (eye == 'left' ? 0 : 1);

        // Compute the view matrix
        if (viewTransform instanceof Float32Array) {
            this._viewMatrix = mat4.clone(viewTransform);
            this.viewTransform = new XRRigidTransform(); // TODO
        } else {
            this.viewTransform = viewTransform;
            this._viewMatrix = viewTransform.inverse.matrix;

            // Alternative view matrix code path
            /*this._viewMatrix = mat4.create();
            let q = viewTransform.orientation;
            let t = viewTransform.position;
            mat4.fromRotationTranslation(
                this._viewMatrix,
                [q.x, q.y, q.z, q.w],
                [t.x, t.y, t.z]
            );
            mat4.invert(this._viewMatrix, this._viewMatrix);*/
        }
    }

    get viewMatrix() {
        return this._viewMatrix;
    }

    get eye() {
        return this._eye;
    }

    set eye(value) {
        this._eye = value;
        this._eyeIndex = (value == 'left' ? 0 : 1);
    }

    get eyeIndex() {
        return this._eyeIndex;
    }
}

class RenderBuffer {
    _target;
    _usage;
    _length;
    _buffer;
    _promise;
    constructor(target, usage, buffer, length = 0) {
        this._target = target;
        this._usage = usage;
        this._length = length;
        if (buffer instanceof Promise) {
            this._buffer = null;
            this._promise = buffer.then((buffer) => {
                this._buffer = buffer;
                return this;
            });
        } else {
            this._buffer = buffer;
            this._promise = Promise.resolve(this);
        }
    }

    waitForComplete() {
        return this._promise;
    }
}

class RenderPrimitiveAttribute {
    _attrib_index;
    _componentCount;
    _componentType;
    _stride;
    _byteOffset;
    _normalized;

    constructor(primitiveAttribute) {
        this._attrib_index = ATTRIB[primitiveAttribute.name];
        this._componentCount = primitiveAttribute.componentCount;
        this._componentType = primitiveAttribute.componentType;
        this._stride = primitiveAttribute.stride;
        this._byteOffset = primitiveAttribute.byteOffset;
        this._normalized = primitiveAttribute.normalized;
    }
}

class RenderPrimitiveAttributeBuffer {
    _buffer;
    _attributes;
    constructor(buffer) {
        this._buffer = buffer;
        this._attributes = [];
    }
}

class RenderPrimitive {
    _activeFrameId;
    _instances;
    _material;
    _mode;
    _elementCount;
    _promise;
    _vao;
    _complete;
    _attributeBuffers;
    _attributeMask;
    _indexBuffer;
    _indexByteOffset;
    _indexType;
    _min;
    _max;

    constructor(primitive) {
        this._activeFrameId = 0;
        this._instances = [];
        this._material = null;

        this.setPrimitive(primitive);
    }

    setPrimitive(primitive) {
        this._mode = primitive.mode;
        this._elementCount = primitive.elementCount;
        this._promise = null;
        this._vao = null;
        this._complete = false;
        this._attributeBuffers = [];
        this._attributeMask = 0;

        for (const attribute of primitive.attributes) {
            this._attributeMask |= ATTRIB_MASK[attribute.name];
            const renderAttribute = new RenderPrimitiveAttribute(attribute);
            let foundBuffer = false;
            for (const attributeBuffer of this._attributeBuffers) {
                if (attributeBuffer._buffer == attribute.buffer) {
                    attributeBuffer._attributes.push(renderAttribute);
                    foundBuffer = true;
                    break;
                }
            }
            if (!foundBuffer) {
                const attributeBuffer = new RenderPrimitiveAttributeBuffer(attribute.buffer);
                attributeBuffer._attributes.push(renderAttribute);
                this._attributeBuffers.push(attributeBuffer);
            }
        }

        this._indexBuffer = null;
        this._indexByteOffset = 0;
        this._indexType = 0;

        if (primitive.indexBuffer) {
            this._indexByteOffset = primitive.indexByteOffset;
            this._indexType = primitive.indexType;
            this._indexBuffer = primitive.indexBuffer;
        }

        if (primitive._min) {
            this._min = vec3.clone(primitive._min);
            this._max = vec3.clone(primitive._max);
        } else {
            this._min = null;
            this._max = null;
        }

        if (this._material != null) {
            this.waitForComplete(); // To flip the _complete flag.
        }
    }

    setRenderMaterial(material) {
        this._material = material;
        this._promise = null;
        this._complete = false;

        if (this._material != null) {
            this.waitForComplete(); // To flip the _complete flag.
        }
    }

    markActive(frameId) {
        if (this._complete && this._activeFrameId != frameId) {
            if (this._material) {
                if (!this._material.markActive(frameId)) {
                    return;
                }
            }
            this._activeFrameId = frameId;
        }
    }

    get samplers() {
        return this._material._samplerDictionary;
    }

    get uniforms() {
        return this._material._uniform_dictionary;
    }

    waitForComplete() {
        if (!this._promise) {
            if (!this._material) {
                return Promise.reject('RenderPrimitive does not have a material');
            }

            const completionPromises = [];

            for (const attributeBuffer of this._attributeBuffers) {
                if (!attributeBuffer._buffer._buffer) {
                    completionPromises.push(attributeBuffer._buffer._promise);
                }
            }

            if (this._indexBuffer && !this._indexBuffer._buffer) {
                completionPromises.push(this._indexBuffer._promise);
            }

            this._promise = Promise.all(completionPromises).then(() => {
                this._complete = true;
                return this;
            });
        }
        return this._promise;
    }
}

export class RenderTexture {
    _texture;
    _complete;
    _activeFrameId;
    _activeCallback;

    constructor(texture) {
        this._texture = texture;
        this._complete = false;
        this._activeFrameId = 0;
        this._activeCallback = null;
    }

    markActive(frameId) {
        if (this._activeCallback && this._activeFrameId != frameId) {
            this._activeFrameId = frameId;
            this._activeCallback(this);
        }
    }
}

const inverseMatrix = mat4.create();

function setCap(gl, glEnum, cap, prevState, state) {
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
    _renderer;
    _uniformName;
    _renderTexture;
    _index;

    constructor(renderer, materialSampler, index) {
        this._renderer = renderer;
        this._uniformName = materialSampler._uniformName;
        this._renderTexture = renderer._getRenderTexture(materialSampler._texture);
        this._index = index;
    }

    set texture(value) {
        this._renderTexture = this._renderer._getRenderTexture(value);
    }
}

class RenderMaterialUniform {
    _uniformName;
    _uniform;
    _length;
    _value;

    constructor(materialUniform) {
        this._uniformName = materialUniform._uniformName;
        this._uniform = null;
        this._length = materialUniform._length;
        if (materialUniform._value instanceof Array) {
            this._value = new Float32Array(materialUniform._value);
        } else {
            this._value = new Float32Array([materialUniform._value]);
        }
    }

    set value(value) {
        if (this._value.length == 1) {
            this._value[0] = value;
        } else {
            for (let i = 0; i < this._value.length; ++i) {
                this._value[i] = value[i];
            }
        }
    }
}

class RenderMaterial {
    _program;
    _state;
    _activeFrameId;
    _completeForActiveFrame;
    _samplerDictionary;
    _samplers;
    _uniform_dictionary;
    _uniforms;
    _firstBind;
    _renderOrder;

    constructor(renderer, material, program) {
        this._program = program;
        this._state = material.state._state;
        this._activeFrameId = 0;
        this._completeForActiveFrame = false;

        this._samplerDictionary = {};
        this._samplers = [];
        for (let i = 0; i < material._samplers.length; ++i) {
            const renderSampler = new RenderMaterialSampler(renderer, material._samplers[i], i);
            this._samplers.push(renderSampler);
            this._samplerDictionary[renderSampler._uniformName] = renderSampler;
        }

        this._uniform_dictionary = {};
        this._uniforms = [];
        for (const uniform of material._uniforms) {
            const renderUniform = new RenderMaterialUniform(uniform);
            this._uniforms.push(renderUniform);
            this._uniform_dictionary[renderUniform._uniformName] = renderUniform;
        }

        this._firstBind = true;

        this._renderOrder = material.renderOrder;
        if (this._renderOrder == RENDER_ORDER.DEFAULT) {
            if (this._state & CAP.BLEND) {
                this._renderOrder = RENDER_ORDER.TRANSPARENT;
            } else {
                this._renderOrder = RENDER_ORDER.OPAQUE;
            }
        }
    }

    bind(gl) {
        // First time we do a binding, cache the uniform locations and remove
        // unused uniforms from the list.
        if (this._firstBind) {
            for (let i = 0; i < this._samplers.length;) {
                const sampler = this._samplers[i];
                if (!this._program.uniform[sampler._uniformName]) {
                    this._samplers.splice(i, 1);
                    continue;
                }
                ++i;
            }

            for (let i = 0; i < this._uniforms.length;) {
                const uniform = this._uniforms[i];
                uniform._uniform = this._program.uniform[uniform._uniformName];
                if (!uniform._uniform) {
                    this._uniforms.splice(i, 1);
                    continue;
                }
                ++i;
            }
            this._firstBind = false;
        }

        for (const sampler of this._samplers) {
            gl.activeTexture(gl.TEXTURE0 + sampler._index);
            if (sampler._renderTexture && sampler._renderTexture._complete) {
                gl.bindTexture(gl.TEXTURE_2D, sampler._renderTexture._texture);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
        }

        for (const uniform of this._uniforms) {
            switch (uniform._length) {
                case 1: gl.uniform1fv(uniform._uniform, uniform._value); break;
                case 2: gl.uniform2fv(uniform._uniform, uniform._value); break;
                case 3: gl.uniform3fv(uniform._uniform, uniform._value); break;
                case 4: gl.uniform4fv(uniform._uniform, uniform._value); break;
            }
        }
    }

    markActive(frameId) {
        if (this._activeFrameId != frameId) {
            this._activeFrameId = frameId;
            this._completeForActiveFrame = true;
            for (let i = 0; i < this._samplers.length; ++i) {
                const sampler = this._samplers[i];
                if (sampler._renderTexture) {
                    if (!sampler._renderTexture._complete) {
                        this._completeForActiveFrame = false;
                        break;
                    }
                    sampler._renderTexture.markActive(frameId);
                }
            }
        }
        return this._completeForActiveFrame;
    }

    // Material State fetchers
    get cullFace() {
        return !!(this._state & CAP.CULL_FACE);
    }
    get blend() {
        return !!(this._state & CAP.BLEND);
    }
    get depthTest() {
        return !!(this._state & CAP.DEPTH_TEST);
    }
    get stencilTest() {
        return !!(this._state & CAP.STENCIL_TEST);
    }
    get colorMask() {
        return !!(this._state & CAP.COLOR_MASK);
    }
    get depthMask() {
        return !!(this._state & CAP.DEPTH_MASK);
    }
    get stencilMask() {
        return !!(this._state & CAP.STENCIL_MASK);
    }
    get depthFunc() {
        return ((this._state & MAT_STATE.DEPTH_FUNC_RANGE) >> MAT_STATE.DEPTH_FUNC_SHIFT) + GL.NEVER;
    }
    get blendFuncSrc() {
        return stateToBlendFunc(this._state, MAT_STATE.BLEND_SRC_RANGE, MAT_STATE.BLEND_SRC_SHIFT);
    }
    get blendFuncDst() {
        return stateToBlendFunc(this._state, MAT_STATE.BLEND_DST_RANGE, MAT_STATE.BLEND_DST_SHIFT);
    }

    // Only really for use from the renderer
    _capsDiff(otherState) {
        return (otherState & MAT_STATE.CAPS_RANGE) ^ (this._state & MAT_STATE.CAPS_RANGE);
    }

    _blendDiff(otherState) {
        if (!(this._state & CAP.BLEND)) {
            return 0;
        }
        return (otherState & MAT_STATE.BLEND_FUNC_RANGE) ^ (this._state & MAT_STATE.BLEND_FUNC_RANGE);
    }

    _depthFuncDiff(otherState) {
        if (!(this._state & CAP.DEPTH_TEST)) {
            return 0;
        }
        return (otherState & MAT_STATE.DEPTH_FUNC_RANGE) ^ (this._state & MAT_STATE.DEPTH_FUNC_RANGE);
    }
}

export class Renderer {
    _gl;
    _frameId;
    _programCache;
    _textureCache;
    _renderPrimitives;
    _cameraPositions;
    _vaoExt;
    _defaultFragPrecision;
    _depthMaskNeedsReset;
    _colorMaskNeedsReset;
    _globalLightColor;
    _globalLightDir;

    constructor(gl) {
        this._gl = gl || createWebGLContext({ alpha: false });
        this._frameId = 0;
        this._programCache = {};
        this._textureCache = {};
        this._renderPrimitives = Array(RENDER_ORDER.DEFAULT);
        this._cameraPositions = [];

        this._vaoExt = gl.getExtension('OES_vertex_array_object');

        const fragHighPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        this._defaultFragPrecision = fragHighPrecision.precision > 0 ? 'highp' : 'mediump';

        this._depthMaskNeedsReset = false;
        this._colorMaskNeedsReset = false;

        this._globalLightColor = vec3.clone(DEF_LIGHT_COLOR);
        this._globalLightDir = vec3.clone(DEF_LIGHT_DIR);
    }

    get gl() {
        return this._gl;
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

    createRenderBuffer(target, data, usage = GL.STATIC_DRAW) {
        const gl = this._gl;
        const glBuffer = gl.createBuffer();

        if (data instanceof Promise) {
            const renderBuffer = new RenderBuffer(target, usage, data.then((data) => {
                gl.bindBuffer(target, glBuffer);
                gl.bufferData(target, data, usage);
                renderBuffer._length = data.byteLength;
                return glBuffer;
            }));
            return renderBuffer;
        } else {
            gl.bindBuffer(target, glBuffer);
            gl.bufferData(target, data, usage);
            return new RenderBuffer(target, usage, glBuffer, data.byteLength);
        }
    }

    updateRenderBuffer(buffer, data, offset = 0) {
        if (buffer._buffer) {
            const gl = this._gl;
            gl.bindBuffer(buffer._target, buffer._buffer);
            if (offset == 0 && buffer._length == data.byteLength) {
                gl.bufferData(buffer._target, data, buffer._usage);
            } else {
                gl.bufferSubData(buffer._target, offset, data);
            }
        } else {
            buffer.waitForComplete().then((buffer) => {
                this.updateRenderBuffer(buffer, data, offset);
            });
        }
    }

    createRenderPrimitive(primitive, material) {
        const renderPrimitive = new RenderPrimitive(primitive);

        const program = this._getMaterialProgram(material, renderPrimitive);
        const renderMaterial = new RenderMaterial(this, material, program);
        renderPrimitive.setRenderMaterial(renderMaterial);

        if (!this._renderPrimitives[renderMaterial._renderOrder]) {
            this._renderPrimitives[renderMaterial._renderOrder] = [];
        }

        this._renderPrimitives[renderMaterial._renderOrder].push(renderPrimitive);

        return renderPrimitive;
    }

    createMesh(primitive, material) {
        const meshNode = new Node();
        meshNode.addRenderPrimitive(this.createRenderPrimitive(primitive, material));
        return meshNode;
    }

    drawViews(views, rootNode) {
        if (!rootNode) {
            return;
        }

        const gl = this._gl;
        this._frameId++;

        rootNode.markActive(this._frameId);

        // If there's only one view then flip the algorithm a bit so that we're only
        // setting the viewport once.
        if (views.length == 1 && views[0].viewport) {
            const vp = views[0].viewport;
            this._gl.viewport(vp.x, vp.y, vp.width, vp.height);
        }

        // Get the positions of the 'camera' for each view matrix.
        for (let i = 0; i < views.length; ++i) {
            if (this._cameraPositions.length <= i) {
                this._cameraPositions.push(vec3.create());
            }
            const p = views[i].viewTransform.position;
            this._cameraPositions[i][0] = p.x;
            this._cameraPositions[i][1] = p.y;
            this._cameraPositions[i][2] = p.z;

            /*mat4.invert(inverseMatrix, views[i].viewMatrix);
            let cameraPosition = this._cameraPositions[i];
            vec3.set(cameraPosition, 0, 0, 0);
            vec3.transformMat4(cameraPosition, cameraPosition, inverseMatrix);*/
        }

        // Draw each set of render primitives in order
        for (const renderPrimitives of this._renderPrimitives) {
            if (renderPrimitives && renderPrimitives.length) {
                this._drawRenderPrimitiveSet(views, renderPrimitives);
            }
        }

        if (this._vaoExt) {
            this._vaoExt.bindVertexArrayOES(null);
        }

        if (this._depthMaskNeedsReset) {
            gl.depthMask(true);
        }
        if (this._colorMaskNeedsReset) {
            gl.colorMask(true, true, true, true);
        }
    }

    _drawRenderPrimitiveSet(views, renderPrimitives) {
        const gl = this._gl;
        let program = null;
        let material = null;
        let attribMask = 0;

        // Loop through every primitive known to the renderer.
        for (const primitive of renderPrimitives) {
            // Skip over those that haven't been marked as active for this frame.
            if (primitive._activeFrameId != this._frameId) {
                continue;
            }

            // Bind the primitive material's program if it's different than the one we
            // were using for the previous primitive.
            // TODO: The ording of this could be more efficient.
            if (program != primitive._material._program) {
                program = primitive._material._program;
                program.use();

                if (program.uniform.LIGHT_DIRECTION) {
                    gl.uniform3fv(program.uniform.LIGHT_DIRECTION, this._globalLightDir);
                }

                if (program.uniform.LIGHT_COLOR) {
                    gl.uniform3fv(program.uniform.LIGHT_COLOR, this._globalLightColor);
                }

                if (views.length == 1) {
                    gl.uniformMatrix4fv(program.uniform.PROJECTION_MATRIX, false, views[0].projectionMatrix);
                    gl.uniformMatrix4fv(program.uniform.VIEW_MATRIX, false, views[0].viewMatrix);
                    gl.uniform3fv(program.uniform.CAMERA_POSITION, this._cameraPositions[0]);
                    gl.uniform1i(program.uniform.EYE_INDEX, views[0].eyeIndex);
                }
            }

            if (material != primitive._material) {
                this._bindMaterialState(primitive._material, material);
                primitive._material.bind(gl, program, material);
                material = primitive._material;
            }

            if (this._vaoExt) {
                if (primitive._vao) {
                    this._vaoExt.bindVertexArrayOES(primitive._vao);
                } else {
                    primitive._vao = this._vaoExt.createVertexArrayOES();
                    this._vaoExt.bindVertexArrayOES(primitive._vao);
                    this._bindPrimitive(primitive, undefined);
                }
            } else {
                this._bindPrimitive(primitive, attribMask);
                attribMask = primitive._attributeMask;
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
                    gl.uniform3fv(program.uniform.CAMERA_POSITION, this._cameraPositions[i]);
                    gl.uniform1i(program.uniform.EYE_INDEX, view.eyeIndex);
                }

                for (const instance of primitive._instances) {
                    if (instance._activeFrameId != this._frameId) {
                        continue;
                    }

                    gl.uniformMatrix4fv(program.uniform.MODEL_MATRIX, false, instance.worldMatrix);

                    if (primitive._indexBuffer) {
                        gl.drawElements(primitive._mode, primitive._elementCount,
                            primitive._indexType, primitive._indexByteOffset);
                    } else {
                        gl.drawArrays(primitive._mode, 0, primitive._elementCount);
                    }
                }
            }
        }
    }

    _getRenderTexture(texture) {
        if (!texture) {
            return null;
        }

        const key = texture.textureKey;
        if (!key) {
            throw new Error('Texure does not have a valid key');
        }

        if (key in this._textureCache) {
            return this._textureCache[key];
        } else {
            const gl = this._gl;
            const textureHandle = gl.createTexture();

            const renderTexture = new RenderTexture(textureHandle);
            this._textureCache[key] = renderTexture;

            if (texture instanceof DataTexture) {
                gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.width, texture.height,
                    0, texture.format, texture._type, texture._data);
                this._setSamplerParameters(texture);
                renderTexture._complete = true;
            } else {
                texture.waitForComplete().then(() => {
                    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                    gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.format, gl.UNSIGNED_BYTE, texture.source);
                    this._setSamplerParameters(texture);
                    renderTexture._complete = true;

                    if (texture instanceof VideoTexture) {
                        // Once the video starts playing, set a callback to update it's
                        // contents each frame.
                        texture._video.addEventListener('playing', () => {
                            renderTexture._activeCallback = () => {
                                if (!texture._video.paused && !texture._video.waiting) {
                                    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
                                    gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.format, gl.UNSIGNED_BYTE, texture.source);
                                }
                            };
                        });
                    }
                });
            }

            return renderTexture;
        }
    }

    _setSamplerParameters(texture) {
        const gl = this._gl;

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
            key += `${define}=${defines[define]},`;
        }

        return key;
    }

    _getMaterialProgram(material, renderPrimitive) {
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

        if (key in this._programCache) {
            return this._programCache[key];
        } else {
            const multiview = false; // Handle this dynamically later
            let fullVertexSource = vertexSource;
            fullVertexSource += multiview ? VERTEX_SHADER_MULTI_ENTRY :
                VERTEX_SHADER_SINGLE_ENTRY;

            const precisionMatch = fragmentSource.match(PRECISION_REGEX);
            const fragPrecisionHeader = precisionMatch ? '' : `precision ${this._defaultFragPrecision} float;\n`;

            let fullFragmentSource = fragPrecisionHeader + fragmentSource;
            fullFragmentSource += FRAGMENT_SHADER_ENTRY;

            const program = new Program(this._gl, fullVertexSource, fullFragmentSource, ATTRIB, defines);
            this._programCache[key] = program;

            program.onNextUse((program) => {
                // Bind the samplers to the right texture index. This is constant for
                // the lifetime of the program.
                for (let i = 0; i < material._samplers.length; ++i) {
                    const sampler = material._samplers[i];
                    const uniform = program.uniform[sampler._uniformName];
                    if (uniform) {
                        this._gl.uniform1i(uniform, i);
                    }
                }
            });

            return program;
        }
    }

    _bindPrimitive(primitive, attribMask) {
        const gl = this._gl;

        // If the active attributes have changed then update the active set.
        if (attribMask != primitive._attributeMask) {
            for (let attrib in ATTRIB) {
                if (primitive._attributeMask & ATTRIB_MASK[attrib]) {
                    gl.enableVertexAttribArray(ATTRIB[attrib]);
                } else {
                    gl.disableVertexAttribArray(ATTRIB[attrib]);
                }
            }
        }

        // Bind the primitive attributes and indices.
        for (const attributeBuffer of primitive._attributeBuffers) {
            gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer._buffer._buffer);
            for (const attrib of attributeBuffer._attributes) {
                gl.vertexAttribPointer(
                    attrib._attrib_index, attrib._componentCount, attrib._componentType,
                    attrib._normalized, attrib._stride, attrib._byteOffset);
            }
        }

        if (primitive._indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive._indexBuffer._buffer);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }

    _bindMaterialState(material, prevMaterial = null) {
        const gl = this._gl;

        const state = material._state;
        const prevState = prevMaterial ? prevMaterial._state : ~state;

        // Return early if both materials use identical state
        if (state == prevState) {
            return;
        }

        // Any caps bits changed?
        if (material._capsDiff(prevState)) {
            setCap(gl, gl.CULL_FACE, CAP.CULL_FACE, prevState, state);
            setCap(gl, gl.BLEND, CAP.BLEND, prevState, state);
            setCap(gl, gl.DEPTH_TEST, CAP.DEPTH_TEST, prevState, state);
            setCap(gl, gl.STENCIL_TEST, CAP.STENCIL_TEST, prevState, state);

            const colorMaskChange = (state & CAP.COLOR_MASK) - (prevState & CAP.COLOR_MASK);
            if (colorMaskChange) {
                const mask = colorMaskChange > 1;
                this._colorMaskNeedsReset = !mask;
                gl.colorMask(mask, mask, mask, mask);
            }

            const depthMaskChange = (state & CAP.DEPTH_MASK) - (prevState & CAP.DEPTH_MASK);
            if (depthMaskChange) {
                this._depthMaskNeedsReset = !(depthMaskChange > 1);
                gl.depthMask(depthMaskChange > 1);
            }

            const stencilMaskChange = (state & CAP.STENCIL_MASK) - (prevState & CAP.STENCIL_MASK);
            if (stencilMaskChange) {
                gl.stencilMask(stencilMaskChange > 1);
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
