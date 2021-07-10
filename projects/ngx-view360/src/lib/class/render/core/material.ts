import { Texture } from './texture';

const GL = WebGLRenderingContext; // For enums

export const CAP = {
    // Enable caps
    CULL_FACE: 0x001,
    BLEND: 0x002,
    DEPTH_TEST: 0x004,
    STENCIL_TEST: 0x008,
    COLOR_MASK: 0x010,
    DEPTH_MASK: 0x020,
    STENCIL_MASK: 0x040,
};

export const MAT_STATE = {
    CAPS_RANGE: 0x000000FF,
    BLEND_SRC_SHIFT: 8,
    BLEND_SRC_RANGE: 0x00000F00,
    BLEND_DST_SHIFT: 12,
    BLEND_DST_RANGE: 0x0000F000,
    BLEND_FUNC_RANGE: 0x0000FF00,
    DEPTH_FUNC_SHIFT: 16,
    DEPTH_FUNC_RANGE: 0x000F0000,
};

export const RENDER_ORDER = {
    // Render opaque objects first.
    OPAQUE: 0,

    // Render the sky after all opaque object to save fill rate.
    SKY: 1,

    // Render transparent objects next so that the opaqe objects show through.
    TRANSPARENT: 2,

    // Finally render purely additive effects like pointer rays so that they
    // can render without depth mask.
    ADDITIVE: 3,

    // Render order will be picked based on the material properties.
    DEFAULT: 4,
};

export function stateToBlendFunc(state, mask, shift) {
    // tslint:disable-next-line:no-bitwise
    const value = (state & mask) >> shift;
    switch (value) {
        case 0:
        case 1:
            return value;
        default:
            return (value - 2) + GL.SRC_COLOR;
    }
}

export class MaterialState {
    state: number;
    constructor() {
        // tslint:disable-next-line:no-bitwise
        this.state = CAP.CULL_FACE |
            CAP.DEPTH_TEST |
            CAP.COLOR_MASK |
            CAP.DEPTH_MASK;

        // Use a fairly commonly desired blend func as the default.
        this.blendFuncSrc = GL.SRC_ALPHA;
        this.blendFuncDst = GL.ONE_MINUS_SRC_ALPHA;

        this.depthFunc = GL.LESS;
    }

    get cullFace() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.CULL_FACE);
    }
    set cullFace(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.CULL_FACE;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.CULL_FACE;
        }
    }

    get blend() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.BLEND);
    }
    set blend(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.BLEND;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.BLEND;
        }
    }

    get depthTest() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.DEPTH_TEST);
    }
    set depthTest(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.DEPTH_TEST;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.DEPTH_TEST;
        }
    }

    get stencilTest() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.STENCIL_TEST);
    }
    set stencilTest(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.STENCIL_TEST;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.STENCIL_TEST;
        }
    }

    get colorMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.COLOR_MASK);
    }
    set colorMask(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.COLOR_MASK;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.COLOR_MASK;
        }
    }

    get depthMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.DEPTH_MASK);
    }
    set depthMask(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.DEPTH_MASK;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.DEPTH_MASK;
        }
    }

    get depthFunc() {
        // tslint:disable-next-line:no-bitwise
        return ((this.state & MAT_STATE.DEPTH_FUNC_RANGE) >> MAT_STATE.DEPTH_FUNC_SHIFT) + GL.NEVER;
    }
    set depthFunc(value) {
        value = value - GL.NEVER;
        // tslint:disable-next-line:no-bitwise
        this.state &= ~MAT_STATE.DEPTH_FUNC_RANGE;
        // tslint:disable-next-line:no-bitwise
        this.state |= (value << MAT_STATE.DEPTH_FUNC_SHIFT);
    }

    get stencilMask() {
        // tslint:disable-next-line:no-bitwise
        return !!(this.state & CAP.STENCIL_MASK);
    }
    set stencilMask(value) {
        if (value) {
            // tslint:disable-next-line:no-bitwise
            this.state |= CAP.STENCIL_MASK;
        } else {
            // tslint:disable-next-line:no-bitwise
            this.state &= ~CAP.STENCIL_MASK;
        }
    }

    get blendFuncSrc() {
        return stateToBlendFunc(this.state, MAT_STATE.BLEND_SRC_RANGE, MAT_STATE.BLEND_SRC_SHIFT);
    }
    set blendFuncSrc(value) {
        switch (value) {
            case 0:
            case 1:
                break;
            default:
                value = (value - GL.SRC_COLOR) + 2;
        }
        // tslint:disable-next-line:no-bitwise
        this.state &= ~MAT_STATE.BLEND_SRC_RANGE;
        // tslint:disable-next-line:no-bitwise
        this.state |= (value << MAT_STATE.BLEND_SRC_SHIFT);
    }

    get blendFuncDst() {
        return stateToBlendFunc(this.state, MAT_STATE.BLEND_DST_RANGE, MAT_STATE.BLEND_DST_SHIFT);
    }
    set blendFuncDst(value) {
        switch (value) {
            case 0:
            case 1:
                break;
            default:
                value = (value - GL.SRC_COLOR) + 2;
        }
        // tslint:disable-next-line:no-bitwise
        this.state &= ~MAT_STATE.BLEND_DST_RANGE;
        // tslint:disable-next-line:no-bitwise
        this.state |= (value << MAT_STATE.BLEND_DST_SHIFT);
    }
}

export class MaterialSampler {
    uniformName: string;
    texture: Texture;
    constructor(uniformName: string) {
        this.uniformName = uniformName;
        this.texture = null;
    }
}

export class MaterialUniform {
    uniformName: string;
    value;
    length: number;

    constructor(uniformName: string, defaultValue, length: number) {
        this.uniformName = uniformName;
        this.value = defaultValue;
        this.length = length;
        if (!this.length) {
            if (defaultValue instanceof Array) {
                this.length = defaultValue.length;
            } else {
                this.length = 1;
            }
        }
    }
}

export class Material {
    state: MaterialState;
    renderOrder: number;
    samplers: MaterialSampler[];
    uniforms: MaterialUniform[];

    constructor() {
        this.state = new MaterialState();
        this.renderOrder = RENDER_ORDER.DEFAULT;
        this.samplers = [];
        this.uniforms = [];
    }

    defineSampler(uniformName: string) {
        const sampler = new MaterialSampler(uniformName);
        this.samplers.push(sampler);
        return sampler;
    }

    defineUniform(uniformName: string, defaultValue = null, length = 0) {
        const uniform = new MaterialUniform(uniformName, defaultValue, length);
        this.uniforms.push(uniform);
        return uniform;
    }

    get materialName() {
        return null;
    }

    get vertexSource() {
        return null;
    }

    get fragmentSource() {
        return null;
    }

    getProgramDefines(renderPrimitive) {
        return {};
    }
}
