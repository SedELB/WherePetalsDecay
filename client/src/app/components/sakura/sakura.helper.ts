import { Vec3 } from '@app/interfaces/sakura.interfaces';

export const SAKURA_CONSTANTS = {
    normalizeEps: 1e-5,
    mat4Size: 16,
    degPerRotation: 360,
};

export function normalizeVector(v: Vec3): void {
    let l = v.x * v.x + v.y * v.y + v.z * v.z;
    if (l > SAKURA_CONSTANTS.normalizeEps) {
        l = 1 / Math.sqrt(l);
        v.x *= l;
        v.y *= l;
        v.z *= l;
    }
}

export function crossProduct(out: Vec3, a: Vec3, b: Vec3): void {
    out.x = a.y * b.z - a.z * b.y;
    out.y = a.z * b.x - a.x * b.z;
    out.z = a.x * b.y - a.y * b.x;
}

export function buildProjectionMatrix(aspect: number, vdeg: number, near: number, far: number): Float32Array<ArrayBuffer> {
    const h = near * Math.tan(vdeg * Math.PI / SAKURA_CONSTANTS.degPerRotation) * 2;
    const w = h * aspect;
    const m = new Float32Array(SAKURA_CONSTANTS.mat4Size);
    m[0] = 2 * near / w;
    m[5] = 2 * near / h;
    m[10] = -(far + near) / (far - near);
    m[11] = -1;
    m[14] = -(2 * far * near / (far - near));
    return m;
}

export function buildLookAtMatrix(vpos: Vec3, vlook: Vec3, vup: Vec3): Float32Array<ArrayBuffer> {
    const front: Vec3 = { x: vpos.x - vlook.x, y: vpos.y - vlook.y, z: vpos.z - vlook.z };
    normalizeVector(front);
    const side: Vec3 = { x: 1, y: 0, z: 0 };
    crossProduct(side, vup, front);
    normalizeVector(side);
    const top: Vec3 = { x: 1, y: 0, z: 0 };
    crossProduct(top, front, side);
    normalizeVector(top);
    const m = new Float32Array(SAKURA_CONSTANTS.mat4Size);
    m[0] = side.x; m[1] = top.x; m[2] = front.x;
    m[4] = side.y; m[5] = top.y; m[6] = front.y;
    m[8] = side.z; m[9] = top.z; m[10] = front.z;
    m[12] = -(vpos.x * m[0] + vpos.y * m[4] + vpos.z * m[8]);
    m[13] = -(vpos.x * m[1] + vpos.y * m[5] + vpos.z * m[9]);
    m[14] = -(vpos.x * m[2] + vpos.y * m[6] + vpos.z * m[10]);
    m[15] = 1;
    return m;
}
