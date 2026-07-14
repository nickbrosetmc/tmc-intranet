# TMC Portal — Agent API Guide

How an external agent (e.g. a Claude "chief of staff") reads and manages
tasks and client requests on the TMC portal.

## Auth

Mint a token at **portal → Admin → Users → API tokens** (admin only).
Send it on every request:

```
Authorization: Bearer tmc_<64 hex chars>
```

- `read` scope: GET only. `write` scope: can also POST/PATCH/DELETE.
- The token acts as its owning user (same permissions as them in the portal).
- Revoke anytime from the same admin card. Treat the token like a password;
  if it leaks, revoke and mint a new one.

Base URL: `https://portal.tmctechhub.com`

## Tasks

### Everything at once (recommended first call)
```
GET /api/tasks/dashboard
GET /api/tasks/dashboard?includeCompleted=1
```
Returns `{ tasks, openPosts, userOptions, postOptions, clientOptions,
weeklyPostsByClient, weekStart, weekEnd, weekDueDate,
defaultPostAssigneeId, defaultPostEstimatedMinutes, pillars, funnelStages }`.

- `tasks[]`: manual tasks — `id, title, description, assigneeId, priority
  (low|medium|high|urgent), dueDate, estimatedMinutes, actualMinutes,
  status (pending|in_progress|completed|cancelled), contentPostId,
  assigneeName, contentPostTitle`.
- `openPosts[]`: content posts not yet completed. A post "belongs" to its
  `assignedTo` user, EXCEPT when `status == "review"` and `reviewerId` is
  set — then it's the reviewer's work. Work is due the Friday BEFORE the
  post's `scheduledDate` week (TMC produces a week ahead).
- Filter to one person's plate by `assigneeId` / effective assignee.

### Mutations (write scope)
```
POST  /api/tasks                 { title, description?, assigneeId?, priority?,
                                   dueDate? (YYYY-MM-DD), estimatedMinutes?,
                                   contentPostId? }
PATCH /api/tasks/:id             any of the above fields
POST  /api/tasks/:id/start       start the timer (status → in_progress)
POST  /api/tasks/:id/complete    { actualMinutes? }  (auto-computed from timer if omitted)
POST  /api/tasks/:id/reopen
DELETE /api/tasks/:id
```

## Client requests & events

### List all
```
GET /api/submissions
```
Returns `{ submissions, notifyEmails }`. Each submission:
`id, clientId, clientName, submitterName, type (request|event), subject,
details, eventDate, location, status (new|in_progress|done), adminNotes,
createdAt`.

### Update (write scope)
```
PATCH /api/submissions/:id       { status?, adminNotes? }
```

## Content posts (the planner)

```
GET   /api/content/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD
POST  /api/content/posts         { clientId, title, scheduledDate, status?,
                                   pillarId?, funnelStageId?, platform?,
                                   assignedTo?, reviewerId?, estimatedMinutes?, notes? }
PATCH /api/content/posts/:id     partial update. Marking status "completed"
                                 requires pillarId + funnelStageId; "review"
                                 requires reviewerId.
```

## Conventions

- All bodies and responses are JSON. Errors: `{ "error": "…" }` with 4xx/5xx.
- Dates are `YYYY-MM-DD`; timestamps are SQLite UTC (`YYYY-MM-DD HH:MM:SS`).
- No rate limits currently, but be a good citizen: the dashboard endpoints
  return everything in one call — poll those rather than hammering
  per-item endpoints.

## Example: morning briefing pull

```bash
TOKEN="tmc_…"
curl -s https://portal.tmctechhub.com/api/tasks/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq '{
    openTasks: [.tasks[] | select(.status=="pending" or .status=="in_progress")
                | {title, assignee: .assigneeName, due: .dueDate, priority}],
    postsInFlight: [.openPosts[] | {title, status, publishes: .scheduledDate}]
  }'

curl -s https://portal.tmctechhub.com/api/submissions \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.submissions[] | select(.status=="new")
         | {client: .clientName, type, subject, submitted: .createdAt}]'
```
