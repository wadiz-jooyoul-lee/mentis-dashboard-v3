import type { Pt } from "@/lib/office/ui/floorPlan";

// 위치와 걷기는 store가 아니라 여기서 관리한다. 1초에 수십 번 바뀌는 값을 store에 넣으면 화면 전체가 다시 그려진다
interface Item {
  pos: Pt;
  path: Pt[];
  arrive?: () => void;
  outer?: SVGGElement | null;
  inner?: SVGGElement | null;
  chain: Promise<void>;
  dir?: WalkDir;
  follow?: { front: string; gap: number; q: Pt[] }; // 앞사람 아이디, 떨어질 거리, 앞사람이 지나온 점
}

// 걷는 방향. 가로 움직임이 세로보다 크면 옆모습, 위로 가면 뒷모습으로 걷는다
export type WalkDir = "front" | "side" | "up";
const dirOf = (a: Pt, b: Pt): WalkDir => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "side" : b.y < a.y ? "up" : "front");

export class Motion {
  speed = 240;
  private items = new Map<string, Item>();
  private holds = new Map<string, Set<string>>(); // 사람마다 멈춰 세운 까닭
  private train: string[] = []; // 따라 걷는 사람. 앞사람이 먼저 오게 붙은 차례로 둔다
  private raf = 0;
  private last = 0;
  private reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  onWalking: (id: string, walking: WalkDir | false) => void = () => {};
  onStop: (id: string, stopped: boolean) => void = () => {}; // 걷던 길 위에 멈춰 섰는지

  private item(id: string): Item {
    let it = this.items.get(id);
    if (!it) {
      it = { pos: { x: 0, y: 0 }, path: [], chain: Promise.resolve() };
      this.items.set(id, it);
    }
    return it;
  }

  attach(id: string, outer: SVGGElement | null, inner: SVGGElement | null) {
    const it = this.item(id);
    it.outer = outer;
    it.inner = inner;
    this.draw(it);
  }

  forget(id: string) {
    this.items.get(id)?.arrive?.();
    this.items.delete(id);
    this.holds.delete(id);
    this.train = this.train.filter((x) => x !== id);
  }

  // 멈추기: 까닭(by)이 하나라도 남아 있으면 걷던 길 위에 서서 기다리고, 모두 풀리면 남은 길을 이어 걷는다
  hold(id: string, by: string, on: boolean) {
    const set = this.holds.get(id) ?? new Set<string>(), was = set.size > 0;
    if (on) set.add(by);
    else set.delete(by);
    if (set.size) this.holds.set(id, set);
    else this.holds.delete(id);
    const it = this.items.get(id), now = set.size > 0;
    if (!it || was === now || !it.path.length) return;
    this.onStop(id, now);
    if (now) return void this.onWalking(id, false);
    if (this.reduce) return void this.place(id, it.path[it.path.length - 1]);
    this.onWalking(id, (it.dir = dirOf(it.pos, it.path[0])));
    this.start();
  }

  held(id: string): boolean {
    return this.holds.has(id);
  }

  // 따라 걷기: 앞사람이 지나온 점을 밟으며 gap 만큼 떨어져 걷는다. 따라가는 동안은 자기 길을 갖지 않는다
  follow(id: string, front: string, gap: number) {
    const it = this.item(id);
    it.follow = { front, gap, q: [] };
    this.train = [...this.train.filter((x) => x !== id), id];
  }

  unfollow(id: string) {
    const it = this.items.get(id);
    if (!it?.follow) return;
    it.follow = undefined;
    this.train = this.train.filter((x) => x !== id);
    if (it.dir) (it.inner?.setAttribute("transform", ""), (it.dir = undefined), this.onWalking(id, false));
  }

  // 화면을 새로 받을 때 멈춤과 따라 걷기를 모두 푼다(이 까닭으로 멈춘 것만)
  release(by: string) {
    for (const id of [...this.holds.keys()]) this.hold(id, by, false);
    for (const id of this.train) this.unfollow(id);
  }

  // 걷지 않고 있는 다른 에이전트 위치. 경로가 그 위를 지나지 않게 할 때 쓴다
  others(id: string): Pt[] {
    return [...this.items].filter(([k, it]) => k !== id && !it.path.length).map(([, it]) => it.pos);
  }

  pos(id: string): Pt | undefined {
    return this.items.get(id)?.pos;
  }

  all(): Pt[] {
    return [...this.items.values()].map((it) => it.pos);
  }

  place(id: string, p: Pt) {
    const it = this.item(id);
    if (it.path.length && this.holds.has(id)) this.onStop(id, false);
    it.path = [];
    it.pos = { ...p };
    const f = it.arrive;
    it.arrive = undefined;
    f?.();
    this.draw(it);
  }

  // 같은 에이전트의 이동은 차례대로 처리한다
  enqueue(id: string, job: () => Promise<void>) {
    const it = this.item(id);
    it.chain = it.chain.then(job, job);
    return it.chain;
  }

  walk(id: string, pts: Pt[]): Promise<void> {
    const it = this.item(id);
    if (it.follow) return Promise.resolve();
    if (this.holds.has(id) && pts.length) {
      it.path = pts.slice();
      this.onStop(id, true);
      return new Promise((res) => (it.arrive = res));
    }
    if (this.reduce || !pts.length) {
      if (pts.length) this.place(id, pts[pts.length - 1]);
      return Promise.resolve();
    }
    return new Promise((res) => {
      it.path = pts.slice();
      it.arrive = res;
      it.dir = dirOf(it.pos, pts[0]);
      this.onWalking(id, it.dir);
      this.start();
    });
  }

  // 따라 걷는 사람 한 걸음. 앞사람 자리를 기록하고, 기록을 따라 잰 거리가 gap 보다 길면 그만큼 앞으로 간다. 움직였으면 true
  private trail(id: string): boolean {
    const it = this.items.get(id), f = it?.follow, front = f && this.items.get(f.front);
    if (!it || !f || !front) return false;
    const last = f.q[f.q.length - 1] ?? it.pos;
    if (Math.hypot(front.pos.x - last.x, front.pos.y - last.y) > 0.5) f.q.push({ ...front.pos });
    let len = 0, prev = it.pos;
    for (const p of f.q) (len += Math.hypot(p.x - prev.x, p.y - prev.y)), (prev = p);
    let step = len - f.gap;
    const from = it.pos;
    while (step > 0.01 && f.q.length) {
      const p = f.q[0], dx = p.x - it.pos.x, dy = p.y - it.pos.y, dist = Math.hypot(dx, dy);
      if (dist <= step) {
        it.pos = { ...p };
        f.q.shift();
        step -= dist;
      } else {
        it.pos = { x: it.pos.x + (dx / dist) * step, y: it.pos.y + (dy / dist) * step };
        step = 0;
      }
    }
    const dx = it.pos.x - from.x, moved = Math.hypot(dx, it.pos.y - from.y) > 0.01;
    if (moved) {
      if (Math.abs(dx) > 0.01) it.inner?.setAttribute("transform", dx < 0 ? "scale(-1,1)" : "");
      const d = dirOf(from, it.pos);
      if (d !== it.dir) this.onWalking(id, (it.dir = d));
      this.draw(it);
    } else if (it.dir) {
      it.inner?.setAttribute("transform", "");
      it.dir = undefined;
      this.onWalking(id, false);
    }
    return moved;
  }

  private draw(it: Item) {
    it.outer?.setAttribute("transform", `translate(${it.pos.x.toFixed(1)},${it.pos.y.toFixed(1)})`);
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      let moving = false;
      for (const [id, it] of this.items) {
        if (!it.path.length || this.holds.has(id)) continue;
        moving = true;
        let step = this.speed * dt;
        while (step > 0 && it.path.length) {
          const p = it.path[0], dx = p.x - it.pos.x, dy = p.y - it.pos.y, dist = Math.hypot(dx, dy);
          if (Math.abs(dx) > 0.5) it.inner?.setAttribute("transform", dx < 0 ? "scale(-1,1)" : "");
          const d = dirOf(it.pos, p);
          if (dist > 0.5 && d !== it.dir) this.onWalking(id, (it.dir = d));
          if (dist <= step) {
            it.pos = { ...p };
            it.path.shift();
            step -= dist;
          } else {
            it.pos = { x: it.pos.x + (dx / dist) * step, y: it.pos.y + (dy / dist) * step };
            step = 0;
          }
        }
        this.draw(it);
        if (!it.path.length) {
          it.inner?.setAttribute("transform", "");
          it.dir = undefined;
          this.onWalking(id, false);
          const f = it.arrive;
          it.arrive = undefined;
          f?.();
        }
      }
      for (const id of this.train) if (this.trail(id)) moving = true;
      this.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }
}
