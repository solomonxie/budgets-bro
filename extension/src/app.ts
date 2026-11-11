const root = document.getElementById('app')!;
const t = (key: string) => chrome.i18n.getMessage(key);

const box = document.createElement('div');
box.className = 'placeholder';
const title = document.createElement('h1');
title.textContent = t('name');
const note = document.createElement('p');
note.textContent = t('comingSoon');
box.append(title, note);
root.replaceChildren(box);
