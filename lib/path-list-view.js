'use babel'

import { CompositeDisposable } from 'atom'
import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
const { shell } = require('electron')
const path = require('path');

export default class PathListView {

  constructor(S) {
    this.S = S
    this.panel = null

    this.selectListView = new SelectListView({

      items: [],

      maxResults: 50,

      emptyMessage: ' [NO MATCHES FOUND]',

      elementForItem: (item) => {
        li = document.createElement('li')
        li.classList.add('event', 'two-lines')

        priBlock = document.createElement('div')
        priBlock.classList.add('primary-line')
        this.highlightMatchesInElement(item.fPath, this.selectListView.getQuery(), priBlock)
        if (this.S.addIconToElement) {
          priBlock.classList.add('icon')
          this.disposIcons.add(
            this.S.addIconToElement(priBlock, path.join(item.pPath, item.fPath))
          )
        }
        li.appendChild(priBlock)

        secBlock = document.createElement('div')
        secBlock.classList.add('secondary-line')
        secBlock.innerHTML = item.pPath
        li.appendChild(secBlock)

        return li
      },

      didCancelSelection: () => { this.hide() },

      filter: (items, query) => {
        if (query.length===0) { return items }
        scoredItems = []
        for (let item of items) {
          item.score = this.fuzz.score(item.fPath, query)
          if (item.score<=0) { continue }
          item.score = item.score/item.distance
          scoredItems.push(item)
        }
        return scoredItems.sort((a,b) => b.score-a.score)
      },
    })

    this.selectListView.element.classList.add('command-palette')
    this.selectListView.element.classList.add('project-files')
    this.selectListView.element.classList.add('path-list')

    this.disposables = new CompositeDisposable()
    this.disposIcons = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add(this.selectListView.element, {
        'path-list:open-in'       : () => this.didConfirmSelection('open-in'),
        'path-list:open-ex'       : () => this.didConfirmSelection('open-ex'),
        'path-list:show-in-folder': () => this.didConfirmSelection('show-in-folder'),
        'path-list:trash'         : () => this.didConfirmSelection('trash'),
        'path-list:split-left'    : () => this.didConfirmSelection('split', 'left' ),
        'path-list:split-right'   : () => this.didConfirmSelection('split', 'right'),
        'path-list:split-up'      : () => this.didConfirmSelection('split', 'up'   ),
        'path-list:split-down'    : () => this.didConfirmSelection('split', 'down' ),
        'path-list:insert-p'      : () => this.didConfirmSelection('insert-p'),
        'path-list:insert-a'      : () => this.didConfirmSelection('insert-a'),
        'path-list:insert-r'      : () => this.didConfirmSelection('insert-r'),
        'path-list:insert-n'      : () => this.didConfirmSelection('insert-n'),
        'path-list:default-slash' : () => { atom.config.set('project-files.insertSep', 0)},
        'path-list:forward-slash' : () => { atom.config.set('project-files.insertSep', 1)},
        'path-list:backslash'     : () => { atom.config.set('project-files.insertSep', 2)},
      }),

      atom.commands.add('atom-workspace', {
        'project-files:paths-toggle' : () => this.toggle(),
      }),

      atom.config.observe('command-palette.useAlternateScoring', (value) => {
        this.useAlternateScoring = value
      }),

      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),

      atom.config.observe('project-files.insertSep', (value) => {
        this.insertSep = value
      }),

    )

  }

  destroy() {
    this.disposables.dispose()
    this.selectListView.destroy()
  }

  show() {
    if (!this.panel) {this.panel = atom.workspace.addModalPanel({item: this.selectListView})}
    this.previouslyFocusedElement = document.activeElement
    this.update()
    if (this.preserveLastSearch) {
      this.selectListView.refs.queryEditor.selectAll()
    } else {
      this.selectListView.reset()
    }
    this.panel.show()
    this.selectListView.focus()
  }

  hide() {
    this.panel.hide()
    this.previouslyFocusedElement.focus()
  }

  toggle() {
    if (this.panel && this.panel.isVisible()) {
      this.hide()
    } else {
      this.show()
    }
  }

  update() {
    if (!this.S.pathManager.items) {
      this.disposIcons.dispose()
      this.selectListView.update({items:[], loadingMessage:'Indexing project\u2026'})
      this.S.pathManager.cache(() => {
        this.S.pathManager.viewQ = true
        this.selectListView.update({items:this.S.pathManager.items, loadingMessage:null, infoMessage: 'Press Enter, Alt-Enter, Ctrl-Enter, Ctrl-P, Ctrl-A, Ctrl-R, Ctrl-N, Alt+Left, Alt+Right, Alt+Up or Alt+Down'})
      })
    } else if (!this.S.pathManager.viewQ) {
      this.disposIcons.dispose()
      this.S.pathManager.viewQ = true
      this.selectListView.update({items:this.S.pathManager.items})
      this.S.pathManager.relativize()
    } else {
      this.S.pathManager.relativize()
    }
  }

  get fuzz () {
    return this.useAlternateScoring ? fuzzaldrinPlus : fuzzaldrin
  }

  highlightMatchesInElement(text, query, el) {
    const matches = this.fuzz.match(text, query)
    let matchedChars = []
    let lastIndex = 0
    for (const matchIndex of matches) {
      const unmatched = text.substring(lastIndex, matchIndex)
      if (unmatched) {
        if (matchedChars.length > 0) {
          const matchSpan = document.createElement('span')
          matchSpan.classList.add('character-match')
          matchSpan.textContent = matchedChars.join('')
          el.appendChild(matchSpan)
          matchedChars = []
        }
        el.appendChild(document.createTextNode(unmatched))
      }
      matchedChars.push(text[matchIndex])
      lastIndex = matchIndex + 1
    }
    if (matchedChars.length > 0) {
      const matchSpan = document.createElement('span')
      matchSpan.classList.add('character-match')
      matchSpan.textContent = matchedChars.join('')
      el.appendChild(matchSpan)
    }
    const unmatched = text.substring(lastIndex)
    if (unmatched) {
      el.appendChild(document.createTextNode(unmatched))
    }
  }

  didConfirmSelection(mode, side) {
    this.hide()
    item = this.selectListView.getSelectedItem()

    if (mode==='open-in') {
      aPath = path.join(item.pPath, item.fPath)
      if (fs.lstatSync(aPath).isFile()) {
        atom.workspace.open(aPath)
      }

    } else if (mode==='open-ex') {
      shell.openPath(path.join(item.pPath, item.fPath))

    } else if (mode==='show-in-folder') {
      shell.showItemInFolder(path.join(item.pPath, item.fPath))

    } else if (mode==='trash') {
      aPath = path.join(item.pPath, item.fPath)
      if (shell.moveItemToTrash(aPath)) {
        atom.notifications.addSuccess(`Item has been trashed\n"${aPath}"`)
      } else {
        atom.notifications.addError(`Item cannot be trashed\n "${aPath}"`)
      }

    } else if (mode==='split') {
      aPath = path.join(item.pPath, item.fPath)
      if (fs.lstatSync(aPath).isFile()) {
        atom.workspace.open(aPath, {split:side})
      }

    } else if (mode==='insert-p') {
      editor = atom.workspace.getActiveTextEditor()
      if (!editor) {return}
      editor.insertText(this.formatPath(item.fPath))

    } else if (mode==='insert-a') {
      editor = atom.workspace.getActiveTextEditor()
      if (!editor) {return}
      editor.insertText(this.formatPath(path.join(item.pPath, item.fPath)))

    } else if (mode==='insert-r') {
      editor = atom.workspace.getActiveTextEditor()
      if (!editor) {return}
      editorPath = editor.getPath()
      if (editorPath) {
        text = path.relative(path.join(editorPath, '..'), path.join(item.pPath, item.fPath))
      } else {
        text = item.fPath
      }
      editor.insertText(this.formatPath(text))

    } else if (mode==='insert-n') {
      editor = atom.workspace.getActiveTextEditor()
      if (!editor) {return}
      editor.insertText(this.formatPath(path.basename(item.fPath)))

    }
  }

  formatPath(fPath) {
    if (this.insertSep===0) {
      return fPath
    } else if (this.insertSep===1) {
      return fPath.replace(/\\/g, '/')
    } else if (this.insertSep===2) {
      return fPath.replace(/\//g, '\\')
    }
  }

}
