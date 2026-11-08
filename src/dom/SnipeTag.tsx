'use dom';

// A5: "who did you get?", from the prototype's war.js (`openSnipeTag`, `sendSnipe`).
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import './art/art.css';
import { avatar, call, esc, I, setTop, toast, TOAST_HTML, type DomPerson } from './ui';

interface Props {
  top: number;
  coopName: string;
  photoUrl: string | null;
  targets: DomPerson[];
  onRetake: () => Promise<void>;
  onSend: (targetId: string, caption: string) => Promise<void>;
  dom?: DOMProps;
}

export default function SnipeTag(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const [target, setTarget] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (root.current) setTop(root.current, props.top);
  }, [props.top]);
  const { coopName, photoUrl, targets } = props;

  async function send() {
    if (!target || sending) return;
    setSending(true);
    try {
      await latest.current.onSend(target, caption.trim());
    } catch (e) {
      setSending(false);
      toast(root.current!, e instanceof Error ? e.message.toLowerCase() : "that didn't send, try again", 3200);
    }
  }

  return (
    <section ref={root} className="view on scr" id="v-snipe" style={{ overflow: 'hidden' }}>
      <header className="hdr">
        <button className="icon-btn" aria-label="retake" onClick={() => call(props.onRetake)} dangerouslySetInnerHTML={{ __html: I.back }} />
        <div className="hdr-t">
          <b>who did you get?</b>
          <span>egg war in {coopName}</span>
        </div>
        <div className="hdr-r" />
      </header>
      <div className="scroll">
        <div className="sn-photo big">{photoUrl ? <img src={photoUrl} alt="" /> : null}</div>
        <button className="sn-retake" onClick={() => call(props.onRetake)} dangerouslySetInnerHTML={{ __html: `${I.retake}retake` }} />
        <h3 className="sec">egged:</h3>
        <div className="chips">
          {targets.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={target === p.id}
              onClick={() => setTarget(p.id)}
              dangerouslySetInnerHTML={{ __html: `${avatar(p)}@${esc(p.username)}` }}
            />
          ))}
          {!targets.length ? <span className="chip ghost">no one else has opted in</span> : null}
        </div>
        <h3 className="sec">
          caption<span className="grow" />
          <span className="gal-count">{caption.length}/100</span>
        </h3>
        <textarea className="sn-cap-in" maxLength={100} rows={2} placeholder="optional, 100 characters max" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <div className="ne-foot">
        <button className="pill solid" disabled={!target || sending} onClick={() => void send()} dangerouslySetInnerHTML={{ __html: `<span>send</span>${I.send}` }} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
