# A place commons

A small public repository where people share what they know about places, for [Orient](https://github.com/ragingapathy/orient) and anyone else who finds it useful. Observations are short, kind, and about places, not people: *"You can browse without buying."* *"There's seating where you can stay a while."*

This folder is a template. Copy it into a new repository of your own and it will:

- **check every contribution** when someone opens a pull request, and show you a plain table of what is being proposed;
- **rebuild one `snapshot.json`** each time you merge, so anyone can follow a single address.

You review and merge. Nothing is accepted automatically.

## Set it up

1. Create a new **public** repository on GitHub (for example `toledo-commons`) and copy the contents of this folder into it, including the hidden `.github` folder. Push it to `main`. The repository needs at least one commit before anyone can contribute.
2. In the repository's **Settings → Actions → General**, make sure workflows can run, and under *Workflow permissions* allow **Read and write permissions**, so the snapshot can be committed. (The workflow asks for `contents: write` and nothing else.)
3. If you protect `main` and require pull requests for every change, allow `github-actions[bot]` to bypass that rule, or the snapshot build cannot push. Otherwise leave protection off for the bot.
4. Edit the first paragraph above so it says what *your* commons is for and where it is (a city, a neighbourhood, a theme).
5. Tell people the repository name. In Orient, **Share this note** asks for it once.

To follow the commons in Orient, open **Field kit → Place commons** and paste

```
https://raw.githubusercontent.com/<owner>/<repo>/main/snapshot.json
```

## What happens to a contribution

1. Someone shares a note from Orient. Orient opens GitHub with one new file, `contributions/<id>.json`, filled in. They sign in as themselves and open a pull request. GitHub makes their fork.
2. The **Check contribution** workflow runs. It fails the check if the pull request touches anything except new files in `contributions/`, if a file is not a valid public bundle, or if it replaces an existing file. On the **Checks → Summary** tab you get a table: the place, a map link for its pin, and the observation in full.
3. It also **warns** (without failing) when an observation looks like it contains an email address or phone number, may describe a specific person, would replace an observation that is already published, or would move an existing place's pin.
4. You read it, and **merge** to accept or **close** to decline.
5. On merge, **Build snapshot** rewrites `snapshot.json` and commits it. Done.

The checking code runs from your `main` branch, not from the pull request, so a contribution cannot loosen the rules it is checked against.

## What to look for when reviewing

- **A place, not a person.** Nothing that identifies an employee, a customer, or a neighbour. Nothing you wouldn't say to their face on a sign.
- **Something useful and true as far as you can tell.** A first-hand observation (*"there are two outlets near the window"*), or a cited public source. Not an opinion about the owner.
- **A believable pin.** Open the map link. Contributors place their own pin, so it is a placement, not a verified entrance.
- **Permission.** Contributions are shared under CC BY 4.0, and the contributor confirmed they can share them.
- **If it replaces something.** The warning names the observation it replaces. Check it is plausibly the same contributor.

## Correcting or retiring something

Files in `contributions/` are never edited. To correct an observation, a contributor adds a **new** file that repeats its id with the new text. To take one back, they repeat it with `"status": "retired"`. Later files win, in the order they were merged. The snapshot keeps retired observations, marked as retired, so people who already accepted them see the change.

## Size

Orient reads files of up to 500 observations at a time. When the commons grows past about 450, the build splits it into `snapshot.json`, `snapshot-2.json`, and so on, and the summary says so. Each file is a complete bundle; follow whichever ones you want.

## Running the tools yourself

Node 18 or newer and git, nothing to install:

```
node tools/build-snapshot.cjs                    # rebuild the snapshot
node tools/validate.cjs contributions/x.json     # check a file
node tools/validate.cjs --base origin/main       # check what a branch changes
```

`tools/commons-data.js` is Orient's own validator, copied unchanged, so the checks match what Orient accepts. If Orient's protocol changes, copy the new version in.

## Licences

Contributions are shared under [CC BY 4.0](DATA-LICENSE.md). The tools in `tools/` come from Orient and are under the [PolyForm Noncommercial License 1.0.0](LICENSE).
