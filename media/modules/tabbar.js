export function bindResponsiveTabbar(tabbar) {
  const updateMode = () => {
    syncTabbarMode(tabbar);
  };

  updateMode();

  if (typeof ResizeObserver !== 'function') {
    return () => {};
  }

  const observer = new ResizeObserver(() => {
    updateMode();
  });

  observer.observe(tabbar);

  return () => {
    observer.disconnect();
  };
}

function syncTabbarMode(tabbar) {
  tabbar.classList.remove('is-icon-only');

  const labels = Array.from(tabbar.querySelectorAll('.tab-label'));
  if (labels.length === 0) {
    return;
  }

  const hasTruncatedLabel = labels.some((label) => {
    if (!(label instanceof HTMLElement)) {
      return false;
    }

    return label.scrollWidth > label.clientWidth + 1;
  });

  if (hasTruncatedLabel) {
    tabbar.classList.add('is-icon-only');
  }
}