'use babel'
/** @jsx etch.dom */
const etch = require('etch')

import { CompositeDisposable } from 'atom'
import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
const { shell } = require('electron')
const path = require('path');
const { clipboard } = require('electron')
const fs = require("fs")

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
        'path-list:open'           : () => this.didConfirmSelection('open'),
        'path-list:open-externally': () => this.didConfirmSelection('open-externally'),
        'path-list:show-in-folder' : () => this.didConfirmSelection('show-in-folder'),
        'path-list:trash'          : () => this.didConfirmSelection('trash'),

        'path-list:split-left'     : () => this.didConfirmSelection('split', {side:'left' }),
        'path-list:split-right'    : () => this.didConfirmSelection('split', {side:'right'}),
        'path-list:split-up'       : () => this.didConfirmSelection('split', {side:'up'   }),
        'path-list:split-down'     : () => this.didConfirmSelection('split', {side:'down' }),

        'path-list:insert-p'       : () => this.didConfirmSelection('path', {op:'insert', rel:'p'}),
        'path-list:insert-a'       : () => this.didConfirmSelection('path', {op:'insert', rel:'a'}),
        'path-list:insert-r'       : () => this.didConfirmSelection('path', {op:'insert', rel:'r'}),
        'path-list:insert-n'       : () => this.didConfirmSelection('path', {op:'insert', rel:'n'}),

        'path-list:copy-p'         : () => this.didConfirmSelection('path', {op:'copy', rel:'p'}),
        'path-list:copy-a'         : () => this.didConfirmSelection('path', {op:'copy', rel:'a'}),
        'path-list:copy-r'         : () => this.didConfirmSelection('path', {op:'copy', rel:'r'}),
        'path-list:copy-n'         : () => this.didConfirmSelection('path', {op:'copy', rel:'n'}),

        'path-list:default-slash'  : () => {
          atom.config.set('project-files.insertSep', 0)
          atom.notifications.addSuccess('Separator has been changed to default')
        },
        'path-list:forward-slash'  : () => {
          atom.config.set('project-files.insertSep', 1)
          atom.notifications.addSuccess('Separator has been changed to forward slash')
        },
        'path-list:backslash'      : () => {
          atom.config.set('project-files.insertSep', 2)
          atom.notifications.addSuccess('Separator has been changed to backslash')
        },

        'path-list:query-item'     : () => this.updateQueryFromItem(),
        'path-list:query-selection': () => this.updateQueryFromSelection(),
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
    this.disposIcons.dispose()
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
    if (this.S.pathManager.loadQ) {
      this.disposIcons.dispose()
      this.selectListView.update({items:[], loadingMessage:[<span>{'Indexing project\u2026'}</span>, <span class='loading loading-spinner-tiny'/>], infoMessage:null})
      this.S.pathManager.cache(() => {
        this.S.pathManager.viewQ = true
        this.selectListView.update({items:this.S.pathManager.items, loadingMessage:null, infoMessage: 'Press [ |Alt|Ctrl]-Enter, Alt+[Left|Right|Up|Down], Ctrl-[C|V] Ctrl-[P|A|R|N] or Alt-[0|/|\\|Q|S]'})
      })
    } else if (!this.S.pathManager.viewQ) {
      this.disposIcons.dispose()
      this.S.pathManager.viewQ = true
      this.S.pathManager.relativize()
      this.selectListView.update({items:this.S.pathManager.items})
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

  didConfirmSelection(mode, params) {
    item = this.selectListView.getSelectedItem()
    if (item) { this.hide() } else { return }
    editor = null

    if (mode==='open') {
      aPath = path.join(item.pPath, item.fPath)
      if (fs.lstatSync(aPath).isFile()) {
        atom.workspace.open(aPath)
      } else {
        atom.notifications.addError(`Cannot open "${aPath}", because it's a dir`)
      }

    } else if (mode==='open-externally') {
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
        atom.workspace.open(aPath, {split:params.side})
      } else {
        atom.notifications.addError(`Cannot open "${aPath}", because it's a dir`)
      }

    } else if (mode==='path') {

      if (params.rel==='p') {
        text = item.fPath

      } else if  (params.rel==='a') {
        text = path.join(item.pPath, item.fPath)

      } else if  (params.rel==='r') {
        editor = atom.workspace.getActiveTextEditor()
        if (!editor) {
          atom.notifications.addError('Cannot insert path, because there is no active text editor')
          return
        }
        editorPath = editor.getPath()
        if (editorPath) {
          text = path.relative(path.dirname(editorPath), path.join(item.pPath, item.fPath))
        } else {
          text = item.fPath
        }

      } else if  (params.rel==='n') {
        text = path.basename(item.fPath)
      }

      text = this.formatSep(text)

      if (params.op==='insert') {
        if (!editor) {
          editor = atom.workspace.getActiveTextEditor()
        }
        if (!editor) {
          atom.notifications.addError('Cannot insert path, because there is no active text editor')
          return
        }
        editor.insertText(text)
      } else if (params.op==='copy') {
        clipboard.writeText(text)
      }
    }
  }

  updateQueryFromItem() {
    text = this.selectListView.getSelectedItem().fPath
    this.selectListView.refs.queryEditor.setText(text)
    this.selectListView.refs.queryEditor.setSelectedBufferRange([[0, 0], [0, text.length]])
  }

  updateQueryFromSelection() {
    const editor = atom.workspace.getActiveTextEditor()
    if (!editor) { return }
    const text = editor.getSelectedText()
    if (/\n/m.test(text)) { return }
    this.selectListView.refs.queryEditor.setText(text)
    this.selectListView.refs.queryEditor.setSelectedBufferRange([[0, 0], [0, text.length]])
  }

  formatSep(text) {
    if (this.insertSep===0) {
      return text
    } else if (this.insertSep===1) {
      return text.replace(/\\/g, '/')
    } else if (this.insertSep===2) {
      return text.replace(/\//g, '\\')
    }
  }

}
