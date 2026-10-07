"""Hero loop for the landing page: Di (cyanotype cut-out) over a cyanotype water-ripple print.

Everything is code-made from existing pixels, nothing is generated:
- water: procedural ripples (planar + radial waves), pale blue and paper white, lighter at the top
- Di: the gig-poster cut-out, cropped waist-up like "cut.png"; slow breathing and a soft coat shift are tiny
  pixel warps (max ~2 px); face, hair, earring, hands and the round object are never warped on their own
- print feel: static paper grain, uneven emulsion edges, a slow exposure flicker
All motion uses whole cycles of T, so frame N equals frame 0: a seamless loop.

Usage: python hero_loop.py <di-cut.webp> <out_dir> [--frames N] [--size W]
Writes <out_dir>/master.mp4 (near-lossless), poster.png and water-dark.png.
"""
import sys, os, subprocess, argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--frames', type=int, default=200)   # 8 s at 25 fps
ap.add_argument('--size', type=int, default=1080)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

W = a.size; H = W * 5 // 4; N = a.frames; FPS = 25
TAU = 2 * np.pi
rng = np.random.default_rng(7)

# ---------- subject ----------
CROP = (400, 503, 1560, 1950)   # x, y, w, h in the 2246x3176 cut-out: same framing as cut.png, 4:5
im = Image.open(a.src).convert('RGBA').crop((CROP[0], CROP[1], CROP[0] + CROP[2], CROP[1] + CROP[3]))
im = im.resize((W, H), Image.LANCZOS)
sub = np.asarray(im).astype(np.float32) / 255
alpha = sub[..., 3]
rgbP = sub[..., :3] * alpha[..., None]            # premultiplied, so warps keep clean edges
L = (sub[..., :3] @ np.array([.3, .59, .11], np.float32))

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
yn = yy / H; xn = xx / W

# hands + round object + legs: light pixels in the lower part stay perfectly still
light_low = (alpha > .5) & (L > .33) & (yn > .5)
keep = ndi.gaussian_filter(ndi.binary_dilation(light_low, iterations=int(W * .03)).astype(np.float32), W * .012)
keep = np.clip(keep * 1.6, 0, 1)

# breathing weight: 0 at the bottom edge (anchored), 1 from the collar up (the head rides on the shoulders)
collar = .42
wb = np.clip((1 - yn) / (1 - collar), 0, 1); wb = wb * wb * (3 - 2 * wb)
wb = wb * (1 - keep)
# coat interior only (not the silhouette edge, not the head, not the hands)
coat = (alpha > .98) & (L < .3)
coat = ndi.binary_erosion(coat, iterations=int(W * .012)).astype(np.float32)
coat = ndi.gaussian_filter(coat, W * .01) * (yn > collar + .04) * (1 - keep)
xc = xn[alpha > .5].mean()

# ---------- water ----------
def water_grad(t, scale=1.0):
    """Gradient of a calm ripple height field. t in [0,1): one loop."""
    gx = np.zeros((H, W), np.float32); gy = np.zeros((H, W), np.float32)
    # planar swells: (angle deg, wavelength as fraction of W, amplitude, cycles per loop, phase)
    for ang, lam, amp, m, ph in [(20, .55, 1.0, 1, .3), (-35, .38, .7, 1, 1.7), (80, .27, .45, 2, 2.9),
                                 (140, .19, .3, 2, .8), (-70, .13, .18, 3, 4.1),
                                 (55, .065, .10, 3, 2.2), (-15, .048, .07, 4, .6)]:
        th = np.radians(ang); k = TAU / (lam * W * scale)
        ph_ = k * (np.cos(th) * xx + np.sin(th) * yy) - TAU * m * t + ph
        c = amp * k * np.cos(ph_)
        gx += c * np.cos(th); gy += c * np.sin(th)
    # a few slow rings, as if a drop landed far away
    for cx, cy, lam, amp, m in [(.78, .18, .09, .55, 1), (.12, .72, .11, .45, 1), (.55, .95, .08, .35, 2)]:
        dx = xx - cx * W; dy = yy - cy * H; r = np.sqrt(dx * dx + dy * dy) + 1
        k = TAU / (lam * W * scale)
        c = amp * k * np.cos(k * r - TAU * m * t) / (1 + r / (.6 * W))
        gx += c * dx / r; gy += c * dy / r
    return gx, gy

PAPER = np.array([.955, .950, .925], np.float32)        # warm white paper
PALE = np.array([.60, .72, .86], np.float32)            # pale cyanotype blue
DEEP = np.array([.42, .56, .76], np.float32)            # a bit deeper, for the bottom

def water_rgb(t, paper=PAPER, pale=PALE, deep=DEEP, base0=.40, base1=.64, ripple=.27):
    gx, gy = water_grad(t)
    g = gx * .62 + gy * -.78                              # light from top-left
    g = g / (np.percentile(np.abs(g), 99) + 1e-6)
    sm = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
    hi = sm(.22, .75, g)                                  # bright crests turn to paper white
    density = base0 + (base1 - base0) * yn                # lighter at the top, deeper at the bottom
    density = np.clip(density - ripple * hi + .14 * sm(.3, .9, -g), 0, 1)
    tint = pale[None, None] * (1 - yn[..., None]) + deep[None, None] * yn[..., None]
    return paper[None, None] * (1 - density[..., None]) + tint * density[..., None]

# ---------- print surface: grain + uneven emulsion edges ----------
grain = rng.normal(0, 1, (H, W)).astype(np.float32)
grain = ndi.gaussian_filter(grain, .7) * .035 + ndi.gaussian_filter(rng.normal(0, 1, (H, W)).astype(np.float32), W * .04) * .9
grain = grain - grain.mean()

def edge_profile(n, base, var, seed):
    r = np.random.default_rng(seed)
    p = ndi.gaussian_filter1d(r.normal(0, 1, n), n * .02) * 3 + ndi.gaussian_filter1d(r.normal(0, 1, n), 5) * .5
    return base + var * p / (np.abs(p).max() + 1e-6)
ew = W * .028
top = edge_profile(W, ew, ew * .6, 1)[None, :]; left = edge_profile(H, ew, ew * .6, 2)[:, None]
right = edge_profile(H, ew, ew * .6, 3)[:, None]; bot = edge_profile(W, 3, 3, 4)[None, :]   # bottom stays thin: the coat runs off it
d = np.minimum.reduce([yy - top, xx - left, (W - 1 - xx) - right, (H - 1 - yy) - bot])
emulsion = np.clip(d / (W * .006), 0, 1)                 # 0 = bare paper, 1 = full print
# brushed streaks where the emulsion thins out near the edge
streak = ndi.gaussian_filter(rng.normal(0, 1, (H, W)).astype(np.float32), (W * .002, W * .02))
emulsion = np.clip(emulsion * (1 + .25 * streak * (emulsion < 1)), 0, 1)

def finish(rgb, t):
    # exposure flicker: density breathes a few percent, like a print developing
    f = .035 * np.sin(TAU * t) + .012 * np.sin(TAU * 3 * t + 1)
    dens = (PAPER - rgb) * (1 + f)
    dens = dens * emulsion[..., None]
    out = PAPER - dens
    out = out * (1 + grain[..., None] * .9)
    return np.clip(out, 0, 1)

def frame(i):
    t = i / N
    s = np.sin(TAU * 2 * t)                               # two calm breaths per loop (4 s each)
    dy = -2.0 * (W / 1080) * s * wb
    dx = .9 * (W / 1080) * s * wb * np.clip((xn - xc) * 4, -1, 1) * (yn > collar)
    # coat: slow travelling folds, under 1 px
    n1 = np.sin(TAU * (xn * 2.1 + yn * 1.3) - TAU * t + .4) + .6 * np.sin(TAU * (xn * -1.2 + yn * 2.7) - TAU * 2 * t)
    n2 = np.sin(TAU * (xn * 1.7 - yn * 1.9) - TAU * t + 2.2)
    dx = dx + .8 * coat * n1; dy = dy + .6 * coat * n2
    coords = [yy - dy, xx - dx]
    warped = np.stack([ndi.map_coordinates(rgbP[..., c], coords, order=1, mode='nearest') for c in range(3)], -1)
    al = ndi.map_coordinates(alpha, coords, order=1, mode='nearest')[..., None]
    # a soft light change along the folds (±3 %), no new detail
    warped = warped * (1 + .03 * (coat * n1)[..., None])
    rgb = water_rgb(t) * (1 - al) + warped
    return finish(rgb, t)

if __name__ == '__main__':
    master = os.path.join(a.out, 'master.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                           '-i', '-', '-c:v', 'libx264', '-crf', '10', '-preset', 'slow', '-pix_fmt', 'yuv444p', master], stdin=subprocess.PIPE)
    for i in range(N):
        fr = (frame(i) * 255 + .5).astype(np.uint8)
        if i == 0: Image.fromarray(fr).save(os.path.join(a.out, 'poster.png'))
        ff.stdin.write(fr.tobytes())
        if i % 25 == 0: print('frame', i, flush=True)
    ff.stdin.close(); ff.wait()
    # deep-blue water for the rest of the section (static), same ripple family
    wd = water_rgb(.0, paper=np.array([.22, .33, .50], np.float32), pale=np.array([.07, .17, .33], np.float32),
                   deep=np.array([.05, .12, .26], np.float32), base0=.55, base1=.85, ripple=.45)
    wd = np.clip(wd * (1 + grain[..., None] * .6), 0, 1)
    Image.fromarray((wd * 255 + .5).astype(np.uint8)).save(os.path.join(a.out, 'water-dark.png'))
    print('done', master)
