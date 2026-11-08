'use dom';

// A5: a new event, from the prototype's events.js (`openNewEvent`, `renderNewEvent`, `saveNewEvent`). State
// stays here while the form is open, re-drawing like the prototype does. There's no end time: our events
// have only a start.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import './art/art.css';
import { avatar, call, closeOv, esc, hdr, I, openOv, OV_HTML, setTop, toast, TOAST_HTML, wireOv, type DomPerson } from './ui';

type Role = 'edit' | 'view' | 'comment';
export interface NewEventPayload {
  circleId: string;
  title: string;
  date: string;
  time: string;
  where: string;
  desc: string;
  people: { userId: string; role: Role; lead: boolean }[];
  chat: boolean;
  gallery: boolean;
}

interface Props {
  top: number;
  me: DomPerson;
  /** The coop if opened from one; otherwise you choose. */
  fixedCoop: string | null;
  coops: { id: string; name: string; members: string[] }[];
  /** Everyone from all your coops. */
  people: Record<string, DomPerson>;
  defaultDate: string;
  onBack: () => Promise<void>;
  onSave: (p: NewEventPayload) => Promise<string | null>;
  dom?: DOMProps;
}

export default function NewEventPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const ne = useRef({
    gid: props.fixedCoop ?? '',
    name: '',
    leads: [props.me.id],
    date: props.defaultDate,
    time: '18:00',
    where: '',
    desc: '',
    role: 'view' as Role,
    people: [{ id: props.me.id, role: 'edit' as Role }],
    chat: true,
    gal: true,
    saving: false,
  });

  function render() {
    const r = root.current;
    const p = latest.current;
    const NE = ne.current;
    if (!r) return;
    if (!NE.gid) NE.gid = p.coops[0]?.id ?? '';
    const g = p.coops.find((c) => c.id === NE.gid);
    const myId = p.me.id;
    const prof = (id: string) => p.people[id] ?? (id === myId ? p.me : { id, username: 'friend' });
    const added = new Set(NE.people.map((x) => x.id));
    const fromGroup = (g?.members ?? []).filter((m) => !added.has(m));
    const contacts = Object.keys(p.people).filter((id) => id !== myId && !added.has(id) && !g?.members.includes(id));
    const neFrom = (id: string) => `<button class="ne-p" data-ne-add="${id}" aria-label="add ${esc(prof(id).username)}">${avatar(prof(id))}<span>${esc(prof(id).username)}</span>${I.plus}</button>`;
    const host = r.querySelector<HTMLElement>('#neHost')!;
    const sc0 = host.querySelector('#neScroll')?.scrollTop ?? 0;
    host.innerHTML = `${hdr('new event', esc(g?.name ?? ''))}
    <div class="scroll" id="neScroll" style="padding-bottom:120px">
      ${!p.fixedCoop ? `<div class="ne-block" style="margin-top:2px"><span class="ne-lbl">for which coop?</span>
        <div class="chips">${p.coops.map((x) => `<button class="chip${x.id === NE.gid ? ' on' : ''}" data-ne-g="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>` : ''}
      <input class="ne-name" id="neName" placeholder="event name" maxlength="40" value="${esc(NE.name)}" aria-label="event name" style="margin-top:${!p.fixedCoop ? 18 : 2}px">
      <div class="ne-block"><span class="ne-lbl">in charge</span><div class="chips">
        ${NE.leads.map((l) => `<span class="chip">${avatar(prof(l))}${l === myId ? 'you' : esc(prof(l).username)}${NE.leads.length > 1 ? `<button data-ne-unlead="${l}" aria-label="remove from in charge" style="display:grid;margin-right:-4px">${I.close}</button>` : ''}</span>`).join('')}
        <button class="chip ghost" data-ne-lead aria-label="add someone in charge">${I.plus}</button></div></div>
      <div class="ne-block"><label class="field"><span>date</span><input type="date" id="neDate" value="${NE.date}"></label>
        <label class="field"><span>starts</span><input type="time" id="neTime" value="${NE.time}"></label>
        <label class="field"><span>location</span><input id="neWhere" placeholder="where is it?" maxlength="60" value="${esc(NE.where)}"></label>
        <label class="field"><span>description</span><textarea id="neDesc" rows="2" maxlength="200" placeholder="anything people should know">${esc(NE.desc)}</textarea></label></div>
      <div class="ne-block"><div class="ne-perm"><span class="ne-lbl">add people</span>
        <div class="seg-mini" role="group" aria-label="new people can">${(['edit', 'view', 'comment'] as const).map((x) => `<button data-ne-role="${x}" aria-pressed="${NE.role === x}">can ${x}</button>`).join('')}</div></div>
        <div class="ne-cols">
          <div class="ne-col from"><button class="ne-addg" data-ne-addg ${fromGroup.length ? '' : 'disabled'}>${I.people}<span>add coop: ${esc(g?.name ?? '')}${fromGroup.length ? ` (${fromGroup.length})` : ''}</span></button>
            ${fromGroup.length ? `<span class="ne-sub">${esc(g?.name ?? '')}</span>${fromGroup.map(neFrom).join('')}` : ''}
            <span class="ne-sub">contacts</span>${contacts.map(neFrom).join('') || '<span class="ne-sub">everyone is added</span>'}</div>
          <div class="ne-col"><span class="ne-sub">added (${NE.people.length})</span>
            ${NE.people.map((x) => `<div class="ne-p">${avatar(prof(x.id))}<span>${x.id === myId ? 'you' : esc(prof(x.id).username)}</span><span class="r">${NE.leads.includes(x.id) ? 'lead' : x.role}</span>
              ${x.id === myId ? '' : `<button data-ne-rm="${x.id}" aria-label="remove" style="display:grid">${I.close}</button>`}</div>`).join('')}</div>
        </div></div>
      <div class="ne-block"><span class="ne-lbl">extras</span><div class="ne-toggles">
        <button class="tgl" data-ne-t="chat" aria-pressed="${NE.chat}">${I.chat}chat</button><button class="tgl" data-ne-t="gal" aria-pressed="${NE.gal}">${I.gallery}gallery</button></div></div>
    </div>
    <div class="ne-foot"><button class="pill solid" id="neSave">save</button></div>`;
    const sc = host.querySelector('#neScroll');
    if (sc) sc.scrollTop = sc0;
  }

  const dataKey = JSON.stringify([props.coops, props.people]);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, props.top);
    wireOv(r);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    render();
  }, [dataKey]);

  function onInput(e: React.FormEvent) {
    const t = e.target as HTMLInputElement;
    const NE = ne.current;
    if (t.id === 'neName') NE.name = t.value;
    if (t.id === 'neDate') NE.date = t.value;
    if (t.id === 'neTime') NE.time = t.value;
    if (t.id === 'neWhere') NE.where = t.value;
    if (t.id === 'neDesc') NE.desc = t.value;
  }

  async function save() {
    const r = root.current!;
    const NE = ne.current;
    if (NE.saving) return;
    if (!NE.gid) return toast(r, 'make a coop first, then plan things with it');
    if (!NE.name.trim()) {
      r.querySelector<HTMLInputElement>('#neName')?.focus();
      return toast(r, 'give the event a name first');
    }
    if (!NE.date) return toast(r, 'pick a date');
    if (!NE.time) return toast(r, 'add a start time');
    NE.saving = true;
    const myId = latest.current.me.id;
    const problem = await latest.current
      .onSave({
        circleId: NE.gid,
        title: NE.name.trim(),
        date: NE.date,
        time: NE.time,
        where: NE.where.trim(),
        desc: NE.desc.trim(),
        people: NE.people.filter((x) => x.id !== myId).map((x) => ({ userId: x.id, role: NE.leads.includes(x.id) ? 'edit' : x.role, lead: NE.leads.includes(x.id) })),
        chat: NE.chat,
        gallery: NE.gal,
      })
      .catch((x: unknown) => (x instanceof Error ? x.message : "that didn't save"));
    NE.saving = false;
    if (problem) toast(r, problem.toLowerCase(), 3200);
  }

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    const NE = ne.current;
    const myId = p.me.id;
    const data = (sel: string, key: string) => t.closest<HTMLElement>(sel)?.dataset[key];
    if (t.closest('[data-back]')) return call(p.onBack);
    const gg = data('[data-ne-g]', 'neG');
    if (gg) {
      NE.gid = gg;
      NE.people = NE.people.filter((x) => x.id === myId);
      NE.leads = [myId];
      return render();
    }
    const add = data('[data-ne-add]', 'neAdd');
    if (add) {
      NE.people.push({ id: add, role: NE.role });
      return render();
    }
    if (t.closest('[data-ne-addg]')) {
      p.coops.find((c) => c.id === NE.gid)?.members.forEach((id) => {
        if (!NE.people.some((x) => x.id === id)) NE.people.push({ id, role: NE.role });
      });
      return render();
    }
    const rm = data('[data-ne-rm]', 'neRm');
    if (rm) {
      NE.people = NE.people.filter((x) => x.id !== rm);
      NE.leads = NE.leads.filter((l) => l !== rm);
      return render();
    }
    const role = data('[data-ne-role]', 'neRole');
    if (role) {
      NE.role = role as Role;
      return render();
    }
    const tg = data('[data-ne-t]', 'neT');
    if (tg === 'chat' || tg === 'gal') {
      NE[tg] = !NE[tg];
      return render();
    }
    const ul = data('[data-ne-unlead]', 'neUnlead');
    if (ul) {
      NE.leads = NE.leads.filter((l) => l !== ul);
      return render();
    }
    if (t.closest('[data-ne-lead]')) {
      const can = NE.people.map((x) => x.id).filter((id) => !NE.leads.includes(id));
      if (!can.length) return toast(r, 'add people first, then pick who else is in charge');
      const sh = openOv(
        r,
        `<div class="sheet" role="dialog" aria-label="who's in charge"><h3>who else is in charge?</h3>
      <div class="opt-list">${can.map((id) => `<button data-lead="${id}"><span style="display:flex;align-items:center;gap:10px">${avatar(p.people[id] ?? { id })}${esc(p.people[id]?.username ?? 'friend')}</span></button>`).join('')}</div></div>`,
      );
      sh.querySelectorAll<HTMLElement>('.opt-list .av').forEach((a) => {
        a.style.width = '28px';
        a.style.height = '28px';
      });
      return sh.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-lead]');
        if (!b) return;
        NE.leads.push(b.dataset.lead ?? '');
        void closeOv(r);
        render();
      });
    }
    if (t.closest('#neSave')) void save();
  }

  return (
    <section ref={root} className="view on scr" id="v-newevent" onClick={onClick} onInput={onInput} style={{ overflow: 'hidden' }}>
      <div id="neHost" />
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
