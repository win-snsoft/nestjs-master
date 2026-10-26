---
name: push-meegle-tasks
description: Pushes the work done on a git branch to a Meegle story as sub-tasks, with title, owner, description and actual start/end dates, without points.
argument-hint: '[meegle work item id or link]'
disable-model-invocation: true
---

# Push Meegle tasks

Turn the commits on a branch into Meegle sub-tasks under one work item, so the story shows who did what and when. Each sub-task gets a title, an owner, a description and actual start/end dates. Points stay empty: the team estimates them, and a number guessed from a diff would be misleading.

All Meegle calls go through the `claude.ai Meegle` MCP tools. If they are not available, ask the user to run `/mcp`, select **claude.ai Meegle** and log in, then continue.

## Steps

1. **Get the Meegle work item.** Take the id or link from `$ARGUMENTS`. If it is empty, ask for it and wait. If a pasted link carries a `disposable_login_token`, do not use or repeat the token, and tell the user it is a login credential. Call `get_workitem_brief` with the id and show the work item's name, type and space. Done when the user has confirmed it is the right one.
2. **Confirm the branch.** Run `git branch --show-current`, then ask the user to confirm the branch and the base it is compared against (default `main`; suggest `upstream/main` when that remote exists). Show the commit count from `git log --no-merges --oneline <base>..<branch>`. Ask whether uncommitted changes (`git status --short`) should become an "in progress" task. Done when branch, base and the uncommitted choice are confirmed.
3. **Collect commits.** Run `git log --no-merges --date=short --pretty=format:'%h|%ae|%an|%ad|%s' --shortstat <base>..<branch>`. For merge commits named `Merge pull request #N`, note which commits each PR brought in (`git log --no-merges <merge>^1..<merge>^2`) so descriptions can name the PR. Done when every commit has hash, author email, date and subject.
4. **Group into tasks** following [Grouping](#grouping), and write each task's title and description as in [Task content](#task-content). Done when every commit belongs to exactly one task.
5. **Resolve owners.** Call `search_user_info` with the author emails (up to 20 per call) and the work item's `project_key`. If an email has no match, try the author name; if that fails too, ask the user who owns those tasks. Done when every task has a `user_key`.
6. **Pick the stage and check duplicates.** Call `get_node_detail` with `need_sub_task: true`. Suggest the development stage (a node named like "In Development") and let the user change it. Mark any task whose title already exists as a sub-task on that stage as `skip`. Done when the stage is confirmed.
7. **Look up field keys.** Call `list_workitem_field_config` with `work_item_type: sub_task` and match by field name: `Description`, `Actual Start Date Time`, `Actual End Date Time`. Field keys differ between spaces, so always look them up rather than reuse keys from another run. If a field is missing, tell the user and leave it out. Done when each field has a key or is dropped.
8. **Propose** a table and wait for the user's OK before creating anything, because these items land in a shared workspace:

   | #   | Title                                          | Owner  | Actual start | Actual end | Commits          | Action        |
   | --- | ---------------------------------------------- | ------ | ------------ | ---------- | ---------------- | ------------- |
   | 1   | Shared QPS limiter pools for provider accounts | Winson | 2026-10-16   | 2026-10-19 | 8333f9b, 78da054 | create        |
   | 2   | Fix: empty Viber log batches not skipped       | Winson | 2026-10-21   | 2026-10-21 | be86de8          | create        |
   | 3   | Health endpoint for messaging-api              | Winson | 2026-10-20   | 2026-10-20 | b66b492          | skip (exists) |

   List each task's description under the table.

9. **Create the first task, then check it.** Create one sub-task with `update_node_subtask` as in [Create call](#create-call), then read it back with `get_workitem_brief` (`work_item_id` = the new id, `fields` = the three field keys). If the description or dates did not save, stop and tell the user before creating the rest.
10. **Create the rest.** Independent creates can run in parallel. If a create returns an error, re-read the stage with `get_node_detail` before retrying: a failed create can still leave the task behind (seen once with no owner), and then the fix is `update` on that `task_id`, not a second `create`.
11. **Verify and report.** Re-read the stage with `get_node_detail` and confirm each created task is there once with its owner. Report counts per owner, skipped duplicates, and anything that failed.

## Grouping

- One task per feature or change a reviewer would recognise, not one per commit. Fold follow-ups into the feature they belong to: review feedback, renames, lint fixes and refactors of the same code.
- A `fix:` commit for a bug that already shipped becomes its own task titled `Fix: <what was wrong>`. A fix for a feature in the same batch folds into that feature.
- Pure chores (formatting, dependency bumps, deleted files) group by theme, for example "Repo cleanup" or "ESLint rules".
- A task has one owner. If two authors worked on the same feature, ask the user whether to split it or assign both.

## Task content

- **Title**: a short noun phrase in plain words, no conventional-commit prefix or scope. `feat(limiter): add rule strategy with per egress IP limits` becomes `Limiter rule strategy with per-egress-IP limits`.
- **Description** (markdown): one to three sentences on what changed and why, written for the PM reading the story, then the commits:

  ```markdown
  Adds a rule strategy to the QPS limiter so each egress IP gets its own limit.

  Commits: fb80c91
  PR: #5
  Branch: implementation-v1
  ```

  Leave out `PR:` when the commits were pushed without a PR.

- **Actual start / end**: the first and last commit date in the task. Convert each date to a millisecond timestamp at local midnight with `node -e "console.log(new Date('2026-10-21T00:00:00').getTime())"`.

## Create call

```
update_node_subtask(
  action: "create",
  project_key: <space key from step 1>,
  work_item_id: <work item id>,
  node_id: <stage node_key from step 6>,
  assignee: [<owner user_key>],
  fields: [
    { field_key: "name", field_value: <title> },
    { field_key: <Description key>, field_value: <description> },
    { field_key: <Actual Start Date Time key>, field_value: <start ms> },
    { field_key: <Actual End Date Time key>, field_value: <end ms> }
  ]
)
```

Leave out the `schedule` argument and every points field (`points`/PD, Task Point, Estimated Man Hour): `schedule` fills in an estimate automatically when its `is_auto` is left at the default.
