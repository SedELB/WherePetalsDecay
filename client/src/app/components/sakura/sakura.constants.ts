/**
 * Adapted from https://github.com/Animmaster/Sakura-Effect
 * Converted to Angular standalone component with TypeScript by Claude Sonnet 4.6.
 */

// GLSL shaders for the sakura effect (cherry blossom petals via WebGL)

export const SAKURA_VERTEX_SHADER = `
uniform mat4 uProjection;
uniform mat4 uModelview;
uniform vec3 uResolution;
uniform vec3 uOffset;
uniform vec3 uDOF;
uniform vec3 uFade;

attribute vec3 aPosition;
attribute vec3 aEuler;
attribute vec2 aMisc;

varying float palpha;
varying float pdist;
varying vec3  normX;
varying vec3  normY;
varying vec3  normZ;
varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

void main(void) {
    vec4 pos     = uModelview * vec4(aPosition + uOffset, 1.0);
    gl_Position  = uProjection * pos;
    gl_PointSize = aMisc.x * uProjection[1][1] / -pos.z * uResolution.y * 0.5;

    pdist  = length(pos.xyz);
    palpha = smoothstep(0.0, 1.0, (pdist - 0.1) / uFade.z);

    vec3 elrsn = sin(aEuler);
    vec3 elrcs = cos(aEuler);
    mat3 rotx   = mat3(1.0,0.0,0.0,  0.0,elrcs.x,elrsn.x,   0.0,-elrsn.x,elrcs.x);
    mat3 roty   = mat3(elrcs.y,0.0,-elrsn.y,  0.0,1.0,0.0,   elrsn.y,0.0,elrcs.y);
    mat3 rotz   = mat3(elrcs.z,elrsn.z,0.0,  -elrsn.z,elrcs.z,0.0,  0.0,0.0,1.0);
    mat3 rotmat = rotx * roty * rotz;
    vec3 normal = rotmat[2];

    mat3 trrotm = mat3(
        rotmat[0][0],rotmat[1][0],rotmat[2][0],
        rotmat[0][1],rotmat[1][1],rotmat[2][1],
        rotmat[0][2],rotmat[1][2],rotmat[2][2]);
    normX = trrotm[0];
    normY = trrotm[1];
    normZ = trrotm[2];

    const vec3 lit = vec3(0.692, 0.692, -0.208);
    float tmpdfs = dot(lit, normal);
    if (tmpdfs < 0.0) { normal = -normal; tmpdfs = dot(lit, normal); }
    diffuse = 0.4 + tmpdfs;

    vec3 eyev = normalize(-pos.xyz);
    specular  = (dot(eyev, normal) > 0.0)
        ? pow(max(dot(normalize(eyev + lit), normal), 0.0), 20.0)
        : 0.0;

    rstop        = pow(clamp((abs(pdist - uDOF.x) - uDOF.y) / uDOF.z, 0.0, 1.0), 0.5);
    distancefade = min(1.0, exp((uFade.x - pdist) * 0.693 / uFade.y));
}`;

export const SAKURA_FRAGMENT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif

varying float palpha;
varying float pdist;
varying vec3  normX;
varying vec3  normY;
varying vec3  normZ;
varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

const vec3 fadeCol = vec3(0.08, 0.03, 0.06);

float ellipse(vec2 p, vec2 o, vec2 r) {
    return length((p - o) / r) - 1.0;
}

void main(void) {
    vec3  p  = vec3(gl_PointCoord - vec2(0.5), 0.0) * 2.0;
    float nd = normZ.z;
    if (abs(nd) < 0.0001) discard;

    vec3 tp    = p + vec3(0.0, 0.0, -1.0) * dot(normZ, p) / nd;
    vec2 coord = vec2(dot(normX, tp), dot(normY, tp));

    const float flwrsn = 0.2588;
    const float flwrcs = 0.9659;
    mat2 m    = mat2(flwrcs, -flwrsn, flwrsn, flwrcs);
    vec2 fp   = vec2(abs(coord.x), coord.y) * m;

    float r = (fp.x < 0.0)
        ? ellipse(fp, vec2(0.0325, 0.012), vec2(0.18, 0.48))
        : ellipse(fp, vec2(0.0325, 0.012), vec2(0.29, 0.48));

    if (r > rstop) discard;

    // ***** PETAL COLOR: mix(innerColor, outerColor, r) — r=0 is center, r=1 is edge
    // vec3(R, G, B) — values between 0.0 and 1.0
    // Current: reddish pink. For soft pink: vec3(1.0, 0.7, 0.75), vec3(1.0, 0.85, 0.87)

    vec3 col = mix(vec3(0.55, 0.19, 0.20), vec3(0.65, 0.25, 0.26), r);

    // ***** GRADIENT: darkens the top of each petal (coord.y gradient). Increase exponent to sharpen.
    float gy = mix(0.0, 1.0, pow(coord.y * 0.5 + 0.5, 0.35));
    col  *= vec3(1.0, gy, gy);

    // ***** EDGE DARKENING: darkens petal edges. Increase 0.8 toward 1.0 to reduce effect.
    col  *= mix(0.8, 1.0, pow(abs(coord.x), 0.3));
    col   = col * diffuse + specular;

    // ***** FADE COLOR: color petals fade to when far away — vec3(R, G, B)
    col   = mix(fadeCol, col, distancefade);

    float alpha = (rstop > 0.001) ? (0.5 - r / (rstop * 2.0)) : 1.0;
    alpha = smoothstep(0.0, 1.0, alpha) * palpha;
    gl_FragColor = vec4(col * 0.5, alpha);
}`;
