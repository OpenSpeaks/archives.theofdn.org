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

## Identifiers

The file names set the identifiers, so don't rename or renumber anything once it's published.

- Collection: `osa-juy`
- Session: `osa-juy-r2`
- Item: `osa-juy002`
- File: `osa-juy002.webm`, `osa-juy002.en.srt`
- Other collection files: `osa-srb-x01`, in the order listed under `extras` in `collection.json`

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

## Publish from the terminal

From the repository's folder, run `npm run push "about page"` with your own short message in the quotes. It checks the records, builds the site, commits every change and pushes it. If the check fails, nothing is committed.
