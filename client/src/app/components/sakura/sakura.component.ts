/**
 * Adapted from https://github.com/Animmaster/Sakura-Effect
 * Converted to Angular standalone component with TypeScript by Claude Sonnet 4.6.
 */
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { SAKURA_FRAGMENT_SHADER, SAKURA_VERTEX_SHADER } from './sakura.constants';

import { Petal, Vec3, buildLookAtMatrix, buildProjectionMatrix } from '@app/components/sakura/sakura.helper';

@Component({
    selector: 'app-sakura',
    standalone: true,
    template: `<canvas #cvs></canvas>`,
    styleUrl: './sakura.component.scss',
})
export class SakuraComponent implements AfterViewInit, OnDestroy {

    @ViewChild('cvs') private canvasRef!: ElementRef<HTMLCanvasElement>;

    // ── Tunable constants ───────────────────────────────────────────────────
    private readonly numPetals = 100;   // Total number of petals on screen (lower = better perf)
    private readonly areaY = 20;    // Vertical half-size of the particle field
    private readonly areaZ = 20;    // Depth half-size of the particle field
    private readonly cameraInitZ = 100;   // Camera initial distance along Z
    private readonly dofFocus = 10;    // Depth-of-field: focus distance
    private readonly dofRadius = 4;     // Depth-of-field: sharp radius around focus
    private readonly dofMax = 8;     // Depth-of-field: max blur radius beyond focus
    private readonly faderStart = 10;    // Distance at which petals start fading in
    private readonly sizeMin = 0.9;   // Minimum petal size (0.0 – 2.0 recommended)
    private readonly sizeRange = 0.1;   // Random size variation added on top of sizeMin
    private readonly speedBase = 2;     // Base movement speed of petals (higher = faster)
    private readonly velXMag = 0.3;   // Horizontal (X) velocity spread
    private readonly velXBias = 0.8;   // Horizontal (X) velocity bias (positive = drift right)
    private readonly velYMag = 0.2;   // Vertical (Y) velocity spread
    private readonly velYBias = -1;    // Vertical (Y) velocity bias (negative = fall down)
    private readonly velZMag = 0.3;   // Depth (Z) velocity spread
    private readonly velZBias = 0.5;   // Depth (Z) velocity bias
    private readonly spinHalfScale = 0.5;   // Controls how fast petals spin (higher = faster)
    private readonly nearPlane = 0.1;   // Near clipping plane
    private readonly farPlane = 100;   // Far clipping plane
    private readonly maxDeltaTime = 0.05;  // Max frame delta time cap (prevents large jumps)
    private readonly msPerSec = 1000;  // Milliseconds per second
    private readonly mat4Size = 16;    // Elements in a 4x4 matrix

    private readonly degPerRotation = 360;   // Degrees in a full rotation
    private readonly floatsPerPetal = 8;     // Floats per petal in the GPU buffer (3 pos + 3 euler + 2 misc)
    private readonly posComponents = 3;     // Floats per position/euler vector
    private readonly copyZOffset = -2;    // Z offset applied to tiled field copies

    // ── WebGL state ──────────────────────────────────────────────────────────
    private gl!: WebGLRenderingContext;
    private program: WebGLProgram | null = null;
    private buffer: WebGLBuffer | null = null;

    private uniforms = {
        uProjection: null as WebGLUniformLocation | null,
        uModelview: null as WebGLUniformLocation | null,
        uResolution: null as WebGLUniformLocation | null,
        uDOF: null as WebGLUniformLocation | null,
        uFade: null as WebGLUniformLocation | null,
        uOffset: null as WebGLUniformLocation | null,
    };
    private attrs = { aPosition: -1, aEuler: -1, aMisc: -1 };

    private petals: Petal[] = [];
    private dataArray!: Float32Array;
    private posOff = 0;
    private eulOff = 0;
    private miscOff = 0;

    private areaX = 0;
    private projMatrix: Float32Array<ArrayBuffer> = new Float32Array(this.mat4Size);
    private viewMatrix: Float32Array<ArrayBuffer> = new Float32Array(this.mat4Size);
    private dof!: Vec3;
    private fader!: Vec3;
    private camPos!: Vec3;

    private prev = 0;
    private rafId = 0;
    private resizeObs!: ResizeObserver;

    // ── Lifecycle hooks ───────────────────────────────────────────────────────

    ngAfterViewInit(): void {
        const canvas = this.canvasRef.nativeElement;
        const glOptions: WebGLContextAttributes = { alpha: true, premultipliedAlpha: false };
        const ctx = canvas.getContext('webgl', glOptions) ?? canvas.getContext('experimental-webgl', glOptions);
        if (!ctx) {
            return;
        }
        this.gl = ctx as WebGLRenderingContext;
        this.dof = { x: this.dofFocus, y: this.dofRadius, z: this.dofMax };
        this.fader = { x: this.faderStart, y: this.areaZ, z: this.nearPlane };
        this.camPos = { x: 0, y: 0, z: this.cameraInitZ };

        this.buildProgram();
        this.resize();
        this.initParticles();

        this.resizeObs = new ResizeObserver(() => this.resize());
        this.resizeObs.observe(canvas.parentElement ?? document.body);
        this.prev = performance.now();
        this.loop(this.prev);
    }

    ngOnDestroy(): void {
        cancelAnimationFrame(this.rafId);
        this.resizeObs?.disconnect();
    }

    // ── Initialization ───────────────────────────────────────────────────────

    private buildProgram(): void {
        const gl = this.gl;
        const vert = this.compileShader(gl.VERTEX_SHADER, SAKURA_VERTEX_SHADER);
        const frag = this.compileShader(gl.FRAGMENT_SHADER, SAKURA_FRAGMENT_SHADER);
        if (!vert || !frag) {
            return;
        }
        const prog = gl.createProgram();
        if (!prog) {
            return;
        }
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.deleteShader(vert);
        gl.deleteShader(frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            return;
        }
        this.program = prog;

        this.uniforms.uProjection = gl.getUniformLocation(prog, 'uProjection');
        this.uniforms.uModelview = gl.getUniformLocation(prog, 'uModelview');
        this.uniforms.uResolution = gl.getUniformLocation(prog, 'uResolution');
        this.uniforms.uDOF = gl.getUniformLocation(prog, 'uDOF');
        this.uniforms.uFade = gl.getUniformLocation(prog, 'uFade');
        this.uniforms.uOffset = gl.getUniformLocation(prog, 'uOffset');
        this.attrs.aPosition = gl.getAttribLocation(prog, 'aPosition');
        this.attrs.aEuler = gl.getAttribLocation(prog, 'aEuler');
        this.attrs.aMisc = gl.getAttribLocation(prog, 'aMisc');

        this.posOff = 0;
        this.eulOff = this.numPetals * this.posComponents;
        this.miscOff = this.numPetals * this.posComponents * 2;
        this.dataArray = new Float32Array(this.numPetals * this.floatsPerPetal);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.dataArray, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    private compileShader(type: number, src: string): WebGLShader | null {
        const sh = this.gl.createShader(type);
        if (!sh) {
            return null;
        }
        this.gl.shaderSource(sh, src);
        this.gl.compileShader(sh);
        if (!this.gl.getShaderParameter(sh, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(sh);
            return null;
        }
        return sh;
    }

    private initParticles(): void {
        const PI2 = Math.PI * 2;
        const rnd = (): number => Math.random() * 2 - 1;
        this.petals = [];

        for (let i = 0; i < this.numPetals; i++) {
            const p = new Petal();
            const dir = [
                rnd() * this.velXMag + this.velXBias,
                rnd() * this.velYMag + this.velYBias,
                rnd() * this.velZMag + this.velZBias,
            ];
            const len = Math.hypot(dir[0], dir[1], dir[2]);
            const spd = this.speedBase + Math.random();

            p.vel = dir.map(v => v / len * spd);
            p.spin = [rnd() * PI2 * this.spinHalfScale,
            rnd() * PI2 * this.spinHalfScale,
            rnd() * PI2 * this.spinHalfScale];
            p.pos = [rnd() * this.areaX, rnd() * this.areaY, rnd() * this.areaZ];
            p.euler = [Math.random() * PI2, Math.random() * PI2, Math.random() * PI2];
            p.size = this.sizeMin + Math.random() * this.sizeRange;
            this.petals.push(p);
        }
    }

    // ── Render loop ──────────────────────────────────────────────────────────

    private loop = (now: number): void => {
        const dt = Math.min((now - this.prev) / this.msPerSec, this.maxDeltaTime);
        this.prev = now;
        this.render(dt);
        this.rafId = requestAnimationFrame(this.loop);
    };

    private render(dt: number): void {
        if (!this.program || !this.buffer) {
            return;
        }
        const gl = this.gl;
        const PI2 = Math.PI * 2;

        this.viewMatrix = buildLookAtMatrix(this.camPos, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

        const limits = [this.areaX, this.areaY, this.areaZ];
        for (const p of this.petals) {
            p.update(dt);
            for (let c = 0; c < limits.length; c++) {
                const lim = limits[c];
                if (Math.abs(p.pos[c]) - p.size / 2 > lim) {
                    p.pos[c] += p.pos[c] > 0 ? -lim * 2 : lim * 2;
                }
                p.euler[c] = ((p.euler[c] % PI2) + PI2) % PI2;
            }
            const vm = this.viewMatrix;
            p.zkey = vm[2] * p.pos[0] + vm[6] * p.pos[1] + vm[10] * p.pos[2] + vm[14];
        }
        this.petals.sort((a, b) => a.zkey - b.zkey);

        let ip = this.posOff;
        let ie = this.eulOff;
        let im = this.miscOff;
        for (const p of this.petals) {
            this.dataArray[ip++] = p.pos[0]; this.dataArray[ip++] = p.pos[1]; this.dataArray[ip++] = p.pos[2];
            this.dataArray[ie++] = p.euler[0]; this.dataArray[ie++] = p.euler[1]; this.dataArray[ie++] = p.euler[2];
            this.dataArray[im++] = p.size; this.dataArray[im++] = 1;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.program);

        const w = gl.canvas.width;
        const h = gl.canvas.height;
        gl.uniform3fv(this.uniforms.uResolution, new Float32Array([w, h, w / h]));
        gl.uniformMatrix4fv(this.uniforms.uProjection, false, this.projMatrix);
        gl.uniformMatrix4fv(this.uniforms.uModelview, false, this.viewMatrix);
        gl.uniform3fv(this.uniforms.uDOF, new Float32Array([this.dof.x, this.dof.y, this.dof.z]));
        gl.uniform3fv(this.uniforms.uFade, new Float32Array([this.fader.x, this.fader.y, this.fader.z]));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.dataArray, gl.DYNAMIC_DRAW);

        const F = Float32Array.BYTES_PER_ELEMENT;
        const aPos = this.attrs.aPosition;
        const aEul = this.attrs.aEuler;
        const aMsc = this.attrs.aMisc;
        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aEul);
        gl.enableVertexAttribArray(aMsc);
        gl.vertexAttribPointer(aPos, this.posComponents, gl.FLOAT, false, 0, this.posOff * F);
        gl.vertexAttribPointer(aEul, this.posComponents, gl.FLOAT, false, 0, this.eulOff * F);
        gl.vertexAttribPointer(aMsc, 2, gl.FLOAT, false, 0, this.miscOff * F);

        const offsets: [number, number, number][] = [
            [0, 0, 0],
            [-this.areaX, -this.areaY, this.copyZOffset],
            [-this.areaX, this.areaY, this.copyZOffset],
            [this.areaX, -this.areaY, this.copyZOffset],
            [this.areaX, this.areaY, this.copyZOffset],
        ];
        for (const [ox, oy, oz] of offsets) {
            gl.uniform3f(this.uniforms.uOffset, ox, oy, oz);
            gl.drawArrays(gl.POINTS, 0, this.numPetals);
        }

        gl.disableVertexAttribArray(aPos);
        gl.disableVertexAttribArray(aEul);
        gl.disableVertexAttribArray(aMsc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
        gl.disable(gl.BLEND);
    }

    // ── Resize handling ──────────────────────────────────────────────────────

    private resize(): void {
        const canvas = this.canvasRef.nativeElement;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const w = canvas.width;
        const h = canvas.height;

        this.gl.viewport(0, 0, w, h);
        this.areaX = this.areaY * (w / h);
        this.fader.y = this.areaZ;
        this.camPos.z = this.areaZ + this.nearPlane;

        const angle = Math.atan2(this.areaY, this.camPos.z + this.areaZ) * this.degPerRotation / Math.PI;
        this.projMatrix = buildProjectionMatrix(w / h, angle, this.nearPlane, this.farPlane);
    }


}
