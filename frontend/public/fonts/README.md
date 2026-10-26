# Report fonts

Fonts for the downloadable PDF reports (src/lib/report/). @react-pdf/renderer
needs WOFF, WOFF2 or TTF files it can parse, so these are copied from the Fontsource packages
(@fontsource/fraunces, @fontsource/figtree, @fontsource/ibm-plex-mono, Latin
subset). The site itself loads the same fonts through next/font.

All three are licensed under the SIL Open Font License 1.1 (see the LICENSE files).

IBM Plex Mono is a TTF converted from Fontsource's WOFF2 (with fontTools):
react-pdf can't parse or embed its WOFF/WOFF2 builds correctly.
