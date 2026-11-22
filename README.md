# Story Spine

A visual planner for documentaries. Lay out the prologue, acts, sequences, scenes and closing on a story wall, see the story arc as a graph, and add footage, audio and voice-over notes once the structure settles.

It is an installable web app (PWA) that works offline on a PC or phone.

## Where your plans live

- **On each device:** every plan is kept in the app's local storage, so it works offline.
- **As files:** *File → Save to file* writes a self-contained, interactive `.html` file. Double-click it to view and edit it in any browser, or open it again with *File → Open file…*. Overwriting the same file works in Chrome and Edge on desktop; other browsers download a new copy instead.
- **In your private GitHub repo:** with sync turned on, each plan is also stored as an `.html` file in the `plans/` folder of a private repository. That keeps your PC and phone in step, and Git history keeps every earlier version.

This repository contains only the app code. It holds no plans.

## Sync setup (once per device)

1. Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>.
2. **Repository access:** *Only select repositories* → your plans repository.
3. **Permissions → Repository permissions → Contents:** *Read and write*. Nothing else.
4. In the app: *File → GitHub sync settings…*, then enter your username, the repository name and the token.

The token is stored only on that device. Sync runs when the app opens, when you come back to it, 30 seconds after you stop editing, and when you press **Save** or the sync button. If the same plan is changed on two devices before they sync, both versions are kept and the second is renamed “(copy from …)”.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App page |
| `editor.js` | Story wall, arc graph and scene editor |
| `shell.js` | Plan library, file open/save, GitHub sync; also runs inside saved plan files |
| `app.css` | Styles (light and dark) |
| `sw.js` | Offline cache. **Bump `VERSION` on every change** so devices pick up updates. |
| `manifest.webmanifest`, `icons/` | Install metadata and icons |

Hosted with GitHub Pages from the `main` branch.
