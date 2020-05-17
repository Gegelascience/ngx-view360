import { mat3, vec3 } from 'gl-matrix';

const normalMat = mat3.create();

const RAY_INTERSECTION_OFFSET = 0.02;

export class Ray {
    origin;
    _dir;
    inv_dir;
    sign;
    constructor(matrix = null) {
        this.origin = vec3.create();

        this._dir = vec3.create();
        this._dir[2] = -1.0;

        if (matrix) {
            vec3.transformMat4(this.origin, this.origin, matrix);
            mat3.fromMat4(normalMat, matrix);
            vec3.transformMat3(this._dir, this._dir, normalMat);
        }

        // To force the inverse and sign calculations.
        this.direction = this._dir;
    }

    get direction() {
        return this._dir;
    }

    set direction(value) {
        this._dir = vec3.copy(this._dir, value);
        vec3.normalize(this._dir, this._dir);

        this.inv_dir = vec3.fromValues(
            1.0 / this._dir[0],
            1.0 / this._dir[1],
            1.0 / this._dir[2]);

        this.sign = [
            (this.inv_dir[0] < 0) ? 1 : 0,
            (this.inv_dir[1] < 0) ? 1 : 0,
            (this.inv_dir[2] < 0) ? 1 : 0,
        ];
    }

    // Borrowed from:
    // eslint-disable-next-line max-len
    // https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-box-intersection
    intersectsAABB(min, max) {
        const r = this;

        const bounds = [min, max];

        let tmin = (bounds[r.sign[0]][0] - r.origin[0]) * r.inv_dir[0];
        let tmax = (bounds[1 - r.sign[0]][0] - r.origin[0]) * r.inv_dir[0];
        const tymin = (bounds[r.sign[1]][1] - r.origin[1]) * r.inv_dir[1];
        const tymax = (bounds[1 - r.sign[1]][1] - r.origin[1]) * r.inv_dir[1];

        if ((tmin > tymax) || (tymin > tmax)) {
            return null;
        }
        if (tymin > tmin) {
            tmin = tymin;
        }
        if (tymax < tmax) {
            tmax = tymax;
        }

        const tzmin = (bounds[r.sign[2]][2] - r.origin[2]) * r.inv_dir[2];
        const tzmax = (bounds[1 - r.sign[2]][2] - r.origin[2]) * r.inv_dir[2];

        if ((tmin > tzmax) || (tzmin > tmax)) {
            return null;
        }
        if (tzmin > tmin) {
            tmin = tzmin;
        }
        if (tzmax < tmax) {
            tmax = tzmax;
        }

        let t = -1;
        if (tmin > 0 && tmax > 0) {
            t = Math.min(tmin, tmax);
        } else if (tmin > 0) {
            t = tmin;
        } else if (tmax > 0) {
            t = tmax;
        } else {
            // Intersection is behind the ray origin.
            return null;
        }

        // Push ray intersection point back along the ray a bit so that cursors
        // don't accidentally intersect with the hit surface.
        t -= RAY_INTERSECTION_OFFSET;

        // Return the point where the ray first intersected with the AABB.
        const intersectionPoint = vec3.clone(this._dir);
        vec3.scale(intersectionPoint, intersectionPoint, t);
        vec3.add(intersectionPoint, intersectionPoint, this.origin);
        return intersectionPoint;
    }
}
