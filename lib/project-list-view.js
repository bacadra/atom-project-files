'use babel'

import { CompositeDisposable, File } from 'atom'
import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
var CSON = require('cson')
import { chdir, cwd } from 'process';
var glob = require('glob')
const path = require('path');

export default class ProjectListView {

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
        li.classList.add('event', 'two-lines')

        matches = this.fuzz.match(item.text, this.selectListView.getQuery())
        total = 0

        priBlock = document.createElement('div')
        priBlock.classList.add('primary-line')

        if (item.tags) {
          for (tag of item.tags) {
            tagBlock = document.createElement('span')
            tagBlock.classList.add('tag')
            total += 1
            this.highlightMatchesInElement(tag, matches.map(x=>x-total), tagBlock)
            total += 1 + tag.length
            priBlock.appendChild(tagBlock)
          }
        }

        this.highlightMatchesInElement(item.title, matches.map(x=>x-total), priBlock)
        li.appendChild(priBlock)

        secBlock = document.createElement('div')
        secBlock.classList.add('secondary-line', 'icon-line')
        for (pPath of item.paths) {
          pathBlock = document.createElement('div')
          pathBlock.innerHTML = pPath
          if (this.S.addIconToElement) {
            this.S.addIconToElement(pathBlock, pPath)
          } else {
            pathBlock.classList.add('icon-file-directory')
          }
          secBlock.appendChild(pathBlock)
        }
        li.appendChild(secBlock)

        return li
      },

      didCancelSelection: () => { this.hide() },

      filter: (items, query) => {
        if (query.length===0) { return items }
        scoredItems = []
        for (let item of items) {
          item.score = this.fuzz.score(item.text, query)
          if (item.score<=0) { continue }
          scoredItems.push(item)
        }
        return scoredItems.sort((a,b) => b.score-a.score)
      },
    })

    this.selectListView.element.classList.add('command-palette')
    this.selectListView.element.classList.add('project-files')
    this.selectListView.element.classList.add('project-list')

    this.disposables = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add(this.selectListView.element, {
        'project-list:open'  : () => this.didConfirmSelection('open'),
        'project-list:swap'  : () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
      }),

      atom.commands.add('atom-workspace', {
        'project-files:projects-toggle' : () => this.toggle(),
        'project-files:projects-cache'  : () => this.updateList(),
        'project-files:projects-edit'   : () => this.edit(),
      }),

      atom.config.observe('command-palette.useAlternateScoring', (value) => {
        this.useAlternateScoring = value
      }),

      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),

      new File(this.getProjectFilePath()).onDidChange(() => {
        if (this.items) { this.updateList() }
      })
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
    item = this.selectListView.getSelectedItem()
    if (item) { this.hide() } else { return }

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

  getProjectFilePath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  edit() {
    atom.workspace.open(this.getProjectFilePath())
  }

  parseProjectFile() {
    cPath = this.getProjectFilePath()
    if (!fs.existsSync(cPath)) { return [] }
    this.items = CSON.parseFile(cPath)
    cwdZero = cwd()
    for (item of this.items) {
      if (item.subsQ) {
        for (pPath of item.paths) {
    			chdir(pPath)
          for (let fPath of glob.sync('*', {silent:true, nosort:true})) {
            if (fs.lstatSync(fPath).isDirectory()) {
              this.items.push(obj = {
                title: path.basename(fPath),
                tags: item.tags,
                paths: [path.join(pPath, fPath)],
              })
              obj.text = item.tags ? item.tags.map(x=>`#${x} `).join('') + item.title : item.title
            }
          }
        }
      }
      chdir(cwdZero)
      item.text = item.tags ? item.tags.map(x=>`#${x} `).join('') + item.title : item.title
    }
  }

}
