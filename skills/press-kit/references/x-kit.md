# X kit

Everything a community manager needs to run the account without asking anyone: profile, a launch
day, two to three weeks of posts with their media, ready replies, and the rules.

## Sizes and limits

| Item | Value |
|---|---|
| Avatar | 400 × 400 (upload the 800 × 800 @2x). Shown in a circle: keep the mark inside the centre 70% |
| Header | 1500 × 500 |
| Post image | 1500 × 900 (default), or 1200 × 675, or 1080 × 1350. Upload the **1x** file: X recompresses larger ones |
| Post video | Same size as the post image, H.264 MP4, 30 fps, no audio needed |
| Display name | 50 characters |
| Bio | 160 characters |
| Post | 280 characters; every link counts as 23, whatever its length |

Platform limits change. Check the platform's current help pages before relying on a number here.

## Safe zones

Working values measured on real profiles; re-check on a live profile before shipping a header.

**X header, 1500 × 500**
- The profile photo covers the bottom-left: a circle centred near (215, 495) with radius 200.
  Treat the whole area `x < 440, y > 300` as unusable.
- Mobile crops the top and bottom: keep text and the logo within `y` 60 to 440.
- Put the message centre or right. The left third can carry texture only.

**LinkedIn cover, 1584 × 396**
- The logo tile covers `x < 420, y > 200`. Nothing important there.

**Story, 1080 × 1920**
- Interface chrome covers roughly the top and bottom 250 px.

Draw these keep-out areas as a debug overlay in the studio (`?guides=1`) and check each header
with it before rendering.

## The posting plan

| Block | Content |
|---|---|
| Profile | Display name, bio (with its character count), location, website, avatar file, header file |
| Day 1: pinned post | One post that says what the product is, with the strongest image or loop. Pin it |
| Day 1: thread | 4 to 7 replies to the pinned post: how it works, what it costs, what it does not do, where to start |
| Daily posts | 10 to 14 posts, one per day at a fixed time, each tied to one image or loop, grouped by category (intro, how, pricing, privacy, FAQ...) |
| Series | A repeatable format ("X of the day") that can continue after the plan ends |
| Ready replies | The questions people will ask, each with an answer that can be pasted |
| Rules | Do, don't, voice |

Day 1 is the first day the account posts; the plan uses day numbers, never dates. The console
turns them into dates from a start date the manager picks.

## Copy rules

- Facts only, from the same data as the press page. A figure that depends on live data is posted
  only if it is true on the day; say so in the post's `note`.
- Mechanism and limits together: say what it does and what it does not do.
- No returns, yield, "guaranteed", "risk-free" or price talk. No invented traction.
- No other brand's logo, and no comparison with a named competitor.
- **No handle.** Not the account's own, not anyone else's, anywhere in the kit. Previews show the
  display name only.
- Voice: short sentences, plain words, one idea per post, say what it does and not how great it is.
  Default house style: no emoji, no exclamation marks, no hashtags. Follow the brand's own voice
  if it has one.
- Every media has alt text.
- Posts about something not live yet carry `soon: true` and a note saying when to re-read them.

## Data shape

One file is the source for the console page, the post images, `tweets.md` and the ZIP.

```ts
export type Theme = "dark" | "light";
export type MediaRef = { id: string; kind: "image" | "video" }; // file id without extension

export type Tweet = {
  id: string;
  category: string;
  day: number; // 1 = the first day the account posts
  when: string; // plain words: "Day 3, 17:00 Paris · 11:00 New York"
  text: string;
  media?: MediaRef;
  alt?: string; // alt text for the media
  other?: MediaRef; // the same post in the other theme or format (download only)
  pin?: boolean;
  reply?: boolean; // post as a reply to the previous one (day-1 thread)
  soon?: boolean; // mentions something not live yet
  note?: string; // why this one needs care
};

export const X_PROFILE = { name: "", bio: "", location: "", website: "", avatar: "avatar-dark", header: "x-header-dark" };
export const PINNED: Tweet = {/* ... */};
export const THREAD: Tweet[] = [];
export const POSTS: Tweet[] = [];
export const X_REPLIES: { question: string; text: string; note?: string }[] = [];
export const X_RULES = { do: [] as string[], dont: [] as string[], voice: [] as string[] };

export const X_LIMIT = 280;
/** X counts every link as 23 characters. Extend the TLD list to the domains you post. */
const LINK = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|io|ai|co|org|net|app|dev|xyz)(?:\/\S*)?/gi;
export const xLength = (text: string) => [...text.replace(LINK, "x".repeat(23))].length;
```

Add a test (or a build-time assertion) that every post satisfies `xLength(text) <= X_LIMIT`, that
the bio is at most 160 characters, and that every `media.id` exists in the manifest.

## `tweets.md`

A route (`/press-kit/x/tweets.md`, `content-type: text/markdown`) generated from the data:

```md
# <Display name> on X

## Rules
- Do: ...
- Don't: ...
- Voice: ...

## Profile
- Name: ...
- Bio (142/160): ...
- Avatar: `profile/avatar-dark@2x.png`
- Header: `profile/x-header-dark.png` (1500×500)

## Day 1: pinned post
### Pinned post
When: Day 1, 17:00
Media: `posts/x-01-intro-dark.png`
Length: 187/280
**Pin it.**

<the text, in a code block so it can be copied exactly>
```

Then the thread, the daily posts, the series and the ready replies in the same block format.
Media paths are the paths inside the X ZIP.

## The console: `/press-kit/x`

- **Post now**: the manager sets the start date once; the page shows today's post with its text,
  media and a copy button, and what comes next. A "posted" checkbox per post. Both are stored in
  `localStorage` only (wrap every access in try/catch; the page must work without it).
- **Profile**: each field with its character count and a copy button, the avatar and header with
  download links, and a preview of the profile.
- **Day 1**, **Daily posts**, **Series**: each post as a card that looks like a post (display name,
  no handle), with character count, copy text, download media, alt text, and its note.
- **Ready replies**: question, answer, copy button.
- **All media**: the gallery of `public/press/posts` and `public/press/motion`.
- The X ZIP download and the link to `tweets.md`.

Copy buttons give feedback ("Copied") and are real `<button>` elements. Videos use
`preload="none"` with their poster.
