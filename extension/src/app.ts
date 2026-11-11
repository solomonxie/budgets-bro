import { type Connection, loadConnection } from './setup/connection';
import { h } from './setup/dom';
import { t } from './setup/i18n';
import { probe } from './setup/probe';
import { bucketFor, setupView, waitingView } from './setup/view';
import { openSession, type Session } from './sync/session';

const root = document.getElementById('app')!;
const POLL_MS = 10_000;
let stopPolling = () => {};
let session: Session | null = null;

function showSetup(initial: Connection | null) {
  stopPolling();
  root.replaceChildren(
    h('main', { class: 'center' }, setupView(initial, (c, state) => (state === 'ready' ? showReady(c) : showWaiting(c)), () => showSetup(null))),
  );
}

// Checks only while the tab is visible: no work for a page nobody is looking at.
function showWaiting(c: Connection) {
  stopPolling();
  root.replaceChildren(h('main', { class: 'center' }, waitingView(c, () => showSetup(c))));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = async () => {
    timer = undefined;
    if (document.visibilityState !== 'visible') return;
    try {
      if ((await probe(bucketFor(c))) === 'ready') return showReady(c);
    } catch {
      // Offline or a blip: the next tick retries.
    }
    timer = setTimeout(check, POLL_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible' && timer === undefined) void check();
  };
  document.addEventListener('visibilitychange', onVisible);
  stopPolling = () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
  timer = setTimeout(check, POLL_MS);
}

// The pages (T6) render from session.store and edit through session.engine.
async function showReady(c: Connection) {
  stopPolling();
  root.replaceChildren(h('main', { class: 'center' }, h('div', { class: 'placeholder' }, h('h1', {}, t('name')), h('p', {}, t('readySoon')))));
  session?.close();
  session = await openSession(c);
}

async function start() {
  const c = await loadConnection();
  if (!c) return showSetup(null);
  try {
    return (await probe(bucketFor(c))) === 'ready' ? showReady(c) : showWaiting(c);
  } catch {
    return showWaiting(c);
  }
}

void start();
