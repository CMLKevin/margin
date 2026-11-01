# Publisher compatibility audit

Checked on November 1, 2026 (Asia/Singapore), against the twelve active subscriptions on the owner’s live Margin Site. Removed Hugging Face subscriptions remain excluded. This report contains public publisher facts only.

Each source was discovered from its ordinary blog/research URL, and three current posts per source were captured with the actual collection engine. All 36 returned article text and publication dates. Counts below describe discovery from the pages and feeds available during this check; they are not a claim of complete historical archives.

| Publisher | Discovery route | Posts discovered | Readable samples | Dated samples |
| --- | --- | ---: | ---: | ---: |
| [Trajectory](https://www.trajectory.ai/field-notes) | HTML discovery | 12 | 3/3 | 3/3 |
| [Preference Model](https://www.preferencemodel.com/blog/) | HTML discovery | 5 | 3/3 | 3/3 |
| [Base Labs](https://labs.baseten.co/articles) | HTML discovery | 19 | 3/3 | 3/3 |
| [Epoch AI](https://epoch.ai/latest) | RSS / Atom | 50 | 3/3 | 3/3 |
| [Anthropic](https://www.anthropic.com/research) | HTML discovery | 24 | 3/3 | 3/3 |
| [OpenAI Research](https://openai.com/research/index/) | Reader discovery + research RSS | 243 | 3/3 | 3/3 |
| [Thinking Machines](https://thinkingmachines.ai/blog/) | RSS / Atom | 7 | 3/3 | 3/3 |
| [Physical Intelligence](https://www.pi.website/blog) | HTML discovery | 15 | 3/3 | 3/3 |
| [Goodfire Research](https://www.goodfire.com/research) | HTML discovery | 43 | 3/3 | 3/3 |
| [Prime Intellect](https://www.primeintellect.ai/blog) | HTML discovery | 51 | 3/3 | 3/3 |
| [Together Research](https://www.together.ai/research-blog) | HTML discovery | 81 | 3/3 | 3/3 |
| [Cognition Research](https://cognition.com/research) | HTML discovery | 14 | 3/3 | 3/3 |

## Feature coverage

A separate isolated local database used the public fields of the existing 277-post library to test every publisher through the real HTTP and MCP endpoints. For each source the audit verified source/topic/date/capture filters, HTTP/MCP result parity, post retrieval and media references, duplicate subscription detection, saved/read state and notes, removal/restoration, and preservation of post IDs and personal state. All twelve passed. The browser also opened every source and a corresponding article preview, and verified that the topic controls reflect that source’s posts. The general integration suite covers first-run setup, private Jina configuration, authentication, restart persistence, collection leases, unattended scheduling, all five MCP tools, and the stdio bridge.

## Fixes made during the audit

Together’s Webflow archive uses Load more and a CMS-specific page parameter. Following its explicit pagination discovers 81 research posts across 21 pages instead of four. This does not subscribe to Together’s general marketing blog. OpenAI’s readable research index is supplemented by Research and Publication entries in its official RSS; Company records are excluded. The combined discovery found 243 posts in this check. Anthropic article-card headers retain their publication dates, while global navigation and category links are excluded; this also recovers genuine cross-section research cards.

Extraction now recognizes additional publisher bylines, classifies common video embeds as video, retains direct video/audio links, and excludes footer assets. HTTP 200 error screens such as Something went wrong are rejected rather than indexed as research. Stored error captures are quarantined and retried. Earlier extractor versions are refreshed progressively with existing bookmarks, read state, and notes preserved.

The shared taxonomy now has twenty topics in four groups, with weighted title, summary, and repeated body evidence. It distinguishes robotics, interpretability, science, security, economics, and other areas that previously collapsed into broad agent/compute labels. The inbox uses source-aware counts, grouped category choices, and a compact row of popular topics. MCP overview exposes the same vocabulary and assignment method.

## Practical limits

Publisher access and page structure can change. OpenAI currently needs the reader fallback in this execution environment; a user’s Jina key improves reliability when anonymous shared IPs are rate limited. Some publishers omit author metadata, so Margin leaves it empty rather than inventing a byline. Several publishers explicitly block framing; the app now shows a clear separate-tab fallback for known blocked embeds. Original-site links preserve the publisher’s complete presentation.

Text extraction is capped at 50,000 characters and the media manifest at forty references per post. Interactive charts, canvas rendering, equations, video content, and browser-only behavior are referenced rather than semantically or visually interpreted. Index traversal checks at most 25 explicit pages per collection. New article imports remain bounded at twelve per source per check, with later checks continuing backfill; discovery counts do not imply that all those posts have already been imported.

Repeat the network audit with `node scripts/audit-publishers.mjs`. Repeat the state-changing feature matrix only against a disposable, populated localhost instance with sources paused using `node scripts/audit-library-features.mjs`.

## Follow-up: Alignment Science Blog

The subsequently added [Anthropic Alignment Science Blog](https://alignment.anthropic.com/) exposed a real gap: its homepage links directly into year folders, without a `/blog/` or `/research/` prefix, and its articles use Distill custom elements. The collector now recognizes heading-backed year-folder article links on homepage indexes and in reader snapshots, preserves the index abstracts, and reads Distill front matter and article/appendix content. Nested author lists and dated metadata are supported. Data-backed interactive demonstrations retain links to their original page anchors.

The live index exposed 57 posts. Three research articles were checked end to end, yielding 37,573, 20,622, and 4,023 characters of article text, with 25, 9, and 2 media references respectively. Some posts provide only a month heading on the index and no exact publication date in the article. Margin keeps the exact date unavailable instead of inventing a publication day. The blog is included as the thirteenth packaged source for new installations.
