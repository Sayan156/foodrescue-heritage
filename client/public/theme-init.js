try {
  document.documentElement.dataset.theme = localStorage.getItem('fr-theme') || 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
