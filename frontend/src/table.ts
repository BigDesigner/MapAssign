import { COUNTRY_NAMES } from './countryNames';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://map-api.akansu.com';

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${path}`;
  init.credentials = 'include';
  return fetch(url, init);
}

function normalizeForSearch(str: string): string {
  return str
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/I/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface RowItem {
  no: number;
  rep: string;
  code: string;
  name: string;
  color: string;
}

let allRows: RowItem[] = [];
let filtered: RowItem[] = [];
let sortCol: 'no' | 'rep' | 'code' | 'name' = 'rep';
let sortDir = 1;
let role: string | null = null;

const tbody = document.getElementById('table-body') as HTMLElement;
const dataTable = document.getElementById('data-table') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const rowCount = document.getElementById('row-count') as HTMLElement;
const loadingState = document.getElementById('loading-state') as HTMLElement;
const emptyState = document.getElementById('empty-state') as HTMLElement;
const authState = document.getElementById('auth-state') as HTMLElement;
const csvBtn = document.getElementById('csv-btn') as HTMLElement;
const roleBadge = document.getElementById('role-badge') as HTMLElement;
const repFilter = document.getElementById('rep-filter') as HTMLSelectElement;

function showState(which: 'loading' | 'empty' | 'auth' | 'table') {
  if (loadingState) loadingState.classList.toggle('visible', which === 'loading');
  if (emptyState) emptyState.classList.toggle('visible', which === 'empty');
  if (authState) authState.classList.toggle('visible', which === 'auth');
  if (dataTable) dataTable.style.display = which === 'table' ? 'table' : 'none';
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadData() {
  showState('loading');
  try {
    const meRes = await apiFetch('/api/auth/me');
    if (meRes.status === 401 || !meRes.ok) {
      showState('auth');
      return;
    }
    const meData = await meRes.json();
    role = meData.role;

    if (roleBadge) {
      if (role === 'admin') {
        roleBadge.textContent = 'YÖNETİCİ';
      } else {
        roleBadge.textContent = 'TEMSİLCİ';
      }
    }

    const res = await apiFetch('/api/map/state');
    if (!res.ok) {
      showState('auth');
      return;
    }
    const data = await res.json();
    const assignments: any[] = data.assignments || [];

    const sorted = [...assignments].sort(
      (a, b) =>
        String(a.name).localeCompare(String(b.name), 'tr') ||
        String(COUNTRY_NAMES[a.country_code] || a.country_code).localeCompare(
          COUNTRY_NAMES[b.country_code] || b.country_code,
          'tr'
        )
    );

    allRows = sorted.map((row, i) => ({
      no: i + 1,
      rep: row.name,
      code: (row.country_code || '').toLowerCase(),
      name:
        COUNTRY_NAMES[(row.country_code || '').toLowerCase()] ||
        (row.country_code || '').toUpperCase(),
      color: row.color_hex,
    }));
  } catch (e) {
    console.error(e);
    showState('auth');
    return;
  }
  populateRepFilter();
  applyFilter();
}

function populateRepFilter() {
  if (!repFilter) return;
  const reps = [...new Set(allRows.map((r) => r.rep))].sort((a, b) =>
    a.localeCompare(b, 'tr')
  );
  const currentVal = repFilter.value;
  repFilter.innerHTML =
    '<option value="">Tüm Temsilciler</option>' +
    reps.map((r) => `<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('');
  if (reps.includes(currentVal)) {
    repFilter.value = currentVal;
  }
}

function applyFilter() {
  const q = normalizeForSearch(searchInput ? searchInput.value.trim() : '');
  const repVal = repFilter ? repFilter.value : '';

  filtered = allRows.filter((r) => {
    const matchesSearch =
      !q ||
      normalizeForSearch(r.rep).includes(q) ||
      normalizeForSearch(r.name).includes(q) ||
      normalizeForSearch(r.code).includes(q);
    const matchesRep = !repVal || r.rep === repVal;
    return matchesSearch && matchesRep;
  });
  applySort();
}

function applySort() {
  filtered.sort((a, b) => {
    const va = sortCol === 'no' ? a.no : String(a[sortCol]);
    const vb = sortCol === 'no' ? b.no : String(b[sortCol]);
    if (sortCol === 'no') return sortDir * ((va as number) - (vb as number));
    return sortDir * (va as string).localeCompare(vb as string, 'en');
  });
  renderTable();
}

function renderTable() {
  if (rowCount) rowCount.textContent = `${filtered.length} kayıt`;

  if (!filtered.length) {
    showState('empty');
    return;
  }

  showState('table');

  if (tbody) {
    tbody.innerHTML = filtered
      .map(
        (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <div class="rep-name-cell">
              <div class="color-dot" style="background:${r.color}; --dot-color:${r.color};"></div>
              ${escHtml(r.rep)}
            </div>
          </td>
          <td><span class="country-code-badge">${escHtml(r.code.toUpperCase())}</span></td>
          <td>${escHtml(r.name)}</td>
        </tr>
      `
      )
      .join('');
  }
}

if (csvBtn) {
  csvBtn.addEventListener('click', () => {
    if (!filtered.length) return;
    const header = ['No', 'Temsilci Adı', 'Ülke Kodu', 'Ülke Adı'];
    const rows = filtered.map((r, i) => [
      i + 1,
      `"${r.rep.replace(/"/g, '""')}"`,
      r.code.toUpperCase(),
      `"${r.name.replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

if (searchInput) searchInput.addEventListener('input', applyFilter);
if (repFilter) repFilter.addEventListener('change', applyFilter);

document.querySelectorAll('thead th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const col = (th as HTMLElement).dataset.sort as 'no' | 'rep' | 'code' | 'name';
    if (sortCol === col) {
      sortDir *= -1;
    } else {
      sortCol = col;
      sortDir = 1;
    }
    document.querySelectorAll('thead th').forEach((h) => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
    applySort();
  });
});

loadData();
