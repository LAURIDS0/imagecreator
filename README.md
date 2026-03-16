# Item Creator

En simpel web-baseret pixel editor til at lave game-items og sprites i faste størrelser.

## Hvad er det?

Item Creator er en lille HTML/CSS/JavaScript app, hvor du kan tegne pixel-art direkte i browseren og eksportere som PNG.

## Funktioner

- Pixelstørrelser: **8x8, 16x16, 32x32, 64x64, 128x128**
- **256-farve palette**
- Værktøjer:
  - Pencil
  - Eraser
  - Fill Bucket
  - Fill Eraser
  - Undo (og **Ctrl/Cmd + Z**)
- Import af billeder (**PNG/JPG/JPEG**)
  - Vælg et kvadratisk udsnit via overlay
  - Vælg output-størrelse
  - Automatisk farve-mapping til nærmeste farve i 256-paletten
- Download som PNG med valgfrit filnavn

## Sådan bruger du den

1. Vælg pixelstørrelse i dropdown (`8` til `128`).
2. Vælg farve i paletten.
3. Tegn på canvas med ønsket værktøj.
4. Brug `Download PNG` for at gemme dit billede.

## Import af eksisterende billede

1. Klik `Indsæt billede`.
2. Vælg en PNG/JPG/JPEG fil.
3. I overlayet:
   - Flyt kvadratet for at vælge område
   - Justér kvadrat-størrelse med slider
   - Vælg output-pixelstørrelse
4. Klik `Indsæt`.

## Kør lokalt

Du kan åbne siden direkte i browseren via [browserudgaven](https://laurids0.github.io/imagecreator/), eller starte en lokal server:

```bash
python -m http.server 8765
```

Og åbne:

`http://127.0.0.1:8765/index.html`

## Filer

- `index.html` – struktur og UI
- `style.css` – styling
- `script.js` – editor-logik, værktøjer, import, eksport
