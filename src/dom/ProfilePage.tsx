'use dom';

// A5: your profile, from the prototype's profile.js (`renderProfile`, `openEggCustom`, `openAddFact`,
// `suggestIdeas`). Edits save as you go (the prototype's `saveMe`), a moment after you stop typing.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art, PATTERNS, SWATCHES } from './art/art';
import './art/art.css';
import { faceId } from './faces';
import { play } from './play';
import { call, closeOv, esc, hdr, I, openOv, OV_HTML, setTop, sideEgg, toast, TOAST_HTML, wireOv } from './ui';

export interface ProfileFact {
  k: string;
  v: string;
}
export interface ProfileData {
  id: string;
  username: string;
  name: string;
  birthday: string;
  photoUrl: string | null;
  egg: { swatch: string; pattern: string };
  facts: ProfileFact[];
}
export type ProfilePatch = Partial<Pick<ProfileData, 'username' | 'name' | 'birthday' | 'egg' | 'facts'>>;

interface Props {
  top: number;
  profile: ProfileData;
  onBack: () => Promise<void>;
  onSave: (p: ProfilePatch) => Promise<string | null>;
  onPhoto: () => Promise<string | null>;
  onIdeas: (have: string[]) => Promise<string[]>;
  onPreview: () => Promise<void>;
  dom?: DOMProps;
}

export default function ProfilePage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const me = useRef({ ...props.profile, facts: [...props.profile.facts] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = props;
  });

  async function save(patch: ProfilePatch) {
    const problem = await latest.current.onSave(patch).catch((e: unknown) => (e instanceof Error ? e.message : "that didn't save"));
    if (problem && root.current) toast(root.current, problem.toLowerCase(), 3200);
  }

  function render() {
    const r = root.current;
    if (!r) return;
    const m = me.current;
    const host = r.querySelector<HTMLElement>('#pfHost')!;
    const st = host.querySelector('#pfScroll')?.scrollTop ?? 0;
    host.innerHTML = `${hdr('your profile', 'editing')}
    <div class="scroll" id="pfScroll">
      <div class="pf-top"><button class="pf-pic" id="pfPic" aria-label="change your profile picture">${Art.faceSVG(faceId(m))}<span class="pf-edit">${I.edit}</span></button>
        <label class="pf-handle">@<input id="pfUser" value="${esc(m.username)}" maxlength="18" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="username"></label></div>
      <div class="rows" style="margin-top:16px">
        <label class="kv-row"><span>name</span><input id="pfName" value="${esc(m.name)}" maxlength="30" autocomplete="off"></label>
        <label class="kv-row"><span>birthday</span><input type="date" id="pfBday" value="${esc(m.birthday)}"></label>
      </div>
      <h3 class="sec">about me</h3>
      <div class="rows" id="pfFacts">${
        m.facts
          .map(
            (f, i) => `<div class="kv-row"><span>${esc(f.k)}</span><input data-fact="${i}" value="${esc(f.v)}" maxlength="60" aria-label="${esc(f.k)}">
        <button class="x" data-delfact="${i}" aria-label="remove ${esc(f.k)}">${I.close}</button></div>`,
          )
          .join('') || '<div class="kv-row"><span>nothing yet</span></div>'
      }</div>
      <button class="add-fact" id="addFact">${I.plus}add a fact</button>
      <p class="pf-note">friends see all of this when they crack your egg in a carton.<br><button id="pfPreview">see what they see</button></p>
    </div>`;
    const sc = host.querySelector('#pfScroll');
    if (sc) sc.scrollTop = st;
    const u = host.querySelector<HTMLInputElement>('#pfUser');
    if (u) u.size = Math.max(3, u.value.length + 1);
  }

  // The photo arrives from the server after an upload.
  useEffect(() => {
    if (props.profile.photoUrl && props.profile.photoUrl !== me.current.photoUrl) {
      me.current.photoUrl = props.profile.photoUrl;
      render();
    }
  }, [props.profile.photoUrl]);

  function openEggCustom() {
    const r = root.current!;
    const m = me.current;
    const p = openOv(
      r,
      `<div class="sheet" role="dialog" aria-label="customize your egg"><h3>customize your egg</h3>
    <p class="g-kicker" style="text-align:left;margin:-6px 0 14px">this is the egg that sits in your friends' cartons.</p>
    <div class="cust-egg" id="custEgg"></div><div class="cust-row" id="custSw"></div><div class="cust-row" id="custPt"></div>
    <div class="sheet-foot"><button class="pill solid small" data-ov-close>done</button></div></div>`,
    );
    const draw = () => {
      p.querySelector('#custEgg')!.innerHTML = Art.eggSVG({ ...m.egg, text: m.username, ty: 96 });
      p.querySelector('#custSw')!.innerHTML = SWATCHES.map((s) => `<button class="sw" data-csw="${s.id}" aria-label="${s.id}" aria-pressed="${s.id === m.egg.swatch}" style="background:${s.base};box-shadow:0 0 0 1px var(--line) inset"></button>`).join('');
      p.querySelector('#custPt')!.innerHTML = PATTERNS.map((pt) => `<button class="pt" data-cpt="${pt}" aria-label="${pt}" aria-pressed="${pt === m.egg.pattern}">${Art.eggSVG({ swatch: m.egg.swatch, pattern: pt })}</button>`).join('');
    };
    draw();
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const s = t.closest<HTMLElement>('[data-csw]');
      const pt = t.closest<HTMLElement>('[data-cpt]');
      if (!s && !pt) return;
      m.egg = s ? { ...m.egg, swatch: s.dataset.csw ?? m.egg.swatch } : { ...m.egg, pattern: pt?.dataset.cpt ?? m.egg.pattern };
      draw();
      void save({ egg: m.egg });
      play(p.querySelector('#custEgg svg'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06,.95)' }, { transform: 'none' }], { duration: 360, keep: false });
    });
  }

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, props.top);
    wireOv(r);
    render();
    sideEgg(r.querySelector<HTMLElement>('#pfEgg')!, { label: 'customize egg', onTap: openEggCustom });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* add a fact: write your own category, or ask claude for ideas */
  function openAddFact() {
    const r = root.current!;
    const m = me.current;
    const p = openOv(
      r,
      `<div class="sheet" role="dialog" aria-label="add a fact"><h3>add a fact</h3>
    <label class="field"><span>category</span><input id="fk" maxlength="30" placeholder="e.g. comfort food" autocomplete="off"></label>
    <label class="field"><span>your answer</span><input id="fv" maxlength="60" placeholder="type your answer" autocomplete="off"></label>
    <div class="ideas"><button class="chip" id="ideaBtn">${I.sparkle}suggest categories</button><div class="chips" id="ideaChips" style="margin-top:10px"></div><p class="ai-note" id="ideaNote"></p></div>
    <div class="sheet-foot"><button class="pill ghost small" data-ov-close>cancel</button><button class="pill solid small" id="factSave">add</button></div></div>`,
    );
    const fk = p.querySelector<HTMLInputElement>('#fk')!;
    const fv = p.querySelector<HTMLInputElement>('#fv')!;
    setTimeout(() => fk.focus(), 380);
    p.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#ideaBtn')) {
        const btn = p.querySelector<HTMLButtonElement>('#ideaBtn')!;
        const chips = p.querySelector('#ideaChips')!;
        btn.disabled = true;
        chips.innerHTML = '<span class="chip ghost">thinking...</span>';
        const ideas = await latest.current.onIdeas(m.facts.map((f) => f.k.toLowerCase())).catch(() => [] as string[]);
        chips.innerHTML = ideas.map((x) => `<button class="chip" data-idea="${esc(x)}">${esc(x)}</button>`).join('');
        p.querySelector('#ideaNote')!.textContent = ideas.length ? 'tap one to use it.' : 'no ideas right now. write your own!';
        btn.disabled = false;
        btn.innerHTML = `${I.sparkle}more ideas`;
        return;
      }
      const idea = t.closest<HTMLElement>('[data-idea]');
      if (idea) {
        fk.value = idea.dataset.idea ?? '';
        return fv.focus();
      }
      if (t.closest('#factSave')) {
        const k = fk.value.trim().toLowerCase();
        const v = fv.value.trim();
        if (!k) return fk.focus();
        if (!v) return fv.focus();
        m.facts.push({ k, v });
        void save({ facts: m.facts });
        void closeOv(r);
        render();
        toast(r, `added ${k}`);
      }
    });
  }

  function onInput(e: React.FormEvent) {
    const t = e.target as HTMLInputElement;
    const m = me.current;
    const patch: ProfilePatch = {};
    if (t.id === 'pfUser') {
      const v = t.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
      if (v !== t.value) t.value = v;
      if (v) {
        m.username = v;
        patch.username = v;
      }
      t.size = Math.max(3, v.length + 1);
    } else if (t.id === 'pfName') {
      m.name = t.value;
      patch.name = t.value;
    } else if (t.id === 'pfBday') {
      m.birthday = t.value;
      patch.birthday = t.value;
    } else if (t.dataset.fact) {
      m.facts[Number(t.dataset.fact)].v = t.value;
      patch.facts = m.facts;
    } else return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(patch), 500);
  }

  async function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const m = me.current;
    if (t.closest('[data-back]')) {
      return call(latest.current.onBack);
    }
    if (t.closest('#pfPic')) {
      const url = await latest.current.onPhoto().catch(() => null);
      if (url) {
        m.photoUrl = url;
        render();
        toast(r, 'new profile picture');
      }
      return;
    }
    const del = t.closest<HTMLElement>('[data-delfact]');
    if (del) {
      m.facts.splice(Number(del.dataset.delfact), 1);
      void save({ facts: m.facts });
      return render();
    }
    if (t.closest('#addFact')) return openAddFact();
    if (t.closest('#pfPreview')) call(latest.current.onPreview);
  }

  return (
    <section ref={root} className="view on scr" id="v-profile" onClick={(e) => void onClick(e)} onInput={onInput} style={{ overflow: 'hidden' }}>
      <div id="pfHost" />
      <div className="side-egg" id="pfEgg" />
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
