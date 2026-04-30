import { useState } from 'react';
import { App } from './App';
import { Pick4Page } from './components/Pick4Page';

type Page = 'pick3' | 'pick4';

var PAGE_KEY = 'pick3_current_page';

function loadPage(): Page {
  try {
    var p = localStorage.getItem(PAGE_KEY);
    if (p === 'pick4') return 'pick4';
  } catch(e) {}
  return 'pick3';
}

function savePage(page: Page) {
  try { localStorage.setItem(PAGE_KEY, page); } catch(e) {}
}

export function Root() {
  var _p = useState<Page>(loadPage);
  var page = _p[0]; var setPage = _p[1];

  function navigateToPick4() {
    savePage('pick4');
    setPage('pick4');
  }

  function navigateToPick3() {
    savePage('pick3');
    setPage('pick3');
  }

  if (page === 'pick4') {
    return <Pick4Page navigateToPick3={navigateToPick3} />;
  }

  return <App navigateToPick4={navigateToPick4} />;
}
