# How to use unsl0p

You type what you want in Claude Code. The kit makes Claude work the way a senior web designer would: it asks a few questions, proposes a direction, waits for your yes, then builds and checks its own work. You never run the scripts yourself; Claude does.

## 1. Install (once, about 5 minutes)

You need Claude Code, Node 22 or later, and Google Chrome.

In your terminal:

```bash
npx unsl0p
npx playwright install chromium
```

Answer the prompts (the defaults install everything). Install `ffmpeg` too if you want videos (`brew install ffmpeg` on a Mac).

Prefer the Claude Code plugin? Run `/plugin marketplace add buildwithrekt/unsl0p`, then `/plugin install unsl0p@unsl0p`, then `/unsl0p:setup`. With the plugin, the commands below are written `/unsl0p:awwwards` and `/unsl0p:scout` instead of `/unsl0p-awwwards` and `/unsl0p-scout`.

Close the session and open a new one. The rules are now loaded in every session.

## 2. Build your first site

Make an empty folder, open Claude Code in it, and type:

```text
/unsl0p-awwwards A landing page for a specialty coffee roaster in Lisbon. Warm, editorial, a bit playful. One page, with a shop link.
```

What happens next:

| Step | What Claude does | What you do |
|---|---|---|
| Brief | Restates your brief and asks up to 3 questions | Answer, or say "you decide" |
| Art direction | Proposes palette, fonts, grid, motion and 2-3 "wow" moments | Say yes, or say what to change |
| Structure | Lists pages and sections, mobile behaviour | Say yes, or adjust |
| Build | Sets up tokens, type, sections, motion, then WebGL | Watch, and look at it in the browser |
| Audit | Runs build, Lighthouse, accessibility and SEO checks | Read the results, failures included |
| Improvements | Lists what would push it further | Pick what to do next |

The three stops are the point. Most of the quality comes from pushing back at the art direction step. Say things like "the palette is too safe", "bigger type", "I want one moment that makes people stop scrolling".

## 3. The skills, and what to type

You do not need a command for these. Describe what you want and Claude loads the right skill. If it does not, name the skill: "use the press-kit skill".

### motion-system
The setup and patterns for scroll, text reveals, page transitions, preloader, cursor and WebGL.

```text
Add a page transition between the home page and the work pages. Use the motion-system skill.
```
```text
The hero feels flat. Add a text reveal on the headline and a scroll-driven moment in the second section.
```

### brand-kit
From an idea to a full identity as files: name, logo set, colours, fonts, favicons, share images, social banners, guidelines page.

```text
Make a brand kit for a budgeting app for freelancers. Calm, confident, not corporate.
```

It stops for your approval on name, colour, typography, logo and social assets.

### press-kit
A press page for your site, logo downloads, an X kit with post images, animated loops as MP4, and zip files.

```text
Build the press kit and X kit for this site.
```

Run this inside an existing site project. It needs the site running locally.

### redesign-thread
An unofficial redesign of a well-known site as 18 to 21 images plus the thread text, built on real data from that site.

```text
Make a redesign thread for <site URL>. Focus on the home page and the main product page.
```

Every image is labelled as an unofficial concept. It redesigns the layout; it does not reuse the site's assets or code.

### code-film
A short film written in code and rendered to MP4, with a soundtrack made in code. Good for launch videos.

```text
Make a 30-second launch film for this product. Landscape, plus a vertical version.
```

Claude writes a plan for the whole film first. Read it before it builds scenes; changing the plan is cheap, changing finished scenes is not.

### scroll-film
A film that plays as the visitor scrolls, made from generated video shots.

```text
Add a scroll film to the hero: the product rotating and opening up, 4 shots.
```

**This one costs money.** It uses fal.ai. Before starting, set a spending cap in your terminal:

```bash
export FAL_KEY=your_key
export FILM_BUDGET=20
```

Claude shows a price estimate before generating anything and the script refuses to go over the cap. Ask for the estimate first: "show me the plan and the cost, don't generate yet".

## 4. Keep your references fresh

The kit ships with a study of recent award-winning sites. Claude cites it when it proposes a direction. Refresh it about once a month:

```text
/unsl0p-scout
```

Or aim it at a theme:

```text
/unsl0p-scout e-commerce
```

It takes a while, because it visits each site in a real browser.

## 5. Habits that make the difference

- **Give a real brief.** Who it is for, the tone, and two or three sites you admire. Three good sentences beat one vague line.
- **Push back at the direction step.** Once the code is written, changing direction costs much more.
- **Look at it in the browser.** Scroll the whole page on desktop and on your phone. Tell Claude exactly what feels off: "the second section arrives too fast", "the hover on the cards does nothing".
- **Ask for one thing at a time** after the first build. "Rework the footer" gets a better result than a list of ten changes.
- **Never accept less motion.** If a change makes the site flatter, say so. The rules tell Claude that removing animation is a downgrade.
- **Ask for the audit numbers.** "Run the audit again and show me the results" before you call it finished.

## 6. Update the kit

```bash
npx unsl0p@latest
```

With the plugin instead:

```bash
claude plugin marketplace update unsl0p
claude plugin update unsl0p@unsl0p
```

With the plugin, run `/unsl0p:setup` again in Claude Code. Your own references file is kept.

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| `/unsl0p-awwwards` is not found | Run `npx unsl0p` again, then restart Claude Code (with the plugin: `/unsl0p:awwwards`, check `claude plugin list`) |
| Claude ignores the rules | You skipped the rules in the installer (or `/unsl0p:setup` with the plugin), or you did not open a new session after it |
| A render script cannot find a browser | Install Google Chrome, or run `npx playwright install chromium` |
| Video export fails | Install `ffmpeg` |
| `scroll-film` refuses to run | That is the spending cap working: raise `FILM_BUDGET` or cut shots |
