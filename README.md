# Deadline Rescue

A student workload planner that turns tasks, deadlines, and available study hours into a daily plan.

## Files

- `index.html` — the interface and dialogs.
- `style.css` — responsive layout, colors, typography, and animations.
- `app.js` — scheduling, task steps, rescue previews, and browser storage.
- `README.md` — these instructions.

Keep the first three files together in the same folder. No build step, package installation, database, or API key is required.

## Open locally

Extract the ZIP into a normal folder on your computer. Open that folder in VS Code to edit it. Open `index.html` in a modern browser to try the app.

For consistent storage behavior during development, serve the folder with a local web server. If Python is installed, run this command from this folder:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8000`. Keep the address and port consistent between sessions.

## Use the planner

1. Add tasks with a name, due date, remaining hours, and importance.
2. Choose a planning period and enter available focused study hours for each day.
3. Click **Generate my plan** to jump to the schedule.
4. Use **Break into steps** on a task to edit suggested steps and minute estimates. Saving steps replaces that task's estimate with the total of its unfinished steps.
5. Check off completed steps to remove their minutes from the remaining workload.
6. Use **Rescue my day** to change a day's available hours. Review the preview, including any shortfalls, and click **Apply changes**.

Record completed work before using Rescue my day. For tasks without steps, edit remaining hours; for tasks with steps, check off finished steps or revise their estimates. Enter only the study time still available today.

## Scheduling rules

- Due dates mean the end of the selected day, in the browser's local date context.
- Earlier deadlines come first. Importance breaks ties; original task order breaks remaining ties.
- Work may split across days, but never exceeds entered daily availability or runs past a deadline.
- Completed tasks and steps are excluded. Overdue tasks are displayed separately.
- Work that does not fit is reported explicitly. Work due beyond the planning period is distinguished from work that cannot fit before a deadline within the period.
- Scheduling time does not mark work complete.
- The planning period supports up to 31 days.
- This is a daily workload allocation, not an hourly calendar or an optimal grade-maximizing algorithm.

## Deploy to GitHub Pages

1. Create a GitHub repository. Use a public repository for the GitHub Free Pages workflow.
2. Upload the extracted files using **Add file → Upload files**. Put `index.html`, `style.css`, and `app.js` at the repository root, not inside an extra folder or a ZIP.
3. Commit the uploaded files.
4. Open the repository's **Settings → Pages**.
5. Choose **Deploy from a branch**, then `main` and `/(root)`, and save.
6. Once deployment finishes, open the published URL shown by GitHub and test it on a phone and desktop.

Other static website hosts can serve this folder directly. No build command is needed; the published directory must contain `index.html` and its two linked files.

## Storage and limitations

Source files are stored in your computer's folder. User-entered tasks and availability are stored separately in the browser's `localStorage` under `deadline-rescue-v1`.

Data does not sync between devices or website addresses. Moving from a local file to localhost or a published website will not transfer existing tasks automatically. Clearing browser site data may erase saved tasks. Local file storage support varies by browser; the app displays a warning if saving fails.

The ZIP contains code, not your browser's saved tasks. There is no login, backend, or AI integration in this version. AI was discussed as a future feature but has not been implemented. The task-step suggestions are editable templates, not AI-generated responses.

## Validation

JavaScript syntax and focused scheduling checks were run during development, covering capacity limits, deadlines, task-step allocation, completed-step exclusion, rescue shortfalls, and compatibility with tasks without steps. Live visual verification through the automated browser tool was unavailable for local file URLs.

Before submission, test adding a task, refreshing, changing availability, completing a step, previewing and cancelling a rescue, applying a rescue, and opening the published app on a phone.
