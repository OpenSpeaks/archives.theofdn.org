# Adding and editing records

The archive has one folder per language collection in `data/`, named by its ISO 639-3 code, such as `data/juy/`. Inside it, each recording session has its own folder: `r1`, `r2`, `r3`. You don't need to install anything to add records.

## Add an item

An item is one video or sound recording, with its subtitles.

1. Describe the recording in [Tome](https://tome.toolforge.org/) and download it with "Saved file (.json)".
2. Name the file after the language and the next free item number, such as `juy004.json`. Numbers run across the whole language, not per session.
3. Name each subtitle file after the item and its language code, such as `juy004.en.srt` and `juy004.or.srt`.
4. On GitHub, open the session's folder, such as `data/juy/r2/`. Click **Add file**, then **Upload files**, and add the JSON and the SRT files together.
5. Choose **Create a new branch** and open a pull request.

A new session gets a new folder with the next number, such as `data/juy/r3/`.

A check runs on the pull request. It says what's wrong if a field is missing, a number is skipped or a subtitle file has no matching item. Merge it when the check passes, and the site updates.

Keep the Tome file as Tome saved it. The site reads it as it is and offers the same file for download.

## Add a recording from the terminal

The archive publishes a recording first. The Internet Archive, Commons and Wikidata copies then cite it. Media files wait in `incoming/`, a folder next to the repo. They don't go into the repo.

1. Run `npm run new kip` for a new session, or `npm run new kip r1` to add to session r1. It prints the item's ID and its folder.
2. Put the recording and subtitles in that folder, named `kip002.mov` and `kip002.ne.srt`. Save the Tome record there as `kip002.json`.
3. Run `npm run ia kip002` to see what goes to the Internet Archive. Run `npm run ia kip002 go` to upload it as `osa-kip002`.
4. Run `npm run stage kip002`. It copies the record and subtitles into `data/`, adds the Internet Archive link and builds the site.
5. Run `npm run serve` to look at it, then `npm run push "add kip002"`.
6. Run `npm run webm kip002` to make the Commons copy. Open `data/kip/r2/kip002.json` in Tome and upload to Commons and Wikidata.
7. Save the record from Tome. Run `npm run update kip002` with the saved file's path, then `npm run push "kip002 updated"`.
8. Run `npm run ia kip002 update go` so the Internet Archive item lists the Commons and Wikidata links.

`npm run update` takes only the Commons file name, subtitle pages and Wikidata links from Tome's file. Add `all` to replace the whole record. Run it with no file later to pick up the Internet Archive's playable copy.

A new language code makes `data/<code>/collection.json` with the name from Wikidata. Fill in its place and map position.

## Identifiers

The file names set the identifiers, so don't rename or renumber anything once it's published.

- Collection: `osa-juy`
- Session: `osa-juy-r2`
- Item: `osa-juy002`
- File: `osa-juy002.webm`, `osa-juy002.en.srt`
- Other collection files: `osa-srb-x01`, in the order listed under `extras` in `collection.json`

## People and languages

Each person, language, variety and register gets a record in `authority/`. The ID is a type letter, five digits and a check character: `osa-p00001v` for a person, `osa-v00001k` for a language, variety or register.

1. Run `npm run mint p Q123` for a person or `npm run mint v Q123` for a language, with its Wikidata ID.
2. Open the new file in `authority/` and check every field. For a language, fill `level` (language, variety or register), `iso` and `glottolog`. For a variety or register, put its language's ID in `parent`.
3. Write the person's name as they write it themselves.

A record never gets a new ID, and a published ID is never reused.

## A new language

Add a folder named by the language code with a `collection.json`. Copy one from another collection and change the name, place and map position (`[latitude, longitude]`).

The variety comes from the Tome record's dialect field. Jaunpuri records have `"dialect": "Jaunpuri"` and sit under Garhwali (`gbm`).

## When Tome changes

Run `npm run tome-sync`. It reads Tome's current source, saves its field list in `schema/tome.json` and lists records saved with an older Tome or with fields Tome has dropped. If Tome renamed a field, add the old and new names to `schema/renames.json` and run `npm run tome-sync -- --write`.

## Update an item

1. On the archive, open the item's session page and download its Tome record (JSON).
2. Open that file in Tome. Make your changes, such as matching people and places with Wikidata, and download it again with "Saved file (.json)".
3. Rename the download to the item's name, such as `juy001.json`, and put it in place of the old one in the session's folder, such as `data/juy/r1/`.
4. If a subtitle changed, replace its file too, such as `juy001.en.srt`. A subtitle in a new language is a new file, such as `juy001.hi.srt`.
5. Check it, then publish it, as below.

Starting from the archive's own record keeps the fields Tome doesn't fill by itself, such as the poster and the speaker's photo under `extra`.

### In the terminal

From the repository's folder:

```
git --no-pager diff data/juy/r1/juy001.json
npm run validate
npm run build
npm run serve
```

The first line shows what changed: red lines are removed, green lines are added. `npm run validate` should end with "items checked". `npm run serve` shows the site at http://127.0.0.1:8765/; press Ctrl+C to stop it. Then publish:

```
git add data/juy/r1/
git commit -m "juy001 updated in Tome"
git push
```

### On GitHub

Open the session's folder, choose **Add file**, then **Upload files**, and add the renamed JSON and any subtitle files. Commit to a new branch and open a pull request. The check runs on it, and the site updates when it's merged.

## Using a record elsewhere

Each item lists its Tome record and subtitle files for download. To describe the same recording on Wikimedia Commons or another archive, open the record in Tome and upload from there.

## Word lists

Pronunciation recordings are kept as word lists in a collection's `words` folder, such as `data/ory/words/`. Each list has a JSON file describing it (`w1.json`) and a CSV of its words (`w1.csv`) with three columns: `n`, `word` and `file`. Add new words at the end with the next number, and never renumber, because each word's identifier is built from its number, such as `osa-ory-w1-00001`.

## Add a paper, talk or article

Entries live in four BibTeX files in `publications/`: `books-and-papers.bib`, `talks.bib`, `writing.bib` and `coverage.bib`. Use `writing.bib` for our pieces published elsewhere and `coverage.bib` for pieces by others. An export from Zenodo, Zotero or Google Scholar can be pasted in as it is. The build sorts entries and groups them by year, so their order in the file doesn't matter.

Give each entry a `title`, the authors in `author` (or `editor` for an edited book), and a `date` as `YYYY-MM-DD`. When only the year or month is known, `year` and `month` work too. The title links to the `doi` if there is one, otherwise to the `url`. Venues come from `eventtitle`, `journal`, `booktitle`, `howpublished` or `publisher`, in that order. Recordings and files go in `video`, `slides` and `pdf`. Any other link goes in `links` as `Label | address`, with a semicolon between two links. Write the names of organisations in double braces, such as `{{Global Voices}}`, so they aren't read as surnames.

## Write a blog post

Add a Markdown file to `posts/`. The file name becomes the address, so `posts/field-notes-juray.md` is published at `/blog/field-notes-juray/`. Start the file like this:

```
---
title: Field notes from the Juray recordings
date: 2026-12-01
authors: First1 Last1, First2 Last2
summary: One line for the list and the feed.
---
```

Write the post below it. Headings start with `##`, lists with `-`, quotes with `>`. Links and images use the usual Markdown form. Posts are listed first on the Publications page and in `/blog/feed.xml`.

## Publish from the terminal

From the repository's folder, run `npm run push "about page"` with your own short message in the quotes. It checks the records, builds the site, commits every change, brings in any changes made on GitHub and pushes. If the check fails, nothing is committed.

## Translate the interface

The website's menus, labels and headings are in the `strings` folder. English is in `en.json`, and Odia is in `or.json`.

Fill in the empty text next to each name. Keep anything in curly brackets, such as `{n}`, exactly as it is. Text left empty shows in English. A new language needs its own file with the same names as `en.json`. Its pages are built under its code, such as `/or/`.

## Translate names and record text

Titles, descriptions and the names of languages, people and places are in `strings/data/`. The build writes `en.json` from the records each time, so don't edit it. Odia goes in `or.json`.

Open `en.json` in Localise, then open `or.json` as the existing translation. Fill names from Wikidata fills the names Wikidata already has in Odia. Type the rest, then use Names for Wikidata to send the new names there through QuickStatements.

A title or description written in Odia in the Tome record is used first. Text left empty shows in English.
