---
name: todowrite
description: Maintain a visible, persistent checklist for work with three or more steps or several parallel items. Use the TodoKit tools to create and update it as work progresses.
---

When a task has three or more steps, or asks for several things at once, use the TodoKit MCP tools to keep a visible task list and update each item as it is completed.

Use `add_todos` for a batch, `list_todos` to inspect current work, `update_todo` to revise an item, and `complete_todo` when a step is done. Use exact IDs returned by the tools. Do not use `delete_todo` unless the user asks to remove an item.

Keep long-term project facts, decisions, and unresolved work in the project `MEMORY/` files. The TodoKit JSON is only active execution state.
