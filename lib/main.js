'use babel'

import { CompositeDisposable } from 'atom'
import PathManager     from './path-manager'
import PathListView    from './path-list-view'
import PathProvider    from './path-provider'
import ProjectListView from './project-list-view'
const { shell } = require('electron')
var fs = require("fs")

export default {

  config: {
    ignoredNames: {
      type: "array",
      default: ['**/.git/**', '**/__pycache__/**'],
      description: "List of string glob patterns. Files and directories matching these patterns will be ignored. This list is merged with the list defined by the core `Ignored Names` config setting. Example: `**/.git/**, **/__pycache__/**`."
    },
  },

  activate() {
    this.pathManager     = new PathManager (this)
    this.pathListView    = new PathListView(this)
    this.projectListView = new ProjectListView(this)

    this.disposables = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add('atom-text-editor', {
        'project-files:open-externally': () => this.openExternally(),
      }),

      atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
        'project-files:open-TeX-PDF-internally': () => this.texOpenPDF(1),
        'project-files:open-TeX-PDF-externally': () => this.texOpenPDF(2),
      }),

      atom.commands.add('.tree-view', {
        'project-files:open-externally': () => this.treeOpenExternally(),
      }),

    )

  },

  deactivate() {
    this.pathManager    .destroy()
    this.pathListView   .destroy()
    this.projectListView.destroy()
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

  treeOpenExternally() {
    selectedPaths = this.treeView.selectedPaths()
    for (let itemPath of selectedPaths) { shell.openPath(itemPath) }
  },

}
