# DocPC setup

This file is for the model. Follow it once, before the first build. `SKILL.md` sends you here when
`<skill>/local/setup.md` does not exist. Follow it again when the user asks to change the setup.

In this file, `<skill>` is the folder that holds this file.

## Rules (read first)

- Do not ask for, store or write passwords.
- Do not change or delete the user's files. Copy a file into `<skill>/local/assets/`; do not move it.
- Write only into `<skill>/local/`. Git ignores that folder, so the user's details and files never go to a public repository.
- `<skill>/local/` holds only the user's own details and the assets common to all documents of the university (logo,
  signature). Never copy the files of one module or project (brief, lecturer's template, cover, forms, rubric,
  samples) into `local/`. They go in that project's `Inputs/` folder.
- If `<skill>/local/setup.md` exists, show it to the user and ask before you replace it. Keep a backup copy.

## Steps

1. **Check the platform and tell the user.** Say this before anything else:

   > DocPC works fully only on Windows with the desktop versions of Microsoft Word and Microsoft Excel. On macOS or
   > Linux, or without Word or Excel, only the text, the minutes, the diagrams and the line-end check work. The rest
   > are manual steps (see "Without Word or Excel" in `README.md`).

   - Find the operating system, and whether Word and Excel are installed.
   - Check Node.js 18 or later (`node --version`), and Microsoft Edge (or Chrome or Chromium in the `EDGE` variable).
   - Tell the user what is missing. Continue the setup: the missing parts only stop the steps that need them.

2. **Ask which setup the user wants.** Give two choices:
   - **Option 1: Clean slate.** DocPC uses its generic defaults. No assets are needed. The user can add a signature or
     a logo later.
   - **Option 2: University.** DocPC learns the usual documents of the user's university, from a sample that the user gives.

3. **Ask where the user's details come from** (name, ID, email, institution, programme, intake). Give two choices:
   - a profile folder: record its path. At each build, read its `about-me.md` (or the file that holds the details).
   - chat: ask the user for the details at each build. Do not record them unless the user asks you to.
   - If the user asks you to keep the details in the skill, write them to `<skill>/local/me.md` (a table of the
     details, and the file that they come from). Never write passwords or national ID numbers.

4. **Ask about the writing style.** If the profile folder has writing-style files, record their names. If not, record
   "ASD-STE100 Simplified Technical English".

5. **Option 2 only: break down the university's documents.**
   1. Ask for the name of the university.
   2. Ask the user for a sample of the typical documentation: a lecturer's template, a past document or a sample
      document (`.docx`, `.doc` or `.pdf`). Also ask for samples of the usual forms, if there are any (meeting minutes,
      progress sheets, Excel forms such as a workload matrix).
   3. Read each sample where it is. Do not copy it into `<skill>/local/`: a sample belongs to one module, and the
      project puts it in its own `Inputs/` folder.
   4. Find each component in the table below. Record a component in the setup only if it is the same for all
      documents of the university (for example the logo). If it comes with each module's template, record
      "`Inputs/` of the project".
   5. Show the user a table of the components: what you found, what the user must give, and where it goes.
   6. Ask the user to put the logo and the signature (if the user wants it used) into `<skill>/local/assets/`. Wait
      until the user says that they are in. A component that the user does not give stays "not given": the skill
      uses its default.

   | Component | Look for | The user gives |
   | --- | --- | --- |
   | Cover page | The fields on the cover (title, name, ID, intake, lecturer, date) and the first heading after the cover | Nothing if the sample has the cover; otherwise a cover template |
   | Logo | A logo on the cover or in the header | The logo file (PNG) |
   | Header and footer | The text in them, and the page numbers | Nothing (record the text pattern) |
   | Page format | Font, font size, line spacing, margins, portrait or landscape | Nothing (record the values) |
   | Front matter | Contents, list of figures, list of tables, abstract, declaration | Nothing (record what is needed) |
   | Headings | The numbering (1.0, 1.1 or 1, 1.1) and the usual section order | Nothing (record the pattern) |
   | Citations | The reference style (for example APA or Harvard) | Nothing (record the style) |
   | Signature | Signature lines on the cover or on forms | The signature image, only if the user wants it used |
   | Meeting minutes and progress sheets | Their layout and parts | A sample, if they differ from the built-in form |
   | Excel forms | The template and the cells to fill | The `.xlsx` template |
   | Other forms | Declarations, feedback forms, test scripts | A sample of each |

6. **Write `<skill>/local/setup.md`** in the format below. Write only what the user gave or what you found in the samples.
   Write "not given" for the rest.

7. **Tell the user that the setup is done.** Show the file. Tell the user to type `/docpc` (or to ask for documentation)
   to start a document. To change the setup, the user asks to run the setup again.

## Format of `local/setup.md`

```markdown
# DocPC local setup

Option: clean slate | university
Date: <date of the setup>
Platform: <operating system>; Word: yes | no; Excel: yes | no; Node.js: <version>; Edge or Chrome: yes | no

## User details
Source: profile folder <path> | local/me.md | chat

## Writing style
<style files of the profile, or ASD-STE100 Simplified Technical English>

## Assets
- Signature: local/assets/<file> | not given (use it only when the user allows it for that form)
- Logo: local/assets/<file> | not given

## University (option 2 only)
Name: <university>
Samples read (not copied): <file names>

| Component | Found in the sample | File or value |
| --- | --- | --- |
| Cover page | <fields> | `Inputs/` of the project |
| Header and footer | <pattern> | - |
| Page format | <font, size, spacing> | - |
| Front matter | <parts> | - |
| Headings | <numbering, order> | - |
| Citations | <style> | - |
| Meeting minutes and progress sheets | <layout> | `Inputs/` of the project, or the built-in form |
| Excel forms | <forms> | `Inputs/` of the project |
| Other forms | <forms> | `Inputs/` of the project |
```
