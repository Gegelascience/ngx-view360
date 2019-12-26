import { quat } from '../render/math/gl-matrix';

const LOOK_SPEED = 0.0025;

declare var XRRigidTransform: any;

export class InlineViewerHelper {
    lookYaw;
    lookPitch;
    viewerHeight;
    canvas;
    baseRefSpace;
    refSpace;
    dirty;

    constructor(canvas, referenceSpace) {
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.viewerHeight = 0;

        this.canvas = canvas;
        this.baseRefSpace = referenceSpace;
        this.refSpace = referenceSpace;

        this.dirty = false;

        canvas.style.cursor = 'grab';

        canvas.addEventListener('mousemove', (event) => {
            // Only rotate when the left button is pressed
            if (event.buttons & 1) {
                this.rotateView(event.movementX, event.movementY);
            }
        });

        // Keep track of touch-related state so that users can touch and drag on
        // the canvas to adjust the viewer pose in an inline session.
        let primaryTouch = undefined;
        let prevTouchX = undefined;
        let prevTouchY = undefined;

        canvas.addEventListener('touchstart', (event) => {
            if (primaryTouch == undefined) {
                const touch = event.changedTouches[0];
                primaryTouch = touch.identifier;
                prevTouchX = touch.pageX;
                prevTouchY = touch.pageY;
            }
        });

        canvas.addEventListener('touchend', (event) => {
            for (const touch of event.changedTouches) {
                if (primaryTouch == touch.identifier) {
                    primaryTouch = undefined;
                    this.rotateView(touch.pageX - prevTouchX, touch.pageY - prevTouchY);
                }
            }
        });

        canvas.addEventListener('touchcancel', (event) => {
            for (const touch of event.changedTouches) {
                if (primaryTouch == touch.identifier) {
                    primaryTouch = undefined;
                }
            }
        });

        canvas.addEventListener('touchmove', (event) => {
            for (const touch of event.changedTouches) {
                if (primaryTouch == touch.identifier) {
                    this.rotateView(touch.pageX - prevTouchX, touch.pageY - prevTouchY);
                    prevTouchX = touch.pageX;
                    prevTouchY = touch.pageY;
                }
            }
        });
    }

    setHeight(value) {
        if (this.viewerHeight != value) {
            this.viewerHeight = value;
        }
        this.dirty = true;
    }

    rotateView(dx, dy) {
        this.lookYaw += dx * LOOK_SPEED;
        this.lookPitch += dy * LOOK_SPEED;
        if (this.lookPitch < -Math.PI * 0.5) {
            this.lookPitch = -Math.PI * 0.5;
        }
        if (this.lookPitch > Math.PI * 0.5) {
            this.lookPitch = Math.PI * 0.5;
        }
        this.dirty = true;
    }

    reset() {
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.refSpace = this.baseRefSpace;
        this.dirty = false;
    }

    // XRReferenceSpace offset is immutable, so return a new reference space
    // that has an updated orientation.
    get referenceSpace() {
        if (this.dirty) {
            // Represent the rotational component of the reference space as a
            // quaternion.
            const invOrient = quat.create();
            quat.rotateX(invOrient, invOrient, -this.lookPitch);
            quat.rotateY(invOrient, invOrient, -this.lookYaw);
            let xform = new XRRigidTransform(
                {},
                { x: invOrient[0], y: invOrient[1], z: invOrient[2], w: invOrient[3] });
            this.refSpace = this.baseRefSpace.getOffsetReferenceSpace(xform);
            xform = new XRRigidTransform({ y: -this.viewerHeight });
            this.refSpace = this.refSpace.getOffsetReferenceSpace(xform);
            this.dirty = false;
        }
        return this.refSpace;
    }
}
