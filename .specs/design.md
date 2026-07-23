# Design Tokens & Theme Specification

Tüm renkler ve tema değişkenleri tek bir noktada (`:root`) tanımlanmıştır. Renk Paletinde değişiklik yapmak istediğinizde sadece `index.html` içerisindeki ilgili `:root` değişkeninin değerini değiştirmeniz tüm sisteme anında yansıyacaktır.

## 🎨 Master CSS Token Registry (`:root`)

```css
:root {
  /* Base Theme Colors */
  --color-bg-page: #f8fafc;              /* Ana sayfa arka planı (Kirli Beyaz) */
  --color-bg-ocean: #f1f5f9;             /* Harita deniz/okyanus arka planı (Açık Gri) */
  --color-bg-sidebar: rgba(255, 255, 255, 0.95); /* Yan menü arka planı */
  --color-bg-panel: #f8fafc;            /* Kartlar & Paneller */
  --color-bg-card: #ffffff;             /* Beyaz Kartlar & Modal'lar */
  --color-bg-input: #ffffff;            /* İnput & Select arka planı */
  
  /* Country & Map Colors */
  --color-map-country-fill: #ffffff;     /* Atanmamış Ülkeler (Saf Beyaz) */
  --color-map-country-stroke: #cbd5e1;   /* Ülke Çerçeve Çizgileri */
  --color-map-country-hover-fill: #e2e8f0; /* Hover Ülke Rengi */
  --color-map-country-hover-stroke: #94a3b8;

  /* Borders */
  --color-border-subtle: rgba(226, 232, 240, 0.9);
  --color-border-input: #cbd5e1;
  --color-border-hover: #94a3b8;

  /* Typography & Icons */
  --color-text-main: #0f172a;           /* Ana Yazı Rengi (Siyah / Koyu Slate) */
  --color-text-muted: #64748b;          /* İkincil / Açıklama Yazıları */
  --color-text-inverse: #ffffff;        /* Siyah Buton İçi Beyaz Yazı */

  /* Primary Actions (Stark Black/Dark Slate) */
  --color-accent-main: #0f172a;         /* Birincil Butonlar (Siyah) */
  --color-accent-hover: #1e293b;        /* Birincil Buton Hover */
  --color-accent-text: #ffffff;         /* Birincil Buton Yazısı */

  /* Secondary Actions (White/Light Slate) */
  --color-secondary-main: #ffffff;      /* İkincil Butonlar (Beyaz) */
  --color-secondary-hover: #f1f5f9;     /* İkincil Buton Hover */
  --color-secondary-border: #cbd5e1;    /* İkincil Buton Çerçevesi */
  --color-secondary-text: #0f172a;      /* İkincil Buton Yazısı */

  /* Status Colors */
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-success: #10b981;

  /* Shadows */
  --shadow-subtle: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-depth: 10px 0 30px rgba(15, 23, 42, 0.06);
  --shadow-modal: 0 20px 40px -15px rgba(15, 23, 42, 0.1);
}
```

## 🛠️ Nasıl Kullanılır?
Bir alanın rengini değiştirmek için projedeki HTML veya CSS dosyalarını tek tek gezmeye gerek yoktur:
1. `frontend/index.html` içerisindeki `:root` bloğunu açın.
2. Örneğin arka planı daha açık yapmak için `--color-bg-page: #ffffff;` yazın.
3. Vurgu rengini değiştirmek için `--color-accent-main: #18181b;` yazın.
Tüm uygulamadaki butonlar, paneller, harita, metinler ve modal'lar tek bir satırla otomatik olarak değişecektir.
