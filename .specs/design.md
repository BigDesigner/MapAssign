# Design Tokens & Theme Specification

Tüm renkler ve tema değişkenleri tek bir noktada (`:root`) tanımlanmıştır. Projedeki hiçbir CSS kuralında veya inline HTML stilinde hardcoded HEX/RGB renk kodu kullanılmaz. Renk Paletinde değişiklik yapmak istediğinizde sadece `index.html` (veya `table.html`) içerisindeki ilgili `:root` değişkeninin değerini değiştirmeniz tüm sisteme anında yansıyacaktır.

## 🎨 Master CSS Token Registry (`:root`)

```css
:root {
  /* Base Theme Colors */
  --color-bg-page: #f8fafc;              /* Ana sayfa arka planı (Kirli Beyaz) */
  --color-bg-ocean: #e0f2fe;             /* Harita deniz/okyanus arka planı (Açık Pastel Mavi) */
  --color-bg-sidebar: rgba(255, 255, 255, 0.95); /* Yan menü arka planı */
  --color-bg-panel: #f8fafc;            /* Kartlar & Paneller */
  --color-bg-card: #ffffff;             /* Beyaz Kartlar & Modal'lar */
  --color-bg-input: #ffffff;            /* İnput & Select arka planı */
  --color-bg-modal-overlay: rgba(15, 23, 42, 0.4); /* Modal karartma zemini */
  --color-bg-badge-subtle: rgba(15, 23, 42, 0.08); /* Rozet hafif zemin */
  --color-bg-hover-subtle: rgba(15, 23, 42, 0.05); /* Liste hover zemin */
  
  /* Country & Map Colors */
  --color-map-country-fill: #fefcf6;     /* Atanmamış Ülkeler (Sıcak Krem Rengi) */
  --color-map-country-stroke: #94a3b8;   /* Ülke Çerçeve Çizgileri */
  --color-map-country-hover-fill: #e2e8f0; /* Hover Ülke Rengi */
  --color-map-country-hover-stroke: #64748b;

  /* Borders */
  --color-border-subtle: rgba(226, 232, 240, 0.9);
  --color-border-input: #cbd5e1;
  --color-border-hover: #94a3b8;
  --color-border-overlay: rgba(0, 0, 0, 0.15);
  --color-border-dot: rgba(0, 0, 0, 0.1);
  --color-border-badge: rgba(15, 23, 42, 0.2);

  /* Typography & Icons */
  --color-text-main: #0f172a;           /* Ana Yazı Rengi (Siyah / Koyu Slate) */
  --color-text-muted: #64748b;          /* İkincil / Açıklama Yazıları */
  --color-text-inverse: #ffffff;        /* Siyah Buton İçi Beyaz Yazı */

  /* Primary Actions */
  --color-accent-main: #0f172a;         /* Birincil Butonlar (Siyah) */
  --color-accent-hover: #1e293b;        /* Birincil Buton Hover */
  --color-accent-text: #ffffff;         /* Birincil Buton Yazısı */
  --color-accent-focus-ring: rgba(15, 23, 42, 0.1);

  /* Secondary Actions */
  --color-secondary-main: #ffffff;      /* İkincil Butonlar (Beyaz) */
  --color-secondary-hover: #f1f5f9;     /* İkincil Buton Hover */
  --color-secondary-border: #cbd5e1;    /* İkincil Buton Çerçevesi */
  --color-secondary-text: #0f172a;      /* İkincil Buton Yazısı */

  /* Scrollbars */
  --color-scrollbar-thumb: rgba(0, 0, 0, 0.15);

  /* Badges & Tables */
  --color-badge-bg: #f1f5f9;
  --color-badge-border: #cbd5e1;
  --color-badge-text: #0f172a;
  --color-row-alt: #f8fafc;
  --color-row-hover: #f1f5f9;

  /* Status Colors */
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-danger-border: rgba(239, 68, 68, 0.3);
  --color-success: #10b981;

  /* Shadows */
  --shadow-subtle: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-depth: 10px 0 30px rgba(15, 23, 42, 0.06);
  --shadow-modal: 0 20px 40px -15px rgba(15, 23, 42, 0.1);
  --shadow-picker-selected: 0 0 8px rgba(15, 23, 42, 0.2);
}
```

## 🛠️ Nasıl Kullanılır?
Bir alanın rengini veya gölgesini değiştirmek için projedeki HTML veya CSS dosyalarını gezmeye gerek yoktur:
1. `:root` bloğunu açın.
2. Değiştirmek istediğiniz değişkenin karşısındaki HEX veya RGBA değerini güncelleyin.
Tüm uygulamadaki butonlar, paneller, harita, metinler, gölgeler ve modal'lar tek bir satırla otomatik olarak değişecektir.
