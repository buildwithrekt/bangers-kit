# Design references — creative watch

> **Watch of 2026-10-07**. Sources: Awwwards Sites of the Day from 2026-09-07 to 2026-10-07 (23 sites analysed in a headless browser with Playwright: scrolling, screenshots, DOM/CSS, loaded scripts and assets) and Dribbble (120 popular and recent shots: web design, animation, typography).
> Library versions are those **observed in production** on that date. Re-check them before installing anything.
> **Rule: inspiration, not copying.** This file describes principles and techniques, never code, assets, text or a site's identity.

## Key figures (23 SOTD)
- **Lenis** smooth scroll: 15/23 (v1.3.8 → 1.3.26). The de facto standard.
- **Three.js**: 11/23 (r128 → r185, mostly r180+). PlayCanvas on 1 site, in-house engine (Active Theory) on another.
- **GSAP** detected as a global: 7/23 (3.12 → 3.15), often with the full suite (SplitText, Flip, MorphSVG, DrawSVG, Inertia, Observer). Probably bundled without being exposed on other sites.
- Frameworks: Next.js 6, **Webflow 5** (always with GSAP and Lenis), Nuxt 4, Vue alone 2, custom 6.
- `prefers-reduced-motion` handled: **only 7/23**. View Transitions API: 4/23. CSS scroll-timeline: 4/23.
- **KTX2/Basis** textures: 6/23. Draco: 3/23. **Rive**: 1. **dotLottie (wasm)** or Lottie: 4.

---

## Animations & motion
| Pattern | Effect | Technique / lib | Difficulty | Source |
|---|---|---|---|---|
| Scroll-driven vector animation (a product object assembling itself) | Smooth, light product storytelling without video | Rive file + state machine bound to scroll progress, wasm runtime | Medium | https://drone.riotters.com/ |
| Preloader with a 0→100 % counter in very large type, bottom-left corner | Waiting becomes a typographic element | Counter bound to real asset loading (not a fake timer), GSAP | Easy | https://bleibtgleich.dev |
| Minimal preloader ("— — —" or "1%") before a WebGL gallery | Sober, but several seconds of empty screen: keep under 2 s | Preload KTX2 textures then fade to the scene | Easy | https://jesperlandberg.com · https://gilhuybrecht.com/ |
| "Click to start" screen and optional audio | Assumed immersive experience, sound is opt-in | User gesture, which unlocks the AudioContext | Medium | https://lisa.locomotive.ca/en · https://coloniazacamil.com/ |
| Doubled text for the hover "roll" effect (the word slides away and its double takes its place) | Crisp typographic micro-interaction on links and headings | Two stacked spans, `overflow:hidden` and translateY. Put `aria-hidden` on the copy | Easy | https://www.butter.video/ · https://drone.riotters.com/ |
| Progressive text reveal on scroll (light grey → ink) | Guided reading, editorial rhythm | SplitText (words or lines) and ScrollTrigger scrub on colour or opacity | Easy | https://www.butter.video/ |
| Massive character splitting (300 to 1300 spans) | Cascading entrances on every heading | GSAP SplitText (or custom splitting), stagger. Remember `aria-label` on the parent | Medium | https://www.cominvi.com.mx/ · https://drone.riotters.com/ |
| Stack of video cards zooming into a full-screen view with a circular or "lens" mask | Cinematic passage from a list to a project | FLIP transition (GSAP Flip) and `clip-path: circle()` mask or shader | Advanced | https://milledollars.fr/ |
| Red "liquid" page transition flooding the screen | Spectacular chapter change | Full-screen shader (noise and threshold) driven by a progress uniform | Advanced | https://www.meermohsin.me/ |
| Animated SVG stroke (scribble, handwritten underline) | A human touch in a strict grid | GSAP DrawSVG on `stroke-dashoffset` | Easy | https://www.lxlcreative.co.uk/ |
| Page transitions without reload on Webflow | App-like continuity on a CMS site | Barba.js 2.10 with GSAP leave/enter timelines | Medium | https://bleibtgleich.dev · https://www.lxlcreative.co.uk/ |
| Easing curves exposed as CSS tokens (`--ease-out-expo`…) | Consistent motion between CSS and JS | `cubic-bezier` CSS variables, reused in GSAP through CustomEase | Easy | https://milledollars.fr/ |
| Mascot or animated head in Lottie (dotLottie wasm) | A living identity for minimal weight | `@lottiefiles/dotlottie-web` (wasm player) | Easy | https://twks.ch/en |
| Drag-and-throw with inertia (galleries, objects) | Tactile, physical manipulation | GSAP Draggable and InertiaPlugin | Medium | https://bleibtgleich.dev |

## Layouts & compositions
| Pattern | Effect | Source |
|---|---|---|
| Image inserted **inside** the heading, between two words ("WORD [photo] WORD"), full width | The heading becomes the hero composition | https://coloniazacamil.com/ · https://realevate.agency/ |
| Heading as an infinite horizontal marquee with an image interleaved | Permanent movement without WebGL | https://realevate.agency/ |
| Words of a sentence scattered on the grid (offsets, irregular indents) with a thin vertical rule | Slow, very editorial reading | https://bleibtgleich.dev |
| Giant pale logotype in the footer, split between the two corners | Discreet but monumental brand signature | https://bleibtgleich.dev |
| Uppercase heading on two lines with a strong indent on the second | Elegant asymmetry over a full-bleed photo | https://tengilemalamala.com/ |
| Bento-style blocks: half-screen halftone-treated image next to flat colour areas (black, mint) holding text | Clean modular grid, very "premium fintech" | https://www.aspensearch.com/ |
| Vertical cards with a title rotated 90°, one colour per category | Navigation by universe, colour coding that carries meaning | https://realevate.agency/ |
| Product grid with a different coloured background per photo (lilac, ochre, green) | A joyful catalogue on a neutral beige base | https://noho.ink |
| Gallery of floating images arranged in 3D space, traversed on scroll | Depth and a sense of exploration | https://www.moto-card.com/ |
| High sticky density (7 to 12 elements): stacked sections covering each other | Storytelling by "cards" without scrolljacking | https://www.aspensearch.com/ · https://noho.ink |
| Filterable work grid on a dark background, with a coloured header band | Dense, readable portfolio | https://boc.studio/ |
| Swiss studio: strict grid contrasted with very maximalist visuals (stickers, posters) | Rigour makes the exuberance of the work stand out | https://twks.ch/en |
| Text list with the active item in black and the others in grey, coupled with a graduated circular dial | "Instrument"-type selector | https://www.cominvi.com.mx/ |
| Dense HUD interface: status columns, monospace data around a globe | "System" or "laboratory" aesthetic | https://pensatori-irrazionali.com/ |
| Extreme page heights (15,000 to 28,000 px) for scroll storytelling | Long, linear narrative. Must be justified by the content | https://www.meermohsin.me/ · https://drone.riotters.com/ |

## Typefaces & type scales
| Observation | Detail | Source |
|---|---|---|
| Giant light grotesk + mono | Switzer Variable at 300, 240 px, letter-spacing −13 px + Proto Mono Light for labels | https://drone.riotters.com/ |
| "Off-grid" variable weights | PP Fragment Glare Variable at **220** (uppercase h1 120 px) and **310** (text): the weight is tuned to the desired optical weight | https://tengilemalamala.com/ |
| Suisse Intl **450** at 180 px, letter-spacing **−4 %** + Suisse Intl Mono | Ultra-tight neo-grotesk, very "Swiss finance" | https://www.aspensearch.com/ |
| Akzidenz Grotesk Pro Medium, line-height **88 %**, letter-spacing −0.31 rem | Compact heading blocks, very "poster" | https://bleibtgleich.dev |
| Extreme contrast within one family: Migra Extrabold and Extralight + ABC Diatype for text | Typographic drama without changing voice | https://milledollars.fr/ |
| Script or calligraphy laid **over** a wide grotesk (Scribo on Owners Wide Bold) | Human versus industrial, one key word in handwriting | https://www.lxlcreative.co.uk/ |
| Editorial serif and script pair: PP Editorial Old + Ballet + Helvetica Now Var + Sometype Mono | Cultural luxury and irony | https://pensatori-irrazionali.com/ |
| Gothic or tattoo script for a title word ("LEGACY") over a grotesk | Dark, dramatic universe | https://www.meermohsin.me/ |
| Very tall condensed (Heathergreen) + serif (Reckless Neue) + mono (Roboto Mono) | Poster, editorial and technical trio | https://coloniazacamil.com/ |
| Light serif capitals with positive letter-spacing (TT Ramillas) + TT Commons Pro | Luxury real-estate codes, mixed case "The art / OF THE SUBLIME" | https://sobha-privy-collection.com/ |
| A single variable family 200–1000 (ABC Diatype Plus Variable) for the whole site | Maximum economy and consistency | https://jesperlandberg.com |
| Rounded ultrabold display (PP Nikkei Maru) + character display (Charles Rosie) | Playful, retro spirits brand | https://santionispirits.com/ |
| Display grotesk (DieGrotesk) + ABC Diatype, H1 at about 108 px fluid (`clamp`) | SaaS product with character | https://www.butter.video/ |
| Neue Montreal 500 in 64 px capitals, letter-spacing −0.008 em | Sober premium fintech | https://www.moto-card.com/ |
| **Recurring families** | Independent foundries: Pangram Pangram (PP Mori, PP Fragment, PP Editorial, PP Supply Mono…), Dinamo (ABC Diatype), Grilli Type (GT Standard, GT Era), Swiss Typefaces (Suisse Intl), Indian Type Foundry (Switzer, General Sans). **No** "default" Google font used for headings | all |
| Type tokens in `clamp()` interpolated between min/max viewport + `text-wrap: pretty` | Clean fluid scale | https://www.lxlcreative.co.uk/ |

## Palettes & moods
| Palette | Observed values | Source |
|---|---|---|
| Cream + deep olive (safari, nature, luxury) | `#F5EEE9` · `#373F1D` · `#5C6E21` · `#E3E1D4` | https://tengilemalamala.com/ |
| Very dark brown + yellow cream + signal orange | `#27201D` · `#FCF2BD` · `#FF5121` | https://www.lxlcreative.co.uk/ |
| Warm beige + anthracite grey (no pure black) | `#F1EEE9` · `#3C3C3C` · `#D7D1C7` | https://noho.ink |
| Lavender grey + lilac + near-black | `#E0DEE1` · `#C2A1C7` · `#181818` | https://milledollars.fr/ |
| White + ink + neon **mint** + navy | `#FFFFFF` · `#232323` · `#A1FFCB` · `#08225A` | https://www.aspensearch.com/ |
| Deep black + cold metallic greys | `#080808` · `#E1E5E5` · `#838A8F` · `#1C2227` | https://www.moto-card.com/ |
| Dark slate + brick red | `#181D21` · `#B62F17` · `#85210F` + electric blue in 3D | https://boc.studio/ |
| Black + blood red | `#000` · `#990000` · `#D60407` | https://www.meermohsin.me/ |
| Strict black and white + occasional electric green | `#000` · `#FFF` · `#39EB72` | https://twks.ch/en |
| Navy + per-category palette (forest green, plum, ink) | `#1F2B5E` · `#36614D` · `#2D1C2D` | https://realevate.agency/ |
| Near-black + industrial orange + pale sea green | `#151515` · `#F47920` · `#EBF0ED` | https://www.cominvi.com.mx/ |
| Neutrals + saturated toy colours as accents (red, blue, green, yellow, pink) | `#FAFAFA` · `#0F0F0F` + `#FF3333` `#4DC5E5` `#63AD45` `#E9D352` `#F9ABFF` | https://www.butter.video/ |
| Textures: halftone or dithering on photos, dot particles, video grain | Material without the "AI" gradient | https://www.aspensearch.com/ · https://twks.ch/en |
| Modern colours: `oklab()` and `color(srgb …)` appear in computed styles (Tailwind v4) | Use OKLCH for tokens | https://twks.ch/en · https://www.lxlcreative.co.uk/ |

## Navigation & micro-interactions
| Pattern | Source |
|---|---|
| Centred floating pill nav, contrasted "Try for free" CTA on the right | https://www.butter.video/ |
| Studio local time shown in the header ("12:55 AM LA", "09:54 OCT") | https://www.aspensearch.com/ · https://boc.studio/ |
| Menu whose opening starts an ambient video | https://sobha-privy-collection.com/ |
| "3D Map" mini-card as a persistent bottom-right thumbnail, shortcut to an experience | https://sobha-privy-collection.com/ |
| Button whose arrow slides into a second square on hover (two state colour tokens) | https://www.cominvi.com.mx/ |
| Interactive quiz embedded in the product page to guide the choice | https://noho.ink |
| Custom cursors: up to 80 `[class*=cursor]` elements (cursor and contextual labels) | https://gilhuybrecht.com/ · https://pensatori-irrazionali.com/ |
| Age gate turned into a brand moment (XXL type, "ACCESS DENIED" refusal) | https://santionispirits.com/ |
| Portfolio filters ("All / Filter +") with a grid transition | https://boc.studio/ |
| Awards or clients table in thin lines, very typographic | https://bleibtgleich.dev |
| "Apply for Access" CTA: exclusivity as a lever | https://www.moto-card.com/ |

## WebGL / shader techniques
| Technique | Use | Source |
|---|---|---|
| **Three.js WebGPU + TSL** (`three.webgpu`, `three.tsl`, r181) in production | Shaders written in TSL, automatic WebGL2 fallback | https://www.moto-card.com/ |
| **KTX2 (Basis)** textures generated from video thumbnails | WebGL galleries light on GPU memory | https://jesperlandberg.com · https://gilhuybrecht.com/ |
| **Image sequences in KTX2** (`sequence.ktx2`) instead of a video | Character animation driven by scroll, frame by frame | https://pensatori-irrazionali.com/ |
| glTF models + **Draco** + KTX2 textures + 3D type from a JSON font | Photorealistic 3D product (bottle, label) | https://santionispirits.com/ |
| HDR environments picked at random (several neutral tints) on a product model | The product changes mood on each visit | https://noho.ink |
| **OGL** used alongside Three for light effects | 2D or image effects without the weight of Three | https://noho.ink |
| PlayCanvas with a dozen chained GLB models | Multi-object tech product scene | https://edolus.com/ |
| Interactive 3D character (CRT-screen head) with a "click to start" terminal | Agency mascot and easter egg | https://lisa.locomotive.ca/en |
| Halftone or dithering effect on portraits | Printed, data aesthetic, very 2026 | https://www.aspensearch.com/ |
| Glossy 3D ribbons (lacquered black, glass blue) in the hero, pre-rendered video or real time | Luxury abstraction. Also very present on Dribbble | https://sobha-privy-collection.com/ · https://boc.studio/ · https://dribbble.com/shots/27787183-3d-visual |
| Branded 3D scene (bank card on a pedestal in a cave, fog) | Exceptional product staging | https://www.moto-card.com/ |
| WebGL mini-game as a brand activation (fashion and sport collab) | Engagement and sharing | https://thetiebreak.merci-michel.com/ |
| Point-cloud particles in the footer | A lively, discreet page ending | https://twks.ch/en |

## Trends 2026-2027 observed
1. **WebGPU reaches production** through Three.js TSL (WebGL2 fallback). Plan for it in 2027.
2. **KTX2 everywhere** for WebGL textures (images, thumbnails, sequences): the new performance standard.
3. **Lenis + GSAP 3.15 (full suite, free)** form the near-universal base. Webflow + GSAP + Barba is an award-winning stack in its own right.
4. **Rive** for scrolled interactive animation and **dotLottie (wasm)** for mascots: interactive vector replaces video.
5. **Micro-tuned variable weights** (220, 310, 450) and strong negative letter-spacing (−4 %) on giant headings.
6. **Script or handwriting paired with a grotesk**: the return of the human and the handcrafted against the smooth AI aesthetic.
7. **Halftones, dithering, data HUDs, mono labels**: a "system or instrument" aesthetic.
8. **Earthy, warm palettes** (cream, olive, brown, beige) as a counterpoint to luxury black, with a single neon accent (mint, green, signal orange).
9. **Opt-in experiences**: "click to start", activatable audio, scripted age gate.
10. **Image inserted in the typography** and full-width heading-compositions.
11. **Native CSS on the rise**: View Transitions, `animation-timeline`, `:has()`, `text-wrap: pretty`, OKLCH colours (through Tailwind v4).
12. On Dribbble: brands with a **pattern system** (logo and pattern), abstract **3D ribbons**, engraved retro packaging, and a huge wave of AI SaaS landing pages (absolutely not to imitate).

## Anti-patterns to avoid (what looks "generic" or hurts the score)
- **"Please rotate your device"**: refusing mobile portrait mode is unacceptable in mobile-first (https://www.cominvi.com.mx/ · https://realevate.agency/).
- **Lorem ipsum in production** (https://www.meermohsin.me/).
- **Blocking preloaders**: 6 sites out of 23 still showed only a loader or a waiting screen after 6 s without interaction. Aim for a loader under 2 s, with progressive content.
- **100 % canvas content without HTML headings** (no `h1`/`h2` detected on several WebGL sites): SEO and accessibility lost. Always mirror in semantic HTML.
- **No `prefers-reduced-motion`**: 16 sites out of 23. A systematic mistake, not to be reproduced.
- **Text duplicated for effects** without `aria-hidden`: screen readers read "GearGear".
- **Dozens of videos loaded up front** (49 on a single page): lazy-load and `preload="none"`.
- **Outdated libraries** (Three r128 in 2026): needless debt and weight.
- **The "Dribbble AI SaaS" look**: purple-pink gradients, glassmorphism cards, stock avatars, generic 3D icons, "Turn your X into AI-powered Y", "99.9 %" counters, decorative dashboards (https://dribbble.com/shots/popular/web-design).
- **Default fonts** (Inter alone, Poppins, Montserrat) for headings: no SOTD uses them for display.
- **Identical fade-up animations** on every block: motion must vary by role (entrance, emphasis, transition).

## Dribbble — notable shots (inspiration, not reproduction)
- Logo system and bold typographic pattern (stencil): https://dribbble.com/shots/27783602-Super-Intelligence-Logo-Pattern-System
- Fashion e-commerce branding, red and black flats + mascot: https://dribbble.com/shots/27784528-OFFCANON-E-Commerce-Fashion-Branding-Concept
- Editorial real estate, italic serif and full-width photo: https://dribbble.com/shots/27786576-Modern-real-estate-website
- Animated identity on a line grid with knotted letters: https://dribbble.com/shots/27787842-Brand-Guidelines-for-Logistic-Platform-Sendit
- Product landing with site animation (section motion): https://dribbble.com/shots/27784786-Oliviera-AI-Automation-SaaS-Landing-Page-Animation
- Fashion and beauty photographer site: https://dribbble.com/shots/27775963-Website-Design-for-Fashion-and-Beauty-Photographer-Per-Appelgren
- Retro engraved labels (whiskey), printed textures: https://dribbble.com/shots/27789885-Grande-Pointe-Bourbon-Whiskey
- Architecture, minimal studio: https://dribbble.com/shots/27786717-Architecture-Studio-Website-Design-Make-Good
- Founders pages with illustrated portraits: https://dribbble.com/shots/27774755-SaaS-Founders-Page-with-Illustrated-Portraits
