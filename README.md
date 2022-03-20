# project-files

Config options `Preserve last search` and `Use alternate scoring` are used from `command-palette` package. The ignores are used from `core.ignoredNames`, `fuzzy-finder.ignoredNames` and `project-files.ignoredNames`.


## Project list

![project-list](https://github.com/bacadra/atom-project-files/raw/master/assets/project-list.png)

![recent-list](https://github.com/bacadra/atom-project-files/raw/master/assets/recent-list.png)

The Project list is a window that makes it easier to navigate through projects. The project file is located in the Atom configuration files under the name `project.cson`. The file must be a valid `.cson` file. The main file structure is a list of objects with the following keys:

* `title`: [string] name of the project
* `paths`: [list with strings] list of paths which describe the project
* `tags`: [list with strings] (optional) the project tags
* `subsQ`: [bool] (optional) flag, possibility to include subfolders as projects

Example of `project.cson`:

    [
      {
        title: "py-bacadra"
        paths: [
          "c:/bacadra/"
        ]
        tags: [
          "bacadra"
        ]
      }
      {
        title: "projects"
        paths: [
          "c:/projects/"
          "d:/projects/"
        ],
        tags: [
          "projects"
        ]
        subsQ: true
      }
      {
        title: "samples"
        paths: [
          "c:/samples/"
        ]
        tags: [
          "projects"
        ]
      }
    ]


In `atom-workspace` space there are available commands:

* `project-files:projects-toggle`: (default `F10`) open projects list
* `project-files:projects-edit`: edit project list in Atom
* `project-files:projects-cache`: manually cache to projects
* `project-files:recent-toggle`: (default `Alt+F10`) open recent projects

In `project-list` view there are available keymap:

* `Enter`: open new window with selected project
* `Alt-Enter`: close active window and open new with selected project
* `Shift-Enter`: append selected project to projects in active window


## Path list

![path-list](https://github.com/bacadra/atom-project-files/raw/master/assets/path-list.png)

The Path list is a window for navigating through files in open projects. It allows you to open a file inside the Atom editor, externally, and to insert a file path in various variants.

In `atom-workspace` space there are available commands:

* `project-files:paths-toggle`: (default `ctrl-P`) open path list
* `project-files:paths-cache`: manually cache the file

In `path-list` view there are available keymap:

* `Enter`: open selected file in Atom
* `Alt-Enter`: open selected file externally
* `Alt-Left`: open selected file by split left
* `Alt-Right`: open selected file by split right
* `Alt-Up`: open selected file by split up
* `Alt-Down`: open selected file by split down
* `Ctrl-P`: insert project path of selected file
* `Ctrl-A`: insert absolute path of selected file
* `Ctrl-R`: insert relative path of selected file to opened file
* `Ctrl-N`: insert name of selected file
* `Alt-0`: change separator in insert to system default
* `Alt-\`: change separator in insert to `\`
* `Alt-/`: change separator in insert to `/`


## Autocomplete paths

![autocomplete-paths](https://github.com/bacadra/atom-project-files/raw/master/assets/autocomplete-paths.png)

This package provides file path hinting options for the Autocomplete package. The paths are displayed relative to the currently active text editor, and the tooltip shows the full file path in the description.

To use a package, type `///` followed by a command that will be filtered with fuzzy-finder.

[autocomplete-plus](https://atom.io/packages/autocomplete-plus) required.


## Tree-view assistance

![tree-view-externally](https://github.com/bacadra/atom-project-files/raw/master/assets/tree-view-externally.png)

In `.tree-view` space there are available commands:

* `project-files:open-externally`: open active item externally


## Editor assistance

In `atom-text-editor` space there are available commands:

* `project-files:open-externally`: open active file externally


## TeX assistance

In `atom-text-editor[data-grammar~="latex"]` space there are available commands:

* `project-files:open-TeX-PDF-internally`: open `.tex` associate `.pdf` file
* `project-files:open-TeX-PDF-externally`: open `.tex` associate `.pdf` file externally


## Icon support

The `autocomplete-paths` and `path-list` can display icon of file/directory.

[file-icons](https://atom.io/packages/file-icons) required.
