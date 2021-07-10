import { RenderView, Renderer } from '../core/renderer';
import { InputRenderer } from '../nodes/input-renderer';
import { Node } from '../core/node';
import { vec3 } from 'gl-matrix';
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
    timestamp = -1;
    frameDelta = 0;
    inputRenderer: InputRenderer = null;
    resetInputEndFrame = true;

    lastTimestamp = 0;

    hoverFrame = 0;
    hoveredNodes: Node[] = [];

    clear = true;

    constructor() {
        super();
        if (!this.inputRenderer) {
            this.inputRenderer = new InputRenderer();
            this.addNode(this.inputRenderer);
        }
    }

    setRenderer(renderer: Renderer) {
        this._setRenderer(renderer);
    }

    loseRenderer() {
        if (this.renderer) {
            this.renderer = null;
            this.inputRenderer = null;
        }
    }


    // Helper function that automatically adds the appropriate visual elements for
    // all input sources.
    updateInputSources(frame, refSpace) {
        const newHoveredNodes = [];
        const lastHoverFrame = this.hoverFrame;
        this.hoverFrame++;

        for (const inputSource of frame.session.inputSources) {
            const targetRayPose = frame.getPose(inputSource.targetRaySpace, refSpace);

            if (!targetRayPose) {
                continue;
            }

            if (inputSource.targetRayMode === 'tracked-pointer') {
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

                if (hitResult.node._hoverFrameId !== lastHoverFrame) {
                    hitResult.node.onHoverStart();
                }
                hitResult.node._hoverFrameId = this.hoverFrame;
                newHoveredNodes.push(hitResult.node);
            } else {
                // Statically render the cursor 1 meters down the ray since we didn't
                // hit anything selectable.
                const targetRay = new Ray(targetRayPose.transform.matrix);
                const cursorDistance = 1.0;
                const cursorPos = vec3.fromValues(
                    targetRay.origin[0], // x
                    targetRay.origin[1], // y
                    targetRay.origin[2]  // z
                );
                vec3.add(cursorPos, cursorPos, [
                    targetRay.direction[0] * cursorDistance,
                    targetRay.direction[1] * cursorDistance,
                    targetRay.direction[2] * cursorDistance,
                ]);

                this.inputRenderer.addCursor(cursorPos);

            }

            if (inputSource.gripSpace) {
                const gripPose = frame.getPose(inputSource.gripSpace, refSpace);

            }

        }

        for (const hoverNode of this.hoveredNodes) {
            if (hoverNode._hoverFrameId !== this.hoverFrame) {
                hoverNode.onHoverEnd();
            }
        }

        this.hoveredNodes = newHoveredNodes;
    }

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

    draw(projectionMatrix, viewTransform, eye) {
        const view = new RenderView(projectionMatrix, viewTransform);
        if (eye) {
            view.eye = eye;
        }

        this.drawViewArray([view]);
    }

    /** Draws the scene into the base layer of the XRFrame's session */
    drawXRFrame(xrFrame, pose) {
        if (!this.renderer || !pose) {
            return;
        }

        const gl = this.renderer.gl;
        const session = xrFrame.session;
        // Assumed to be a XRWebGLLayer for now.
        const layer = session.renderState.baseLayer;

        if (!gl) {
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);

        if (this.clear) {
            // tslint:disable-next-line:no-bitwise
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
        if (!this.renderer) {
            return;
        }

        this.renderer.drawViews(views, this);
    }

    startFrame() {
        const prevTimestamp = this.timestamp;
        this.timestamp = performance.now();

        if (prevTimestamp >= 0) {
            this.frameDelta = this.timestamp - prevTimestamp;
        } else {
            this.frameDelta = 0;
        }

        this._update(this.timestamp, this.frameDelta);

        return this.frameDelta;
    }

    endFrame() {
        if (this.inputRenderer && this.resetInputEndFrame) {
            this.inputRenderer.reset(undefined);
        }
    }

    // Override to load scene resources on construction or context restore.
    onLoadScene(renderer) {
        return Promise.resolve();
    }
}
