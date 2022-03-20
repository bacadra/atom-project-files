'use babel'

import { CompositeDisposable, File } from 'atom'
import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
var CSON = require('cson')
import { chdir, cwd } from 'process';
var glob = require('glob')
const path = require('path');

export default class RecentListView {

  constructor(S) {
    this.S = S
    this.panel = null
    this.items = null

    this.selectListView = new SelectListView({

      items: [],

      maxResults: 50,

      emptyMessage: ' [NO MATCHES FOUND]',

      infoMessage: 'Press Enter, Alt-Enter or Shift-Enter',

      elementForItem: (item) => {
        li = document.createElement('li')
        li.classList.add('icon-line')
        for (pPath of item.paths) {
          pathBlock = document.createElement('div')
          this.highlightMatchesInElement(pPath, this.selectListView.getQuery(), pathBlock)
          if (this.S.addIconToElement) {
            this.S.addIconToElement(pathBlock, pPath)
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
        scoredItems = []
        for (let item of items) {
          item.score = 0
          for (pPath of item.paths) {
            item.score += this.fuzz.score(pPath, query)
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

    this.disposables.add(

      atom.commands.add(this.selectListView.element, {
        'project-list:open'  : () => this.didConfirmSelection('open'),
        'project-list:swap'  : () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
      }),

      atom.commands.add('atom-workspace', {
        'project-files:recent-toggle'   : () => this.toggle(),
      }),

      atom.config.observe('command-palette.useAlternateScoring', (value) => {
        this.useAlternateScoring = value
      }),

      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),

      atom.history.onDidChangeProjects( () => { if (this.items) {this.updateList()} })
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
    if (!this.items) { this.updateList () }
  }

  updateList() {
    this.parseProjectFile()
    this.selectListView.update({items:this.items})
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

  parseProjectFile() {
    this.items = []
    for (project of atom.history.getProjects()) {
      paths = []
      for (pPath of project.paths) {
        if (fs.existsSync(pPath)) { paths.push(pPath) }
      }
      if (paths.length>0) {
        this.items.push({
          title: (project.paths.map((pPath)=>path.basename(pPath))).join(' | '),
          paths: project.paths,
          group: 'Recent',
        })
      }
    }
  }

}
