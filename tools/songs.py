import sys; sys.path.insert(0, '/tmp/bgm')
from synth import *
import numpy as np
R = np.random.default_rng(11)

def humanize(v=0.08): return 1 - R.random() * v

def drums_basic(S, bars, pat='pop', start=0, vel=1.0):
    S.track('kick', 0, 1.0, 0.05); S.track('snare', 0.05, 0.8, 0.25); S.track('hat', 0.3, 0.4, 0.1)
    for b in range(start, bars):
        for i in range(8):
            t = S.at(b, i / 2)
            if pat == 'pop':
                if i in (0, 4) or (i == 5 and b % 2): S.put('kick', t, kick(vel))
                if i in (2, 6): S.put('snare', t, snare(vel * 0.9))
                S.put('hat', t, hat(vel * (0.9 if i % 2 == 0 else 0.55)))
            elif pat == 'four':
                if i % 2 == 0: S.put('kick', t, kick(vel))
                if i in (2, 6): S.put('snare', t, clap(vel)); S.put('snare', t, snare(vel * 0.5))
                if i % 2 == 1: S.put('hat', t, hat(vel, open_=True) * 0.6)
            elif pat == 'drive':
                if i in (0, 3, 4, 7) or (i == 6 and b % 2): S.put('kick', t, kick(vel))
                if i in (2, 6): S.put('snare', t, snare(vel))
                S.put('hat', t, hat(vel)); S.put('hat', t + S.beat / 4, hat(vel * 0.5))
            elif pat == 'soft':
                if i in (0, 5): S.put('kick', t, kick(vel * 0.6))
                if i in (2, 6): S.put('snare', t, snare(vel * 0.35))
                S.put('hat', t, shaker(vel) * 1.5)

def comp(S, trk, inst, prog, bars, rhythm, octv=4, vel=0.6, dur=None, **kw):
    for b in range(bars):
        ch = chord(prog[b % len(prog)], octv)
        for (beat, d) in rhythm:
            for n in ch: S.put(trk, S.at(b, beat) + R.random() * 0.008, inst(n, dur or d * S.beat, vel * humanize(), **kw))

def arp(S, trk, inst, prog, bars, step=0.5, octv=4, pattern=(0, 1, 2, 1), vel=0.6, up=True, **kw):
    for b in range(bars):
        ch = chord(prog[b % len(prog)], octv); ch = ch + [c + 12 for c in ch]
        k = 0; beat = 0
        while beat < S.bpb - 1e-6:
            n = ch[pattern[k % len(pattern)] % len(ch)]
            S.put(trk, S.at(b, beat), inst(n, step * S.beat * 1.5, vel * humanize(), **kw)); beat += step; k += 1

def bassline(S, trk, prog, bars, rhythm, octv=2, vel=0.8, kind='saw', cut=700, fifth=False):
    for b in range(bars):
        root = chord(prog[b % len(prog)], octv)[0]
        for k, (beat, d) in enumerate(rhythm):
            n = root + (7 if fifth and k % 2 == 1 else 0)
            S.put(trk, S.at(b, beat), bass(n, d * S.beat * 0.9, vel, kind, cut))

def melody(S, trk, inst, notes, startbar=0, vel=0.7, **kw):
    # notes: list of (midi or None, beats)
    t = S.at(startbar)
    for n, d in notes:
        if n is not None: S.put(trk, t, inst(n, d * S.beat * 0.95, vel * humanize(0.1), **kw))
        t += d * S.beat

def mel(s, base=60):
    # "E4 2 G4 1 - 1" -> [(midi,beats)...]
    out = []; tok = s.split()
    for i in range(0, len(tok), 2):
        n, d = tok[i], float(tok[i + 1])
        if n == '-': out.append((None, d)); continue
        name = n[:-1]; o = int(n[-1]); out.append((NOTE[name] + 12 * (o + 1), d))
    return out

# 1 잔잔한 오후
def calm():
    S = Song(80, 24); prog = ['Cmaj7', 'Am7', 'Fmaj7', 'G']
    S.track('pno', -0.15, 1.0, 0.35); S.track('pad', 0.2, 0.5, 0.5); S.track('bs', 0, 0.6, 0.1); S.track('mel', 0.1, 0.8, 0.4)
    arp(S, 'pno', piano, prog, 24, 0.5, 4, (0, 2, 1, 3, 2, 4, 3, 2), 0.55)
    comp(S, 'pad', pad, prog, 24, [(0, 4)], 3, 0.45, bright=1200, att=1.0)
    bassline(S, 'bs', prog, 24, [(0, 2), (2, 2)], 2, 0.6, 'sine')
    m = mel('E5 1.5 D5 0.5 C5 1 G4 1 A4 2 C5 1 E5 1 F5 1.5 E5 0.5 C5 1 A4 1 G4 3 - 1') * 1
    melody(S, 'mel', bell, m, 8, 0.5, ratio=3.0, dec=1.2); melody(S, 'mel', bell, m, 16, 0.5, ratio=3.0, dec=1.2)
    S.render('calm')

# 2 신나는 하루
def upbeat():
    S = Song(124, 32); prog = ['C', 'G', 'Am', 'F']
    S.track('gtr', -0.35, 0.8, 0.2); S.track('bs', 0, 0.9, 0.05); S.track('lead', 0.25, 0.9, 0.3); S.track('keys', 0.35, 0.6, 0.3)
    drums_basic(S, 32, 'pop', start=4)
    comp(S, 'gtr', pluck, prog, 32, [(0, .5), (.5, .5), (1.5, .5), (2.5, .5), (3, .5), (3.5, .5)], 4, 0.4, bright=0.8)
    bassline(S, 'bs', prog, 32, [(0, .5), (.5, .5), (1, .5), (1.5, .5), (2, .5), (2.5, .5), (3, .5), (3.5, .5)], 2, 0.7, 'saw', 900, fifth=True)
    comp(S, 'keys', rhodes, prog, 32, [(1, 1), (3, 1)], 4, 0.4)
    m = mel('E5 .5 G5 .5 G5 .5 A5 .5 G5 1 E5 1 D5 .5 E5 .5 D5 .5 B4 .5 D5 2 C5 .5 E5 .5 E5 .5 G5 .5 A5 1 G5 1 F5 .5 E5 .5 D5 .5 C5 .5 C5 2')
    for sb in (8, 12, 20, 24): melody(S, 'lead', lead, m, sb, 0.75, kind='sq', cut=3500)
    S.render('upbeat')

# 3 엉뚱발랄 (개그)
def comic():
    S = Song(112, 24); prog = ['C', 'C', 'F', 'G7', 'C', 'A7', 'Dm', 'G7']
    S.track('bsn', -0.2, 1.0, 0.15); S.track('pz', 0.3, 0.8, 0.2); S.track('mel', 0.0, 0.9, 0.2); S.track('kick', 0, .7, .05); S.track('snare', 0, .5, .2); S.track('hat', 0.3, .6, .1)
    for b in range(24):
        ch = chord(prog[b % 8], 2)
        for i, beat in enumerate((0, 1, 2, 3)):
            n = ch[0] if i % 2 == 0 else ch[2] - 12
            S.put('bsn', S.at(b, beat), bass(n, 0.3 * S.beat, 0.8, 'sq', 1100))
            S.put('kick' if i % 2 == 0 else 'snare', S.at(b, beat), kick(.8) if i % 2 == 0 else snare(.4))
        for beat in (1, 3):
            for n in chord(prog[b % 8], 4): S.put('pz', S.at(b, beat), pluck(n, 0.15 * S.beat, 0.5, 0.9))
    m = mel('G5 .5 - .5 E5 .5 - .5 C5 .5 D5 .5 E5 .5 F5 .5 G5 .5 G5 .5 A5 .5 G5 .5 F5 1 - 1 '
            'F5 .5 - .5 D5 .5 - .5 B4 .5 C5 .5 D5 .5 E5 .5 F5 .5 E5 .5 D5 .5 C#5 .5 D5 1 G4 1 '
            'C5 .5 E5 .5 G5 .5 C6 .5 Bb5 .5 A5 .5 G#5 .5 A5 .5 D5 .5 F5 .5 A5 .5 F5 .5 G5 .5 F5 .5 E5 .5 D5 .5 C5 1 G4 1 C5 2')
    melody(S, 'mel', bell, m, 4, 0.7, ratio=1.0, dec=6); melody(S, 'mel', bell, m, 14, 0.7, ratio=1.0, dec=6)
    S.render('comic')

# 4 긴장감
def tension():
    S = Song(104, 24); prog = ['Am', 'Am', 'F', 'E', 'Am', 'Am', 'Bb', 'E']
    S.track('ost', -0.2, 0.9, 0.2); S.track('drone', 0, 0.6, 0.5); S.track('hit', 0, 0.9, 0.5); S.track('str', 0.3, 0.7, 0.4); S.track('kick', 0, .9, .1); S.track('hat', 0.3, .5, .1)
    for b in range(24):
        root = chord(prog[b % 8], 3)[0]
        for k in range(16):
            n = root + (12 if k % 4 == 2 else (7 if k % 4 == 3 else 0))
            S.put('ost', S.at(b, k / 4), pluck(n, 0.2 * S.beat, 0.55 if k % 4 == 0 else 0.35, 0.4))
            if b >= 8 and k % 2 == 1: S.put('hat', S.at(b, k / 4), hat(.5))
        if b >= 4:
            for beat in (0, 2.5): S.put('kick', S.at(b, beat), kick(.7)); S.put('kick', S.at(b, beat), tom(40, .4))
        if b % 4 == 0: S.put('drone', S.at(b), pad(chord(prog[b % 8], 1)[0], 4 * 4 * S.beat, 0.6, 500, 2, 2))
        if b % 8 == 7: S.put('hit', S.at(b, 3), boom(0.6))
    for b in range(8, 24, 2):
        for n in chord(prog[b % 8], 4)[:2]: S.put('str', S.at(b), strings(n + 12, 8 * S.beat, 0.5))
    S.render('tension')

# 5 슬픈 비
def sad():
    S = Song(66, 16); prog = ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'F', 'E']
    S.track('pno', -0.1, 1.0, 0.45); S.track('str', 0.25, 0.7, 0.55); S.track('bs', 0, .5, .2); S.track('mel', 0, 0.9, 0.45)
    arp(S, 'pno', piano, prog, 16, 0.5, 3, (0, 1, 2, 3, 4, 3, 2, 1), 0.45)
    comp(S, 'str', strings, prog, 16, [(0, 4)], 4, 0.35)
    bassline(S, 'bs', prog, 16, [(0, 4)], 2, 0.6, 'sine')
    m = mel('E5 1.5 D5 .5 C5 1 B4 1 A4 3 C5 1 B4 1.5 A4 .5 G4 1 E4 1 G4 4 '
            'A4 1.5 B4 .5 C5 1 D5 1 E5 2 F5 2 D5 1.5 C5 .5 A4 1 C5 1 B4 4')
    melody(S, 'mel', piano, m, 8, 0.75)
    S.render('sad')

# 6 공포
def horror():
    S = Song(60, 16);
    S.track('drone', 0, 0.8, 0.6); S.track('clst', 0, .6, .7); S.track('ping', 0.4, 0.7, 0.8); S.track('boom', 0, 1, .4); S.track('whisper', -0.3, 0.5, 0.8)
    L = S.len
    for b in range(0, 16, 4):
        for n in (26, 27, 33): S.put('drone', S.at(b), pad(n, 16 * S.beat, 0.6, 400, 3, 3))
    for b in range(2, 16, 4):
        for n in (65, 66, 71): S.put('clst', S.at(b, 1), strings(n, 6 * S.beat, 0.25))
    for k in range(18):
        t = R.random() * (L - 3)
        S.put('ping', t, bell(int(R.integers(78, 95)), 1.0, 0.35, ratio=1.414 + R.random(), dec=2.2))
    for b in (3, 7, 11, 15): S.put('boom', S.at(b, 2), boom(0.7))
    N = int(L * SR); nz = bp(rng.uniform(-1, 1, N), 600, 2500) * (0.5 + 0.5 * np.sin(np.arange(N) / SR * 0.7)) * 0.05
    S.put('whisper', 0, nz)
    S.render('horror')

# 7 두근두근 (로맨스)
def romance():
    S = Song(88, 24); prog = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm7', 'C7']
    S.track('rh', -0.2, 1.0, 0.35); S.track('bs', 0, .7, .1); S.track('mel', 0.15, 0.85, 0.4); S.track('kick', 0, .6, .1); S.track('snare', 0, .5, .3); S.track('hat', .3, .6, .1)
    comp(S, 'rh', rhodes, prog, 24, [(0, 1.5), (1.5, 1), (2.5, 1.5)], 4, 0.4)
    bassline(S, 'bs', prog, 24, [(0, 1.5), (1.5, .5), (2, 2)], 2, 0.6, 'sine')
    drums_basic(S, 24, 'soft', start=8, vel=0.9)
    m = mel('A5 1 G5 .5 A5 .5 C6 1 A5 1 G5 1 E5 .5 G5 .5 A5 2 F5 1 E5 .5 F5 .5 A5 1 F5 1 E5 1 D5 .5 E5 .5 C5 2 '
            'D5 1 E5 .5 F5 .5 A5 1 G5 1 C5 1 D5 .5 E5 .5 G5 2 Bb4 1 C5 .5 D5 .5 F5 1 E5 1 E5 4')
    melody(S, 'mel', bell, m, 8, 0.55, ratio=2.0, dec=1.4)
    S.render('romance')

# 8 전투 (액션)
def action():
    S = Song(150, 32); prog = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A']
    S.track('bs', 0, 0.9, 0.05); S.track('pow', -0.3, 0.7, 0.15); S.track('pow2', 0.3, 0.7, 0.15); S.track('lead', 0, .8, .3); S.track('str', 0, .6, .4); S.track('boom', 0, .8, .4)
    drums_basic(S, 32, 'drive', start=2)
    for b in range(32):
        root = chord(prog[b % 8], 2)[0]
        for k in range(8): S.put('bs', S.at(b, k / 2), bass(root + (12 if k in (3, 6) else 0), 0.45 * S.beat, 0.8, 'saw', 1200))
        if b >= 4:
            for beat, d in ((0, 1.5), (1.5, 1.5), (3, 1)):
                for n in (root + 12, root + 19):
                    S.put('pow' if n == root + 12 else 'pow2', S.at(b, beat), lp(lead(n, d * S.beat * 0.9, 0.8, 'saw', 2200), 2400))
        if b % 8 == 0: S.put('boom', S.at(b), boom(0.5))
    m = mel('D5 1 A4 .5 D5 .5 E5 1 F5 1 E5 1.5 D5 .5 C5 1 A4 1 Bb4 1 C5 1 D5 1 F5 1 E5 2 A4 2 '
            'D5 1 A4 .5 D5 .5 E5 1 F5 1 G5 1.5 F5 .5 E5 1 D5 1 Bb4 1 D5 1 G5 1 F5 1 E5 2 C#5 2')
    for sb in (8, 16, 24): melody(S, 'lead', strings, m, sb, 0.8)
    S.render('action')

# 9 미스터리
def mystery():
    S = Song(92, 24); prog = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Gm', 'A7']
    S.track('mal', -0.25, 0.9, 0.45); S.track('pad', 0.2, .5, .6); S.track('bs', 0, .7, .2); S.track('kick', 0, .5, .2); S.track('snare', 0, .3, .5); S.track('hat', .3, .4, .3)
    arp(S, 'mal', bell, prog, 24, 0.5, 4, (0, 2, 4, 1, 3, 2, 4, 3), 0.4, ratio=4.0, dec=3.0)
    comp(S, 'pad', pad, prog, 24, [(0, 4)], 3, 0.4, bright=900, att=1.2)
    bassline(S, 'bs', prog, 24, [(0, 1.5), (1.5, 2.5)], 1, 0.7, 'sine')
    drums_basic(S, 24, 'soft', start=8, vel=0.8)
    S.render('mystery')

# 10 감동
def emotional():
    S = Song(72, 16); prog = ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G']
    S.track('pno', -0.15, 0.9, 0.4); S.track('str', 0.2, 0.8, 0.55); S.track('bs', 0, .6, .2); S.track('mel', 0, .9, .5); S.track('kick', 0, .6, .3); S.track('snare', 0, .4, .5); S.track('hat', 0, .3, .3)
    arp(S, 'pno', piano, prog, 16, 0.5, 4, (0, 1, 2, 1), 0.45)
    comp(S, 'str', strings, prog, 16, [(0, 4)], 3, 0.45)
    bassline(S, 'bs', prog, 16, [(0, 4)], 2, 0.7, 'sine')
    for b in range(8, 16): S.put('kick', S.at(b), kick(.6)); S.put('snare', S.at(b, 2), snare(.4))
    m = mel('E5 2 D5 1 C5 1 D5 2 G4 2 C5 2 B4 1 A4 1 G4 4 A4 1 B4 1 C5 2 E5 1 D5 1 C5 2 A4 2 C5 1.5 B4 .5 B4 4')
    melody(S, 'mel', strings, m, 8, 0.75)
    S.render('emotional')

# 11 평범한 일상
def daily():
    S = Song(100, 24); prog = ['G', 'D', 'Em', 'C']
    S.track('gtr', -0.3, 0.9, 0.2); S.track('bs', 0, .8, .05); S.track('mel', 0.25, .8, .3)
    drums_basic(S, 24, 'soft', vel=1.0)
    arp(S, 'gtr', pluck, prog, 24, 0.5, 3, (0, 2, 3, 2, 1, 2, 3, 2), 0.55, bright=0.5)
    bassline(S, 'bs', prog, 24, [(0, 1.5), (1.5, .5), (2, 2)], 2, 0.6, 'sine')
    m = mel('B4 .5 D5 .5 G5 1 F#5 .5 E5 .5 D5 1 A4 1 D5 1 F#5 1 E5 1 G4 .5 B4 .5 E5 1 D5 .5 C5 .5 B4 1 C5 1 E5 1 D5 2')
    melody(S, 'mel', rhodes, m, 8, 0.55); melody(S, 'mel', rhodes, m, 16, 0.55)
    S.render('daily')

# 12 고요한 밤
def night():
    S = Song(70, 16); prog = ['Dmaj7', 'Bm7', 'Gmaj7', 'A']
    S.track('pad', 0, 0.8, 0.6); S.track('bell', 0.2, 0.7, 0.8); S.track('bs', 0, .5, .3)
    comp(S, 'pad', pad, prog, 16, [(0, 4)], 3, 0.55, bright=1400, att=1.5, rel=2.0, wave='tri')
    bassline(S, 'bs', prog, 16, [(0, 4)], 2, 0.5, 'sine')
    for b in range(16):
        ch = chord(prog[b % 4], 5)
        for k in range(3):
            if R.random() < 0.8: S.put('bell', S.at(b, R.integers(0, 8) / 2), bell(int(R.choice(ch)), 1, 0.35, ratio=2.0, dec=1.0))
    S.render('night')

if __name__ == '__main__':
    names = sys.argv[1:] or ['calm', 'upbeat', 'comic', 'tension', 'sad', 'horror', 'romance', 'action', 'mystery', 'emotional', 'daily', 'night']
    for n in names: globals()[n]()
