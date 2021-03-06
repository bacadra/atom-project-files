'use babel'
/** @jsx etch.dom */
const etch = require('etch')

import { CompositeDisposable } from 'atom'
import SelectListView from 'atom-select-list'
const zadeh = require("zadeh")
const path  = require('path')
const Diacritics = require('diacritic');

export default class RecentListView {

  constructor(S) {
    this.S = S
    this.panel = null
    this.items = []
    this.loadQ = true

    this.selectListView = new SelectListView({

      items: [],

      maxResults: 50,

      emptyMessage: <div class='empty-message'>No matches found</div>,

      elementForItem: (item) => {
        li = document.createElement('li')
        query = Diacritics.clean(this.selectListView.getQuery())
        for (pPath of item.paths) {
          pathBlock = document.createElement('div')
          pathBlock.classList.add('icon-line')
          matches = query.length>0 ? zadeh.match(Diacritics.clean(pPath), query) : []
          this.highlightMatchesInElement(pPath, matches, pathBlock)
          if (this.useIcons && this.S.addIconToElement) {
            this.disposIcons.add(
              this.S.addIconToElement(pathBlock, pPath)
            )
          } else {
            pathBlock.classList.add('icon-file-directory')
          }
          li.appendChild(pathBlock)
        }
        return li
      },

      didCancelSelection: () => { this.hide() },

      filter: (items, query) => {
        if (query.length===0) { return items }
        query = Diacritics.clean(query)
        scoredItems = []
        for (let item of items) {
          item.score = 0
          for (pPath of item.paths) {
            item.score += zadeh.score(Diacritics.clean(pPath), query)
          }
          if (item.score<=0) { continue }
          scoredItems.push(item)
        }
        return scoredItems.sort((a,b) => b.score-a.score)
      },
    })

    this.selectListView.element.classList.add('command-palette')
    this.selectListView.element.classList.add('project-files')
    this.selectListView.element.classList.add('recent-list')

    this.disposables = new CompositeDisposable()
    this.disposIcons = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add(this.selectListView.element, {
        'project-list:open'  : () => this.didConfirmSelection('open'),
        'project-list:swap'  : () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
      }),

      atom.commands.add('atom-workspace', {
        'project-files:recent-toggle'   : () => this.toggle(),
      }),

      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),

      atom.config.observe('command-palette.useIcons', (value) => {
        this.useIcons = value
      }),

      atom.history.onDidChangeProjects( () => { this.loadQ = true })
    )

    this.showKeystrokes = atom.config.get('project-files.showKeystrokes')
  }

  destroy() {
    this.disposables.dispose()
    this.disposIcons.dispose()
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
    if (this.loadQ) {
      this.disposIcons.dispose()
      this.selectListView.update({items:[], loadingMessage:[<span>{'Indexing project\u2026'}</span>, <span class='loading loading-spinner-tiny'/>], infoMessage:null})
      this.cache()
      this.loadQ = false
      infoMessage = this.showKeystrokes ? ['Press ', <span class='keystroke'>Enter</span>, ', ', <span class='keystroke'>Alt-Enter</span>, ' or ', <span class='keystroke'>Shift-Enter</span>] : null
      this.selectListView.update({items:this.items, loadingMessage:null, infoMessage: infoMessage})
    }
  }

  highlightMatchesInElement(text, matches, el) {
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

  didConfirmSelection(mode) {
    this.hide()
    item = this.selectListView.getSelectedItem()

    if (mode==='open') {
      atom.open({pathsToOpen:item.paths})

    } else if (mode==='swap') {
      atom.open({pathsToOpen:item.paths})
      atom.close()

    } else if (mode==='append') {
      for (let fPath of item.paths) {
        atom.project.addPath(fPath, {mustExist:true})
      }
    }
  }

  cache() {
    this.items = []
    for (project of atom.history.getProjects()) {
      this.items.push({
        title: (project.paths.map((pPath)=>path.basename(pPath))).join(' | '),
        paths: project.paths,
        group: 'Recent',
      })
    }
  }
}
