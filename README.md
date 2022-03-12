# project-files

Config options `Preserve last search` and `Use alternate scoring` are used from `command-palette` package.


## Project list

The `Project List` is a window that makes it easier to navigate through projects. The project file is located in the atom configuration files under the name `project.cson`. The file must be a valid `.cson` file. The main file structure is a list of objects with the following keys:

* `group`: [string] name of the group the project is associated with
* `title`: [string] nazwa projektu
* `paths`: [list with strings] list of paths which describe the project
* `subsQ`: [bool] (optional) flag, possibility to include subfolders as projects

Example of `project.cson`:

    [
      {
        group: "bacadra"
        title: "py-bacadra"
        paths: [
          "c:\\bacadra\\"
        ]
      }
      {
        group: "projects"
        title: "projects"
        paths: [
          "c:\\projects\\"
          "d:\\projects\\"
        ],
        subsQ: true
      }
      {
        group: "projects"
        title: "samples"
        paths: [
          "c:\\samples\\"
        ]
      }
    ]


In `atom-workspace` space there are available commands:

* `project-files:prj-toggle`: (default `F10`) open projects list
* `project-files:prj-edit`: edit project list in atom


In `prj-list-view` view there are available keymap:

* `enter`: open new window with selected project
* `alt-enter`: close active window and open new with selected project
* `shift-enter`: append selected project to projects in active window


## Path list

The `Path list` is a window for navigating through files in open projects. It allows you to open a file inside the atom editor, externally, and to insert a file path in various variants.

In `atom-workspace` space there are available commands:

* `project-files:pth-toggle`: (default `ctrl-P`) open path list
* `project-files:pth-recache`: recache files

In `pth-list-view` view there are available keymap:

* `enter`: open selected file in atom
* `alt-enter`: open selected file externally
* `ctrl-p`: insert project path of selected file
* `ctrl-a`: insert absolute path of selected file
* `ctrl-r`: insert relative path of selected file to opened file
* `ctrl-n`: insert name of selected file


## Editor assistance

In `atom-text-editor` space there are available commands:

* `project-files:open-externally`: open active file externally


## TeX assistance

In `atom-text-editor[data-grammar~="latex"]` space there are available commands:

* `project-files:open-TeX-PDF-internally`: open associate `.pdf` file in atom
* `project-files:open-TeX-PDF-externally`: open associate `.pdf` file externally
