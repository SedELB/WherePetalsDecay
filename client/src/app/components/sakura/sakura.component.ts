/**
 * Adapted from https://github.com/Animmaster/Sakura-Effect
 * Converted to Angular standalone component with TypeScript by Claude Sonnet 4.6.
 */
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { SAKURA_FRAGMENT_SHADER, SAKURA_VERTEX_SHADER } from './sakura.constants';

import { buildLookAtMatrix, buildProjectionMatrix } from '@app/components/sakura/sakura.helper';
import { Vec3 } from '@app/interfaces/sakura.interfaces';
import { Petal } from '@app/classes/petal.class';

@Component({
    selector: 'app-sakura',
    standalone: true,
    template: `<canvas #cvs></canvas>`,
    styleUrl: './sakura.component.scss',
})
export class SakuraComponent implements AfterViewInit, OnDestroy {

    @ViewChild('cvs') private canvasRef!: ElementRef<HTMLCanvasElement>;

    // ── Tunable constants ───────────────────────────────────────────────────
    private readonly numPetals = 100;
    private readonly areaY = 20;
    private readonly areaZ = 20;
    private readonly cameraInitZ = 100;
    private readonly dofFocus = 10;
    private readonly dofRadius = 4;
    private readonly dofMax = 8;
    private readonly faderStart = 10;
    private readonly sizeMin = 0.9;
    private readonly sizeRange = 0.1;
    private readonly speedBase = 2;
    private readonly velXMag = 0.3;
    private readonly velXBias = 0.8;
    private readonly velYMag = 0.2;
    private readonly velYBias = -1;
    private readonly velZMag = 0.3;
    private readonly velZBias = 0.5;
    private readonly spinHalfScale = 0.5;
    private readonly nearPlane = 0.1;
    private readonly farPlane = 100;
    private readonly maxDeltaTime = 0.05;
    private readonly msPerSec = 1000;
    private readonly mat4Size = 16;

    private readonly degPerRotation = 360;
    private readonly floatsPerPetal = 8;
    private readonly posComponents = 3;
    private readonly copyZOffset = -2;

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
        const context = canvas.getContext('webgl', glOptions) ?? canvas.getContext('experimental-webgl', glOptions);
        if (!context) {
            return;
        }
        this.gl = context as WebGLRenderingContext;
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
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, SAKURA_VERTEX_SHADER);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, SAKURA_FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) {
            return;
        }
        const shaderProgram = gl.createProgram();
        if (!shaderProgram) {
            return;
        }
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            return;
        }
        this.program = shaderProgram;

        this.uniforms.uProjection = gl.getUniformLocation(shaderProgram, 'uProjection');
        this.uniforms.uModelview = gl.getUniformLocation(shaderProgram, 'uModelview');
        this.uniforms.uResolution = gl.getUniformLocation(shaderProgram, 'uResolution');
        this.uniforms.uDOF = gl.getUniformLocation(shaderProgram, 'uDOF');
        this.uniforms.uFade = gl.getUniformLocation(shaderProgram, 'uFade');
        this.uniforms.uOffset = gl.getUniformLocation(shaderProgram, 'uOffset');
        this.attrs.aPosition = gl.getAttribLocation(shaderProgram, 'aPosition');
        this.attrs.aEuler = gl.getAttribLocation(shaderProgram, 'aEuler');
        this.attrs.aMisc = gl.getAttribLocation(shaderProgram, 'aMisc');

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
        const shaderRef = this.gl.createShader(type);
        if (!shaderRef) {
            return null;
        }
        this.gl.shaderSource(shaderRef, src);
        this.gl.compileShader(shaderRef);
        if (!this.gl.getShaderParameter(shaderRef, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(shaderRef);
            return null;
        }
        return shaderRef;
    }

    private initParticles(): void {
        const PI2 = Math.PI * 2;
        const randomValue = (): number => Math.random() * 2 - 1;
        this.petals = [];

        for (let i = 0; i < this.numPetals; i++) {
            const petal = new Petal();
            const direction = [
                randomValue() * this.velXMag + this.velXBias,
                randomValue() * this.velYMag + this.velYBias,
                randomValue() * this.velZMag + this.velZBias,
            ];
            const length = Math.hypot(direction[0], direction[1], direction[2]);
            const speed = this.speedBase + Math.random();

            petal.vel = direction.map(v => v / length * speed);
            petal.spin = [randomValue() * PI2 * this.spinHalfScale,
            randomValue() * PI2 * this.spinHalfScale,
            randomValue() * PI2 * this.spinHalfScale];
            petal.pos = [randomValue() * this.areaX, randomValue() * this.areaY, randomValue() * this.areaZ];
            petal.euler = [Math.random() * PI2, Math.random() * PI2, Math.random() * PI2];
            petal.size = this.sizeMin + Math.random() * this.sizeRange;
            this.petals.push(petal);
        }
    }

    // ── Render loop ──────────────────────────────────────────────────────────

    private loop = (now: number): void => {
        const deltaTime = Math.min((now - this.prev) / this.msPerSec, this.maxDeltaTime);
        this.prev = now;
        this.render(deltaTime);
        this.rafId = requestAnimationFrame(this.loop);
    };

    private render(deltaTime: number): void {
        if (!this.program || !this.buffer) {
            return;
        }
        const gl = this.gl;
        const PI2 = Math.PI * 2;

        this.viewMatrix = buildLookAtMatrix(this.camPos, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

        const limits = [this.areaX, this.areaY, this.areaZ];
        for (const petal of this.petals) {
            petal.update(deltaTime);
            for (let c = 0; c < limits.length; c++) {
                const limit = limits[c];
                if (Math.abs(petal.pos[c]) - petal.size / 2 > limit) {
                    petal.pos[c] += petal.pos[c] > 0 ? -limit * 2 : limit * 2;
                }
                petal.euler[c] = ((petal.euler[c] % PI2) + PI2) % PI2;
            }
            const currentViewMatrix = this.viewMatrix;
            petal.zkey = currentViewMatrix[2] * 
            petal.pos[0] + currentViewMatrix[6] * 
            petal.pos[1] + currentViewMatrix[10] * 
            petal.pos[2] + currentViewMatrix[14];
        }
        this.petals.sort((a, b) => a.zkey - b.zkey);

        let indexPos = this.posOff;
        let indexEuler = this.eulOff;
        let indexMisc = this.miscOff;
        for (const petal of this.petals) {
            this.dataArray[indexPos++] = petal.pos[0]; this.dataArray[indexPos++] = petal.pos[1]; this.dataArray[indexPos++] = petal.pos[2];
            this.dataArray[indexEuler++] = petal.euler[0];
            this.dataArray[indexEuler++] = petal.euler[1]; this.dataArray[indexEuler++] = petal.euler[2];
            this.dataArray[indexMisc++] = petal.size; this.dataArray[indexMisc++] = 1;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.program);

        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;
        gl.uniform3fv(this.uniforms.uResolution, new Float32Array([canvasWidth, canvasHeight, canvasWidth / canvasHeight]));
        gl.uniformMatrix4fv(this.uniforms.uProjection, false, this.projMatrix);
        gl.uniformMatrix4fv(this.uniforms.uModelview, false, this.viewMatrix);
        gl.uniform3fv(this.uniforms.uDOF, new Float32Array([this.dof.x, this.dof.y, this.dof.z]));
        gl.uniform3fv(this.uniforms.uFade, new Float32Array([this.fader.x, this.fader.y, this.fader.z]));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.dataArray, gl.DYNAMIC_DRAW);

        const floatSizeBytes = Float32Array.BYTES_PER_ELEMENT;
        const attrPosition = this.attrs.aPosition;
        const attrEuler = this.attrs.aEuler;
        const attrMisc = this.attrs.aMisc;
        gl.enableVertexAttribArray(attrPosition);
        gl.enableVertexAttribArray(attrEuler);
        gl.enableVertexAttribArray(attrMisc);
        gl.vertexAttribPointer(attrPosition, this.posComponents, gl.FLOAT, false, 0, this.posOff * floatSizeBytes);
        gl.vertexAttribPointer(attrEuler, this.posComponents, gl.FLOAT, false, 0, this.eulOff * floatSizeBytes);
        gl.vertexAttribPointer(attrMisc, 2, gl.FLOAT, false, 0, this.miscOff * floatSizeBytes);

        const offsets: [number, number, number][] = [
            [0, 0, 0],
            [-this.areaX, -this.areaY, this.copyZOffset],
            [-this.areaX, this.areaY, this.copyZOffset],
            [this.areaX, -this.areaY, this.copyZOffset],
            [this.areaX, this.areaY, this.copyZOffset],
        ];
        for (const [offsetX, offsetY, offsetZ] of offsets) {
            gl.uniform3f(this.uniforms.uOffset, offsetX, offsetY, offsetZ);
            gl.drawArrays(gl.POINTS, 0, this.numPetals);
        }

        gl.disableVertexAttribArray(attrPosition);
        gl.disableVertexAttribArray(attrEuler);
        gl.disableVertexAttribArray(attrMisc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
        gl.disable(gl.BLEND);
    }

    // ── Resize handling ──────────────────────────────────────────────────────

    private resize(): void {
        const canvas = this.canvasRef.nativeElement;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        this.gl.viewport(0, 0, canvasWidth, canvasHeight);
        this.areaX = this.areaY * (canvasWidth / canvasHeight);
        this.fader.y = this.areaZ;
        this.camPos.z = this.areaZ + this.nearPlane;

        const angle = Math.atan2(this.areaY, this.camPos.z + this.areaZ) * this.degPerRotation / Math.PI;
        this.projMatrix = buildProjectionMatrix(canvasWidth / canvasHeight, angle, this.nearPlane, this.farPlane);
    }


}
