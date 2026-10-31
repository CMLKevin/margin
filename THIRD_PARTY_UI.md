# UI sources

The interface uses source components from shadcn/ui (Button and Dialog), installed from the official new-york registry, and Radix primitives. The components are themed for Margin. Registry: https://ui.shadcn.com/r/styles/new-york/{name}.json. Project: https://github.com/shadcn-ui/ui.

Dither Kit gradient and avatar components, with their shared pixel primitives, palette, and class utility, were copied from https://tripwire.sh/r/{name}.json. Source: https://github.com/Boring-Software-Inc/dither-kit. They provide static ordered-dither washes and a deterministic research-space identicon; publisher logos and research figures are left intact.

Cult UI PixelHeading (word) and TextureOverlay were copied from https://www.cult-ui.com/r/{name}.json. Source: https://github.com/nolly-studio/cult-ui. The heading is used in the right-hand desk card, and paper grain appears subtly in the sidebar.

Geist Pixel font files are self-hosted from the `geist` npm package. Source: https://github.com/vercel/geist-font. The font license is distributed alongside the assets. Pixel typography is used for the brand, display headings, labels, and accents; article titles and long research text retain readable sans and serif typography.

Pixelarticons 2.4.2 supplies the free 24×24 React navigation and topic icons under its MIT license. Official docs: https://pixelarticons.com/docs/. No Pro assets or license keys are used. Margin’s receiver, orbital, book, and wave motifs and block M mark are original SVG artwork, rendered with a static ordered-dither pattern.

The desktop topic stamps use seven original 16×16 glyphs (agent, processor, reward medal, evaluation board, learning loop, inference bolt, and shield), drawn as crisp SVG cells. Icon sizes are kept independent of compact reading density.

Vendored shadcn/ui and Cult UI notices are in third-party/. Dither Kit is declared MIT in its upstream package metadata; its notice and standard MIT terms are included alongside them. Fonts retain public/fonts/LICENSE.txt. Installed npm dependencies retain their respective package licenses.
