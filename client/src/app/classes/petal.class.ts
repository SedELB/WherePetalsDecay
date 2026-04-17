export class Petal {
    pos = [0, 0, 0];
    vel = [0, 0, 0];
    euler = [0, 0, 0];
    spin = [0, 0, 0];
    size = 1;
    zkey = 0;

    update(dt: number): void {
        for (let i = 0; i < this.pos.length; i++) {
            this.pos[i] += this.vel[i] * dt;
            this.euler[i] += this.spin[i] * dt;
        }
    }
}
