import { RenderView } from '../core/renderer';
import { InputRenderer } from '../nodes/input-renderer';
import { Node } from '../core/node';
import { vec3, quat } from '../math/gl-matrix';
import { Ray } from '../math/ray';

export class WebXRView extends RenderView {
    constructor(view, layer) {
        super(
            view ? view.projectionMatrix : null,
            view ? view.transform : null,
            (layer && view) ? layer.getViewport(view) : null,
            view ? view.eye : 'left'
        );
    }

}

export class Scene extends Node {
    _timestamp = -1;
    _frameDelta = 0;
    _statsStanding = false;
    _stats = null;
    _statsEnabled = false;
    _inputRenderer = null;
    _resetInputEndFrame = true;

    _lastTimestamp = 0;

    _hoverFrame = 0;
    _hoveredNodes = [];

    clear = true;

    constructor() {
        super();
    }

    setRenderer(renderer) {
        this._setRenderer(renderer);
    }

    loseRenderer() {
        if (this._renderer) {
            this._stats = null;
            this._renderer = null;
            this._inputRenderer = null;
        }
    }

    get inputRenderer() {
        if (!this._inputRenderer) {
            this._inputRenderer = new InputRenderer();
            this.addNode(this._inputRenderer);
        }
        return this._inputRenderer;
    }

    // Helper function that automatically adds the appropriate visual elements for
    // all input sources.
    updateInputSources(frame, refSpace) {
        const newHoveredNodes = [];
        const lastHoverFrame = this._hoverFrame;
        this._hoverFrame++;

        for (const inputSource of frame.session.inputSources) {
            const targetRayPose = frame.getPose(inputSource.targetRaySpace, refSpace);

            if (!targetRayPose) {
                continue;
            }

            if (inputSource.targetRayMode == 'tracked-pointer') {
                // If we have a pointer matrix and the pointer origin is the users
                // hand (as opposed to their head or the screen) use it to render
                // a ray coming out of the input device to indicate the pointer
                // direction.
                this.inputRenderer.addLaserPointer(targetRayPose.transform);
            }

            // If we have a pointer matrix we can also use it to render a cursor
            // for both handheld and gaze-based input sources.

            // Check and see if the pointer is pointing at any selectable objects.
            const hitResult = this.hitTest(targetRayPose.transform);

            if (hitResult) {
                // Render a cursor at the intersection point.
                this.inputRenderer.addCursor(hitResult.intersection);

                if (hitResult.node._hoverFrameId != lastHoverFrame) {
                    hitResult.node.onHoverStart();
                }
                hitResult.node._hoverFrameId = this._hoverFrame;
                newHoveredNodes.push(hitResult.node);
            } else {
                // Statically render the cursor 1 meters down the ray since we didn't
                // hit anything selectable.
                const targetRay = new Ray(targetRayPose.transform.matrix);
                const cursorDistance = 1.0;
                const cursorPos = vec3.fromValues(
                    targetRay.origin[0], //x
                    targetRay.origin[1], //y
                    targetRay.origin[2]  //z
                );
                vec3.add(cursorPos, cursorPos, [
                    targetRay.direction[0] * cursorDistance,
                    targetRay.direction[1] * cursorDistance,
                    targetRay.direction[2] * cursorDistance,
                ]);
                // let cursorPos = vec3.fromValues(0, 0, -1.0);
                // vec3.transformMat4(cursorPos, cursorPos, inputPose.targetRay);
                this.inputRenderer.addCursor(cursorPos);
            }

            if (inputSource.gripSpace) {
                const gripPose = frame.getPose(inputSource.gripSpace, refSpace);

                // Any time that we have a grip matrix, we'll render a controller.
                if (gripPose) {
                    this.inputRenderer.addController(gripPose.transform.matrix, inputSource.handedness);
                }
            }

        }

        for (const hoverNode of this._hoveredNodes) {
            if (hoverNode._hoverFrameId != this._hoverFrame) {
                hoverNode.onHoverEnd();
            }
        }

        this._hoveredNodes = newHoveredNodes;
    }

    /*handleSelect(inputSource, frame, refSpace) {
        const targetRayPose = frame.getPose(inputSource.targetRaySpace, refSpace);

        if (!targetRayPose) {
            return;
        }

        this.handleSelectPointer(targetRayPose.transform);
    }*/

    handleSelectPointer(rigidTransform) {
        if (rigidTransform) {
            // Check and see if the pointer is pointing at any selectable objects.
            const hitResult = this.hitTest(rigidTransform);

            if (hitResult) {
                // Render a cursor at the intersection point.
                hitResult.node.handleSelect();
            }
        }
    }

    standingStats(enable) {
        this._statsStanding = enable;
        if (this._stats) {
            if (this._statsStanding) {
                this._stats.translation = [0, 1.4, -0.75];
            } else {
                this._stats.translation = [0, -0.3, -0.5];
            }
            this._stats.scale = [0.3, 0.3, 0.3];
            quat.fromEuler(this._stats.rotation, -45.0, 0.0, 0.0);
        }
    }

    draw(projectionMatrix, viewTransform, eye) {
        const view = new RenderView(projectionMatrix, viewTransform);
        if (eye) {
            view.eye = eye;
        }

        this.drawViewArray([view]);
    }

    /** Draws the scene into the base layer of the XRFrame's session */
    drawXRFrame(xrFrame, pose) {
        if (!this._renderer || !pose) {
            return;
        }

        const gl = this._renderer.gl;
        const session = xrFrame.session;
        // Assumed to be a XRWebGLLayer for now.
        const layer = session.renderState.baseLayer;

        if (!gl) {
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);

        if (this.clear) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        const views = [];
        for (const view of pose.views) {
            views.push(new WebXRView(view, layer));
        }

        this.drawViewArray(views);
    }

    drawViewArray(views) {
        // Don't draw when we don't have a valid context
        if (!this._renderer) {
            return;
        }

        this._renderer.drawViews(views, this);
    }

    startFrame() {
        const prevTimestamp = this._timestamp;
        this._timestamp = performance.now();
        if (this._stats) {
            this._stats.begin();
        }

        if (prevTimestamp >= 0) {
            this._frameDelta = this._timestamp - prevTimestamp;
        } else {
            this._frameDelta = 0;
        }

        this._update(this._timestamp, this._frameDelta);

        return this._frameDelta;
    }

    endFrame() {
        if (this._inputRenderer && this._resetInputEndFrame) {
            this._inputRenderer.reset();
        }

        if (this._stats) {
            this._stats.end();
        }
    }

    // Override to load scene resources on construction or context restore.
    onLoadScene(renderer) {
        return Promise.resolve();
    }
}
