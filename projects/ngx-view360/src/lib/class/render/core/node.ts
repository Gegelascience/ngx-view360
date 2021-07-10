import { Ray } from '../math/ray';
import { mat4, quat, vec3 } from 'gl-matrix';
import { Renderer, RenderPrimitive } from './renderer';

const DEFAULT_TRANSLATION = new Float32Array([0, 0, 0]);
const DEFAULT_ROTATION = new Float32Array([0, 0, 0, 1]);
const DEFAULT_SCALE = new Float32Array([1, 1, 1]);

const tmpRayMatrix = mat4.create();

export class Node {
    name: string;
    children: Node[];
    parent: Node;
    visible: boolean;
    selectable: boolean;
    _matrix;
    dirtyTRS: boolean;
    _translation;
    _rotation;
    _scale: Float32Array;
    dirtyWorldMatrix: boolean;
    _worldMatrix;
    activeFrameId: number;
    _hoverFrameId: number;
    renderPrimitives: RenderPrimitive[];
    renderer: Renderer;
    _selectHandler;

    constructor() {
        this.name = null; // Only for debugging
        this.children = [];
        this.parent = null;
        this.visible = true;
        this.selectable = false;

        this._matrix = null;

        this.dirtyTRS = false;
        this._translation = null;
        this._rotation = null;
        this._scale = null;

        this.dirtyWorldMatrix = false;
        this._worldMatrix = null;

        this.activeFrameId = -1;
        this._hoverFrameId = -1;
        this.renderPrimitives = null;
        this.renderer = null;

        this._selectHandler = null;
    }

    _setRenderer(renderer: Renderer) {
        if (this.renderer === renderer) {
            return;
        }

        if (this.renderer) {
            // Changing the renderer removes any previously attached renderPrimitives
            // from a different renderer.
            this.clearRenderPrimitives();
        }

        this.renderer = renderer;
        if (renderer) {
            this.onRendererChanged(renderer);

            for (const child of this.children) {
                child._setRenderer(renderer);
            }
        }
    }

    onRendererChanged(renderer) {
        // Override in other node types to respond to changes in the renderer.
    }

    // Create a clone of this node and all of it's children. Does not duplicate
    // RenderPrimitives, the cloned nodes will be treated as new instances of the
    // geometry.
    clone() {
        const cloneNode = new Node();
        cloneNode.name = this.name;
        cloneNode.visible = this.visible;
        cloneNode.renderer = this.renderer;

        cloneNode.dirtyTRS = this.dirtyTRS;

        if (this._translation) {
            cloneNode._translation = vec3.create();
            vec3.copy(cloneNode._translation, this._translation);
        }

        if (this._rotation) {
            cloneNode._rotation = quat.create();
            quat.copy(cloneNode._rotation, this._rotation);
        }

        if (this._scale) {
            cloneNode._scale = vec3.create();
            vec3.copy(cloneNode._scale, this._scale);
        }

        // Only copy the matrices if they're not already dirty.
        if (!cloneNode.dirtyTRS && this._matrix) {
            cloneNode._matrix = mat4.create();
            mat4.copy(cloneNode._matrix, this._matrix);
        }

        cloneNode.dirtyWorldMatrix = this.dirtyWorldMatrix;
        if (!cloneNode.dirtyWorldMatrix && this._worldMatrix) {
            cloneNode._worldMatrix = mat4.create();
            mat4.copy(cloneNode._worldMatrix, this._worldMatrix);
        }

        this.waitForComplete().then(() => {
            if (this.renderPrimitives) {
                for (const primitive of this.renderPrimitives) {
                    cloneNode.addRenderPrimitive(primitive);
                }
            }

            for (const child of this.children) {
                cloneNode.addNode(child.clone());
            }
        });

        return cloneNode;
    }

    markActive(frameId: number) {
        if (this.visible && this.renderPrimitives) {
            this.activeFrameId = frameId;
            for (const primitive of this.renderPrimitives) {
                primitive.markActive(frameId);
            }
        }

        for (const child of this.children) {
            if (child.visible) {
                child.markActive(frameId);
            }
        }
    }

    addNode(value: Node) {
        if (!value || value.parent === this) {
            return;
        }

        if (value.parent) {
            value.parent.removeNode(value);
        }
        value.parent = this;

        this.children.push(value);

        if (this.renderer) {
            value._setRenderer(this.renderer);
        }
    }

    removeNode(value: Node) {
        const i = this.children.indexOf(value);
        if (i > -1) {
            this.children.splice(i, 1);
            value.parent = null;
        }
    }

    clearNodes() {
        for (const child of this.children) {
            child.parent = null;
        }
        this.children = [];
    }

    setMatrixDirty() {
        if (!this.dirtyWorldMatrix) {
            this.dirtyWorldMatrix = true;
            for (const child of this.children) {
                child.setMatrixDirty();
            }
        }
    }

    _updateLocalMatrix() {
        if (!this._matrix) {
            this._matrix = mat4.create();
        }

        if (this.dirtyTRS) {
            this.dirtyTRS = false;
            mat4.fromRotationTranslationScale(
                this._matrix,
                this._rotation || DEFAULT_ROTATION,
                this._translation || DEFAULT_TRANSLATION,
                this._scale || DEFAULT_SCALE);
        }

        return this._matrix;
    }

    set matrix(value) {
        if (value) {
            if (!this._matrix) {
                this._matrix = mat4.create();
            }
            mat4.copy(this._matrix, value);
        } else {
            this._matrix = null;
        }
        this.setMatrixDirty();
        this.dirtyTRS = false;
        this._translation = null;
        this._rotation = null;
        this._scale = null;
    }

    get matrix() {
        this.setMatrixDirty();

        return this._updateLocalMatrix();
    }

    get worldMatrix() {
        if (!this._worldMatrix) {
            this.dirtyWorldMatrix = true;
            this._worldMatrix = mat4.create();
        }

        if (this.dirtyWorldMatrix || this.dirtyTRS) {
            if (this.parent) {
                // TODO: Some optimizations that could be done here if the node matrix
                // is an identity matrix.
                mat4.mul(this._worldMatrix, this.parent.worldMatrix, this._updateLocalMatrix());
            } else {
                mat4.copy(this._worldMatrix, this._updateLocalMatrix());
            }
            this.dirtyWorldMatrix = false;
        }

        return this._worldMatrix;
    }

    // TODO: Decompose matrix when fetching these?
    set translation(value) {
        if (value != null) {
            this.dirtyTRS = true;
            this.setMatrixDirty();
        }
        this._translation = value;
    }

    get translation() {
        this.dirtyTRS = true;
        this.setMatrixDirty();
        if (!this._translation) {
            this._translation = vec3.clone(DEFAULT_TRANSLATION);
        }
        return this._translation;
    }

    set rotation(value) {
        if (value != null) {
            this.dirtyTRS = true;
            this.setMatrixDirty();
        }
        this._rotation = value;
    }

    get rotation() {
        this.dirtyTRS = true;
        this.setMatrixDirty();
        if (!this._rotation) {
            this._rotation = quat.clone(DEFAULT_ROTATION);
        }
        return this._rotation;
    }

    set scale(value) {
        if (value != null) {
            this.dirtyTRS = true;
            this.setMatrixDirty();
        }
        this._scale = value;
    }

    get scale() {
        this.dirtyTRS = true;
        this.setMatrixDirty();
        if (!this._scale) {
            this._scale = vec3.clone(DEFAULT_SCALE);
        }
        return this._scale;
    }

    waitForComplete() {
        const childPromises = [];
        for (const child of this.children) {
            childPromises.push(child.waitForComplete());
        }
        if (this.renderPrimitives) {
            for (const primitive of this.renderPrimitives) {
                childPromises.push(primitive.waitForComplete());
            }
        }
        return Promise.all(childPromises).then(() => this);
    }


    addRenderPrimitive(primitive: RenderPrimitive) {
        if (!this.renderPrimitives) {
            this.renderPrimitives = [primitive];
        } else {
            this.renderPrimitives.push(primitive);
        }
        primitive._instances.push(this);
    }

    /*removeRenderPrimitive(primitive: RenderPrimitive) {
        if (!this._renderPrimitives) {
            return;
        }

        let index = this._renderPrimitives._instances.indexOf(primitive);
        if (index > -1) {
            this._renderPrimitives._instances.splice(index, 1);

            index = primitive._instances.indexOf(this);
            if (index > -1) {
                primitive._instances.splice(index, 1);
            }

            if (!this._renderPrimitives.length) {
                this._renderPrimitives = null;
            }
        }
    }*/

    clearRenderPrimitives() {
        if (this.renderPrimitives) {
            for (const primitive of this.renderPrimitives) {
                const index = primitive._instances.indexOf(this);
                if (index > -1) {
                    primitive._instances.splice(index, 1);
                }
            }
            this.renderPrimitives = null;
        }
    }

    _hitTestSelectableNode(rigidTransform) {
        if (this.renderPrimitives) {
            let localRay: Ray = null;
            for (const primitive of this.renderPrimitives) {
                if (primitive.min) {
                    if (!localRay) {
                        mat4.invert(tmpRayMatrix, this.worldMatrix);
                        mat4.multiply(tmpRayMatrix, tmpRayMatrix, rigidTransform.matrix);
                        localRay = new Ray(tmpRayMatrix);
                    }
                    const intersection = localRay.intersectsAABB(primitive.min, primitive.max);
                    if (intersection) {
                        vec3.transformMat4(intersection, intersection, this.worldMatrix);
                        return intersection;
                    }
                }
            }
        }
        for (const child of this.children) {
            const intersection = child._hitTestSelectableNode(rigidTransform);
            if (intersection) {
                return intersection;
            }
        }
        return null;
    }

    hitTest(rigidTransform) {
        if (this.selectable && this.visible) {
            const intersect = this._hitTestSelectableNode(rigidTransform);

            if (intersect) {
                const ray = new Ray(rigidTransform.matrix);
                const origin = vec3.fromValues(ray.origin.x, ray.origin.y, ray.origin.z);
                return {
                    node: this,
                    intersection: intersect,
                    distance: vec3.distance(origin, intersect),
                };
            }
            return null;
        }

        let result = null;
        for (const child of this.children) {
            const childResult = child.hitTest(rigidTransform);
            if (childResult) {
                if (!result || result.distance > childResult.distance) {
                    result = childResult;
                }
            }
        }
        return result;
    }

    onSelect(value) {
        this._selectHandler = value;
    }

    get selectHandler() {
        return this._selectHandler;
    }

    // Called when a selectable node is selected.
    handleSelect() {
        if (this._selectHandler) {
            this._selectHandler();
        }
    }

    // Called when a selectable element is pointed at.
    onHoverStart() {

    }

    // Called when a selectable element is no longer pointed at.
    onHoverEnd() {

    }

    _update(timestamp: number, frameDelta: number) {
        this.onUpdate(timestamp, frameDelta);

        for (const child of this.children) {
            child._update(timestamp, frameDelta);
        }
    }

    // Called every frame so that the nodes can animate themselves
    onUpdate(timestamp: number, frameDelta: number) {

    }
}
