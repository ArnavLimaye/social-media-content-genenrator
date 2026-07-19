# Post content stored as a document, not normalized tables

**Status:** accepted

A Post's copywriter output — `slides` (each with `heading`, `description`, and a
list of `imageIdeas`), plus `hashtags` and `reviewFlags` — is stored as Prisma
`Json` fields on the `Post` row, not as relational `Slide` / `ImageIdea` tables.

Slides and image ideas are value objects: each belongs to exactly one Post, is
always loaded and saved with that Post, and is never queried independently. That
is the textbook case for document storage. Normalizing would require two extra
tables (`Post → Slide → ImageIdea`, since imageIdeas is a list-within-a-list),
`position` columns to preserve order, and cascade wiring — all to buy
cross-post query-ability the MVP has no use for. The operator edits a post as a
unit, so a save rewrites the document anyway.

Scalar copywriter outputs (`hook`, `caption`, `cta`) remain plain columns for
easy inline editing; only the nested/list-shaped data is `Json`.

**Reconsider if:** we ever need to query or aggregate across individual slides or
image ideas (e.g. analytics on which image types perform best) — that would be
the signal to normalize.
