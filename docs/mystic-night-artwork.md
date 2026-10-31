# Mystic Night artwork

Original New Mystic BBS artwork in purple, cyan and a dark starfield. Open
`public/mystic-night/preview.html` to compare all designs. The same files are
available at `/mystic-night/preview.html` when the web application is running.

- `welcome.ans`: welcome/login artwork.
- `main-menu.ans`: proposed menu design.
- `message-areas.ans`: message-area header.
- `web-hero.svg`: matching scalable web banner.
- `.svg` companions preview the ANSI layout without terminal escape sequences.

ANSI files use CP437, 78 columns, 24 rows and standard 16-color SGR. They clear
the screen and position the cursor at the top before drawing. They contain no
Mystic macros or executable menu actions. Main-menu letters are a design proposal,
not a claim about the installed menu bindings. These assets have not been installed
in E:\mystic. Review bindings and prompt placement before replacing a live display
file. Keep a backup of any existing screen.

Regenerate with `node scripts/generate-mystic-night.cjs .` from the repository.
SVG uses a monospace font; exact glyph shape depends on the viewer's font.
