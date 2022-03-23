'use babel'

import { CompositeDisposable } from 'atom'
import PathManager     from './path-manager'
import PathListView    from './path-list-view'
import PathProvider    from './path-provider'
import ProjectListView from './project-list-view'
import RecentListView  from './recent-list-view'
const { shell } = require('electron')
var fs = require("fs")

export default {

  config: {
    ignoredNames: {
      title: 'List of string glob patterns',
      description: "Files and directories matching these patterns will be ignored. This list is merged with the list defined by the core `Ignored Names` config setting. Example: `**/.git/**, **/__pycache__/**`.",
      type: "array",
      default: ['**/.git/**', '**/.dev/**', '**/__pycache__/**'],
    },
    insertSep: {
      title: "Type of separator in file paths",
      description: 'Type of separator for the file path when copying or pasting',
      type: 'integer',
      default: 0,
      enum: [
        {value: 0, description: 'Default'},
        {value: 1, description: 'Forward Slash'},
        {value: 2, description: 'Backslash'},
      ],
    },
    autocompletePath: {
      title: "Enable or disable path autocomplete",
      description: 'Enable or disable autocomplete paths in the text editor. To call the hint, type `///` followed by the text that will be searched in the file-list using the fuzzy-finder',
      type: 'boolean',
      default: true,
    },
    unsupportedFiles: {
      description: "Many files cannot be displayed in human-readable form and the corresponding Atom editor plugins do not exist. In this case, the most convenient form of exploring file resources is to open it in an external editor.",
      type: "object",
      properties: {
        flag: {
          title: "Toggle state of external opener",
          description: "External opener can be turn ON/OFF depend like you want use it",
          type: 'boolean',
          default: false,
        },
        list: {
          title: "Unsupported extensions",
          description: "List of file extensions which will be open externally by default, without dot and separated by comma",
          type: "array",
          default: ['doc','docx','xls','xlsx','ppt','pptx','rtf','exe','dwg','sofistik','cdb','plb'],
        },
      },
    },
  },

  activate() {
    this.pathManager     = new PathManager (this)
    this.pathListView    = new PathListView(this)
    this.projectListView = new ProjectListView(this)
    this.recentListView  = new RecentListView(this)
    this.disposables     = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add('atom-text-editor', {
        'project-files:open-externally': () => this.openExternally(),
        'project-files:show-in-folder' : () => this.showInFolder(),
      }),

      atom.commands.add('.tree-view', {
        'project-files:open-externally': () => this.treeOpenExternally(),
        'project-files:show-in-folder' : () => this.treeShowInFolder(),
      }),

      atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
        'project-files:open-TeX-PDF-internally': () => this.texOpenPDF(1),
        'project-files:open-TeX-PDF-externally': () => this.texOpenPDF(2),
      }),

      atom.commands.add('atom-workspace', {
        'project-files:toggle-unsupported-flag': () => {
          atom.config.set('project-files.unsupportedFiles.flag', value = !atom.config.get('project-files.unsupportedFiles.flag'))
          if (value) {
            atom.notifications.addInfo('External opener has been activated')
          } else {
            atom.notifications.addInfo('External opener has been deactivated')
          }
        },
      }),

      atom.config.observe('project-files.unsupportedFiles.flag', (value) => {
        this.UF_flag = value
      }),

      atom.config.observe('project-files.unsupportedFiles.list', (value) => {
        this.UF_list = value
      }),

      atom.workspace.addOpener( (uri) => {
        if (!this.UF_flag) {
          return
        } else if (this.UF_list.includes(path.extname(uri).substring(1))) {
          return shell.openPath(uri)
        }
      }),
    )
  },

  deactivate() {
    this.pathManager    .destroy()
    this.pathListView   .destroy()
    this.projectListView.destroy()
    this.recentListView .destroy()
    this.disposables.dispose()
  },

  consumeElementIcons(func) {
    this.addIconToElement = func;
  },

  consumeClassIcons(object) {
    this.getIconClass = object.iconClassForPath;
  },

  consumeTreeView(object) {
    this.treeView = object
  },

  getProvider() {
    return new PathProvider(this)
  },

  openExternally() {
    editor = atom.workspace.getActiveTextEditor()
    shell.openPath(editor.getPath())
  },

  treeOpenExternally() {
    selectedPaths = this.treeView.selectedPaths()
    for (let itemPath of selectedPaths) { shell.openPath(itemPath) }
  },

  showInFolder() {
    editor = atom.workspace.getActiveTextEditor()
    shell.showItemInFolder(editor.getPath())
  },

  treeShowInFolder() {
    selectedPaths = this.treeView.selectedPaths()
    for (let itemPath of selectedPaths) { shell.showItemInFolder(itemPath) }
  },

  texOpenPDF(mode) {
    editor = atom.workspace.getActiveTextEditor()
    editorPath = editor.getPath()
    if (editorPath.slice(-4)!=='.tex') {
      atom.notifications.addError(`Can not open PDF file of "${editorPath}", because it is not .tex file`)
      return
    }
    pdfPath = editorPath.slice(0, -4).concat('.pdf')
    if (!fs.existsSync(pdfPath)) {
      atom.notifications.addError(`Can not open PDF file "${pdfPath}", because it does not exists`)
      return
    } else if (mode===1) {
        atom.workspace.open(pdfPath)
    } else if (mode===2) {
        shell.openPath(pdfPath)
    }
  },

}
