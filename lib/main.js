'use babel'

import { CompositeDisposable } from 'atom'
import PrjListView from './prj-list-view'
import PthListView from './pth-list-view'
const { shell } = require('electron')

export default {
  config: {
    localWeight: {
      title: 'The weight of relative coherence',
      description: 'If file is far from active editor, then it score are lowered by length of relative path elements multiply by this factor',
      type: 'number',
      default: 0.2,
      minimum: 0.0,
      maximum: 1.0,
    },
    ignoredNames: {
      type: "array",
      default: ['.*', '_*'],
      description: "List of string glob patterns. Files and directories matching these patterns will be ignored. This list is merged with the list defined by the core `Ignored Names` config setting. Example: `.git, _*, Thumbs.db`."
    },
  },


  activate (_state) {
    this.disposables = new CompositeDisposable()

    this.prjListView = new PrjListView()
    this.pthListView = new PthListView()

    this.disposables.add(atom.commands.add('atom-workspace', {
      'project-files:prj-toggle' : () => this.prjListView.toggle(),
      'project-files:prj-edit'   : () => this.prjListView.edit(),
      'project-files:pth-toggle' : () => this.pthListView.toggle(),
      'project-files:pth-recache': () => {
        this.pthListView.cache()
        this.pthListView.toggle()
      },
    }))

    this.disposables.add(atom.commands.add('atom-text-editor', {
      'project-files:open-externally': () => this.openExternally(),
    }))

    this.disposables.add(atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
      'project-files:open-TeX-PDF-internally': () => this.texOpenPDF(1),
      'project-files:open-TeX-PDF-externally': () => this.texOpenPDF(2),
    }))
  },


  deactivate () {
    this.disposables.dispose()
    this.prjListView.destroy()
    this.pthListView.destroy()
  },


  consumeElementIcons(func) {
    this.prjListView.addIconToElement = func;
  	this.pthListView.addIconToElement = func;
  },


  openExternally() {
    editor = atom.workspace.getActiveTextEditor()
    pathSrc = editor.buffer.file.path
    this.openExternal(pathSrc)
  },


  texOpenPDF(mode) {
    editor = atom.workspace.getActiveTextEditor()
    pth = editor.buffer.file.path
    if (pth.slice(-4)!=='.tex') {
      atom.notifications.addError(`Can not open PDF file of "${pth}", because it is not .tex file`)
      return
    }
    pth = pth.slice(0, -4).concat('.pdf')
    if (!fs.existsSync(pth)) {
      atom.notifications.addError(`Can not open PDF file "${pth}", because it does not exists`)
      return
    } else if (mode===1) {
        atom.workspace.open(pth)
    } else if (mode===2) {
        shell.openPath(pth)
    }
  },
};
