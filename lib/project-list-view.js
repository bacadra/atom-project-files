'use babel'
/** @jsx etch.dom */
const etch = require('etch')

import { CompositeDisposable, File } from 'atom'
import SelectListView from 'atom-select-list'
const zadeh = require("zadeh")
const CSON  = require('cson')
const glob  = require('glob')
const path  = require('path')
const fs    = require("fs")

export default class ProjectListView {

  constructor(S) {
    this.S = S
    this.panel = null
    this.items = []
    this.loadQ = true

    this.selectListView = new SelectListView({

      items: [],

      maxResults: 50,

      emptyMessage: <div class='empty-message'>No matches found</div>,

      elementForItem: (item, {selected, index, visible}) => {
        li = document.createElement('li')
        if (!visible) { return li }
        li.classList.add('event', 'two-lines')
        query = this.selectListView.getQuery()
        matches = query.length>0 ? zadeh.match(item.text, query) : []
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
        for (pPath of item.paths) {
          pathBlock = document.createElement('div')
          pathBlock.classList.add('icon-line')
          innerBlock = document.createElement('span')
          innerBlock.classList.add('secondary-line')
          innerBlock.innerHTML = pPath
          pathBlock.appendChild(innerBlock)
          if (this.useIcons && this.S.addIconToElement) {
            new Promise( (_, _) => {
              this.disposIcons.add(this.S.addIconToElement(pathBlock, pPath))
            })
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
          item.score = zadeh.score(item.text, query)
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
    this.disposIcons = new CompositeDisposable()

    this.disposables.add(

      atom.commands.add(this.selectListView.element, {
        'project-list:open'  : () => this.didConfirmSelection('open'),
        'project-list:swap'  : () => this.didConfirmSelection('swap'),
        'project-list:append': () => this.didConfirmSelection('append'),
        'project-list:paths' : () => this.didConfirmSelection('paths'),
      }),

      atom.commands.add('atom-workspace', {
        'project-files:projects-toggle': () => this.toggle(),
        'project-files:projects-cache' : () => { this.loadQ = true ; this.update() },
        'project-files:projects-edit'  : () => this.edit(),
      }),

      atom.config.observe('command-palette.preserveLastSearch', (value) => {
        this.preserveLastSearch = value
      }),

      atom.config.observe('command-palette.useIcons', (value) => {
        this.useIcons = value
      }),

      new File(this.getProjectFilePath()).onDidChange(() => { this.loadQ = true }),
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

    } else if (mode==='paths') {
      editor = atom.workspace.getActiveTextEditor()
      if (!editor) {
        atom.notifications.addError('Cannot insert path, because there is no active text editor')
        return
      }
      editor.insertText(item.paths.join('\n'))
    }
  }

  getProjectFilePath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  edit() {
    atom.workspace.open(this.getProjectFilePath())
  }

  cache() {
    cPath = this.getProjectFilePath()
    if (!fs.existsSync(cPath)) { return }
    this.items = CSON.parseFile(cPath)
    promises = []
    for (item of this.items) {
      this.createItemText(item)
      if (item.subsQ) {
        for (pPath of item.paths) {
          promises.push(this.globPromise(item.tags, pPath))
        }
      }
    }
    Promise.all(promises).then(() => {
      infoMessage = this.showKeystrokes ? ['Press ', <span class='keystroke'>Enter</span>, ', ', <span class='keystroke'>Alt-Enter</span>, ', ', <span class='keystroke'>Shift-Enter</span>, ' or ', <span class='keystroke'>Alt-V</span>] : null
      this.selectListView.update({items:this.items, loadingMessage:null, infoMessage: infoMessage})
      this.loadQ = false
    })
  }

  globPromise(tags, pPath) {
    return new Promise((resolve) => {
      glob('*/', {cwd:pPath, silent:true, nosort:true}, (err, match) => {
        for (let fPath of match) {
          item = {title:path.basename(fPath), tags:tags, paths:[path.join(pPath, fPath)]}
          this.createItemText(item)
          this.items.push(item)
        }
        resolve(err)
      })
    })
  }

  createItemText(item) {
    item.text = item.tags ? item.tags.map(x=>`#${x} `).join('') + item.title : item.title
  }

}
