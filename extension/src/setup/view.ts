import { BucketError, S3Bucket } from '../../../sync-core/bucket';
import { parseS3ConfigText, parsedFieldCount } from '../../../sync-core/parseS3ConfigText';
import {
  ACCESS_KEY_LENGTH,
  type Connection,
  DEFAULT_PREFIX,
  SECRET_KEY_LENGTH,
  detectRegion,
  dropDraft,
  forgetConnection,
  keepDraft,
  loadDrafts,
  normalizePrefix,
  originsFor,
  saveConnection,
} from './connection';
import { clear, h } from './dom';
import { t } from './i18n';
import { type BucketState, probe } from './probe';

export const bucketFor = (c: Connection) =>
  new S3Bucket(c, { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) });

const where = (c: Pick<Connection, 'bucket' | 'keyPrefix'>) => `${c.bucket}/${c.keyPrefix ? `${c.keyPrefix}/` : ''}`;

// One bucket, proved by a real listing before anything is stored.
// See docs/design/browser-sync/uiux/setup.md.
export function setupView(
  initial: Partial<Connection> | null,
  onConnected: (c: Connection, state: BucketState) => void,
  onDisconnected?: () => void,
): HTMLElement {
  const field = (name: string, placeholder: string, value = '', type = 'text') =>
    h('input', { class: 'field', name, type, placeholder, value, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' });
  const bucket = field('bucket', t('setupBucket'), initial?.bucket);
  const keyId = field('keyId', t('setupKeyId'), initial?.accessKeyId);
  const secret = field('secret', t('setupSecret'), initial?.secretAccessKey, 'password');
  const prefix = field('prefix', t('setupPrefix'), initial?.keyPrefix ?? DEFAULT_PREFIX);
  let region = initial?.region ?? '';
  bucket.addEventListener('input', () => (region = ''));

  const lengthHint = (input: HTMLInputElement, expected: number) => {
    const hint = h('p', { class: 'hint warn', hidden: true });
    const update = () => {
      const n = input.value.trim().length;
      hint.hidden = n === 0 || n === expected;
      hint.textContent = t('setupLengthHint', n, expected);
    };
    input.addEventListener('input', update);
    update();
    return { hint, update };
  };
  const keyHint = lengthHint(keyId, ACCESS_KEY_LENGTH);
  const secretHint = lengthHint(secret, SECRET_KEY_LENGTH);
  const eye = h('button', { type: 'button', class: 'eye', 'aria-label': t('setupShowSecret') }, '👁');
  eye.addEventListener('click', () => (secret.type = secret.type === 'password' ? 'text' : 'password'));

  const fields = h(
    'div',
    { class: 'fields' },
    bucket,
    keyId,
    keyHint.hint,
    h('div', { class: 'secret-row' }, secret, eye),
    secretHint.hint,
    prefix,
  );

  const paste = h('textarea', {
    class: 'paste',
    rows: 5,
    spellcheck: 'false',
    placeholder: 'bucket: my-bucket\nprefix: budgets-bro/\naccess_key_id: AKIA…\nsecret_access_key: …',
  });
  const pasteBox = h('div', { class: 'paste-box', hidden: true }, paste, h('p', { class: 'hint' }, t('setupPasteHint')));
  const pasteToggle = h('button', { type: 'button', class: 'link' }, t('setupPaste'));
  const showPaste = (on: boolean) => {
    pasteBox.hidden = !on;
    fields.hidden = on;
    pasteToggle.textContent = on ? t('setupBackToFields') : t('setupPaste');
    if (on) paste.focus();
  };
  pasteToggle.addEventListener('click', () => showPaste(pasteBox.hidden === true));
  let lastPaste = '';
  paste.addEventListener('input', () => {
    const got = parseS3ConfigText(paste.value);
    if (got.bucket) {
      bucket.value = got.bucket;
      region = '';
    }
    if (got.keyPrefix) prefix.value = got.keyPrefix;
    if (got.accessKeyId) keyId.value = got.accessKeyId;
    if (got.secretAccessKey) secret.value = got.secretAccessKey;
    keyHint.update();
    secretHint.update();
    // A real paste (not typing) that filled something snaps back to the fields.
    const pasted = paste.value.length - lastPaste.length > 1;
    lastPaste = paste.value;
    if (pasted && parsedFieldCount(got) > 0) {
      paste.value = lastPaste = '';
      showPaste(false);
    }
  });

  const status = h('div', { class: 'setup-status', role: 'status' });
  const extra = h('div', { class: 'setup-extra' });
  const connect = h('button', { class: 'primary', type: 'submit' }, t('setupConnect'));
  const say = (text: string, error = false, detail = '') => {
    status.className = error ? 'setup-status error' : 'setup-status';
    status.replaceChildren(text, ...(detail ? [h('p', { class: 'hint' }, detail)] : []));
    clear(extra);
  };

  const drafts = h('div', { class: 'drafts' });
  const fill = (d: Connection) => {
    bucket.value = d.bucket;
    keyId.value = d.accessKeyId;
    secret.value = d.secretAccessKey;
    prefix.value = d.keyPrefix;
    region = d.region;
    keyHint.update();
    secretHint.update();
    showPaste(false);
  };
  const renderDrafts = async () => {
    clear(drafts);
    const list = await loadDrafts();
    if (list.length === 0) return;
    drafts.append(h('div', { class: 'section-title' }, t('setupDrafts')));
    for (const d of list) {
      drafts.append(
        h(
          'div',
          { class: 'draft' },
          h('span', {}, `${where(d)} · ${d.accessKeyId.slice(0, 5)}…`),
          h('button', { type: 'button', class: 'link', onclick: () => fill(d) }, t('setupFill')),
          h('button', { type: 'button', class: 'link', 'aria-label': t('setupForget'), onclick: () => void dropDraft(d).then(renderDrafts) }, '✕'),
        ),
      );
    }
  };
  void renderDrafts();

  const finish = async (c: Connection, state: BucketState) => {
    await saveConnection(c);
    await dropDraft(c);
    onConnected(c, state);
  };

  const form = h(
    'form',
    { class: 'setup' },
    h('h1', {}, t('name')),
    h('p', { class: 'subtitle' }, t('setupSubtitle')),
    h('div', { class: 'group-head' }, h('span', { class: 'section-title' }, t('setupBucketHeading')), pasteToggle),
    fields,
    pasteBox,
    h('p', { class: 'hint' }, t('setupScopeHint')),
    status,
    extra,
    connect,
    drafts,
  );

  if (initial?.bucket && onDisconnected) form.append(disconnectRow(onDisconnected));

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const c: Connection = {
      bucket: bucket.value.trim(),
      region,
      keyPrefix: normalizePrefix(prefix.value),
      accessKeyId: keyId.value.trim(),
      secretAccessKey: secret.value.trim(),
    };
    if (!c.bucket || !c.accessKeyId || !c.secretAccessKey) {
      say(t('setupMissing'), true);
      return;
    }
    // Asked first, inside the click: Chrome grants host access only to a gesture.
    const asked = chrome.permissions.request({ origins: originsFor(c) });
    void (async () => {
      connect.disabled = true;
      try {
        say(t('setupAsking', c.bucket));
        if (!(await asked)) {
          say(t('setupDenied'), true);
          extra.append(h('button', { type: 'button', class: 'btn', onclick: () => form.requestSubmit() }, t('setupTryAgain')));
          return;
        }
        await keepDraft(c);
        if (!c.region) {
          say(t('setupDetecting'));
          const found = await detectRegion(c.bucket);
          if (!found) {
            say(t('setupNoSuchBucket', c.bucket), true);
            return;
          }
          c.region = region = found;
          await keepDraft(c);
          // The regional host wasn't known when the click asked: one more click.
          if (!(await chrome.permissions.contains({ origins: originsFor(c) }))) {
            say(t('setupRegionFound', found));
            return;
          }
        }
        say(t('setupChecking'));
        const state = await probe(bucketFor(c));
        if (state === 'empty') {
          say(t('setupNoData', where(c)), true, t('setupNoDataHint'));
          extra.append(h('button', { type: 'button', class: 'btn', onclick: () => void finish(c, 'waiting') }, t('setupUseAnyway')));
          return;
        }
        await finish(c, state);
      } catch (e) {
        if (e instanceof BucketError) {
          const detail = e.status === 403 ? t('setupCantList', where(c)) : '';
          say(e.message, true, detail);
        } else say(e instanceof Error ? e.message : String(e), true);
      } finally {
        connect.disabled = false;
        void renderDrafts();
      }
    })();
  });
  return form;
}

function disconnectRow(onDisconnected: () => void): HTMLElement {
  const row = h('div', { class: 'disconnect' });
  const ask = () => {
    row.replaceChildren(
      h('p', {}, t('setupDisconnectBody')),
      h('button', { type: 'button', class: 'link', onclick: idle }, t('cancel')),
      h(
        'button',
        { type: 'button', class: 'btn danger', onclick: () => void forgetConnection().then(onDisconnected) },
        t('setupDisconnect'),
      ),
    );
  };
  const idle = () => row.replaceChildren(h('button', { type: 'button', class: 'link danger', onclick: ask }, t('setupDisconnect')));
  idle();
  return row;
}

export function waitingView(c: Connection, onChange: () => void): HTMLElement {
  return h(
    'div',
    { class: 'waiting' },
    h('div', { class: 'spinner', 'aria-hidden': 'true' }),
    h('h2', {}, t('waitingTitle')),
    h('p', {}, t('waitingBody', c.bucket)),
    h(
      'div',
      { class: 'waiting-foot' },
      h('span', { class: 'hint' }, t('waitingPolling')),
      h('button', { type: 'button', class: 'link', onclick: onChange }, t('waitingChange')),
    ),
  );
}
