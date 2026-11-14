import numpy as np, subprocess, sys, os
from scipy.signal import butter, sosfilt, lfilter, fftconvolve
SR = 44100
rng = np.random.default_rng(7)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
QUAL = {'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'dim':[0,3,6],'sus4':[0,5,7],'sus2':[0,2,7],'add9':[0,4,7,14],'m9':[0,3,7,10,14],'5':[0,7]}
def chord(name, octv=4):
    r = name[:2] if len(name) > 1 and name[1] in '#b' else name[:1]
    q = name[len(r):]
    root = NOTE[r] + 12 * (octv + 1)
    return [root + i for i in QUAL[q]]

def env(n, a, d, s_, r, total=None):
    total = total or n
    t = np.arange(total) / SR
    e = np.where(t < a, t / max(a, 1e-4), s_ + (1 - s_) * np.exp(-(t - a) / max(d, 1e-4) * 3))
    if n < total:
        lvl = e[max(0, n - 1)]
        e[n:] = lvl * np.maximum(0, 1 - (t[n:] - t[n]) / max(r, 1e-4))
    return e

def lp(x, fc, order=2):
    fc = min(fc, SR*0.45); return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

def saw(f, t, ph=0): return 2 * ((f * t + ph) % 1) - 1
def sq(f, t, duty=0.5): return np.where((f * t) % 1 < duty, 1.0, -1.0)
def tri(f, t): return 2 * np.abs(saw(f, t)) - 1

# ---------- instruments: each returns mono array ----------
def piano(n, dur, vel=0.8):
    f = midi(n); L = int((dur + 1.6) * SR); t = np.arange(L) / SR
    x = np.zeros(L)
    for h in range(1, 9):
        fh = f * h * (1 + 0.0004 * h * h)
        if fh > SR / 2.2: break
        x += (0.9 ** h) / h ** 0.6 * np.sin(2 * np.pi * fh * t) * np.exp(-t * (1.2 + 0.9 * h) * (0.6 + f / 900))
    hold = int(dur * SR)
    damp = np.ones(L); damp[hold:] = np.exp(-np.arange(L - hold) / SR * 9)
    att = np.minimum(1, t / 0.004)
    return x * damp * att * vel * 0.5

def rhodes(n, dur, vel=0.8):
    f = midi(n); L = int((dur + 1.0) * SR); t = np.arange(L) / SR
    idx = 1.6 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * np.exp(-t * 1.1)
    x += 0.15 * np.sin(2 * np.pi * f * 7 * t) * np.exp(-t * 18)
    hold = int(dur * SR); damp = np.ones(L); damp[hold:] = np.exp(-np.arange(L - hold) / SR * 7)
    return x * damp * np.minimum(1, t / 0.003) * vel * 0.45

def bell(n, dur, vel=0.8, ratio=3.5, dec=1.6):
    f = midi(n); L = int((dur + 2.5) * SR); t = np.arange(L) / SR
    idx = 2.2 * np.exp(-t * 2.5)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t * dec)
    return x * np.minimum(1, t / 0.002) * vel * 0.35

def pluck(n, dur, vel=0.8, bright=0.5):
    f = midi(n); N = max(2, int(SR / f)); L = int((dur + 0.8) * SR)
    exc = np.zeros(L); burst = rng.uniform(-1, 1, N); burst = lp(burst, 1500 + bright * 7000); exc[:N] = burst
    a = np.zeros(N + 2); a[0] = 1; a[N] = -0.497; a[N + 1] = -0.497
    y = lfilter([1], a, exc)
    hold = int(dur * SR); damp = np.ones(L); damp[hold:] = np.exp(-np.arange(L - hold) / SR * 14)
    return y * damp * vel * 0.6

def pad(n, dur, vel=0.6, bright=1800, att=0.6, rel=1.2, wave='saw'):
    f = midi(n); L = int((dur + rel) * SR); t = np.arange(L) / SR
    x = np.zeros(L)
    for dt in (-0.12, 0, 0.11):
        ff = f * 2 ** (dt / 12)
        x += saw(ff, t, rng.random()) if wave == 'saw' else tri(ff, t)
    x = lp(x / 3, bright)
    e = env(int(dur * SR), att, 0.3, 0.85, rel, L)
    return x * e * vel * 0.35

def strings(n, dur, vel=0.6):
    f = midi(n); L = int((dur + 1.0) * SR); t = np.arange(L) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.8)
    ph = np.cumsum(f * vib) / SR
    x = sum(2 * ((ph * 2 ** (d / 1200) + r) % 1) - 1 for d, r in ((-7, .1), (0, .5), (6, .8))) / 3
    x = lp(x, 2600)
    return x * env(int(dur * SR), 0.35, 0.2, 0.9, 0.9, L) * vel * 0.3

def bass(n, dur, vel=0.8, kind='saw', cut=700):
    f = midi(n); L = int((dur + 0.15) * SR); t = np.arange(L) / SR
    if kind == 'sine': x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    elif kind == 'sq': x = lp(sq(f, t), cut)
    else:
        w = saw(f, t); e = np.exp(-t * 12); x = lp(w, cut) * (1 - e) + lp(w, cut * 3) * e
    return x * env(int(dur * SR), 0.005, 0.15, 0.7, 0.08, L) * vel * 0.55

def lead(n, dur, vel=0.7, kind='sq', cut=3000):
    f = midi(n); L = int((dur + 0.2) * SR); t = np.arange(L) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3)
    ph = np.cumsum(f * vib) / SR
    x = np.where(ph % 1 < 0.5, 1.0, -1.0) if kind == 'sq' else 2 * (ph % 1) - 1
    x = lp(x, cut)
    return x * env(int(dur * SR), 0.01, 0.1, 0.8, 0.12, L) * vel * 0.22

def kick(vel=1.0):
    L = int(0.45 * SR); t = np.arange(L) / SR
    f = 48 + 110 * np.exp(-t * 28); ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t * 7) * vel * 0.9
def snare(vel=1.0):
    L = int(0.3 * SR); t = np.arange(L) / SR
    nz = bp(rng.uniform(-1, 1, L), 1200, 7000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25)
    return (nz * 0.9 + tone * 0.5) * vel * 0.6
def hat(vel=1.0, open_=False):
    L = int((0.35 if open_ else 0.06) * SR); t = np.arange(L) / SR
    return hp(rng.uniform(-1, 1, L), 7000) * np.exp(-t * (9 if open_ else 70)) * vel * 0.28
def shaker(vel=1.0):
    L = int(0.09 * SR); t = np.arange(L) / SR
    return bp(rng.uniform(-1, 1, L), 4000, 11000) * np.sin(np.pi * t / t[-1]) ** 2 * vel * 0.18
def clap(vel=1.0):
    L = int(0.25 * SR); t = np.arange(L) / SR
    e = np.exp(-t * 20) + sum(np.exp(-(t - d) * 120) * (t >= d) for d in (0.0, 0.011, 0.022))
    return bp(rng.uniform(-1, 1, L), 900, 5000) * e * vel * 0.35
def tom(n=45, vel=1.0):
    L = int(0.5 * SR); t = np.arange(L) / SR
    f = midi(n) * (1 + 0.6 * np.exp(-t * 20)); ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t * 6) * vel * 0.6
def boom(vel=1.0):
    L = int(3.0 * SR); t = np.arange(L) / SR
    f = 30 + 60 * np.exp(-t * 4); ph = np.cumsum(f) / SR
    return (np.sin(2 * np.pi * ph) * np.exp(-t * 1.3) + lp(rng.uniform(-1, 1, L), 200) * np.exp(-t * 2) * 0.5) * vel

# ---------- song builder ----------
class Song:
    def __init__(s, bpm, bars, beats=4):
        s.bpm = bpm; s.beat = 60 / bpm; s.bars = bars; s.bpb = beats
        s.len = bars * beats * s.beat
        s.tail = 3.0
        N = int((s.len + s.tail) * SR) + SR
        s.bus = {}  # name -> (L,R) arrays
        s.N = N
    def track(s, name, pan=0.0, vol=1.0, rev=0.25):
        if name not in s.bus: s.bus[name] = [np.zeros(s.N), pan, vol, rev]
        return name
    def put(s, name, t, x):
        b = s.bus[name]; i = int(t * SR)
        if i >= s.N: return
        j = min(s.N, i + len(x)); b[0][i:j] += x[:j - i]
    def at(s, bar, beat=0): return (bar * s.bpb + beat) * s.beat
    def render(s, name, master_lp=None):
        L = np.zeros(s.N); R = np.zeros(s.N); RL = np.zeros(s.N); RR = np.zeros(s.N)
        for nm, (x, pan, vol, rev) in s.bus.items():
            g = vol; l = np.cos((pan + 1) * np.pi / 4) * g; r = np.sin((pan + 1) * np.pi / 4) * g
            L += x * l; R += x * r; RL += x * l * rev; RR += x * r * rev
        # reverb
        irl = int(2.6 * SR); ti = np.arange(irl) / SR
        ir1 = rng.normal(0, 1, irl) * np.exp(-ti * 2.4); ir2 = rng.normal(0, 1, irl) * np.exp(-ti * 2.4)
        ir1 = lp(ir1, 5000); ir2 = lp(ir2, 5000); ir1 /= np.sqrt((ir1**2).sum()); ir2 /= np.sqrt((ir2**2).sum())
        L += fftconvolve(RL, ir1)[:s.N] * 0.9; R += fftconvolve(RR, ir2)[:s.N] * 0.9
        st = np.stack([L, R])
        if master_lp: st = np.stack([lp(st[0], master_lp), lp(st[1], master_lp)])
        # seamless loop: fold tail onto start
        n = int(s.len * SR); out = st[:, :n].copy(); tail = st[:, n:]
        k = min(tail.shape[1], n); out[:, :k] += tail[:, :k]
        out = hp(out, 30)
        pk = np.max(np.abs(out)) + 1e-9
        out = out / pk * 1.15; out = np.tanh(out) / np.tanh(1.15) * 0.9
        os.makedirs('out', exist_ok=True)
        wav = f'out/{name}.f32'
        out.T.astype(np.float32).tofile(wav)
        inp = ['-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', wav]
        r = subprocess.run(['ffmpeg', '-hide_banner'] + inp + ['-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
        import re
        I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
        g = -18.0 - I
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + inp + ['-af', f'volume={g:.2f}dB,alimiter=limit=0.89:level=false',
                        '-c:a', 'libmp3lame', '-b:a', '96k', f'out/{name}.mp3'], check=True)
        os.remove(wav)
        print(name, round(s.len, 1), 's', os.path.getsize(f'out/{name}.mp3') // 1024, 'KB')
