'use babel'

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
const path = require('path');
var fs = require("fs")
var CSON = require('cson')
var glob = require('glob')
import { chdir, cwd } from 'process';

export default class ProjListView {

  constructor () {
    this.selectListView = new SelectListView({

      initiallyVisibleItemCount: 10,

      items: [],

      filter: this.filter,

      emptyMessage: ' [NO MATCHES FOUND]',
      infoMessage: 'Press `enter`, `alt-enter` or `shift-enter`',

      elementForItem: (item, {index, selected, visible}) => {
        if (!visible) {
          return document.createElement("li")
        }

        const li = document.createElement('li')
        li.classList.add('event', 'two-lines')
        li.dataset.eventName = item.name

        const rightBlock = document.createElement('div')
        rightBlock.classList.add('pull-right')

        const leftBlock = document.createElement('div')
        const titleEl = document.createElement('div')
        titleEl.classList.add('primary-line')
        titleEl.title = item.name
        leftBlock.appendChild(titleEl)

        if (item.group) {
          matchSpan = document.createElement('span')
          matchSpan.classList.add('group')
          matchSpan.textContent = `${item.group}: `
          titleEl.appendChild(matchSpan)
        }

        const query = this.selectListView.getQuery()
        this.highlightMatchesInElement(item.fline, query, titleEl)

        let secondaryEl = document.createElement('div')
        secondaryEl.classList.add('secondary-line')

        if (typeof item.sline === 'string') {
          secondaryEl.appendChild(this.createDescription(item.sline, query))
        }

        if (Array.isArray(item.tags)) {
          const matchingTags = item.tags
            .map(t => [t, this.fuzz.score(t, query)])
            .filter(([t, s]) => s > 0)
            .sort((a, b) => a.s - b.s)
            .map(([t, s]) => t)

          if (matchingTags.length > 0) {
            secondaryEl.appendChild(this.createTags(matchingTags, query))
          }
        }

        leftBlock.appendChild(secondaryEl)

        li.appendChild(leftBlock)
        return li
      },

      didConfirmSelection: (item) => {
        this.hide()
        if (this.mode===1) {
          atom.open({pathsToOpen:item.paths})
        } else if (this.mode===2) {
          if (atom.project.getPaths().length===0) {
            atom.open({pathsToOpen:item.paths})
          } else {
            atom.open({pathsToOpen:item.paths})
            atom.close()
          }
        } else if (this.mode===3) {
          for (let path of item.paths) {
            atom.project.addPath(path, {mustExist:true})
          }
        }
      },

      didCancelSelection: () => {
        this.hide()
      },
    })

    atom.commands.add(this.selectListView.element, {
      'proj-list:mode-1': (event) => {
        this.mode = 1
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'proj-list:mode-2': (event) => {
        this.mode = 2
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
      'proj-list:mode-3': (event) => {
        this.mode = 3
        this.selectListView.confirmSelection();
        event.stopPropagation();
      },
    })

    this.selectListView.element.classList.add('command-palette')
    this.selectListView.element.classList.add('project-files')
    this.selectListView.element.classList.add('proj-list')
  }

  async destroy () {
    await this.selectListView.destroy()
  }


  toggle () {
    if (this.panel && this.panel.isVisible()) {
      return this.hide()
    } else {
      return this.show()
    }
  }

  show () {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({item: this.selectListView})
    }
    if (atom.config.get('project-files.preserveLastSearch')) {
      this.selectListView.refs.queryEditor.selectAll()
    } else {
      this.selectListView.reset()
    }
    this.activeElement = (document.activeElement === document.body) ? atom.views.getView(atom.workspace) : document.activeElement
    this.selectListView.update({items: this.parseProjectFile()})
    this.previouslyFocusedElement = document.activeElement
    this.panel.show()
    this.selectListView.focus()
  }


  hide () {
    this.panel.hide()
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }
  }


  async update (props) {
    if (props.hasOwnProperty('preserveLastSearch')) {
      this.preserveLastSearch = props.preserveLastSearch
    }

    if (props.hasOwnProperty('useAlternateScoring')) {
      this.useAlternateScoring = props.useAlternateScoring
    }
  }

  get fuzz () {
    return atom.config.get('project-files:useAlternateScoring') ? fuzzaldrinPlus : fuzzaldrin
  }

  highlightMatchesInElement (text, query, el) {
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

  filter = (items, query) => {
    if (query.length === 0) {
      return items
    }

    const scoredItems = []
    for (const item of items) {
      let score = this.fuzz.score(item.fline, query)
      if (item.tags) {
        score += item.tags.reduce(
          (currentScore, tag) => currentScore + this.fuzz.score(tag, query),
          0
        )
      }
      if (item.sline) {
        score += this.fuzz.score(item.sline, query)
      }

      if (score > 0) {
        scoredItems.push({item, score})
      }
    }
    scoredItems.sort((a, b) => b.score - a.score)
    return scoredItems.map((i) => i.item)
  }

  createDescription (sline, query) {
    const slineEl = document.createElement('div')

    // in case of overflow, give full contents on long hover
    slineEl.title = sline

    Object.assign(slineEl.style, {
      flexGrow: 1,
      flexShrink: 1,
      textOverflow: 'ellipsis',
      whiteSpace: 'pre-wrap',
      overflow: 'hidden'
    })
    this.highlightMatchesInElement(sline, query, slineEl)
    return slineEl
  }

  createTag (tagText, query) {
    const tagEl = document.createElement('li')
    Object.assign(tagEl.style, {
      borderBottom: 0,
      display: 'inline',
      padding: 0
    })
    this.highlightMatchesInElement(tagText, query, tagEl)
    return tagEl
  }

  createTags (matchingTags, query) {
    const tagsEl = document.createElement('ol')
    Object.assign(tagsEl.style, {
      display: 'inline',
      marginLeft: '4px',
      flexShrink: 0,
      padding: 0
    })

    const introEl = document.createElement('strong')
    introEl.textContent = 'matching tags: '

    tagsEl.appendChild(introEl)
    matchingTags.map(t => this.createTag(t, query)).forEach((tagEl, i) => {
      tagsEl.appendChild(tagEl)
      if (i < matchingTags.length - 1) {
        const commaSpace = document.createElement('span')
        commaSpace.textContent = ', '
        tagsEl.appendChild(commaSpace)
      }
    })
    return tagsEl
  }

  getProjectFilePath() {
    return `${atom.getConfigDirPath()}/projects.cson`
  }

  parseProjectFile() {
    data = CSON.parseFile(this.getProjectFilePath())

    cwdZero = cwd()
    for (item of data) {
      if (item.subsQ) {
        try {
          for (pPath of item.paths) {
      			chdir(pPath)
            for (let fPath of glob.sync('*', {silent:true, nosort:true})) {
              if (fs.lstatSync(fPath).isDirectory()) {
                data.push(item={
                  title: path.basename(fPath),
                  group: item.group,
                  paths: [path.join(pPath, fPath)]
                })
              }
            }
          }
        } catch (er) {}
      }
    }
    chdir(cwdZero)

    for (let item of data) {
      item.name  = item.title
      item.fline = item.title
      item.sline = item.paths.join('\n')
    }

    return data
  }

  edit() {
    atom.workspace.open(this.getProjectFilePath())
  }


}
