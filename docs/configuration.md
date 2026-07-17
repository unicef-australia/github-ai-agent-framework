# Configuration reference

`.github/agent.yml` is strict YAML. Unknown keys fail validation so misspelled
security settings do not silently fall back.

## Provider stages

`triage`, `implementation`, and `review` accept:

| Key           | Meaning                       |
| ------------- | ----------------------------- |
| `provider`    | Registered adapter name       |
| `model`       | Provider model identifier     |
| `max_tokens`  | Positive response-token limit |
| `temperature` | Number from 0 to 2            |

`implementation.max_steps` limits model/tool turns to 100 or fewer.

## Limits

| Key                        | Default posture                |
| -------------------------- | ------------------------------ |
| `max_changed_files`        | Small, reviewable patch        |
| `max_patch_lines`          | Bounded text patch             |
| `allow_dependency_changes` | `false`                        |
| `allow_workflow_changes`   | `false`                        |
| `protected_paths`          | Workflows, `.env*`, and `.git` |

Binary patches and quoted Git paths are rejected. Dependency protection covers
common JavaScript, Python, Go, Rust, Ruby, and Bun manifests/lockfiles.

## Commands

Each command has:

```yaml
- name: test
  kind: test # install | format | lint | test | build | custom
  run: npm test
  required: true
  timeout_minutes: 10
```

The model requests `run_command` with only `name`. The framework looks up the
exact trusted string, parses arguments, and launches the executable with
`shell: false`. Shell executables are rejected. Required commands run before an
implementation bundle is produced and again in the publisher's read-only
verification job.

## Context

`context.include` lists exact files or directories gathered for prompts.
Symlinks and heavy generated directories are skipped. `context.max_bytes` bounds
total context. `AGENTS.md` is loaded explicitly for implementation even if it is
removed from the include list.
