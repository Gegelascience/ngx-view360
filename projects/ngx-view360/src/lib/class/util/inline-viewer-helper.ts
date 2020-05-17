import { quat } from 'gl-matrix';

declare var XRRigidTransform: any;

export class InlineViewerHelper {
    lookYaw: number;
    lookPitch: number;
    viewerHeight: number;
    baseRefSpace;
    refSpace;
    dirty: boolean;

    constructor(referenceSpace) {
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.viewerHeight = 0;

        this.baseRefSpace = referenceSpace;
        this.refSpace = referenceSpace;

        this.dirty = false;
    }

    setHeight(value) {
        if (this.viewerHeight !== value) {
            this.viewerHeight = value;
        }
        this.dirty = true;
    }

    rotateView(dx, dy) {
        const LOOK_SPEED = 0.0025;
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
